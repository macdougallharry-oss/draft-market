import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/picks";

  if (code) {
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

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const redirectResponse = NextResponse.redirect(`${origin}${next}`);
      Object.entries(cacheHeaders).forEach(([key, value]) =>
        redirectResponse.headers.set(key, value),
      );
      return redirectResponse;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
