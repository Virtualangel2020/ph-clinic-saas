import type { SupabaseClient } from "@supabase/supabase-js";

export type MaintenanceStatus = { isEnabled: boolean; message: string };

const DEFAULT_MESSAGE = "MyCareDesk is currently undergoing a quick system update. We'll be back in just a few minutes — thanks for your patience!";

// Read-only check used by every sign-in/sign-up entry point (see
// components/maintenance-notice.tsx and the *-form split in app/login,
// app/signup, app/patient-signup, app/portal/login). maintenance_settings
// is publicly readable by design — a signed-out visitor has to be able to
// read this before they're authenticated at all — so this works the same
// whether `supabase` came from the server client (anon or a real session)
// or, in principle, a browser client too.
export async function getMaintenanceStatus(supabase: SupabaseClient): Promise<MaintenanceStatus> {
  const { data } = await supabase.from("maintenance_settings").select("is_enabled, message").eq("id", true).maybeSingle();
  return {
    isEnabled: !!(data as any)?.is_enabled,
    message: (data as any)?.message || DEFAULT_MESSAGE,
  };
}
