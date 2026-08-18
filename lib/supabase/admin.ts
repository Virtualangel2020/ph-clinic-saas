import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// SERVER-ONLY, ELEVATED CLIENT. Uses the service-role key, which bypasses
// Row Level Security entirely. The rest of this app deliberately never
// does that (see the comment in lib/require-admin.ts) — this file exists
// for the two things that genuinely can't be done any other way:
//
//   1. Creating a Supabase Auth user + sending Supabase's built-in invite
//      email (auth.admin.inviteUserByEmail) when a platform admin invites
//      clinic staff — there is no RLS-respecting way to create an auth
//      user on someone else's behalf.
//   2. Recording a payment from the PayMongo webhook, which arrives with
//      no user session at all (it's a server-to-server call from
//      PayMongo, authenticated by verifying its signature instead).
//
// NEVER import this from a Client Component, NEVER log the key, and only
// call it from Server Actions / Route Handlers.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Add it as a server-only Environment Variable in Vercel " +
        "(Supabase dashboard → Project Settings → API → service_role secret) — never commit it to code."
    );
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
