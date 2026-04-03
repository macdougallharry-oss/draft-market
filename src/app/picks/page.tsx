"use client";

import { useCallback, useEffect, useState } from "react";
import { SiteNav } from "@/components/site-nav";

type Direction = "long" | "short";

type Coin = {
  symbol: string;
  name: string;
  price: number;
  change7d: number;
};

type Pick = Coin & { direction: Direction };

type CoinGeckoMarket = {
  id: string;
  symbol: string;
  name: string;
  current_price: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  price_change_percentage_7d?: number | null;
};

const COINGECKO_MARKETS_URL =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=30&page=1&sparkline=false&price_change_percentage=7d";

/** Display order = CoinGecko coin ids */
const COIN_IDS_ORDER = [
  "bitcoin",
  "ethereum",
  "solana",
  "binancecoin",
  "ripple",
  "avalanche-2",
  "chainlink",
  "polkadot",
  "cardano",
  "dogecoin",
  "uniswap",
  "aave",
  "arbitrum",
  "optimism",
  "matic-network",
] as const;

const MAX_PICKS = 5;
const CONFIDENCE_PER_PICK = 20;

const FALLBACK_COINS: Coin[] = [
  { symbol: "BTC", name: "Bitcoin", price: 98420, change7d: 4.12 },
  { symbol: "ETH", name: "Ethereum", price: 3452, change7d: -1.85 },
  { symbol: "SOL", name: "Solana", price: 178.42, change7d: 8.3 },
  { symbol: "BNB", name: "BNB", price: 612.15, change7d: 2.04 },
  { symbol: "XRP", name: "XRP", price: 2.18, change7d: -3.2 },
  { symbol: "AVAX", name: "Avalanche", price: 36.9, change7d: 5.67 },
  { symbol: "LINK", name: "Chainlink", price: 14.22, change7d: 1.1 },
  { symbol: "DOT", name: "Polkadot", price: 6.45, change7d: -0.92 },
  { symbol: "ADA", name: "Cardano", price: 0.78, change7d: 3.45 },
  { symbol: "DOGE", name: "Dogecoin", price: 0.162, change7d: -4.8 },
  { symbol: "UNI", name: "Uniswap", price: 9.87, change7d: 6.12 },
  { symbol: "AAVE", name: "Aave", price: 312.4, change7d: 2.88 },
  { symbol: "ARB", name: "Arbitrum", price: 0.52, change7d: -2.15 },
  { symbol: "OP", name: "Optimism", price: 1.35, change7d: 4.5 },
  { symbol: "MATIC", name: "Polygon", price: 0.38, change7d: 1.22 },
];

const FALLBACK_BY_ID = new Map(
  COIN_IDS_ORDER.map((id, i) => [id, FALLBACK_COINS[i]!]),
);

function marketToCoin(row: CoinGeckoMarket): Coin | null {
  if (row.current_price == null) return null;
  const change7d =
    row.price_change_percentage_7d_in_currency ??
    row.price_change_percentage_7d ??
    0;
  return {
    symbol: row.symbol.toUpperCase(),
    name: row.name,
    price: row.current_price,
    change7d,
  };
}

function mapMarketsToCoins(data: CoinGeckoMarket[]): Coin[] {
  const byId = new Map(data.map((row) => [row.id, row]));
  return COIN_IDS_ORDER.map((id) => {
    const row = byId.get(id);
    if (row) {
      const mapped = marketToCoin(row);
      if (mapped) return mapped;
    }
    return FALLBACK_BY_ID.get(id)!;
  });
}

