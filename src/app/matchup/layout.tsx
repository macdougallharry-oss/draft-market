import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Matchup — DraftMarket",
  description: "Live head-to-head scores and picks.",
};

export default function MatchupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
