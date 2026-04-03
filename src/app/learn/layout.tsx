import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How to play — DraftMarket",
  description:
    "Learn long vs short, confidence points, scoring, and weekly schedule.",
};

export default function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
