import { requireClinicMember } from "@/lib/require-clinic-member";
import { IncomingTransferRow } from "./incoming-transfer-row";
import { SentTransferRow } from "./sent-transfer-row";

// Records Exchange (spec §7, §14-18) — internal AngelClinic-provider-to-
// -provider sharing, never email. "Incoming" is the Review → Accept & File
// workflow; "Sent" is a read-only log of what this clinic has sent out.
// Deliberately its own page rather than folded into the Phase-5 Referrals
// placeholder — see the spec's explicit instruction to reuse a Records
// Exchange architecture; since none existed yet, this IS that architecture,
// built fresh but keeping the naming the spec used throughout.
export default async function RecordsExchangePage({ searchParams }: { searchParams: { tab?: string } }) {
  const { supabase, profile } = await requireClinicMember();
  const tab = searchParams.tab === "sent" ? "sent" : "incoming";

  const [{ data: incoming }, { data: sent }, { data: patients }, { data: documentFolders }] = await Promise.all([
    supabase
      .from("records_exchange_transfers")
      .select(
        "id, patient_name, patient_dob, record_count, authorization_verified, status, sent_at, accepted_at, sending_provider_name, sending_clinic_name, filed_patient_id, source, note"
      )
      .eq("receiving_tenant_id", profile.tenant_id)
      .order("sent_at", { ascending: false }),
    supabase
      .from("records_exchange_transfers")
      .select("id, patient_name, patient_dob, record_count, status, sent_at, accepted_at, declined_at, receiving_provider_name, receiving_clinic_name, source, note")
      .eq("sending_tenant_id", profile.tenant_id)
      .order("sent_at", { ascending: false }),
    supabase.from("patients").select("id, first_name, middle_name, last_name, date_of_birth, mobile_phone").eq("tenant_id", profile.tenant_id).eq("is_active", true).order("last_name").order("first_name"),
    supabase.from("document_folders").select("key, label").eq("tenant_id", profile.tenant_id).order("label"),
  ]);

  const transferIds = [...(incoming ?? []).map((t: any) => t.id), ...(sent ?? []).map((t: any) => t.id)];
  const { data: attachments } = transferIds.length
    ? await supabase
        .from("records_exchange_transfer_documents")
        .select("id, transfer_id, source_document_id, title, doc_type, description, document_date, storage_path, mime_type, file_size_bytes, filed_document_id")
        .in("transfer_id", transferIds)
    : { data: [] as any[] };

  function attachmentsFor(transferId: string) {
    return ((attachments as any[]) ?? []).filter((a) => a.transfer_id === transferId);
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Records Exchange</h1>
      <p style={{ color: "#666", marginBottom: 16, fontSize: 13 }}>
        Secure, internal AngelClinic-to-AngelClinic record sharing — never email. Send from a patient's Encounters
        or Documents tab; review and file what other providers send you here.
      </p>

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #e2e2e5", marginBottom: 16 }}>
        <TabLink href="/dashboard/records-exchange?tab=incoming" active={tab === "incoming"} label={`Incoming (${(incoming ?? []).length})`} />
        <TabLink href="/dashboard/records-exchange?tab=sent" active={tab === "sent"} label={`Sent (${(sent ?? []).length})`} />
      </div>

      {tab === "incoming" ? (
        (incoming ?? []).length === 0 ? (
          <Empty text="Nothing has been sent to you yet — you'll see requests here once another AngelClinic provider sends records for a shared patient." />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {(incoming as any[]).map((t) => (
              <IncomingTransferRow key={t.id} transfer={t} patients={(patients as any) ?? []} attachments={attachmentsFor(t.id)} customFolders={(documentFolders as any) ?? []} />
            ))}
          </div>
        )
      ) : (sent ?? []).length === 0 ? (
        <Empty text="Nothing sent yet — send records to another AngelClinic provider from a patient's Encounters or Documents tab." />
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {(sent as any[]).map((t) => (
            <SentTransferRow key={t.id} transfer={t} attachments={attachmentsFor(t.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function TabLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <a
      href={href}
      style={{
        padding: "8px 14px",
        fontSize: 13,
        fontWeight: 600,
        textDecoration: "none",
        color: active ? "#0c1730" : "#888",
        borderBottom: active ? "2px solid #0c1730" : "2px solid transparent",
      }}
    >
      {label}
    </a>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24, color: "#888", fontSize: 13 }}>{text}</div>;
}
