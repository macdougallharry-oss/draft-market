"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/learn", label: "Learn" },
  { href: "/picks", label: "Picks" },
  { href: "/leaderboard", label: "Leaderboard" },
] as const;

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-[color:var(--border)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:h-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-y-0 sm:px-6">
        <Link
          href="/"
          className="font-mono text-sm font-bold tracking-tight text-accent"
        >
          <span className="text-foreground">Draft</span>Market
        </Link>
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <nav
            className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-wider text-muted sm:gap-x-6"
            aria-label="Main"
          >
            {links.map(({ href, label }) => {
              const active =
                href === "/"
                  ? pathname === "/"
                  : href.startsWith("/#")
                    ? false
                    : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={
                    active
                      ? "text-accent"
                      : "transition-colors hover:text-accent"
                  }
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <Link
            href="/picks"
            className="inline-flex items-center rounded border border-accent/40 bg-accent/10 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wide text-accent transition hover:bg-accent/20"
          >
            Play
          </Link>
        </div>
      </div>
    </header>
  );
}
