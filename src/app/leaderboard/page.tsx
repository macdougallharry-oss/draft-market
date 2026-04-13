"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SiteNav } from "@/components/site-nav";
import { createClient } from "@/lib/supabase/client";
import { geckoIdForSymbol } from "@/lib/coingecko-ids";
import {
  totalLiveScore,
  type ScorePick,
} from "@/lib/scoring";
import { getISOWeekKey, weeklyPrizeGbpLabel } from "@/lib/week";

type DbPickRow = {
  user_id: string;
  coin_symbol: string;
  direction: "long" | "short";
  confidence: number;
  entry_price: number;
};

type LeaderRow = {
  userId: string;
  displayName: string;
  score: number;
  rank: number;
};

type ProfileRow = {
  id: string;
  username: string;
};

function normalizeSymbol(s: string) {
  return s.trim().toUpperCase();
}

function fallbackDisplayName(userId: string) {
  const compact = userId.replace(/-/g, "");
  return `Player ${compact.slice(0, 8)}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Stagger leaderboard CoinGecko calls vs picks page to reduce rate limits. */
const LEADERBOARD_COINGECKO_DELAY_MS = 3000;

/**
 * Fetches simple USD prices; never throws. Returns {} on network errors, HTTP
 * errors, rate limits (429), or invalid JSON.
 */
async function fetchGeckoSimpleUsdSafe(
  geckoIds: string[],
): Promise<Record<string, number>> {
  if (geckoIds.length === 0) return {};
  await delay(LEADERBOARD_COINGECKO_DELAY_MS);
  const idParam = geckoIds.map((id) => encodeURIComponent(id)).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${idParam}&vs_currencies=usd`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 429) {
      console.warn("[leaderboard] CoinGecko rate limited (429)");
      return {};
    }
    if (!res.ok) {
      console.warn("[leaderboard] CoinGecko HTTP", res.status);
      return {};
    }
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      console.warn("[leaderboard] CoinGecko invalid JSON");
      return {};
    }
    if (typeof data !== "object" || data === null) return {};
    const record = data as Record<string, { usd?: number }>;
    const out: Record<string, number> = {};
    for (const id of geckoIds) {
      const v = record[id]?.usd;
      if (typeof v === "number" && Number.isFinite(v) && v > 0) {
        out[id] = v;
      }
    }
    return out;
  } catch (e) {
    console.warn("[leaderboard] CoinGecko fetch failed", e);
    return {};
  }
}

function buildPriceBySymbol(
  symbols: Iterable<string>,
  priceByGeckoId: Record<string, number>,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const symRaw of symbols) {
    const sym = normalizeSymbol(symRaw);
    const gid = geckoIdForSymbol(sym);
    if (!gid) continue;
    const p = priceByGeckoId[gid];
    if (p != null && Number.isFinite(p)) m.set(sym, p);
  }
  return m;
}

function picksLoadErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return "Could not load this week's picks. Check your connection and try again.";
}

