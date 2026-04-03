import type { Metadata } from "next";
import { Space_Mono, Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "DraftMarket",
  description:
    "Fantasy crypto trading — pick coins, go long or short, and compete in leagues.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${syne.variable} ${spaceMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
