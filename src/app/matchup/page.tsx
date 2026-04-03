import { SiteNav } from "@/components/site-nav";

const playerA = {
  name: "Maya Chen",
  initials: "MC",
  score: 128.4,
  avatarHue: 140,
};

const playerB = {
  name: "Jordan Blake",
  initials: "JB",
  score: 119.2,
  avatarHue: 320,
};

const weekCurrent = 4;
const weekTotal = 7;

const picksA = [
  { symbol: "SOL", direction: "long" as const, points: 18.6 },
  { symbol: "ETH", direction: "short" as const, points: 12.1 },
  { symbol: "BTC", direction: "long" as const, points: 8.4 },
  { symbol: "ARB", direction: "long" as const, points: -4.2 },
  { symbol: "LINK", direction: "short" as const, points: 5.1 },
];

const picksB = [
  { symbol: "SOL", direction: "short" as const, points: -16.2 },
  { symbol: "ETH", direction: "long" as const, points: 9.8 },
  { symbol: "BNB", direction: "long" as const, points: 22.4 },
  { symbol: "DOGE", direction: "long" as const, points: -3.0 },
  { symbol: "OP", direction: "short" as const, points: 6.2 },
];

const feed = [
  "SOL up 7.1% — your long is paying off",
  "Jordan’s BNB long hits +22 pts on the session",
  "ETH funding flipped — volatility picking up",
  "ARB squeezes higher — Maya’s long clawed back from red",
  "Clock: 2h left in Week 7 trading window",
];

function Avatar({
  initials,
  hue,
}: {
  initials: string;
  hue: number;
}) {
  return (
    <div
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] font-mono text-sm font-bold text-background"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 70% 52%), hsl(${hue} 60% 38%))`,
      }}
      aria-hidden
    >
      {initials}
    </div>
  );
}

export default function MatchupPage() {
  const aWins = playerA.score >= playerB.score;
  const scoreAClass = aWins ? "text-accent" : "text-accent-red";
  const scoreBClass = aWins ? "text-accent-red" : "text-accent";
  const weekPct = (weekCurrent / weekTotal) * 100;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
          Live matchup
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Week 7 · Head to head
        </h1>

        <div className="mt-8 flex flex-col items-stretch gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4 lg:flex-1">
            <Avatar initials={playerA.initials} hue={playerA.avatarHue} />
            <div>
              <p className="font-sans text-lg font-semibold">{playerA.name}</p>
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
                You
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center px-4">
            <div className="flex items-baseline gap-3 sm:gap-6">
              <span
                className={`font-mono text-4xl font-bold tabular-nums sm:text-5xl md:text-6xl ${scoreAClass}`}
              >
                {playerA.score.toFixed(1)}
              </span>
              <span className="font-mono text-xl text-muted sm:text-2xl">
                —
              </span>
              <span
                className={`font-mono text-4xl font-bold tabular-nums sm:text-5xl md:text-6xl ${scoreBClass}`}
              >
                {playerB.score.toFixed(1)}
              </span>
            </div>
            <p className="mt-2 font-mono text-xs uppercase tracking-wider text-muted">
              Weekly fantasy score
            </p>
          </div>

          <div className="flex items-center gap-4 lg:flex-1 lg:flex-row-reverse lg:text-right">
            <Avatar initials={playerB.initials} hue={playerB.avatarHue} />
            <div>
              <p className="font-sans text-lg font-semibold">{playerB.name}</p>
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
                Opponent
              </p>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-xl">
          <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-muted">
            <span>Week progress</span>
            <span className="tabular-nums text-foreground">
              Day {weekCurrent} / {weekTotal}
            </span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuenow={weekCurrent}
            aria-valuemin={1}
            aria-valuemax={weekTotal}
            aria-label="Week progress"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${weekPct}%` }}
            />
          </div>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-2">
          <section aria-label={`${playerA.name} picks`}>
            <h2 className="border-b border-[color:var(--border)] pb-2 font-mono text-xs uppercase tracking-wider text-muted">
              {playerA.name.split(" ")[0]}&apos;s picks
            </h2>
            <ul className="mt-4 space-y-3">
              {picksA.map((p) => (
                <li
                  key={p.symbol}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--border)] bg-white/[0.02] px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-base font-bold text-foreground">
                      {p.symbol}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide ${
                        p.direction === "long"
                          ? "bg-accent/15 text-accent"
                          : "bg-accent-red/15 text-accent-red"
                      }`}
                    >
                      {p.direction}
                    </span>
                  </div>
                  <span
                    className={`font-mono text-sm font-bold tabular-nums ${
                      p.points >= 0 ? "text-accent" : "text-accent-red"
                    }`}
                  >
                    {p.points >= 0 ? "+" : ""}
                    {p.points.toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label={`${playerB.name} picks`}>
            <h2 className="border-b border-[color:var(--border)] pb-2 font-mono text-xs uppercase tracking-wider text-muted">
              {playerB.name.split(" ")[0]}&apos;s picks
            </h2>
            <ul className="mt-4 space-y-3">
              {picksB.map((p) => (
                <li
                  key={p.symbol}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--border)] bg-white/[0.02] px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-base font-bold text-foreground">
                      {p.symbol}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide ${
                        p.direction === "long"
                          ? "bg-accent/15 text-accent"
                          : "bg-accent-red/15 text-accent-red"
                      }`}
                    >
                      {p.direction}
                    </span>
                  </div>
                  <span
                    className={`font-mono text-sm font-bold tabular-nums ${
                      p.points >= 0 ? "text-accent" : "text-accent-red"
                    }`}
                  >
                    {p.points >= 0 ? "+" : ""}
                    {p.points.toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="mt-14" aria-label="Activity feed">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            Live feed
          </h2>
          <ul className="mt-4 divide-y divide-white/10 rounded-lg border border-[color:var(--border)] bg-black/25">
            {feed.map((line) => (
              <li
                key={line}
                className="flex gap-3 px-4 py-3 font-mono text-sm text-foreground/90 first:rounded-t-lg last:rounded-b-lg"
              >
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
