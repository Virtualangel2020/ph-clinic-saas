"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDocumentAction, getDocumentSignedUrlAction, setDocumentStatusAction } from "../actions";

type Doc = {
  id: string;
  title: string;
  doc_type: string;
  description: string | null;
  created_at: string;
  storage_path: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  status: string;
  status_reason: string | null;
};

// Full label map — used to render EXISTING rows of any type, including
// older ones filed before Prescriptions/Orders/Results existed as their
// own modules.
const TYPE_LABEL: Record<string, string> = {
  labs: "Labs",
  imaging: "Imaging",
  progress_notes: "Progress Notes",
  referrals: "Referrals",
  forms: "Forms",
  hospital_er: "Hospital / ER",
  procedures: "Procedures",
  medications: "Medications / Prescriptions",
  insurance: "Insurance",
  patient_documents: "Patient Documents",
  other: "Other",
};

// Selectable when adding a NEW document — deliberately excludes "labs" and
// "medications", now that Lab Orders/Results and Prescriptions are real
// structured modules with their own tabs. Filing a new lab result or script
// here would just recreate the "documents tab is a pile of unsorted
// results" problem this list is meant to avoid; imaging films/CDs and
// hospital/ER records still don't have a dedicated module, so they stay.
const UPLOADABLE_TYPES: Record<string, string> = {
  referrals: "Referrals",
  forms: "Forms",
  hospital_er: "Hospital / ER",
  imaging: "Imaging",
  procedures: "Procedures",
  insurance: "Insurance",
  other: "Other",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  entered_in_error: "Entered in Error",
  duplicate: "Duplicate",
  administrative_correction: "Administrative Correction",
  superseded: "Superseded",
  archived: "Archived",
};

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsSection({ patientId, documents }: { patientId: string; documents: Doc[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("other");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const visible = documents.filter((d) => (showResolved ? true : d.status === "active"));

  function save() {
    if (!title.trim()) return;
    setError(null);
    const fd = new FormData();
    fd.set("patientId", patientId);
    fd.set("title", title);
    fd.set("docType", docType);
    fd.set("description", description);
    if (fileRef.current?.files?.[0]) fd.set("file", fileRef.current.files[0]);
    startTransition(async () => {
      try {
        await addDocumentAction(fd);
        setTitle("");
        setDocType("other");
        setDescription("");
        if (fileRef.current) fileRef.current.value = "";
        setAdding(false);
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't add that document.");
      }
    });
  }

  function view(storagePath: string) {
    startTransition(async () => {
      try {
        const url = await getDocumentSignedUrlAction(storagePath);
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (e: any) {
        alert(e.message || "Couldn't open this file.");
      }
    });
  }

  function changeStatus(id: string) {
    const status = prompt(
      "Set status to one of: entered_in_error, duplicate, administrative_correction, superseded, archived\n\n(this replaces deletion — the document stays on record with this status)"
    );
    if (!status) return;
    if (!Object.keys(STATUS_LABEL).includes(status)) {
      alert("Not a valid status.");
      return;
    }
    const reason = prompt("Reason (optional):") || "";
    startTransition(async () => {
      await setDocumentStatusAction(id, patientId, status, reason);
      router.refresh();
    });
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: 15 }}>Documents</h2>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#888" }}>
            <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
            Show entered-in-error / archived
          </label>
          <button onClick={() => setAdding((v) => !v)} style={{ fontSize: 12.5, color: "#0c1730", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            {adding ? "Cancel" : "+ Add document"}
          </button>
        </div>
      </div>

      {adding && (
        <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 10, padding: 14, marginBottom: 10, display: "grid", gap: 8 }}>
          <input placeholder="Title (e.g. Referral Letter — Aug 2026)" value={title} onChange={(e) => setTitle(e.target.value)} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", fontSize: 13 }} />
          <select value={docType} onChange={(e) => setDocType(e.target.value)} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
            {Object.entries(UPLOADABLE_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <p style={{ fontSize: 11, color: "#999", margin: "-4px 0 0" }}>
            Lab results and prescriptions have their own tabs — file those there, not here.
          </p>
          <textarea placeholder="Description / notes" value={description} onChange={(e) => setDescription(e.target.value)} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", fontSize: 13, minHeight: 50, fontFamily: "inherit" }} />
          <div>
            <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/heic,image/webp" style={{ fontSize: 12 }} />
            <p style={{ fontSize: 11, color: "#999", margin: "4px 0 0" }}>PDF, JPG, PNG, HEIC, or WEBP, up to 25MB. Optional — you can also just record the metadata.</p>
          </div>
          {error && <div style={{ color: "#a12a2a", fontSize: 12.5 }}>{error}</div>}
          <button onClick={save} disabled={pending} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", justifySelf: "start", opacity: pending ? 0.6 : 1 }}>
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <p style={{ color: "#999", fontSize: 12.5 }}>No documents on file.</p>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {visible.map((d) => (
            <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "white", border: "1px solid #e2e2e5", borderRadius: 8, padding: "8px 12px", fontSize: 13, opacity: d.status === "active" ? 1 : 0.6 }}>
              <div>
                <strong>{d.title}</strong>
                <span style={{ marginLeft: 8, fontSize: 11, color: "#888", border: "1px solid #ddd", borderRadius: 999, padding: "1px 7px" }}>{TYPE_LABEL[d.doc_type] ?? d.doc_type}</span>
                {d.status !== "active" && (
                  <span style={{ marginLeft: 6, fontSize: 11, color: "#a12a2a", fontWeight: 600 }}>{STATUS_LABEL[d.status] ?? d.status}</span>
                )}
                {d.description && <div style={{ color: "#666", fontSize: 12, marginTop: 2 }}>{d.description}</div>}
                {d.storage_path && (
                  <div style={{ color: "#999", fontSize: 11, marginTop: 2 }}>{d.mime_type} · {formatSize(d.file_size_bytes)}</div>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                {d.storage_path && (
                  <button onClick={() => view(d.storage_path!)} style={{ background: "none", border: "none", color: "#0c1730", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                    View
                  </button>
                )}
                {d.status === "active" && (
                  <button onClick={() => changeStatus(d.id)} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 12 }}>
                    Change status
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
