import { requireClinicMember } from "@/lib/require-clinic-member";
import { ProviderCredentialsForm } from "./provider-credentials-form";
import { SignatureManager } from "./signature-manager";
import { ApprovalQueue } from "./approval-queue";

// Parts 21-23: provider credentials + signature, each protected by a
// Clinic Admin approval step so nothing legally-significant changes
// silently. A non-admin only ever sees their own record and their own
// pending requests; a Clinic Admin also sees the clinic-wide queue.
export default async function ProvidersPage() {
  const { supabase, user, profile } = await requireClinicMember();
  const isAdmin = profile.role === "clinic_admin" || profile.role === "platform_admin";

  const [{ data: signatures }, { data: credentialRequests }, adminQueues] = await Promise.all([
    supabase
      .from("provider_signatures")
      .select("id, status, signature_path, requested_at, reviewed_at, rejection_note")
      .eq("user_id", user.id)
      .order("requested_at", { ascending: false })
      .limit(5),
    supabase
      .from("provider_credential_change_requests")
      .select("id, field_key, old_value, new_value, status, requested_at, rejection_note")
      .eq("user_id", user.id)
      .order("requested_at", { ascending: false })
      .limit(5),
    isAdmin
      ? Promise.all([
          supabase
            .from("provider_signatures")
            .select("id, user_id, signature_path, requested_at, user_profiles(full_name)")
            .eq("status", "pending")
            .order("requested_at"),
          supabase
            .from("provider_credential_change_requests")
            .select("id, user_id, field_key, old_value, new_value, requested_at, user_profiles(full_name)")
            .eq("status", "pending")
            .order("requested_at"),
        ])
      : Promise.resolve([{ data: [] }, { data: [] }]),
  ]);

  const [{ data: pendingSignatures }, { data: pendingCredentials }] = adminQueues as any;

  let activeSignatureUrl: string | null = null;
  const activeSignature = (signatures ?? []).find((s) => s.status === "approved");
  if (activeSignature) {
    const { data } = await supabase.storage.from("provider-signatures").createSignedUrl(activeSignature.signature_path, 3600);
    activeSignatureUrl = data?.signedUrl ?? null;
  }

  // Preview images for the Clinic Admin approval queue.
  let signedUrlsByPath: Record<string, string> = {};
  if (isAdmin && (pendingSignatures ?? []).length > 0) {
    const { data } = await supabase.storage
      .from("provider-signatures")
      .createSignedUrls((pendingSignatures ?? []).map((s: any) => s.signature_path), 3600);
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) signedUrlsByPath[entry.path] = entry.signedUrl;
    }
  }

  return (
    <div style={{ maxWidth: 720, display: "grid", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Providers & Credentials</h1>
        <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
          Your professional details and signature auto-populate every document once they're approved — no
          re-entering them each time you sign something.
        </p>
      </div>

      <ProviderCredentialsForm profile={profile as any} isAdmin={isAdmin} pendingRequests={(credentialRequests ?? []).filter((r) => r.status === "pending")} />

      <SignatureManager signatures={signatures ?? []} activeSignatureUrl={activeSignatureUrl} />

      {isAdmin && (
        <ApprovalQueue
          pendingSignatures={pendingSignatures ?? []}
          pendingCredentials={pendingCredentials ?? []}
          signedUrlsByPath={signedUrlsByPath}
        />
      )}
    </div>
  );
}
