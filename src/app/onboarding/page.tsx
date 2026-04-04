"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

function validateUsername(raw: string): string | null {
  const t = raw.trim();
  if (t.length < 3 || t.length > 20) {
    return "Username must be 3–20 characters.";
  }
  if (!USERNAME_RE.test(t)) {
    return "Use only letters, numbers, and underscores (a–z, A–Z, 0–9, _).";
  }
  return null;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function gate() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        router.replace("/login?redirect=/onboarding");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (profile) {
        router.replace("/picks");
        return;
      }
      setLoading(false);
    }

    gate();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const msg = validateUsername(username);
    if (msg) {
      setError(msg);
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSubmitting(false);
      router.replace("/login?redirect=/onboarding");
      return;
    }

    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      username: username.trim(),
    });

    setSubmitting(false);
    if (insertError) {
      if (insertError.code === "23505") {
        setError("That username is already taken. Try another.");
      } else {
        setError(insertError.message);
      }
      return;
    }

    router.push("/picks");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <header className="border-b border-[color:var(--border)]">
          <div className="mx-auto flex h-14 max-w-md items-center px-6">
            <Link
              href="/"
              className="font-mono text-sm font-bold tracking-tight text-accent"
            >
              <span className="text-foreground">Draft</span>Market
            </Link>
          </div>
        </header>
        <main className="flex flex-1 items-center justify-center px-6">
          <p className="font-mono text-sm text-muted">Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-[color:var(--border)]">
        <div className="mx-auto flex h-14 max-w-md items-center px-6">
          <Link
            href="/"
            className="font-mono text-sm font-bold tracking-tight text-accent"
          >
            <span className="text-foreground">Draft</span>Market
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col justify-center px-6 py-12">
        <div className="mx-auto w-full max-w-md">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
            Welcome
          </p>
          <h1 className="mt-2 font-sans text-3xl font-semibold tracking-tight">
            Choose a username
          </h1>
          <p className="mt-2 font-sans text-sm text-muted">
            3–20 characters: letters, numbers, and underscores only. This is
            how you&apos;ll show up on the leaderboard.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label
                htmlFor="username"
                className="block font-mono text-[11px] uppercase tracking-wider text-muted"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                className="mt-2 w-full rounded-lg border border-[color:var(--border)] bg-black/30 px-4 py-3 font-mono text-sm text-foreground outline-none transition placeholder:text-muted focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
                placeholder="crypto_king"
              />
            </div>

            {error ? (
              <p className="rounded border border-accent-red/40 bg-accent-red/10 px-3 py-2 font-mono text-xs text-accent-red">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-accent py-3 font-mono text-sm font-bold uppercase tracking-wide text-background transition hover:brightness-110 disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Continue to picks"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
