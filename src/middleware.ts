import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function isProtectedPath(pathname: string) {
  return (
    pathname.startsWith("/picks") ||
    pathname.startsWith("/matchup") ||
    pathname.startsWith("/leaderboard") ||
    pathname.startsWith("/onboarding")
  );
}

/** Logged-in users need a profile row before using these routes. */
function requiresCompletedProfile(pathname: string) {
  return (
    pathname.startsWith("/picks") ||
    pathname.startsWith("/matchup") ||
    pathname.startsWith("/leaderboard")
  );
}

export async function middleware(request: NextRequest) {
  const supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  let hasProfile = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    hasProfile = !!profile;
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    if (!hasProfile) {
      url.pathname = "/onboarding";
      url.searchParams.delete("redirect");
      return NextResponse.redirect(url);
    }
    const next = request.nextUrl.searchParams.get("redirect");
    const safeRedirect =
      next != null &&
      next.startsWith("/") &&
      !next.startsWith("//") &&
      !next.includes("://")
        ? next
        : null;
    url.pathname = safeRedirect ?? "/picks";
    url.searchParams.delete("redirect");
    return NextResponse.redirect(url);
  }

  if (user && pathname.startsWith("/onboarding") && hasProfile) {
    const url = request.nextUrl.clone();
    url.pathname = "/picks";
    return NextResponse.redirect(url);
  }

  if (user && requiresCompletedProfile(pathname) && !hasProfile) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    return NextResponse.redirect(url);
  }

  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
