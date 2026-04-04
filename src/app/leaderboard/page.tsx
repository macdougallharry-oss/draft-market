"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SiteNav } from "@/components/site-nav";
import { createClient } from "@/lib/supabase/client";
import { geckoIdForSymbol } from "@/lib/coingecko-ids";
import {
  totalLiveScore,
  type ScorePick,
} from "@/lib/scoring";
import { getISOWeekKey } from "@/lib/week";

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

async function fetchGeckoSimpleUsd(
  geckoIds: string[],
): Promise<Record<string, number>> {
  if (geckoIds.length === 0) return {};
  const idParam = geckoIds.map((id) => encodeURIComponent(id)).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${idParam}&vs_currencies=usd`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const data = (await res.json()) as Record<string, { usd?: number }>;
  const out: Record<string, number> = {};
  for (const id of geckoIds) {
    const v = data[id]?.usd;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      out[id] = v;
    }
  }
  return out;
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

export default function LeaderboardPage() {
  const weekKey = useMemo(() => getISOWeekKey(), []);

  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { weekNumber, year } = weekKey;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? null);

    if (!user) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      const { data: pickData, error: pickError } = await supabase
        .from("picks")
        .select("user_id, coin_symbol, direction, confidence, entry_price")
        .eq("week_number", weekNumber)
        .eq("year", year);

      if (pickError) throw pickError;

      const allPicks = (pickData as DbPickRow[]) ?? [];
      if (allPicks.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const userIds = [...new Set(allPicks.map((p) => p.user_id))];
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", userIds);
      if (profileError) throw profileError;
      const usernameByUserId = new Map<string, string>();
      for (const row of (profileData as ProfileRow[]) ?? []) {
        usernameByUserId.set(row.id, row.username);
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

      const priceByGeckoId = await fetchGeckoSimpleUsd(geckoIds);
      const priceBySymbol = buildPriceBySymbol(symbolSet, priceByGeckoId);

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
      console.error("[leaderboard] load failed", e);
      setRows([]);
      setError(
        e instanceof Error
          ? e.message
          : "Could not load leaderboard. Try again later.",
      );
    } finally {
      setLoading(false);
    }
  }, [weekKey.weekNumber, weekKey.year]);

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
            <span className="font-mono text-accent">£50</span>{" "}
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

        {error ? (
          <p
            className="mt-6 rounded-lg border border-accent-red/40 bg-accent-red/10 px-4 py-3 font-mono text-sm text-accent-red"
            role="alert"
          >
            {error}
          </p>
        ) : null}

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
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center font-mono text-sm text-muted"
                  >
                    Loading leaderboard…
                  </td>
                </tr>
              ) : !currentUserId ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center font-mono text-sm text-muted"
                  >
                    Sign in to view the leaderboard.
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
                        {topRank ? "£50" : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
