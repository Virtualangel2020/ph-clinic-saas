import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. Uses the publishable (anon) key only —
// RLS policies (see the 001-005 migrations) are what actually protect
// the data; this key is safe to expose in client-side code.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
