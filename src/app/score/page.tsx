"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SiteNav } from "@/components/site-nav";
import { geckoIdForSymbol } from "@/lib/coingecko-ids";
import { createClient } from "@/lib/supabase/client";
import { calculateScore, type ScorePick } from "@/lib/scoring";
import { getISOWeekKey, isPickWindowOpen } from "@/lib/week";

const BG = "#080c0a";
const FG = "#e8f0ec";
const GREEN = "#00ff64";
const RED = "#ff4d6d";
const MUTED = "#6b7f72";

type PickRow = {
  id: string;
  coin_symbol: string;
  coin_name: string;
  direction: "long" | "short";
  confidence: number;
  entry_price: number;
};

function normalizeSymbol(s: string) {
  return s.trim().toUpperCase();
}

function formatPrice(n: number) {
  if (n >= 1000)
    return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n >= 1)
    return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 4 })}`;
}

function pctSinceEntry(
  entry: number,
  current: number | null,
): number | null {
  if (current == null || !Number.isFinite(entry) || entry === 0) return null;
  return ((current - entry) / entry) * 100;
}

async function fetchGeckoPrices(
  geckoIds: string[],
): Promise<Record<string, number>> {
  if (geckoIds.length === 0) return {};
  const idParam = geckoIds.map((id) => encodeURIComponent(id)).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${idParam}&vs_currencies=usd`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return {};
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return {};
  }
  if (typeof data !== "object" || data === null) return {};
  const record = data as Record<string, { usd?: number }>;
  const out: Record<string, number> = {};
  for (const id of geckoIds) {
    const v = record[id]?.usd;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[id] = v;
  }
  return out;
}

function pricesBySymbolFromGecko(
  rows: PickRow[],
  priceByGeckoId: Record<string, number>,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const sym = normalizeSymbol(r.coin_symbol);
    const gid = geckoIdForSymbol(sym);
    if (!gid) continue;
    const p = priceByGeckoId[gid];
    if (p != null && Number.isFinite(p)) m.set(sym, p);
  }
  return m;
}

