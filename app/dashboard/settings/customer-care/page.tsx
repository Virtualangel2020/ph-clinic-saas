import { requireClinicMember } from "@/lib/require-clinic-member";
import { BackLink } from "@/components/back-link";
import { SupportThread } from "./support-thread";

// Customer Care is a core, always-included AngelClinic feature (retired as
// a paid add-on by the angelclinic_core_reclassify_addons migration, which
// also granted every tenant an active 'customer_care' plan_features
// entitlement). The entitlement check below is kept as the source of truth
// rather than removed outright — it stays correct for any tenant without a
// subscription row yet, and needs no further change if Core's feature list
// is ever revisited.
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
