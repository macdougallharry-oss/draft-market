/** Map roster symbols (DB) to CoinGecko `simple/price` ids. */
export const COIN_SYMBOL_TO_GECKO_ID = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  DOT: "polkadot",
  ADA: "cardano",
  DOGE: "dogecoin",
  UNI: "uniswap",
  AAVE: "aave",
  ARB: "arbitrum",
  OP: "optimism",
  MATIC: "matic-network",
  POL: "pol",
} as const;

export type CoinSymbolKey = keyof typeof COIN_SYMBOL_TO_GECKO_ID;

export function geckoIdForSymbol(symbol: string): string | undefined {
  const k = symbol.trim().toUpperCase() as CoinSymbolKey;
  return k in COIN_SYMBOL_TO_GECKO_ID
    ? COIN_SYMBOL_TO_GECKO_ID[k]
    : undefined;
}
