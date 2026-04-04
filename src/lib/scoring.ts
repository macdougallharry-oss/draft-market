export type ScorePick = {
  coin_symbol: string;
  direction: "long" | "short";
  confidence: number;
  entry_price: number;
};

/**
 * Fantasy score from locked entry vs current spot.
 * price_change_pct = (current - entry) / entry * 100
 * long: score = pct * confidence · short: score = -pct * confidence
 */
export function calculateScore(
  pick: ScorePick,
  currentPrice: number,
): number {
  const entry = Number(pick.entry_price);
  const current = Number(currentPrice);
  if (
    !Number.isFinite(entry) ||
    entry === 0 ||
    !Number.isFinite(current)
  ) {
    return 0;
  }
  const priceChangePct = ((current - entry) / entry) * 100;
  const raw =
    pick.direction === "long"
      ? priceChangePct * pick.confidence
      : -priceChangePct * pick.confidence;
  return Math.round(raw * 100) / 100;
}

export function totalLiveScore(
  picks: ScorePick[],
  currentPriceBySymbol: Map<string, number>,
): number {
  let sum = 0;
  for (const p of picks) {
    const sym = p.coin_symbol.trim().toUpperCase();
    const price = currentPriceBySymbol.get(sym);
    if (price == null) continue;
    sum += calculateScore(p, price);
  }
  return Math.round(sum * 100) / 100;
}
