import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { createClient } from "@/lib/supabase/server";

const steps = [
  {
    n: "01",
    title: "Draft your roster",
    body: "Pick the coins you believe in — build a lineup that fits your read on the market.",
  },
  {
    n: "02",
    title: "Call long or short",
    body: "Each round, stake your conviction. Green when you’re bullish, red when you’re betting the fade.",
  },
  {
    n: "03",
    title: "Climb the league",
    body: "Points stack from performance vs. the field. Top the board and brag with receipts.",
  },
] as const;

async function fetchPlayerCount(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_profile_count");
  if (error) {
    console.error("[home] public_profile_count", error);
    return 0;
  }
  if (typeof data === "number" && Number.isFinite(data)) return data;
  if (typeof data === "string") {
    const n = Number.parseInt(data, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export default async function Home() {
  const playerCount = await fetchPlayerCount();

  const stats = [
    { label: "Players", value: playerCount.toLocaleString("en-US") },
    { label: "Weekly prize", value: "£10" },
    { label: "Coins", value: "14+" },
    { label: "Free", value: "Always" },
  ] as const;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <main>
        <section className="mx-auto max-w-5xl px-6 pb-20 pt-16 sm:pt-24">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-accent">
            Fantasy crypto trading
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl sm:leading-[1.06] md:text-6xl">
            Pick your coins.{" "}
            <span className="text-accent">Long</span>
            {" or "}
            <span className="text-accent-red">short</span>. Beat your league.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted">
            DraftMarket turns volatility into competition — draft assets, set
            directional calls, and outscore rivals in private or public leagues.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/picks"
              className="inline-flex items-center justify-center rounded bg-accent px-6 py-3 font-mono text-sm font-bold uppercase tracking-wide text-background transition hover:brightness-110"
            >
              Make your picks
            </Link>
            <Link
              href="/leaderboard"
              className="inline-flex items-center justify-center rounded border border-white/15 px-6 py-3 font-mono text-sm uppercase tracking-wide text-foreground/90 transition hover:border-accent/50 hover:text-accent"
            >
              See leaderboard
            </Link>
          </div>

          <div className="mt-16 flex flex-wrap gap-3 sm:gap-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-full border border-[color:var(--border)] bg-white/[0.03] px-4 py-2 sm:px-5"
              >
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                  {s.label}
                </span>
                <span className="ml-2 font-mono text-sm font-bold text-accent">
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section
          id="how-it-works"
          className="border-t border-[color:var(--border)] bg-black/20 py-20"
        >
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-muted">
              How it works
            </h2>
            <p className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Three steps. One leaderboard.
            </p>
            <ol className="mt-12 grid gap-8 sm:grid-cols-3 sm:gap-6">
              {steps.map((step, i) => (
                <li
                  key={step.n}
                  className="rounded-lg border border-[color:var(--border)] bg-white/[0.02] p-6"
                >
                  <p
                    className={`font-mono text-sm font-bold tracking-wider ${
                      i === 1 ? "text-accent-red" : "text-accent"
                    }`}
                  >
                    {step.n}
                  </p>
                  <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="border-t border-[color:var(--border)] py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <p className="font-mono text-xs text-muted">
            © {new Date().getFullYear()} DraftMarket
          </p>
          <p className="text-center font-mono text-[11px] text-muted/80">
            Not financial advice. Play responsibly.
          </p>
        </div>
      </footer>
    </div>
  );
}
