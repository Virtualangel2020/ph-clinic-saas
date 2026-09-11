import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Root cause found (Find a Doctor crash investigation, Digest 800866611,
// third pass — see lib/auth/safe-get-user.ts for the full mechanism): this
// app never had the middleware.ts the official Supabase Next.js App
// Router pattern requires. Without it, a session's access token can
// expire and get silently refreshed in-memory on the server (auth-js does
// this automatically inside getUser()/getSession()), but that refreshed
// session was NEVER being written back to the browser as cookies — Server
// Components literally cannot set cookies (see lib/supabase/server.ts's
// setAll, which has always had to silently swallow that exact Next.js
// restriction). Over enough requests, that mismatch can leave a browser
// holding a stale or partially-chunked session cookie (Supabase splits a
// session across `sb-<ref>-auth-token.0`, `.1`, ... once it's larger than
// ~3.1KB) that fails to decode — an error auth-js does NOT treat as a
// normal auth failure, so it throws straight past any page-level
// try/catch and into Next's generic error boundary.
//
// This middleware is the actual fix for that root cause: it runs on every
// request, calls supabase.auth.getUser() (which both validates the
// current session AND refreshes it if the access token has expired), and
// — critically — persists any refreshed session back onto both the
// request (so this request's Server Components see the fresh cookie too)
// and the response (so the browser actually receives it). This is the
// standard, official pattern; it does not add any redirect/auth-gating
// logic of its own — every page's existing requirePatientPortal() /
// requireAdmin() / requireClinicMember() checks are unchanged and remain
// the actual authorization boundary. getPortalUser() (safe-get-user.ts)
// stays in place alongside this as defense-in-depth for any session that
// was already corrupted in a browser before this fix shipped.
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    }
  );

  // Do not add logic between createServerClient and getUser() — per
  // Supabase's own guidance, that's the easiest way to accidentally break
  // the refresh/cookie-sync this middleware exists to guarantee.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  // Run on every route except static assets and image optimization files
  // — those never touch auth and don't need a session refresh.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
