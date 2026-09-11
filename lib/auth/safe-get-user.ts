import type { SupabaseClient, User } from "@supabase/supabase-js";

// Root-cause finding (Find a Doctor crash investigation, Digest 800866611,
// third pass): supabase.auth.getUser() does NOT always fail gracefully.
// Reading @supabase/auth-js's own source (GoTrueClient._getUser) shows it
// only returns a clean `{ data: { user: null }, error }` shape for errors
// the SDK recognizes as an AuthError — anything else is RE-THROWN out of
// getUser() uncaught:
//
//   catch (error) {
//     if (isAuthError(error)) { ... return this._returnResult({ data: { user: null }, error }); }
//     throw error;
//   }
//
// A corrupted or partially-chunked session cookie is exactly this kind of
// "anything else": @supabase/ssr splits a session cookie into
// `sb-<ref>-auth-token.0`, `.1`, ... once it exceeds ~3.1KB
// (MAX_CHUNK_SIZE in its chunker.js), and recombines them on read. If the
// chunk count ever changes between what's stored and what a refresh
// produces — exactly what happens when a refreshed session is never
// persisted back to cookies — a stale leftover chunk can get concatenated
// with fresh ones, producing a string that fails to base64/JSON-decode. In
// a plain Server Component that decode happens as a plain SyntaxError/
// TypeError, not an AuthError, so it escapes uncaught straight past any
// local try/catch and into Next's error.tsx boundary. This app has no
// middleware.ts (confirmed absent) — the official Next.js App Router
// pattern that refreshes and re-persists the session on every request —
// and Server Components cannot write cookies themselves (see
// lib/supabase/server.ts's setAll, which silently swallows that exact
// restriction), so a refreshed session was never being saved at all before
// this pass. middleware.ts (added alongside this file) fixes that
// generally; this helper is the defense-in-depth half — no matter what
// state a browser's cookies are already in, failing to resolve "who is
// this" should degrade to "treat as signed out" (a clean re-login writes a
// fresh, valid cookie and self-heals), never a hard crash.
export async function getPortalUser(supabase: SupabaseClient): Promise<User | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ?? null;
  } catch (err) {
    console.error("[auth] supabase.auth.getUser() threw — treating as signed out rather than crashing:", err);
    return null;
  }
}
