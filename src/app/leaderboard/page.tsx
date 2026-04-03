"use client";

import { useMemo, useState } from "react";
import { SiteNav } from "@/components/site-nav";

type Tab = "global" | "league" | "friends";

type Row = {
  rank: number;
  name: string;
  record: string;
  weeklyScore: number;
  prize: string;
};

const globalRows: Row[] = [
  {
    rank: 1,
    name: "Maya Chen",
    record: "9-2",
    weeklyScore: 128.4,
    prize: "£50",
  },
  {
    rank: 2,
    name: "Jordan Blake",
    record: "8-3",
    weeklyScore: 119.2,
    prize: "—",
  },
  {
    rank: 3,
    name: "Sam Okonkwo",
    record: "7-4",
    weeklyScore: 112.0,
    prize: "—",
  },
  {
    rank: 4,
    name: "Riley Park",
    record: "6-5",
    weeklyScore: 104.8,
    prize: "—",
  },
  {
    rank: 5,
    name: "Alex Morgan",
    record: "6-5",
    weeklyScore: 98.1,
    prize: "—",
  },
  {
    rank: 6,
    name: "Casey Liu",
    record: "5-6",
    weeklyScore: 91.5,
    prize: "—",
  },
];

const leagueRows: Row[] = [
  {
    rank: 1,
    name: "Maya Chen",
    record: "4-1",
    weeklyScore: 128.4,
    prize: "£50",
  },
  {
    rank: 2,
    name: "Jordan Blake",
    record: "3-2",
    weeklyScore: 119.2,
    prize: "—",
  },
  {
    rank: 3,
    name: "Taylor Brooks",
    record: "2-3",
    weeklyScore: 88.4,
    prize: "—",
  },
  {
    rank: 4,
    name: "Jamie Fox",
    record: "1-4",
    weeklyScore: 72.0,
    prize: "—",
  },
];

const friendsRows: Row[] = [
  {
    rank: 1,
    name: "Maya Chen",
    record: "11-1",
    weeklyScore: 128.4,
    prize: "£50",
  },
  {
    rank: 2,
    name: "Priya Shah",
    record: "7-5",
    weeklyScore: 115.9,
    prize: "—",
  },
  {
    rank: 3,
    name: "Jordan Blake",
    record: "6-6",
    weeklyScore: 119.2,
    prize: "—",
  },
];

const tabs: { id: Tab; label: string }[] = [
  { id: "global", label: "Global" },
  { id: "league", label: "My League" },
  { id: "friends", label: "Friends" },
];

export default function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>("global");

  const rows = useMemo(() => {
    if (tab === "league") return leagueRows;
    if (tab === "friends") return friendsRows;
    return globalRows;
  }, [tab]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-4 sm:px-6 sm:py-5">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
            Week 7 prize
          </p>
          <p className="mt-1 font-sans text-2xl font-semibold tracking-tight sm:text-3xl">
            <span className="font-mono text-accent">£50</span>{" "}
            <span className="text-foreground/90">Week 7 pool</span>
          </p>
          <p className="mt-2 max-w-xl font-mono text-xs text-muted">
            Paid to the top weekly score in each scope. Ties split by
            tiebreakers.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Leaderboard
            </h1>
            <p className="mt-1 font-mono text-xs uppercase tracking-wider text-muted">
              Rankings update as markets move
            </p>
          </div>

          <div
            className="flex gap-1 rounded-lg border border-[color:var(--border)] bg-black/30 p-1 font-mono text-[11px] uppercase tracking-wider"
            role="tablist"
            aria-label="Leaderboard scope"
          >
            {tabs.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`rounded-md px-3 py-2 transition ${
                  tab === id
                    ? "bg-accent/20 text-accent"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-lg border border-[color:var(--border)]">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[color:var(--border)] font-mono text-[11px] uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-medium">Rank</th>
                <th className="px-4 py-3 font-medium">Player</th>
                <th className="px-4 py-3 font-medium">W–L</th>
                <th className="px-4 py-3 font-medium">Weekly</th>
                <th className="px-4 py-3 font-medium">Prize</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const winner = i === 0;
                return (
                  <tr
                    key={`${tab}-${row.rank}-${row.name}`}
                    className={
                      winner
                        ? "bg-accent/15 text-foreground"
                        : "border-t border-white/5 bg-white/[0.02]"
                    }
                  >
                    <td className="px-4 py-3 font-mono text-sm font-bold tabular-nums">
                      {row.rank}
                    </td>
                    <td className="px-4 py-3 font-sans text-sm font-medium">
                      {row.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm tabular-nums text-muted">
                      {row.record}
                    </td>
                    <td
                      className={`px-4 py-3 font-mono text-sm font-bold tabular-nums ${
                        winner ? "text-accent" : "text-foreground"
                      }`}
                    >
                      {row.weeklyScore.toFixed(1)}
                    </td>
                    <td
                      className={`px-4 py-3 font-mono text-sm font-bold ${
                        row.prize !== "—" ? "text-accent" : "text-muted"
                      }`}
                    >
                      {row.prize}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
