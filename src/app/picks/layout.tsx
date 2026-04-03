import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Picks — DraftMarket",
  description: "Lock in long or short calls on your draft roster.",
};

export default function PicksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
