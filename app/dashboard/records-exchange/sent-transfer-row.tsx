"use client";

import { TransferPreview } from "./transfer-preview";
import type { TransferDocumentAttachment } from "../encounters/records-exchange-actions";

const STATUS_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
  sent: { bg: "#fff6e6", border: "#f0d998", color: "#8a6100", label: "Awaiting review" },
  accepted: { bg: "#eaf7ee", border: "#bfe6c9", color: "#1a7f37", label: "Accepted" },
  declined: { bg: "#fbeaea", border: "#f0c2c2", color: "#a12a2a", label: "Declined" },
};

export function SentTransferRow({
  transfer,
  attachments,
}: {
  transfer: {
    id: string;
    patient_name: string;
    patient_dob: string;
    record_count: number;
    status: string;
    sent_at: string;
    receiving_provider_name: string;
    receiving_clinic_name: string | null;
    source: "encounters" | "documents";
    note: string | null;
  };
  attachments: TransferDocumentAttachment[];
}) {
  const s = STATUS_STYLE[transfer.status] ?? STATUS_STYLE.sent;

  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-heading)" }}>
            {transfer.patient_name} <span style={{ fontWeight: 400, color: "#888" }}>· DOB {new Date(transfer.patient_dob).toLocaleDateString()}</span>
          </div>
          <div style={{ fontSize: 12, color: "#888" }}>
            To {transfer.receiving_provider_name}
            {transfer.receiving_clinic_name ? ` · ${transfer.receiving_clinic_name}` : ""} · {transfer.record_count} record
            {transfer.record_count === 1 ? "" : "s"} · Sent {new Date(transfer.sent_at).toLocaleDateString()}
          </div>
          {transfer.note && <div style={{ fontSize: 12, color: "#555", marginTop: 4, fontStyle: "italic" }}>&ldquo;{transfer.note}&rdquo;</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 999, padding: "3px 10px" }}>{s.label}</span>
          <TransferPreview transferId={transfer.id} source={transfer.source} attachments={attachments} />
        </div>
      </div>
    </div>
  );
}
