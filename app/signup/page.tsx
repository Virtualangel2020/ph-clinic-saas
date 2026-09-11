import { createClient } from "@/lib/supabase/server";
import { getMaintenanceStatus } from "@/lib/maintenance";
import { MaintenanceNotice } from "@/components/maintenance-notice";
import { SignupFormWithSuspense } from "./signup-form";

// Server wrapper — checks maintenance mode (Angel: "do not allow anybody to
// create an account or login" while she's doing a system update) before
// ever rendering the real signup form. See lib/maintenance.ts.
export default async function SignupPage() {
  const supabase = await createClient();
  const { isEnabled, message } = await getMaintenanceStatus(supabase);
  if (isEnabled) return <MaintenanceNotice message={message} />;

  return <SignupFormWithSuspense />;
}
