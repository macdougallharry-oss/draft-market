"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SiteNav } from "@/components/site-nav";
import { createClient } from "@/lib/supabase/client";
import {
  formatDurationParts,
  getISOWeekKey,
  getMondayUTCOfDate,
  getNextPickWindowOpenUTC,
  getPickDeadline,
  isPickWindowOpen,
  weeklyPrizeGbpLabel,
} from "@/lib/week";

type Direction = "long" | "short";

type BoardCoin = {
  geckoId: string;
  symbol: string;
  name: string;
  price: number | null;
  change7d: number | null;
};

type Pick = BoardCoin & { direction: Direction; confidence: number };

type PicksRow = {
  id: string;
  user_id: string;
  week_number: number;
  year: number;
  coin_symbol: string;
  coin_name: string;
  direction: Direction;
  confidence: number;
  entry_price: number;
  created_at: string;
};

type ActivePanel =
  | {
      symbol: string;
      coin: BoardCoin;
      isNew: true;
      direction: Direction;
      confidence: number;
    }
  | { symbol: string; coin: BoardCoin; isNew: false };

type CoinGeckoMarket = {
  id: string;
  symbol: string;
  name: string;
  current_price: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  price_change_percentage_7d?: number | null;
};

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
  "pol",
] as const;

type BoardGeckoId = (typeof COIN_IDS_ORDER)[number];

const BOARD_SLOT_COUNT = COIN_IDS_ORDER.length;

/** Split markets requests to reduce rate-limit pressure (8 + 7 = 15). */
const MARKETS_BATCH_1_IDS = COIN_IDS_ORDER.slice(0, 8);
const MARKETS_BATCH_2_IDS = COIN_IDS_ORDER.slice(8);

const MARKETS_BATCH_DELAY_MS = 2000;

/** Skip network if cache is newer than this (reduces CoinGecko rate limits). */
const MARKETS_CACHE_FRESH_MS = 2 * 60 * 1000;
/** After a failed fetch, use cache only if it is younger than this. */
const MARKETS_CACHE_STALE_FALLBACK_MS = 5 * 60 * 1000;
/** Background refetch interval while the picks page is open. */
const MARKETS_REFETCH_INTERVAL_MS = 2 * 60 * 1000;

const COINGECKO_MARKETS_CACHE_KEY = "draftmarket.coingecko.markets.v1";

type CachedMarketsPayload = {
  savedAt: number;
  rows: CoinGeckoMarket[];
};

function readMarketsCache(): CachedMarketsPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COINGECKO_MARKETS_CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as CachedMarketsPayload;
    if (typeof p?.savedAt !== "number" || !Array.isArray(p.rows)) return null;
    return p;
  } catch {
    return null;
  }
}

