import { requireClinicMember } from "@/lib/require-clinic-member";
import { BackLink } from "@/components/back-link";
import { SupportThread } from "./support-thread";

// New add-on (Part: Customer Care). Only clinics who've availed it
// (tenant_entitlements has an active 'customer_care' row — either bundled
// into their plan or purchased as an add-on via the Superadmin client
// editor) get the actual thread. Everyone else sees a short explanation
// instead of a "coming in a later phase" placeholder, since this already
// exists — it's just gated by entitlement, not by build status.
export default async function CustomerCarePage() {
  const { supabase, profile } = await requireClinicMember();

  const { data: entitlement } = await supabase
    .from("tenant_entitlements")
    .select("feature_key")
    .eq("tenant_id", profile.tenant_id)
    .eq("feature_key", "customer_care")
    .eq("status", "active")
    .maybeSingle();

  const isEntitled = !!entitlement;

  let messages: any[] = [];
  if (isEntitled) {
    const { data } = await supabase
      .from("support_messages")
      .select("id, sender_type, sender_name, body, created_at, read_at")
      .eq("tenant_id", profile.tenant_id)
      .order("created_at", { ascending: true });
    messages = data ?? [];
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <BackLink href="/dashboard/settings" label="Settings" />
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Customer Care</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        A direct, ongoing line to the Virtual Angel Systems support team — one running conversation per clinic, like
        a messaging app. Send a message any time; we'll reply right here.
      </p>

      {isEntitled ? (
        <SupportThread initialMessages={messages} />
      ) : (
        <div style={{ background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 10, padding: "16px 18px", fontSize: 13, color: "#7a5c12" }}>
          Customer Care isn't included on your current plan yet. Reach out to Virtual Angel Systems and we can add it
          to your account.
        </div>
      )}
    </div>
  );
}
