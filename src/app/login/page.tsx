"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function SubmitSpinner({ className }: { className?: string }) {
  return (
    <span
      className={`inline-block size-4 shrink-0 rounded-full border-2 border-current border-t-transparent opacity-90 animate-spin ${className ?? ""}`}
      aria-hidden
    />
  );
}

/** Browser timer id (avoids NodeJS.Timeout vs DOM number mismatch in client code). */
type BrowserTimeoutId = ReturnType<typeof globalThis.setTimeout>;

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

/** Supabase Auth requires an email; we never show this to players. */
function internalAuthEmail(trimmedUsername: string): string {
  return `${trimmedUsername.toLowerCase()}@draftmarket.app`;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/picks";

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [signUpSuccess, setSignUpSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [welcomeRedirect, setWelcomeRedirect] = useState(false);
  const postSignUpRedirectRef = useRef<BrowserTimeoutId | null>(null);

  useEffect(() => {
    return () => {
      if (postSignUpRedirectRef.current != null) {
        globalThis.clearTimeout(postSignUpRedirectRef.current);
      }
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSignUpSuccess(null);
    setLoading(true);

    const nameErr = validateUsername(username);
    if (nameErr) {
      setLoading(false);
      setError(nameErr);
      return;
    }

    const trimmed = username.trim();
    const authEmail = internalAuthEmail(trimmed);
    const supabase = createClient();

    if (mode === "login") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password,
      });
      setLoading(false);
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.push(redirectTo);
      router.refresh();
      return;
    }

    const origin = window.location.origin;

    let data: Awaited<
      ReturnType<typeof supabase.auth.signUp>
    >["data"];
    let signUpError: Awaited<
      ReturnType<typeof supabase.auth.signUp>
    >["error"];

    try {
      const result = await supabase.auth.signUp({
        email: authEmail,
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });
      data = result.data;
      signUpError = result.error;
    } catch (err) {
      console.log(err);
      setLoading(false);
      setError(err instanceof Error ? err.message : "Sign up failed");
      return;
    }

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    if (data.session && data.user) {
      const { error: insertError } = await supabase.from("profiles").insert({
        id: data.user.id,
        username: trimmed,
      });

      if (insertError) {
        setLoading(false);
        if (insertError.code === "23505") {
          setError(
            "That username is already taken. Try another, or sign in if it's yours.",
          );
        } else {
          setError(insertError.message);
        }
        return;
      }

      setLoading(false);
      setWelcomeRedirect(true);
      postSignUpRedirectRef.current = globalThis.setTimeout(() => {
        postSignUpRedirectRef.current = null;
        router.push(redirectTo);
        router.refresh();
      }, 1800);
      return;
    }

    setLoading(false);
    setSignUpSuccess(
      "Account created. If your project requires email confirmation, check your inbox to verify — then sign in with your username. We'll ask for a real email later if you win a prize.",
    );
    setPassword("");
    setMode("login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#080c0a] text-[#e8f0ec]">
      <header className="border-b border-[color:rgba(0,255,100,0.12)]">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-6">
          <Link
            href="/"
            className="font-mono text-sm font-bold tracking-tight text-[#00ff64]"
          >
            <span className="text-[#e8f0ec]">Draft</span>Market
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col justify-center px-6 py-12">
        <div className="mx-auto w-full max-w-md">
          {welcomeRedirect ? (
            <div
              className="rounded-lg border border-[rgba(0,255,100,0.2)] bg-[rgba(0,255,100,0.06)] px-6 py-10 text-center"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#00ff64]">
                You&apos;re in
              </p>
              <h2 className="mt-4 font-sans text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
                Welcome to DraftMarket!
              </h2>
              <p className="mt-3 font-sans text-sm leading-relaxed text-[#6b7f72]">
                Setting up your account…
              </p>
              <div className="mt-8 flex justify-center">
                <span
                  className="inline-block size-6 rounded-full border-2 border-[#00ff64]/25 border-t-[#00ff64] animate-spin"
                  aria-hidden
                />
              </div>
            </div>
          ) : (
            <>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#00ff64]">
                Account
              </p>
              <h1 className="mt-2 font-sans text-3xl font-semibold tracking-tight">
                {mode === "login" ? "Welcome back" : "Create account"}
              </h1>
              <p className="mt-2 font-sans text-sm text-[#6b7f72]">
                {mode === "login"
                  ? "Sign in with your username and password."
                  : "Pick a username and password — 3–20 characters, letters, numbers, and underscores only."}
              </p>

              {searchParams.get("error") === "auth" && (
                <p className="mt-4 rounded border border-[#ff4d6d]/40 bg-[#ff4d6d]/10 px-3 py-2 font-mono text-xs leading-relaxed text-[#ff4d6d]">
                  {searchParams.get("message")?.trim() ||
                    "Something went wrong confirming your session. Try signing in again."}
                </p>
              )}

              {signUpSuccess && (
                <p className="mt-4 rounded border border-[#00ff64]/40 bg-[#00ff64]/10 px-3 py-2 font-mono text-xs leading-relaxed text-[#00ff64]">
                  {signUpSuccess}
                </p>
              )}

              {error && (
                <p className="mt-4 rounded border border-[#ff4d6d]/40 bg-[#ff4d6d]/10 px-3 py-2 font-mono text-xs text-[#ff4d6d]">
                  {error}
                </p>
              )}

              <div className="mt-8 flex rounded-lg border border-[rgba(0,255,100,0.12)] bg-black/30 p-1 font-mono text-[11px] uppercase tracking-wider">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setMode("login");
                    setError(null);
                    setSignUpSuccess(null);
                    setUsername("");
                    setPassword("");
                  }}
                  className={`flex-1 rounded-md py-2 transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    mode === "login"
                      ? "bg-[#00ff64]/20 text-[#00ff64]"
                      : "text-[#6b7f72] hover:text-[#e8f0ec]"
                  }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                    setSignUpSuccess(null);
                    setUsername("");
                    setPassword("");
                  }}
                  className={`flex-1 rounded-md py-2 transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    mode === "signup"
                      ? "bg-[#00ff64]/20 text-[#00ff64]"
                      : "text-[#6b7f72] hover:text-[#e8f0ec]"
                  }`}
                >
                  Sign up
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div>
                  <label
                    htmlFor="username"
                    className="font-mono text-[11px] uppercase tracking-wider text-[#6b7f72]"
                  >
                    Username
                  </label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    minLength={3}
                    maxLength={20}
                    disabled={loading}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="mt-1.5 w-full rounded border border-[rgba(0,255,100,0.15)] bg-[#080c0a] px-3 py-2.5 font-mono text-sm text-[#e8f0ec] outline-none ring-[#00ff64]/40 placeholder:text-[#6b7f72] focus:border-[#00ff64]/50 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="crypto_king"
                  />
                </div>
                <div>
                  <label
                    htmlFor="password"
                    className="font-mono text-[11px] uppercase tracking-wider text-[#6b7f72]"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    required
                    minLength={6}
                    disabled={loading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1.5 w-full rounded border border-[rgba(0,255,100,0.15)] bg-[#080c0a] px-3 py-2.5 font-mono text-sm text-[#e8f0ec] outline-none ring-[#00ff64]/40 placeholder:text-[#6b7f72] focus:border-[#00ff64]/50 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="••••••••"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  aria-busy={loading}
                  className={`inline-flex w-full items-center justify-center gap-2.5 rounded bg-[#00ff64] py-3 font-mono text-sm font-bold tracking-wide text-[#080c0a] transition hover:enabled:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 ${
                    loading ? "normal-case font-semibold" : "uppercase"
                  }`}
                >
                  {loading && <SubmitSpinner />}
                  {loading
                    ? mode === "login"
                      ? "Signing in..."
                      : "Creating account..."
                    : mode === "login"
                      ? "Sign in"
                      : "Create account"}
                </button>
                {loading ? (
                  <p
                    className="text-center font-mono text-[11px] leading-relaxed text-[#6b7f72]"
                    aria-live="polite"
                  >
                    This may take a few seconds...
                  </p>
                ) : null}
              </form>

              <p className="mt-8 text-center font-mono text-[11px] text-[#6b7f72]">
                <Link href="/" className="text-[#00ff64] hover:underline">
                  ← Back to home
                </Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080c0a]">
      <p className="font-mono text-sm text-[#6b7f72]">Loading…</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
