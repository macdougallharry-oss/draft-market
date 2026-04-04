import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

function loginAuthErrorRedirect(
  origin: string,
  message: string,
): NextResponse {
  const params = new URLSearchParams({
    error: "auth",
    message,
  });
  return NextResponse.redirect(`${origin}/login?${params.toString()}`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { searchParams, origin } = url;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/picks";

  console.log("[auth/callback] received request", {
    origin: url.origin,
    hasCode: Boolean(code),
    next,
    searchParamKeys: [...searchParams.keys()],
  });

  if (!code) {
    console.warn(
      "[auth/callback] missing ?code= — user may have opened the URL without completing the OAuth/email flow",
    );
    return loginAuthErrorRedirect(
      origin,
      "No sign-in code was found in the link. Use the link from your email again, or sign in with email and password.",
    );
  }

  const cookieStore = await cookies();
  let cacheHeaders: Record<string, string> = {};

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
          cacheHeaders = { ...cacheHeaders, ...headers };
        },
      },
    },
  );

  console.log("[auth/callback] exchanging code for session…");
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession failed", {
      message: error.message,
      name: error.name,
    });
    const detail =
      error.message?.trim() ||
      "We could not complete sign-in. Try again or request a new confirmation link.";
    return loginAuthErrorRedirect(origin, detail);
  }

  console.log("[auth/callback] session established, redirecting", {
    next,
  });

  const redirectResponse = NextResponse.redirect(`${origin}${next}`);
  Object.entries(cacheHeaders).forEach(([key, value]) =>
    redirectResponse.headers.set(key, value),
  );
  return redirectResponse;
}