export default function ScorePage() {
  const weekKey = useMemo(() => getISOWeekKey(), []);

  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [picks, setPicks] = useState<PickRow[]>([]);
  const [priceBySymbol, setPriceBySymbol] = useState<Map<string, number>>(
    () => new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [picksError, setPicksError] = useState<string | null>(null);
  const [pickWindowOpen, setPickWindowOpen] = useState(() =>
    isPickWindowOpen(),
  );

  const loadPricesForPicks = useCallback(async (rows: PickRow[]) => {
    if (rows.length === 0) {
      setPriceBySymbol(new Map());
      return;
    }
    const geckoIds = [
      ...new Set(
        rows
          .map((r) => geckoIdForSymbol(normalizeSymbol(r.coin_symbol)))
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    try {
      const raw = await fetchGeckoPrices(geckoIds);
      setPriceBySymbol(pricesBySymbolFromGecko(rows, raw));
    } catch {
      setPriceBySymbol(new Map());
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPickWindowOpen(isPickWindowOpen());
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function loadPicks() {
      setLoading(true);
      setPicksError(null);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setAuthReady(true);
      setUserId(user?.id ?? null);
      if (!user) {
        setPicks([]);
        setPriceBySymbol(new Map());
        setLoading(false);
        return;
      }

      const { weekNumber, year } = weekKey;
      const { data, error } = await supabase
        .from("picks")
        .select("id, coin_symbol, coin_name, direction, confidence, entry_price")
        .eq("user_id", user.id)
        .eq("week_number", weekNumber)
        .eq("year", year)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      if (error) {
        console.error("[score] picks", error);
        setPicks([]);
        setPicksError("Could not load your picks. Try again later.");
        setLoading(false);
        return;
      }

      const rows = (data as PickRow[]) ?? [];
      setPicks(rows);
      await loadPricesForPicks(rows);
      if (!cancelled) setLoading(false);
    }

    loadPicks();
    return () => {
      cancelled = true;
    };
  }, [weekKey, loadPricesForPicks]);

  useEffect(() => {
    if (picks.length === 0) return;
    const id = window.setInterval(() => {
      loadPricesForPicks(picks);
    }, 60_000);
    return () => window.clearInterval(id);
  }, [picks, loadPricesForPicks]);

  const totalScore = useMemo(() => {
    let sum = 0;
    for (const r of picks) {
      const sym = normalizeSymbol(r.coin_symbol);
      const live = priceBySymbol.get(sym) ?? null;
      const pick: ScorePick = {
        coin_symbol: r.coin_symbol,
        direction: r.direction,
        confidence: r.confidence,
        entry_price: Number(r.entry_price),
      };
      if (live != null) sum += calculateScore(pick, live);
    }
    return Math.round(sum * 100) / 100;
  }, [picks, priceBySymbol]);

  return (
    <div
      className="min-h-screen font-sans"
      style={{ backgroundColor: BG, color: FG }}
    >
      <SiteNav />

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <p
            className="font-mono text-xs uppercase tracking-[0.2em]"
            style={{ color: GREEN }}
          >
            My performance
          </p>
          {picks.length > 0 ? (
            <span
              className="rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider"
              style={{
                borderColor: `${GREEN}55`,
                backgroundColor: `${GREEN}18`,
                color: GREEN,
              }}
            >
              Picks locked
            </span>
          ) : null}
        </div>

        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Week {weekKey.weekNumber} · Your Score
        </h1>

        {!authReady || loading ? (
          <p className="mt-8 font-mono text-sm" style={{ color: MUTED }}>
            Loading…
          </p>
        ) : !userId ? (
          <p className="mt-8 font-mono text-sm" style={{ color: MUTED }}>
            Sign in to see your score.
          </p>
        ) : picksError ? (
          <p
            className="mt-8 rounded border px-4 py-3 font-mono text-sm"
            style={{
              borderColor: `${RED}55`,
              backgroundColor: `${RED}12`,
              color: RED,
            }}
            role="alert"
          >
            {picksError}
          </p>
        ) : picks.length === 0 ? (
          <div className="mt-8 rounded-lg border px-5 py-8 text-center">
            <p
              className="font-mono text-sm leading-relaxed"
              style={{ color: MUTED }}
            >
              You haven&apos;t made picks this week.
            </p>
            {pickWindowOpen ? (
              <Link
                href="/picks"
                className="mt-5 inline-flex font-mono text-sm font-bold uppercase tracking-wide transition hover:brightness-110"
                style={{ color: GREEN }}
              >
                Go to picks →
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <div className="mt-8">
              <p className="font-mono text-[11px] uppercase tracking-wider" style={{ color: MUTED }}>
                Total fantasy score
              </p>
              <p
                className="mt-1 font-mono text-4xl font-bold tabular-nums sm:text-5xl"
                style={{ color: totalScore >= 0 ? GREEN : RED }}
              >
                {totalScore >= 0 ? "+" : ""}
                {totalScore.toFixed(2)}
              </p>
              <p className="mt-2 font-mono text-[10px]" style={{ color: MUTED }}>
                Live prices refresh every 60s · Week {weekKey.weekNumber},{" "}
                {weekKey.year}
              </p>
            </div>

            <ul className="mt-10 space-y-4">
              {picks.map((r) => {
                const sym = normalizeSymbol(r.coin_symbol);
                const live = priceBySymbol.get(sym) ?? null;
                const entry = Number(r.entry_price);
                const pick: ScorePick = {
                  coin_symbol: r.coin_symbol,
                  direction: r.direction,
                  confidence: r.confidence,
                  entry_price: entry,
                };
                const points =
                  live != null ? calculateScore(pick, live) : 0;
                const pct = pctSinceEntry(entry, live);
                const long = r.direction === "long";

                return (
                  <li
                    key={r.id}
                    className="rounded-lg border p-5"
                    style={{
                      borderColor: "rgba(0, 255, 100, 0.15)",
                      backgroundColor: "rgba(0, 0, 0, 0.35)",
                    }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p
                          className="font-mono text-xl font-bold"
                          style={{ color: GREEN }}
                        >
                          {sym}
                        </p>
                        <p className="mt-0.5 text-sm" style={{ color: MUTED }}>
                          {r.coin_name}
                        </p>
                      </div>
                      <span
                        className="shrink-0 rounded px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest"
                        style={
                          long
                            ? {
                                backgroundColor: `${GREEN}22`,
                                color: GREEN,
                              }
                            : {
                                backgroundColor: `${RED}22`,
                                color: RED,
                              }
                        }
                      >
                        {long ? "Long" : "Short"}
                      </span>
                    </div>

                    <dl className="mt-4 grid gap-3 font-mono text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>
                          Entry price
                        </dt>
                        <dd className="mt-0.5 font-bold tabular-nums">
                          {formatPrice(entry)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>
                          Current price
                        </dt>
                        <dd className="mt-0.5 font-bold tabular-nums">
                          {live != null ? formatPrice(live) : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>
                          Change since entry
                        </dt>
                        <dd
                          className="mt-0.5 font-bold tabular-nums"
                          style={{
                            color:
                              pct == null
                                ? MUTED
                                : pct >= 0
                                  ? GREEN
                                  : RED,
                          }}
                        >
                          {pct == null
                            ? "—"
                            : `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>
                          Points scored
                        </dt>
                        <dd
                          className="mt-0.5 font-bold tabular-nums"
                          style={{
                            color:
                              live == null
                                ? MUTED
                                : points >= 0
                                  ? GREEN
                                  : RED,
                          }}
                        >
                          {live == null
                            ? "—"
                            : `${points >= 0 ? "+" : ""}${points.toFixed(2)}`}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>
                          Confidence
                        </dt>
                        <dd className="mt-0.5 font-bold tabular-nums">
                          {r.confidence} pts allocated
                        </dd>
                      </div>
                    </dl>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
