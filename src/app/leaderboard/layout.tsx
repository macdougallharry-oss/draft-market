import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leaderboard — DraftMarket",
  description: "Weekly scores, records, and prizes.",
};

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