export default function LeaderboardPage() {
  const weekKey = useMemo(() => getISOWeekKey(), []);
  const prizeLabel = weeklyPrizeGbpLabel();

  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [livePricesNote, setLivePricesNote] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLivePricesNote(null);

    try {
      const supabase = createClient();
      const { weekNumber, year } = weekKey;

      let user: { id: string } | null = null;
      try {
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        user = data.user;
      } catch (e) {
        console.error("[leaderboard] auth", e);
        setCurrentUserId(null);
        setRows([]);
        setError(
          "We could not verify your session. Refresh the page or sign in again.",
        );
        return;
      }

      setCurrentUserId(user?.id ?? null);

      if (!user) {
        setRows([]);
        return;
      }

      let allPicks: DbPickRow[];
      try {
        const { data: pickData, error: pickError } = await supabase
          .from("picks")
          .select("user_id, coin_symbol, direction, confidence, entry_price")
          .eq("week_number", weekNumber)
          .eq("year", year);

        if (pickError) throw pickError;
        allPicks = (pickData as DbPickRow[]) ?? [];
      } catch (e) {
        console.error("[leaderboard] picks query", e);
        setRows([]);
        setError(picksLoadErrorMessage(e));
        return;
      }

      if (allPicks.length === 0) {
        setRows([]);
        return;
      }

      const userIds = [...new Set(allPicks.map((p) => p.user_id))];

      const usernameByUserId = new Map<string, string>();
      try {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", userIds);

        if (profileError) {
          console.warn("[leaderboard] profiles skipped", profileError);
        } else {
          for (const row of (profileData as ProfileRow[]) ?? []) {
            usernameByUserId.set(row.id, row.username);
          }
        }
      } catch (e) {
        console.warn("[leaderboard] profiles fetch", e);
      }

      const symbolSet = new Set<string>();
      for (const p of allPicks) {
        symbolSet.add(normalizeSymbol(p.coin_symbol));
      }

      const geckoIds = [
        ...new Set(
          [...symbolSet]
            .map((s) => geckoIdForSymbol(s))
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      const priceByGeckoId = await fetchGeckoSimpleUsdSafe(geckoIds);
      const priceBySymbol = buildPriceBySymbol(symbolSet, priceByGeckoId);
      if (geckoIds.length > 0 && priceBySymbol.size === 0) {
        setLivePricesNote(
          "Live prices unavailable, showing scores based on entry prices",
        );
      }

      try {
        const byUser = new Map<string, DbPickRow[]>();
        for (const p of allPicks) {
          const uid = p.user_id;
          if (!byUser.has(uid)) byUser.set(uid, []);
          byUser.get(uid)!.push(p);
        }

        const scored: { userId: string; score: number }[] = [];
        for (const [userId, picks] of byUser) {
          const scorePicks: ScorePick[] = picks.map((r) => ({
            coin_symbol: r.coin_symbol,
            direction: r.direction,
            confidence: r.confidence,
            entry_price: Number(r.entry_price),
          }));
          const score = totalLiveScore(scorePicks, priceBySymbol);
          scored.push({ userId, score });
        }

        scored.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.userId.localeCompare(b.userId);
        });

        const leaderRows: LeaderRow[] = scored.map((s, i) => ({
          userId: s.userId,
          displayName:
            usernameByUserId.get(s.userId) ?? fallbackDisplayName(s.userId),
          score: s.score,
          rank: i + 1,
        }));

        setRows(leaderRows);
      } catch (e) {
        console.error("[leaderboard] scoring", e);
        setRows([]);
        setError(
          "Something went wrong while calculating scores. Please try again.",
        );
      }
    } catch (e) {
      console.error("[leaderboard] unexpected", e);
      setRows([]);
      setError(
        "Something went wrong loading the leaderboard. Please refresh and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [weekKey]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-4 sm:px-6 sm:py-5">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
            Week {weekKey.weekNumber} prize
          </p>
          <p className="mt-1 font-sans text-2xl font-semibold tracking-tight sm:text-3xl">
            <span className="font-mono text-accent">{prizeLabel}</span>{" "}
            <span className="text-foreground/90">
              Week {weekKey.weekNumber} · {weekKey.year} pool
            </span>
          </p>
          <p className="mt-2 max-w-xl font-mono text-xs text-muted">
            Paid to the top weekly score. Rankings use live CoinGecko USD
            prices vs each player&apos;s locked entry prices.
          </p>
        </div>

        <div className="mt-8">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Leaderboard
          </h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-wider text-muted">
            Week {weekKey.weekNumber} · {weekKey.year} · ranked by fantasy
            score
          </p>
        </div>

        {loading ? (
          <div
            className="mt-6 rounded-lg border border-[color:var(--border)] bg-white/[0.02] px-4 py-12 text-center"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <p className="font-mono text-sm text-muted">
              <span className="inline-block animate-pulse">
                Loading leaderboard…
              </span>
            </p>
            <p className="mt-2 font-mono text-[11px] text-muted/80">
              Fetching picks and live prices
            </p>
          </div>
        ) : null}

        {!loading && error ? (
          <p
            className="mt-6 rounded-lg border border-accent-red/40 bg-accent-red/10 px-4 py-3 font-mono text-sm leading-relaxed text-accent-red"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {!loading && livePricesNote && !error ? (
          <p
            className="mt-4 rounded-lg border border-accent/35 bg-accent/10 px-4 py-2.5 font-mono text-xs leading-relaxed text-muted"
            role="status"
          >
            {livePricesNote}
          </p>
        ) : null}

        {!loading ? (
          <div className="mt-6 overflow-x-auto rounded-lg border border-[color:var(--border)]">
            <table className="w-full min-w-[480px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[color:var(--border)] font-mono text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-medium">Rank</th>
                  <th className="px-4 py-3 font-medium">Player</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Prize</th>
                </tr>
              </thead>
              <tbody>
                {!currentUserId ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center font-mono text-sm text-muted"
                    >
                      Sign in to view the leaderboard.
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center font-mono text-sm text-muted"
                    >
                      No rankings to show until data loads successfully.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center font-mono text-sm text-muted"
                    >
                      No locked picks for week {weekKey.weekNumber},{" "}
                      {weekKey.year} yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const isYou =
                      currentUserId != null && row.userId === currentUserId;
                    const topRank = row.rank === 1;
                    return (
                      <tr
                        key={row.userId}
                        className={
                          isYou
                            ? "border-t border-accent/30 bg-accent/15 text-foreground ring-1 ring-inset ring-accent/40"
                            : topRank
                              ? "border-t border-white/5 bg-accent/10"
                              : "border-t border-white/5 bg-white/[0.02]"
                        }
                      >
                        <td className="px-4 py-3 font-mono text-sm font-bold tabular-nums">
                          {row.rank}
                        </td>
                        <td className="px-4 py-3 font-sans text-sm font-medium">
                          {row.displayName}
                          {isYou ? (
                            <span className="ml-2 font-mono text-[10px] uppercase tracking-wide text-accent">
                              You
                            </span>
                          ) : null}
                        </td>
                        <td
                          className={`px-4 py-3 font-mono text-sm font-bold tabular-nums ${
                            topRank ? "text-accent" : "text-foreground"
                          }`}
                        >
                          {row.score >= 0 ? "+" : ""}
                          {row.score.toFixed(2)}
                        </td>
                        <td
                          className={`px-4 py-3 font-mono text-sm font-bold ${
                            topRank ? "text-accent" : "text-muted"
                          }`}
                        >
                          {topRank ? prizeLabel : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </main>
    </div>
  );
}
