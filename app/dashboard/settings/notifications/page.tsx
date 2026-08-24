import { requireClinicMember } from "@/lib/require-clinic-member";
import { BackLink } from "@/components/back-link";
import { NotificationsForm } from "./notifications-form";

// Which events raise an alert, and how (in-app / email). This is a
// per-user preference page, not a clinic-wide admin policy — every staff
// member sets their own — so it uses requireClinicMember() rather than
// requireClinicAdmin().
export default async function NotificationsPage() {
  const { supabase, user } = await requireClinicMember();

  const { data: existing } = await supabase
    .from("notification_preferences")
    .select("event_key, in_app, email")
    .eq("user_id", user.id);

  return (
    <div style={{ maxWidth: 640 }}>
      <BackLink href="/dashboard/settings" label="Settings" />
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Notifications</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        Choose which events raise an alert for you, and where — in-app, by email, or both.
      </p>
      <NotificationsForm existing={existing ?? []} />
    </div>
  );
}
