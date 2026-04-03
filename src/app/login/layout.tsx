import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in — DraftMarket",
  description: "Log in or create a DraftMarket account.",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
