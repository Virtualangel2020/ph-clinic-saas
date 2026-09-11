import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getMaintenanceStatus } from "@/lib/maintenance";
import { MaintenanceNotice } from "@/components/maintenance-notice";
import { LoginForm } from "./login-form";

// Server wrapper — checks maintenance mode (Angel: "do not allow anybody to
// create an account or login" while she's doing a system update) before
// ever rendering the real sign-in form. See lib/maintenance.ts.
export default async function LoginPage() {
  const supabase = await createClient();
  const { isEnabled, message } = await getMaintenanceStatus(supabase);
  if (isEnabled) return <MaintenanceNotice message={message} />;

  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