function formatPrice(n: number) {
  if (n >= 1000)
    return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n >= 1)
    return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 4 })}`;
}

export default function PicksPage() {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [coins, setCoins] = useState<Coin[]>(FALLBACK_COINS);
  const [coinsLoading, setCoinsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadMarkets() {
      setCoinsLoading(true);
      try {
        const res = await fetch(COINGECKO_MARKETS_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: unknown = await res.json();
        if (!Array.isArray(data)) throw new Error("Invalid payload");
        const mapped = mapMarketsToCoins(data as CoinGeckoMarket[]);
        if (!cancelled) setCoins(mapped);
      } catch {
        if (!cancelled) setCoins(FALLBACK_COINS);
      } finally {
        if (!cancelled) setCoinsLoading(false);
      }
    }

    loadMarkets();
    return () => {
      cancelled = true;
    };
  }, []);

  const confidence = Math.min(100, picks.length * CONFIDENCE_PER_PICK);

  const addOrUpdatePick = useCallback(
    (coin: Coin, direction: Direction) => {
      setPicks((prev) => {
        const existing = prev.find((p) => p.symbol === coin.symbol);
        if (existing) {
          return prev.map((p) =>
            p.symbol === coin.symbol ? { ...p, direction } : p,
          );
        }
        if (prev.length >= MAX_PICKS) return prev;
        return [...prev, { ...coin, direction }];
      });
    },
    [],
  );

  const removePick = useCallback((symbol: string) => {
    setPicks((prev) => prev.filter((p) => p.symbol !== symbol));
  }, []);

  const atMax = picks.length >= MAX_PICKS;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_340px] lg:items-start lg:gap-10 lg:px-6">
        <section aria-label="Coin universe">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              This week&apos;s board
            </h1>
            <p className="mt-1 font-mono text-xs uppercase tracking-wider text-muted">
              Up to {MAX_PICKS} picks · tap long or short
            </p>
            {coinsLoading ? (
              <p
                className="mt-3 font-mono text-xs text-accent"
                aria-live="polite"
              >
                <span className="inline-block animate-pulse">
                  Loading live prices from CoinGecko…
                </span>
              </p>
            ) : (
              <p className="mt-3 font-mono text-[11px] text-muted">
                Prices via CoinGecko · USD · 7d change
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {coinsLoading
              ? COIN_IDS_ORDER.map((id) => (
                  <div
                    key={id}
                    className="animate-pulse rounded-lg border border-[color:var(--border)] bg-white/[0.03] p-4"
                    aria-hidden
                  >
                    <div className="h-5 w-16 rounded bg-white/10" />
                    <div className="mt-2 h-4 w-28 rounded bg-white/5" />
                    <div className="mt-6 h-8 w-32 rounded bg-white/10" />
                    <div className="mt-2 h-4 w-24 rounded bg-white/5" />
                    <div className="mt-4 flex gap-2">
                      <div className="h-9 flex-1 rounded bg-white/5" />
                      <div className="h-9 flex-1 rounded bg-white/5" />
                    </div>
                  </div>
                ))
              : coins.map((coin) => {
                  const selected = picks.find((p) => p.symbol === coin.symbol);
                  const canAddNew = !selected && !atMax;
                  const up = coin.change7d >= 0;

                  return (
                    <article
                      key={coin.symbol}
                      className={`rounded-lg border border-[color:var(--border)] bg-white/[0.02] p-4 transition-colors ${
                        selected ? "ring-1 ring-accent/35" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-lg font-bold text-accent">
                            {coin.symbol}
                          </p>
                          <p className="font-sans text-sm text-muted">
                            {coin.name}
                          </p>
                        </div>
                        {selected && (
                          <span
                            className={`shrink-0 rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide ${
                              selected.direction === "long"
                                ? "bg-accent/15 text-accent"
                                : "bg-accent-red/15 text-accent-red"
                            }`}
                          >
                            {selected.direction}
                          </span>
                        )}
                      </div>

                      <div className="mt-4 space-y-1">
                        <p className="font-mono text-xl font-bold tracking-tight">
                          {formatPrice(coin.price)}
                        </p>
                        <p
                          className={`font-mono text-sm font-medium ${
                            up ? "text-accent" : "text-accent-red"
                          }`}
                        >
                          {up ? "+" : ""}
                          {coin.change7d.toFixed(2)}%{" "}
                          <span className="text-muted">7d</span>
                        </p>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          disabled={!selected && !canAddNew}
                          onClick={() => addOrUpdatePick(coin, "long")}
                          className="flex-1 rounded border border-accent/50 bg-accent/10 py-2 font-mono text-xs font-bold uppercase tracking-wide text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          Long
                        </button>
                        <button
                          type="button"
                          disabled={!selected && !canAddNew}
                          onClick={() => addOrUpdatePick(coin, "short")}
                          className="flex-1 rounded border border-accent-red/50 bg-accent-red/10 py-2 font-mono text-xs font-bold uppercase tracking-wide text-accent-red transition hover:bg-accent-red/20 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          Short
                        </button>
                      </div>
                    </article>
                  );
                })}
          </div>
        </section>

        <aside
          className="lg:sticky lg:top-8"
          aria-label="Your picks"
        >
          <div className="rounded-lg border border-[color:var(--border)] bg-black/30 p-5">
            <h2 className="font-sans text-lg font-semibold">Selected picks</h2>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted">
              {picks.length} / {MAX_PICKS} slots
            </p>

            <ul className="mt-4 min-h-[120px] space-y-2">
              {picks.length === 0 ? (
                <li className="rounded border border-dashed border-white/10 py-8 text-center font-mono text-xs text-muted">
                  No picks yet — choose long or short on the grid.
                </li>
              ) : (
                picks.map((p) => (
                  <li
                    key={p.symbol}
                    className="flex items-center justify-between gap-2 rounded border border-[color:var(--border)] bg-white/[0.03] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-bold text-foreground">
                        {p.symbol}
                      </p>
                      <p className="truncate font-sans text-xs text-muted">
                        {p.name}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`font-mono text-[10px] font-bold uppercase ${
                          p.direction === "long"
                            ? "text-accent"
                            : "text-accent-red"
                        }`}
                      >
                        {p.direction}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePick(p.symbol)}
                        className="font-mono text-xs text-muted hover:text-foreground"
                        aria-label={`Remove ${p.symbol}`}
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>

            <div className="mt-6 border-t border-[color:var(--border)] pt-5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                  Confidence
                </span>
                <span className="font-mono text-sm font-bold tabular-nums text-accent">
                  {confidence} / 100
                </span>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"
                role="meter"
                aria-valuenow={confidence}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Confidence points"
              >
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-300"
                  style={{ width: `${confidence}%` }}
                />
              </div>
              <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted">
                +{CONFIDENCE_PER_PICK} pts per pick · caps at 100 with a full
                slate
              </p>
            </div>

            <p className="mt-5 rounded border border-accent/20 bg-accent/5 px-3 py-2 font-mono text-xs text-accent">
              League hint: top score this week takes the{" "}
              <span className="font-bold">£50</span> prize.
            </p>

            <button
              type="button"
              disabled={picks.length === 0}
              className="mt-5 w-full rounded py-3 font-mono text-sm font-bold uppercase tracking-wide transition enabled:bg-accent enabled:text-background enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:border disabled:border-white/10 disabled:bg-white/5 disabled:text-muted"
            >
              Lock in picks
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