function writeMarketsCache(rows: CoinGeckoMarket[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      COINGECKO_MARKETS_CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), rows }),
    );
  } catch {
    /* quota / private mode */
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function coinGeckoMarketsUrlForIds(ids: readonly string[]): string {
  const idParam = ids.join(",");
  const n = ids.length;
  return (
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd` +
    `&ids=${idParam}&order=market_cap_desc&per_page=${n}&page=1&sparkline=false&price_change_percentage=7d`
  );
}

/** Labels only — never substitute for live prices. */
const COIN_BOARD_META: Record<BoardGeckoId, { symbol: string; name: string }> =
  {
    bitcoin: { symbol: "BTC", name: "Bitcoin" },
    ethereum: { symbol: "ETH", name: "Ethereum" },
    solana: { symbol: "SOL", name: "Solana" },
    binancecoin: { symbol: "BNB", name: "BNB" },
    ripple: { symbol: "XRP", name: "XRP" },
    "avalanche-2": { symbol: "AVAX", name: "Avalanche" },
    chainlink: { symbol: "LINK", name: "Chainlink" },
    polkadot: { symbol: "DOT", name: "Polkadot" },
    cardano: { symbol: "ADA", name: "Cardano" },
    dogecoin: { symbol: "DOGE", name: "Dogecoin" },
    uniswap: { symbol: "UNI", name: "Uniswap" },
    aave: { symbol: "AAVE", name: "Aave" },
    arbitrum: { symbol: "ARB", name: "Arbitrum" },
    optimism: { symbol: "OP", name: "Optimism" },
    pol: { symbol: "POL", name: "Polygon" },
  };

const MAX_PICKS = 5;
const MIN_CONFIDENCE = 5;
const MAX_CONFIDENCE_PER_PICK = 50;
const MAX_TOTAL_CONFIDENCE = 100;

function boardSlotsWithoutPrices(): BoardCoin[] {
  return COIN_IDS_ORDER.map((geckoId) => {
    const meta = COIN_BOARD_META[geckoId];
    return {
      geckoId,
      symbol: meta.symbol,
      name: meta.name,
      price: null,
      change7d: null,
    };
  });
}

/**
 * Map /coins/markets JSON to board rows. Look up each row by CoinGecko `id` only
 * (never by response array index). Missing or null `current_price` → no price on the card.
 */
function buildBoardFromMarkets(data: CoinGeckoMarket[]): BoardCoin[] {
  const marketsByGeckoId: Record<string, CoinGeckoMarket> = {};
  for (const row of data) {
    if (row && typeof row.id === "string" && row.id.length > 0) {
      marketsByGeckoId[row.id] = row;
    }
  }

  return COIN_IDS_ORDER.map((geckoId) => {
    const row = marketsByGeckoId[geckoId];
    const meta = COIN_BOARD_META[geckoId];
    if (!row || row.current_price == null) {
      return {
        geckoId,
        symbol: meta.symbol,
        name: meta.name,
        price: null,
        change7d: null,
      };
    }
    const ch =
      row.price_change_percentage_7d_in_currency ??
      row.price_change_percentage_7d ??
      null;
    return {
      geckoId,
      symbol: row.symbol.toUpperCase(),
      name: row.name,
      price: row.current_price,
      change7d:
        typeof ch === "number" && Number.isFinite(ch) ? ch : null,
    };
  });
}

function formatPrice(n: number) {
  if (n >= 1000)
    return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n >= 1)
    return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 4 })}`;
}

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function sumConfidence(list: Pick[]) {
  return list.reduce((s, p) => s + p.confidence, 0);
}

/** Max points this symbol can use; others already count toward 100. */
function maxConfidenceForPick(list: Pick[], symbol: string) {
  const sym = normalizeSymbol(symbol);
  const sumOthers = list
    .filter((p) => normalizeSymbol(p.symbol) !== sym)
    .reduce((s, p) => s + p.confidence, 0);
  return Math.min(MAX_CONFIDENCE_PER_PICK, MAX_TOTAL_CONFIDENCE - sumOthers);
}

/** Room for a brand-new coin (not in list yet). */
function maxConfidenceForNewPick(list: Pick[]) {
  return Math.min(
    MAX_CONFIDENCE_PER_PICK,
    MAX_TOTAL_CONFIDENCE - sumConfidence(list),
  );
}

function defaultConfidenceForNewPick(list: Pick[]) {
  const cap = maxConfidenceForNewPick(list);
  if (cap < MIN_CONFIDENCE) return MIN_CONFIDENCE;
  return clamp(20, MIN_CONFIDENCE, cap);
}

/** One pick per symbol; first occurrence wins (stable order). */
function dedupePicksBySymbol(list: Pick[]): Pick[] {
  const m = new Map<string, Pick>();
  for (const p of list) {
    const sym = normalizeSymbol(p.symbol);
    if (!m.has(sym)) {
      m.set(sym, { ...p, symbol: sym });
    }
  }
  return Array.from(m.values());
}

function formatLockedAt(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

/** “Picks lock in …” / reopen countdown: prefer days+hours, then hours+minutes. */
function pickWindowCountdownLabel(ms: number) {
  const { days, hours, minutes } = formatDurationParts(ms);
  if (days > 0) {
    return `${days} day${days === 1 ? "" : "s"} ${hours} hour${hours === 1 ? "" : "s"}`;
  }
  if (hours > 0) {
    return `${hours} hour${hours === 1 ? "" : "s"} ${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function ConfidenceSlider({
  value,
  min,
  max,
  id,
  onChange,
  disabled,
}: {
  value: number;
  min: number;
  max: number;
  id: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const safeMax = Math.max(min, max);
  const shown = clamp(value, min, safeMax);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-muted">
        <label htmlFor={id}>Confidence</label>
        <span className="tabular-nums text-accent">{shown} pts</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={safeMax}
        step={1}
        value={shown}
        disabled={disabled || safeMax < min}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[#00ff64] disabled:cursor-not-allowed disabled:opacity-40 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00ff64] [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[#00ff64]"
      />
      <p className="font-mono text-[10px] text-muted">
        Range {min}–{safeMax} pts
      </p>
    </div>
  );
}

export default function PicksPage() {
  const [authLoading, setAuthLoading] = useState(true);
  const [lockedRows, setLockedRows] = useState<PicksRow[]>([]);
  const [picksLoading, setPicksLoading] = useState(true);

  const [picks, setPicks] = useState<Pick[]>([]);
  const [coins, setCoins] = useState<BoardCoin[]>([]);
  const [coinsLoading, setCoinsLoading] = useState(true);
  const [coinsError, setCoinsError] = useState<string | null>(null);

  const [activePanel, setActivePanel] = useState<ActivePanel | null>(null);
  const activePanelRef = useRef<ActivePanel | null>(null);
  activePanelRef.current = activePanel;

  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const nowDate = useMemo(() => new Date(nowTick), [nowTick]);
  const pickWindowOpen = useMemo(
    () => isPickWindowOpen(nowDate),
    [nowDate],
  );
  /** Stable for the whole Mon–Sun UTC week so picks fetch does not run every tick. */
  const weekStableKey = useMemo(
    () => getMondayUTCOfDate(new Date(nowTick)).getTime(),
    [nowTick],
  );
  const weekKey = useMemo(
    () => getISOWeekKey(new Date(weekStableKey)),
    [weekStableKey],
  );
  const prizeLabel = weeklyPrizeGbpLabel();

  const reopenInMs = useMemo(
    () => getNextPickWindowOpenUTC(nowDate).getTime() - nowTick,
    [nowDate, nowTick],
  );
  const lockInMs = useMemo(
    () => getPickDeadline(nowDate).getTime() - nowTick,
    [nowDate, nowTick],
  );

  const hasLockedThisWeek = lockedRows.length > 0;
  const showLockedNoPicks =
    !pickWindowOpen && !hasLockedThisWeek && !picksLoading;

  const uniqueDraftPicks = useMemo(() => dedupePicksBySymbol(picks), [picks]);

  const confidenceSum = useMemo(
    () => sumConfidence(uniqueDraftPicks),
    [uniqueDraftPicks],
  );

  const canAddAnotherPick =
    uniqueDraftPicks.length < MAX_PICKS &&
    MAX_TOTAL_CONFIDENCE - confidenceSum >= MIN_CONFIDENCE;

  const gridCoins = useMemo((): BoardCoin[] => {
    if (coins.length === BOARD_SLOT_COUNT) return coins;
    return boardSlotsWithoutPrices();
  }, [coins]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function loadAuthAndPicks() {
      setAuthLoading(true);
      setPicksLoading(true);
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setAuthLoading(false);

      if (!u) {
        setLockedRows([]);
        setPicksLoading(false);
        return;
      }

      const { weekNumber, year } = weekKey;
      const { data, error } = await supabase
        .from("picks")
        .select(
          "id, user_id, week_number, year, coin_symbol, coin_name, direction, confidence, entry_price, created_at",
        )
        .eq("user_id", u.id)
        .eq("week_number", weekNumber)
        .eq("year", year)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      if (error) {
        console.error("picks fetch", error);
        setLockedRows([]);
      } else {
        const rows = (data as PicksRow[]) ?? [];
        const bySymbol = new Map<string, PicksRow>();
        for (const r of rows) {
          const sym = normalizeSymbol(r.coin_symbol);
          if (!bySymbol.has(sym)) bySymbol.set(sym, { ...r, coin_symbol: sym });
        }
        setLockedRows(Array.from(bySymbol.values()));
      }
      setPicksLoading(false);
    }

    loadAuthAndPicks();
    return () => {
      cancelled = true;
    };
  }, [weekKey]);

  useEffect(() => {
    if (!pickWindowOpen && !hasLockedThisWeek) {
      setCoins(boardSlotsWithoutPrices());
      setCoinsLoading(false);
      setCoinsError(null);
      return;
    }

    let cancelled = false;
    let networkBusy = false;

    async function loadMarkets(options?: { forceNetwork?: boolean }) {
      const forceNetwork = options?.forceNetwork ?? false;
      const now = Date.now();
      const cache = readMarketsCache();

      if (
        !forceNetwork &&
        cache &&
        now - cache.savedAt < MARKETS_CACHE_FRESH_MS
      ) {
        if (!cancelled) {
          setCoins(buildBoardFromMarkets(cache.rows));
          setCoinsError(null);
          setCoinsLoading(false);
        }
        return;
      }

      if (networkBusy) return;
      networkBusy = true;
      setCoinsLoading(true);
      setCoinsError(null);
      try {
        const url1 = coinGeckoMarketsUrlForIds(MARKETS_BATCH_1_IDS);
        const res1 = await fetch(url1, { cache: "no-store" });
        if (!res1.ok) throw new Error(`HTTP ${res1.status} (batch 1)`);
        const raw1: unknown = await res1.json();
        if (!Array.isArray(raw1)) throw new Error("Invalid payload (batch 1)");
        const batch1 = raw1 as CoinGeckoMarket[];

        if (cancelled) return;
        await delay(MARKETS_BATCH_DELAY_MS);
        if (cancelled) return;

        const url2 = coinGeckoMarketsUrlForIds(MARKETS_BATCH_2_IDS);
        const res2 = await fetch(url2, { cache: "no-store" });
        if (!res2.ok) throw new Error(`HTTP ${res2.status} (batch 2)`);
        const raw2: unknown = await res2.json();
        if (!Array.isArray(raw2)) throw new Error("Invalid payload (batch 2)");
        const batch2 = raw2 as CoinGeckoMarket[];

        const merged = [...batch1, ...batch2];
        writeMarketsCache(merged);
        if (!cancelled) {
          setCoins(buildBoardFromMarkets(merged));
          setCoinsError(null);
        }
      } catch (e) {
        if (cancelled) return;
        console.error("[picks] CoinGecko markets load failed", e);
        const fallback = readMarketsCache();
        const fallbackOk =
          fallback &&
          Date.now() - fallback.savedAt < MARKETS_CACHE_STALE_FALLBACK_MS;
        if (fallbackOk) {
          setCoins(buildBoardFromMarkets(fallback.rows));
          setCoinsError(null);
        } else {
          setCoins(boardSlotsWithoutPrices());
          setCoinsError(
            "Could not load live prices from CoinGecko. Refresh the page or try again shortly.",
          );
        }
      } finally {
        networkBusy = false;
        if (!cancelled) setCoinsLoading(false);
      }
    }

    loadMarkets({ forceNetwork: false });

    const intervalId = window.setInterval(() => {
      loadMarkets({ forceNetwork: true });
    }, MARKETS_REFETCH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [pickWindowOpen, hasLockedThisWeek]);

  const lockedConfidence = lockedRows.reduce((s, r) => s + r.confidence, 0);

  const openPanel = useCallback(
    (coin: BoardCoin, direction: Direction) => {
      if (coin.price == null) return;
      const sym = normalizeSymbol(coin.symbol);
      const normalizedCoin: BoardCoin = { ...coin, symbol: sym };
      const existing = uniqueDraftPicks.find(
        (p) => normalizeSymbol(p.symbol) === sym,
      );

      if (!existing) {
        if (!canAddAnotherPick) return;
        const cap = maxConfidenceForNewPick(uniqueDraftPicks);
        if (cap < MIN_CONFIDENCE) return;
        setActivePanel({
          symbol: sym,
          coin: normalizedCoin,
          direction,
          confidence: defaultConfidenceForNewPick(uniqueDraftPicks),
          isNew: true,
        });
        return;
      }

      setActivePanel({
        symbol: sym,
        coin: normalizedCoin,
        isNew: false,
      });
      setPicks((prev) =>
        dedupePicksBySymbol(prev).map((p) =>
          normalizeSymbol(p.symbol) === sym ? { ...p, direction } : p,
        ),
      );
    },
    [canAddAnotherPick, uniqueDraftPicks],
  );

  const setPanelDirection = useCallback((direction: Direction) => {
    let symToUpdate: string | null = null;
    setActivePanel((ap) => {
      if (!ap) return null;
      if (ap.isNew) return { ...ap, direction };
      symToUpdate = ap.symbol;
      return ap;
    });
    if (symToUpdate !== null) {
      setPicks((prev) =>
        dedupePicksBySymbol(prev).map((p) =>
          normalizeSymbol(p.symbol) === symToUpdate
            ? { ...p, direction }
            : p,
        ),
      );
    }
  }, []);

  const setDraftPanelConfidence = useCallback((value: number) => {
    setActivePanel((ap) => {
      if (!ap || !ap.isNew) return ap;
      const list = dedupePicksBySymbol(picks);
      const maxV = maxConfidenceForNewPick(list);
      const v = clamp(Math.round(value), MIN_CONFIDENCE, maxV);
      return { ...ap, confidence: v };
    });
  }, [picks]);

  const updatePickConfidence = useCallback((symbol: string, raw: number) => {
    const sym = normalizeSymbol(symbol);
    setPicks((prev) => {
      const list = dedupePicksBySymbol(prev);
      const maxV = maxConfidenceForPick(list, sym);
      const v = clamp(Math.round(raw), MIN_CONFIDENCE, maxV);
      return list.map((p) =>
        normalizeSymbol(p.symbol) === sym ? { ...p, confidence: v } : p,
      );
    });
  }, []);

  const removePick = useCallback((symbol: string) => {
    const sym = normalizeSymbol(symbol);
    setPicks((prev) =>
      prev.filter((p) => normalizeSymbol(p.symbol) !== sym),
    );
    setActivePanel((ap) =>
      ap && normalizeSymbol(ap.symbol) === sym ? null : ap,
    );
  }, []);

  const commitNewPick = useCallback(() => {
    const ap = activePanelRef.current;
    if (!ap || !ap.isNew || ap.coin.price == null) return;
    setPicks((prev) => {
      const list = dedupePicksBySymbol(prev);
      const cap = maxConfidenceForNewPick(list);
      const c = clamp(ap.confidence, MIN_CONFIDENCE, cap);
      if (cap < MIN_CONFIDENCE) return prev;
      return [
        ...list,
        {
          ...ap.coin,
          direction: ap.direction,
          confidence: c,
        },
      ];
    });
    setActivePanel(null);
  }, []);

  const closePanel = useCallback(() => setActivePanel(null), []);

  const picksValidForLock =
    uniqueDraftPicks.length > 0 &&
    uniqueDraftPicks.every((p) => {
      const cap = maxConfidenceForPick(uniqueDraftPicks, p.symbol);
      return (
        p.price != null &&
        p.confidence >= MIN_CONFIDENCE &&
        p.confidence <= cap &&
        p.confidence <= MAX_CONFIDENCE_PER_PICK
      );
    }) &&
    confidenceSum <= MAX_TOTAL_CONFIDENCE;

  const handleLockIn = useCallback(async () => {
    if (!isPickWindowOpen()) {
      setSaveState("error");
      setSaveError("The pick window is closed. Picks reopen Monday 00:00 UTC.");
      return;
    }
    const uniquePicks = dedupePicksBySymbol(picks);
    if (uniquePicks.length !== picks.length) {
      setPicks(uniquePicks);
    }
    if (uniquePicks.length === 0) return;
    const sum = sumConfidence(uniquePicks);
    if (sum > MAX_TOTAL_CONFIDENCE) return;

    setSaveError(null);
    setSaveState("saving");
    const supabase = createClient();
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    if (!u) {
      setSaveState("error");
      setSaveError("You must be signed in to lock picks.");
      return;
    }

    const priceBySymbol = new Map<string, number>();
    for (const c of coins) {
      const sym = normalizeSymbol(c.symbol);
      if (c.price != null && Number.isFinite(c.price) && c.price > 0) {
        priceBySymbol.set(sym, c.price);
      }
    }
    for (const p of uniquePicks) {
      const sym = normalizeSymbol(p.symbol);
      const live = priceBySymbol.get(sym);
      if (
        live == null ||
        !Number.isFinite(live) ||
        live <= 0
      ) {
        setSaveState("error");
        setSaveError(
          `No live board price for ${sym}. Wait for prices to load or refresh, then try again.`,
        );
        return;
      }
    }

    const { weekNumber, year } = weekKey;
    const rows = uniquePicks.map((p) => {
      const sym = normalizeSymbol(p.symbol);
      const entry_price = priceBySymbol.get(sym)!;
      return {
        user_id: u.id,
        week_number: weekNumber,
        year,
        coin_symbol: sym,
        coin_name: p.name,
        direction: p.direction,
        confidence: p.confidence,
        entry_price,
      };
    });

    const { data, error } = await supabase
      .from("picks")
      .insert(rows)
      .select(
        "id, user_id, week_number, year, coin_symbol, coin_name, direction, confidence, entry_price, created_at",
      );

    if (error) {
      console.error("picks insert", error);
      setSaveState("error");
      setSaveError(error.message);
      return;
    }

    setLockedRows((data as PicksRow[]) ?? []);
    setPicks([]);
    setActivePanel(null);
    setSaveState("success");
  }, [picks, weekKey, coins]);

  const isExpanded = (coin: BoardCoin) =>
    activePanel &&
    normalizeSymbol(activePanel.symbol) === normalizeSymbol(coin.symbol);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_340px] lg:items-start lg:gap-10 lg:px-6">
        <section aria-label="Coin universe">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {hasLockedThisWeek
                ? "Your locked picks"
                : showLockedNoPicks
                  ? "Picks are locked"
                  : "This week's board"}
            </h1>
            <p className="mt-1 font-mono text-xs uppercase tracking-wider text-muted">
              {hasLockedThisWeek
                ? `Week ${weekKey.weekNumber} · ${weekKey.year} · saved to your account`
                : showLockedNoPicks
                  ? "Entries open Mon 00:00 UTC through Tue 23:59 UTC each week"
                  : `Up to ${MAX_PICKS} picks · set confidence (5–50) · max ${MAX_TOTAL_CONFIDENCE} total`}
            </p>
            {pickWindowOpen && !hasLockedThisWeek && (
              <p
                className="mt-2 font-mono text-[11px] tabular-nums text-accent"
                aria-live="polite"
              >
                Picks lock in {pickWindowCountdownLabel(lockInMs)}
              </p>
            )}
            {showLockedNoPicks && (
              <p
                className="mt-2 font-mono text-[11px] tabular-nums text-muted"
                aria-live="polite"
              >
                Picks reopen in {pickWindowCountdownLabel(reopenInMs)} · next
                window starts Monday 00:00 UTC
              </p>
            )}
            {saveState === "success" && (
              <p
                className="mt-3 rounded border border-accent/40 bg-accent/10 px-3 py-2 font-mono text-xs text-accent"
                role="status"
              >
                Picks locked and saved for week {weekKey.weekNumber},{" "}
                {weekKey.year}.
              </p>
            )}
            {pickWindowOpen && !hasLockedThisWeek && coinsLoading ? (
              <p
                className="mt-3 font-mono text-xs text-accent"
                aria-live="polite"
              >
                <span className="inline-block animate-pulse">
                  Loading live prices from CoinGecko…
                </span>
              </p>
            ) : pickWindowOpen && !hasLockedThisWeek ? (
              <p className="mt-3 font-mono text-[11px] text-muted">
                Prices via CoinGecko · USD · 7d change
              </p>
            ) : null}
            {coinsError && pickWindowOpen && !hasLockedThisWeek ? (
              <p
                className="mt-3 rounded border border-accent-red/40 bg-accent-red/10 px-3 py-2 font-mono text-xs text-accent-red"
                role="alert"
              >
                {coinsError}
              </p>
            ) : null}
          </div>

          {picksLoading && !hasLockedThisWeek ? (
            <p className="font-mono text-sm text-muted">Loading your week…</p>
          ) : hasLockedThisWeek ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {lockedRows.map((row) => (
                <article
                  key={row.id}
                  className="rounded-lg border border-[color:var(--border)] bg-white/[0.02] p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-lg font-bold text-accent">
                        {row.coin_symbol}
                      </p>
                      <p className="font-sans text-sm text-muted">
                        {row.coin_name}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide ${
                        row.direction === "long"
                          ? "bg-accent/15 text-accent"
                          : "bg-accent-red/15 text-accent-red"
                      }`}
                    >
                      {row.direction}
                    </span>
                  </div>
                  <div className="mt-4 space-y-1">
                    <p className="font-mono text-xs uppercase tracking-wider text-muted">
                      Entry (locked)
                    </p>
                    <p className="font-mono text-xl font-bold tracking-tight">
                      {formatPrice(Number(row.entry_price))}
                    </p>
                    <p className="font-mono text-sm text-muted">
                      {row.confidence} confidence pts
                    </p>
                    <p className="font-mono text-[10px] text-muted/80">
                      Locked {formatLockedAt(row.created_at)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : showLockedNoPicks ? (
            <div
              className="rounded-lg border border-[color:var(--border)] bg-white/[0.02] px-6 py-16 text-center"
              role="status"
              aria-label="Picks locked until next window"
            >
              <p className="font-mono text-sm uppercase tracking-wider text-muted">
                Picks are locked
              </p>
              <p className="mt-5 font-mono text-3xl font-bold tabular-nums tracking-tight text-accent sm:text-4xl">
                {pickWindowCountdownLabel(reopenInMs)}
              </p>
              <p className="mt-3 max-w-md mx-auto font-mono text-xs leading-relaxed text-muted">
                The board opens again Monday 00:00 UTC. You can lock entries
                through Tuesday 23:59 UTC.
              </p>
            </div>
          ) : (
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
                : gridCoins.map((coin) => {
                    const selected = uniqueDraftPicks.find(
                      (p) =>
                        normalizeSymbol(p.symbol) ===
                        normalizeSymbol(coin.symbol),
                    );
                    const expanded = isExpanded(coin);
                    const canOpenNew = !selected && canAddAnotherPick;
                    const hasLivePrice = coin.price != null;
                    const up =
                      coin.change7d != null && coin.change7d >= 0;

                    const panel = activePanel;
                    const showPanel =
                      expanded &&
                      panel &&
                      normalizeSymbol(panel.symbol) ===
                        normalizeSymbol(coin.symbol);
                    const maxForSlider = panel
                      ? panel.isNew
                        ? maxConfidenceForNewPick(uniqueDraftPicks)
                        : maxConfidenceForPick(uniqueDraftPicks, coin.symbol)
                      : MAX_CONFIDENCE_PER_PICK;

                    const livePickForPanel =
                      showPanel && panel && !panel.isNew ? selected : undefined;
                    const panelDirection = panel?.isNew
                      ? panel.direction
                      : livePickForPanel?.direction ?? "long";
                    const panelConfidence = panel?.isNew
                      ? panel.confidence
                      : livePickForPanel?.confidence ?? MIN_CONFIDENCE;

                    return (
                      <article
                        key={coin.geckoId}
                        className={`rounded-lg border border-[color:var(--border)] bg-white/[0.02] p-4 transition-[padding,box-shadow] duration-200 ${
                          expanded
                            ? "ring-1 ring-accent/40 shadow-lg shadow-black/20 sm:col-span-2 xl:col-span-2"
                            : selected
                              ? "ring-1 ring-accent/25"
                              : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            selected
                              ? openPanel(coin, selected.direction)
                              : undefined
                          }
                          disabled={!selected}
                          className={`w-full text-left ${selected ? "cursor-pointer" : "cursor-default"}`}
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
                                {selected.direction} · {selected.confidence}pts
                              </span>
                            )}
                          </div>

                          <div className="mt-4 space-y-1">
                            {coin.price != null ? (
                              <p className="font-mono text-xl font-bold tracking-tight">
                                {formatPrice(coin.price)}
                              </p>
                            ) : (
                              <div
                                className="h-7 w-32 max-w-full animate-pulse rounded bg-white/10"
                                aria-hidden
                              />
                            )}
                            {coin.change7d != null ? (
                              <p
                                className={`font-mono text-sm font-medium ${
                                  up ? "text-accent" : "text-accent-red"
                                }`}
                              >
                                {up ? "+" : ""}
                                {coin.change7d.toFixed(2)}%{" "}
                                <span className="text-muted">7d</span>
                              </p>
                            ) : hasLivePrice ? (
                              <p className="font-mono text-sm text-muted">
                                7d change unavailable
                              </p>
                            ) : (
                              <div
                                className="h-4 w-24 animate-pulse rounded bg-white/5"
                                aria-hidden
                              />
                            )}
                          </div>
                        </button>

                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            disabled={
                              !hasLivePrice ||
                              (!selected && !canOpenNew)
                            }
                            title={
                              !hasLivePrice
                                ? "Waiting for live price from CoinGecko"
                                : undefined
                            }
                            onClick={() => openPanel(coin, "long")}
                            className="flex-1 rounded border border-accent/50 bg-accent/10 py-2 font-mono text-xs font-bold uppercase tracking-wide text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            Long
                          </button>
                          <button
                            type="button"
                            disabled={
                              !hasLivePrice ||
                              (!selected && !canOpenNew)
                            }
                            title={
                              !hasLivePrice
                                ? "Waiting for live price from CoinGecko"
                                : undefined
                            }
                            onClick={() => openPanel(coin, "short")}
                            className="flex-1 rounded border border-accent-red/50 bg-accent-red/10 py-2 font-mono text-xs font-bold uppercase tracking-wide text-accent-red transition hover:bg-accent-red/20 disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            Short
                          </button>
                        </div>

                        {showPanel && panel && (
                          <div className="mt-4 border-t border-[color:var(--border)] pt-4">
                            <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted">
                              Set direction & confidence
                            </p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={coin.price == null}
                                onClick={() => setPanelDirection("long")}
                                className={`flex-1 rounded border py-2 font-mono text-xs font-bold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-35 ${
                                  panelDirection === "long"
                                    ? "border-accent bg-accent/20 text-accent"
                                    : "border-white/10 text-muted hover:border-accent/40"
                                }`}
                              >
                                Long
                              </button>
                              <button
                                type="button"
                                disabled={coin.price == null}
                                onClick={() => setPanelDirection("short")}
                                className={`flex-1 rounded border py-2 font-mono text-xs font-bold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-35 ${
                                  panelDirection === "short"
                                    ? "border-accent-red bg-accent-red/20 text-accent-red"
                                    : "border-white/10 text-muted hover:border-accent-red/40"
                                }`}
                              >
                                Short
                              </button>
                            </div>

                            <div className="mt-4">
                              <ConfidenceSlider
                                id={`conf-${coin.symbol}`}
                                value={panelConfidence}
                                min={MIN_CONFIDENCE}
                                max={Math.max(MIN_CONFIDENCE, maxForSlider)}
                                onChange={(v) => {
                                  if (panel.isNew) {
                                    setDraftPanelConfidence(v);
                                  } else {
                                    updatePickConfidence(coin.symbol, v);
                                  }
                                }}
                              />
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              {panel.isNew ? (
                                <button
                                  type="button"
                                  onClick={commitNewPick}
                                  disabled={
                                    maxForSlider < MIN_CONFIDENCE ||
                                    panel.confidence < MIN_CONFIDENCE
                                  }
                                  className="flex-1 rounded bg-accent py-2 font-mono text-xs font-bold uppercase tracking-wide text-background transition hover:brightness-110 disabled:opacity-40"
                                >
                                  Add to roster
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={closePanel}
                                className="rounded border border-white/15 px-4 py-2 font-mono text-xs uppercase tracking-wide text-muted transition hover:border-white/30 hover:text-foreground"
                              >
                                Done
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
            </div>
          )}
        </section>

        <aside
          className="lg:sticky lg:top-8"
          aria-label="Your picks"
        >
          <div className="rounded-lg border border-[color:var(--border)] bg-black/30 p-5">
            <h2 className="font-sans text-lg font-semibold">
              {showLockedNoPicks ? "Picks are locked" : "Selected picks"}
            </h2>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted">
              {authLoading
                ? "Checking session…"
                : showLockedNoPicks
                  ? `Reopens in ${pickWindowCountdownLabel(reopenInMs)} · Mon 00:00 UTC`
                  : hasLockedThisWeek
                    ? `${lockedRows.length} locked · Week ${weekKey.weekNumber}`
                    : `${uniqueDraftPicks.length} / ${MAX_PICKS} picks · ${confidenceSum} / ${MAX_TOTAL_CONFIDENCE} pts`}
            </p>

            {saveError && (
              <p className="mt-3 rounded border border-accent-red/40 bg-accent-red/10 px-3 py-2 font-mono text-xs text-accent-red">
                {saveError}
              </p>
            )}

            <ul className="mt-4 min-h-[120px] space-y-3">
              {authLoading || picksLoading ? (
                <li className="py-6 text-center font-mono text-xs text-muted">
                  Loading…
                </li>
              ) : hasLockedThisWeek ? (
                lockedRows.map((r) => (
                  <li
                    key={r.id}
                    className="rounded border border-[color:var(--border)] bg-white/[0.03] px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-bold text-foreground">
                          {r.coin_symbol}
                        </p>
                        <p className="truncate font-sans text-xs text-muted">
                          {r.coin_name} · {formatPrice(Number(r.entry_price))}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 font-mono text-[10px] font-bold uppercase ${
                          r.direction === "long"
                            ? "text-accent"
                            : "text-accent-red"
                        }`}
                      >
                        {r.direction}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-[11px] text-muted">
                      {r.confidence} pts
                    </p>
                  </li>
                ))
              ) : showLockedNoPicks ? (
                <li className="rounded border border-dashed border-white/10 py-8 text-center font-mono text-xs text-muted">
                  Entry window is closed. You can build a roster when the board
                  opens Monday 00:00 UTC.
                </li>
              ) : uniqueDraftPicks.length === 0 ? (
                <li className="rounded border border-dashed border-white/10 py-8 text-center font-mono text-xs text-muted">
                  No picks yet — tap Long or Short on a coin, set confidence,
                  then Add to roster.
                </li>
              ) : (
                uniqueDraftPicks.map((p) => {
                  const maxV = maxConfidenceForPick(uniqueDraftPicks, p.symbol);
                  return (
                    <li
                      key={p.symbol}
                      className="rounded border border-[color:var(--border)] bg-white/[0.03] px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-bold text-foreground">
                            {p.symbol}
                          </p>
                          <p className="truncate font-sans text-xs text-muted">
                            {p.name}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePick(p.symbol)}
                          className="shrink-0 font-mono text-xs text-muted hover:text-foreground"
                          aria-label={`Remove ${p.symbol}`}
                        >
                          ×
                        </button>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPicks((prev) =>
                              dedupePicksBySymbol(prev).map((x) =>
                                normalizeSymbol(x.symbol) ===
                                normalizeSymbol(p.symbol)
                                  ? { ...x, direction: "long" }
                                  : x,
                              ),
                            );
                          }}
                          className={`flex-1 rounded border py-1.5 font-mono text-[10px] font-bold uppercase ${
                            p.direction === "long"
                              ? "border-accent bg-accent/15 text-accent"
                              : "border-white/10 text-muted"
                          }`}
                        >
                          Long
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPicks((prev) =>
                              dedupePicksBySymbol(prev).map((x) =>
                                normalizeSymbol(x.symbol) ===
                                normalizeSymbol(p.symbol)
                                  ? { ...x, direction: "short" }
                                  : x,
                              ),
                            );
                          }}
                          className={`flex-1 rounded border py-1.5 font-mono text-[10px] font-bold uppercase ${
                            p.direction === "short"
                              ? "border-accent-red bg-accent-red/15 text-accent-red"
                              : "border-white/10 text-muted"
                          }`}
                        >
                          Short
                        </button>
                      </div>
                      <div className="mt-3">
                        <ConfidenceSlider
                          id={`side-${p.symbol}`}
                          value={p.confidence}
                          min={MIN_CONFIDENCE}
                          max={Math.max(MIN_CONFIDENCE, maxV)}
                          onChange={(v) => updatePickConfidence(p.symbol, v)}
                        />
                      </div>
                    </li>
                  );
                })
              )}
            </ul>

            {!showLockedNoPicks && (
              <div className="mt-6 border-t border-[color:var(--border)] pt-5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                    Total confidence
                  </span>
                  <span
                    className={`font-mono text-sm font-bold tabular-nums ${
                      confidenceSum > MAX_TOTAL_CONFIDENCE
                        ? "text-accent-red"
                        : "text-accent"
                    }`}
                  >
                    {hasLockedThisWeek ? lockedConfidence : confidenceSum} /{" "}
                    {MAX_TOTAL_CONFIDENCE}
                  </span>
                </div>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"
                  role="meter"
                  aria-valuenow={
                    hasLockedThisWeek ? lockedConfidence : confidenceSum
                  }
                  aria-valuemin={0}
                  aria-valuemax={MAX_TOTAL_CONFIDENCE}
                  aria-label="Total confidence points"
                >
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-300"
                    style={{
                      width: `${hasLockedThisWeek ? lockedConfidence : clamp((confidenceSum / MAX_TOTAL_CONFIDENCE) * 100, 0, 100)}%`,
                    }}
                  />
                </div>
                {!hasLockedThisWeek && (
                  <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted">
                    Each pick: {MIN_CONFIDENCE}–{MAX_CONFIDENCE_PER_PICK} pts ·
                    pool {MAX_TOTAL_CONFIDENCE} max
                  </p>
                )}
              </div>
            )}

            <p className="mt-5 rounded border border-accent/20 bg-accent/5 px-3 py-2 font-mono text-xs text-accent">
              League hint: top score this week takes the{" "}
              <span className="font-bold">{prizeLabel}</span> prize.
            </p>

            {hasLockedThisWeek ? (
              <p className="mt-5 text-center font-mono text-[11px] uppercase tracking-wider text-muted">
                Picks are locked for this week
              </p>
            ) : showLockedNoPicks ? (
              <p className="mt-5 text-center font-mono text-[11px] uppercase tracking-wider text-muted">
                Lock-in unavailable until the window opens
              </p>
            ) : (
              <button
                type="button"
                disabled={
                  uniqueDraftPicks.length === 0 ||
                  saveState === "saving" ||
                  !picksValidForLock ||
                  !pickWindowOpen
                }
                onClick={handleLockIn}
                className="mt-5 w-full rounded py-3 font-mono text-sm font-bold uppercase tracking-wide transition enabled:bg-accent enabled:text-background enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:border disabled:border-white/10 disabled:bg-white/5 disabled:text-muted"
              >
                {saveState === "saving" ? "Saving…" : "Lock in picks"}
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
