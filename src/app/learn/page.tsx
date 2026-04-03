import Link from "next/link";
import { SiteNav } from "@/components/site-nav";

const sections = [
  {
    title: "What is long vs short?",
    body: "Going long means you think the price will go up. Going short means you think it will go down.",
    example: {
      type: "longShort" as const,
    },
  },
  {
    title: "How do confidence points work?",
    body: "You have 100 points to spread across up to 5 picks. The more points you put on a pick, the more it affects your score.",
    example: {
      type: "confidence" as const,
    },
  },
  {
    title: "How is my score calculated?",
    body: "Score = price change % × confidence points. Bigger moves and higher conviction multiply together.",
    example: {
      type: "score" as const,
    },
  },
  {
    title: "What makes a good pick?",
    body: "Look for coins with upcoming catalysts, strong momentum, or that are unusually overbought or oversold. Concentrate points on your highest conviction calls.",
    example: {
      type: "tips" as const,
    },
  },
  {
    title: "When can I play?",
    body: "Picks open Monday, lock Tuesday midnight. Week settles Sunday. Maximum wait to play is 7 days. Browse and plan your picks anytime.",
    example: {
      type: "schedule" as const,
    },
  },
];

function ExampleVisual({ type }: { type: (typeof sections)[number]["example"]["type"] }) {
  if (type === "longShort") {
    return (
      <div className="mt-4 space-y-3 rounded-lg border border-[color:var(--border)] bg-black/40 p-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
          Example
        </p>
        <div className="rounded-md border border-accent/30 bg-accent/10 p-3">
          <p className="font-mono text-xs font-bold uppercase tracking-wide text-accent">
            Long · BTC
          </p>
          <p className="mt-2 font-sans text-sm text-foreground/90">
            You go long at <span className="font-mono text-muted">$80,000</span>.
            Price rises to{" "}
            <span className="font-mono text-muted">$84,000</span>.
          </p>
          <p className="mt-2 font-mono text-lg font-bold text-accent">+5%</p>
        </div>
        <p className="font-sans text-xs text-muted">
          <span className="font-mono text-accent-red">Short</span> is the
          mirror: you profit when price falls — same idea, opposite direction.
        </p>
      </div>
    );
  }

  if (type === "confidence") {
    return (
      <div className="mt-4 rounded-lg border border-[color:var(--border)] bg-black/40 p-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
          Example · 100 pts used
        </p>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-white/10">
          <div
            className="bg-accent"
            style={{ width: "50%" }}
            title="SOL long 50"
          />
          <div
            className="bg-accent-red"
            style={{ width: "30%" }}
            title="ETH short 30"
          />
          <div
            className="bg-accent/70"
            style={{ width: "20%" }}
            title="BTC long 20"
          />
        </div>
        <ul className="mt-4 space-y-2 font-mono text-xs">
          <li className="flex justify-between gap-2">
            <span className="text-accent">50 pts</span>
            <span className="text-foreground/80">SOL · long</span>
          </li>
          <li className="flex justify-between gap-2">
            <span className="text-accent-red">30 pts</span>
            <span className="text-foreground/80">ETH · short</span>
          </li>
          <li className="flex justify-between gap-2">
            <span className="text-accent">20 pts</span>
            <span className="text-foreground/80">BTC · long</span>
          </li>
        </ul>
      </div>
    );
  }

  if (type === "score") {
    return (
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-accent/35 bg-accent/10 p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
            Win example
          </p>
          <p className="mt-2 font-sans text-sm text-foreground/90">
            <span className="font-mono text-accent">+10%</span> move ×{" "}
            <span className="font-mono">40</span> confidence
          </p>
          <p className="mt-3 font-mono text-2xl font-bold text-accent">+400</p>
        </div>
        <div className="rounded-lg border border-accent-red/35 bg-accent-red/10 p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
            Loss example
          </p>
          <p className="mt-2 font-sans text-sm text-foreground/90">
            <span className="font-mono text-accent-red">−5%</span> move ×{" "}
            <span className="font-mono">20</span> confidence
          </p>
          <p className="mt-3 font-mono text-2xl font-bold text-accent-red">
            −100
          </p>
        </div>
      </div>
    );
  }

  if (type === "tips") {
    return (
      <div className="mt-4 rounded-lg border border-[color:var(--border)] bg-black/40 p-4">
        <ul className="space-y-3 font-sans text-sm text-foreground/85">
          <li className="flex gap-3">
            <span className="font-mono text-accent">▸</span>
            Catalysts (listings, upgrades, macro)
          </li>
          <li className="flex gap-3">
            <span className="font-mono text-accent">▸</span>
            Momentum — trend + volume
          </li>
          <li className="flex gap-3">
            <span className="font-mono text-accent-red">▸</span>
            Extremes — crowded longs (fade) or washed-out shorts (bounce)
          </li>
        </ul>
      </div>
    );
  }

  if (type === "schedule") {
    return (
      <div className="mt-4 rounded-lg border border-[color:var(--border)] bg-black/40 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { day: "Mon", label: "Picks open", tone: "accent" as const },
            { day: "Tue", label: "Lock midnight", tone: "muted" as const },
            { day: "Sun", label: "Week settles", tone: "accent" as const },
          ].map((step) => (
            <div
              key={step.day}
              className="rounded-lg border border-[color:var(--border)] bg-white/[0.03] p-3"
            >
              <p
                className={`font-mono text-xs font-bold uppercase ${
                  step.tone === "accent" ? "text-accent" : "text-muted"
                }`}
              >
                {step.day}
              </p>
              <p className="mt-1 font-sans text-sm text-foreground/90">
                {step.label}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 border-t border-[color:var(--border)] pt-4 font-mono text-[11px] text-muted">
          Max wait to play: <span className="text-foreground">7 days</span> ·
          browse &amp; plan anytime
        </p>
      </div>
    );
  }

  return null;
}

export default function LearnPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
          Education
        </p>
        <h1 className="mt-2 font-sans text-3xl font-semibold tracking-tight sm:text-4xl">
          How to play
        </h1>
        <p className="mt-3 max-w-2xl font-sans text-base leading-relaxed text-muted">
          DraftMarket is fantasy crypto: pick coins, call direction, and rack up
          points against your league. Here&apos;s the short version.
        </p>

        <div className="mt-12 space-y-8">
          {sections.map((section, index) => (
            <article
              key={section.title}
              className="rounded-xl border border-[color:var(--border)] bg-white/[0.02] p-6 sm:p-8"
            >
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-sm font-bold text-accent/60">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h2 className="font-sans text-xl font-semibold tracking-tight sm:text-2xl">
                  {section.title}
                </h2>
              </div>
              <p className="mt-4 font-sans text-sm leading-relaxed text-muted sm:text-base">
                {section.body}
              </p>
              <ExampleVisual type={section.example.type} />
            </article>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center gap-4 border-t border-[color:var(--border)] pt-12">
          <p className="text-center font-sans text-sm text-muted">
            Ready to put it into practice?
          </p>
          <Link
            href="/picks"
            className="inline-flex items-center justify-center rounded bg-accent px-8 py-3 font-mono text-sm font-bold uppercase tracking-wide text-background transition hover:brightness-110"
          >
            Make your picks
          </Link>
        </div>
      </main>
    </div>
  );
}
