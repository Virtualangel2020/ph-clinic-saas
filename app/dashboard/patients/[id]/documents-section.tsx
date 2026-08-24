"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDocumentAction, addDocumentFolderAction, getDocumentSignedUrlAction, setDocumentStatusAction } from "../actions";

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
  document_date?: string | null;
  source?: string | null;
  user_profiles?: { full_name: string | null } | null;
};

type Provider = { id: string; full_name: string; title?: string | null };

// Folder taxonomy (spec §11) — one flat level, deliberately not nested
// further ("Do not make the structure overly complicated"). Each folder
// maps to one or more doc_type values so older rows (filed under a
// slightly different historical type) still land somewhere sensible.
const FOLDERS: { key: string; label: string; docTypes: string[]; blurb: string }[] = [
  { key: "forms", label: "Forms", docTypes: ["forms"], blurb: "Patient-completed forms and consents." },
  { key: "ids", label: "IDs", docTypes: ["ids"], blurb: "Government ID or other identification." },
  { key: "insurance", label: "HMO / Insurance", docTypes: ["insurance"], blurb: "Insurance/HMO card, verification, and authorization documents." },
  { key: "philhealth", label: "PhilHealth", docTypes: ["philhealth"], blurb: "PhilHealth membership/supporting documents." },
  { key: "labs", label: "Labs", docTypes: ["labs"], blurb: "Scanned/external lab reports. Structured results live under the Orders & Results tab." },
  { key: "imaging", label: "Imaging", docTypes: ["imaging"], blurb: "X-ray, ultrasound, CT, MRI, mammography, or other imaging reports." },
  { key: "progress_notes", label: "Progress Notes", docTypes: ["progress_notes"], blurb: "Internal notes or external notes received from another provider." },
  { key: "referrals", label: "Referrals", docTypes: ["referrals"], blurb: "Referral orders, letters, and received/sent referral documents." },
  { key: "hospital_er", label: "Hospital / ER Records", docTypes: ["hospital_er"], blurb: "" },
  { key: "procedures", label: "Procedures", docTypes: ["procedures"], blurb: "" },
  { key: "medications", label: "Prescriptions / Medication Documents", docTypes: ["medications"], blurb: "Scanned/external prescription documents. Provider-issued prescriptions live under the Prescriptions tab." },
  { key: "medical_certificates", label: "Medical Certificates", docTypes: ["medical_certificates"], blurb: "" },
  { key: "patient_documents", label: "Patient-Uploaded Documents", docTypes: ["patient_documents"], blurb: "Filed by the patient through the Patient Portal." },
  { key: "other", label: "Other", docTypes: ["other"], blurb: "" },
];

const UPLOADABLE_TYPES: Record<string, string> = {
  forms: "Forms",
  ids: "IDs",
  insurance: "HMO / Insurance",
  philhealth: "PhilHealth",
  labs: "Labs (scanned report)",
  imaging: "Imaging",
  progress_notes: "Progress Notes",
  referrals: "Referrals",
  hospital_er: "Hospital / ER",
  procedures: "Procedures",
  medications: "Prescriptions / Medication Documents",
  medical_certificates: "Medical Certificates",
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

function formatSize(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Patient Documents — collapsible folder tree (spec §11-12). Same
// underlying patient_documents rows the global Documents tab shows after a
// patient is selected there (see app/dashboard/documents/page.tsx) — this
// is the one implementation both places render, not a fork.
export function DocumentsSection({
  patientId,
  documents,
  providers = [],
  customFolders = [],
}: {
  patientId: string;
  documents: Doc[];
  providers?: Provider[];
  customFolders?: { key: string; label: string }[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [addingIn, setAddingIn] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("other");
  const [description, setDescription] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [source, setSource] = useState("");
  const [providerId, setProviderId] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderLabel, setNewFolderLabel] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Built-in folders + this tenant's custom folders (spec follow-up:
  // "provider can add more folders depends on what they need to
  // organize"), placed just before the catch-all "Other" folder.
  const allFolders = [...FOLDERS.slice(0, -1), ...customFolders.map((f) => ({ key: f.key, label: f.label, docTypes: [f.key], blurb: "" })), FOLDERS[FOLDERS.length - 1]];
  const allUploadableTypes: Record<string, string> = { ...UPLOADABLE_TYPES, ...Object.fromEntries(customFolders.map((f) => [f.key, f.label])) };

  const visible = documents.filter((d) => (showResolved ? true : d.status === "active"));

  function byFolder(folderKey: string) {
    const folder = allFolders.find((f) => f.key === folderKey)!;
    return visible.filter((d) => folder.docTypes.includes(d.doc_type));
  }

  function saveFolder() {
    if (!newFolderLabel.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await addDocumentFolderAction(newFolderLabel.trim());
        setNewFolderLabel("");
        setAddingFolder(false);
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't add that folder.");
      }
    });
  }

  function toggle(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function startAdd(folderKey: string) {
    setDocType(folderKey in allUploadableTypes ? folderKey : "other");
    setAddingIn(folderKey);
    setExpanded((prev) => ({ ...prev, [folderKey]: true }));
  }

  function save() {
    if (!title.trim()) return;
    setError(null);
    const fd = new FormData();
    fd.set("patientId", patientId);
    fd.set("title", title);
    fd.set("docType", docType);
    fd.set("description", description);
    fd.set("documentDate", documentDate);
    fd.set("source", source);
    fd.set("providerId", providerId);
    if (fileRef.current?.files?.[0]) fd.set("file", fileRef.current.files[0]);
    startTransition(async () => {
      try {
        await addDocumentAction(fd);
        setTitle("");
        setDescription("");
        setDocumentDate("");
        setSource("");
        setProviderId("");
        if (fileRef.current) fileRef.current.value = "";
        setAddingIn(null);
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
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: 15 }}>Documents</h2>
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#888" }}>
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
          Show entered-in-error / archived
        </label>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        {allFolders.map((folder) => {
          const docs = byFolder(folder.key);
          const isOpen = !!expanded[folder.key];
          return (
            <div key={folder.key} style={{ border: "1px solid var(--card-border)", borderRadius: 10, background: "var(--card-bg)", overflow: "hidden" }}>
              <button
                onClick={() => toggle(folder.key)}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "11px 14px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-heading)" }}>
                  <span style={{ display: "inline-block", width: 14, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.1s" }}>›</span>{" "}
                  {folder.label}
                  <span style={{ marginLeft: 8, fontSize: 11.5, color: "#999", fontWeight: 500 }}>{docs.length > 0 ? `(${docs.length})` : ""}</span>
                </span>
                {folder.key in allUploadableTypes && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      startAdd(folder.key);
                    }}
                    style={{ fontSize: 12, color: "var(--text-heading)", fontWeight: 600 }}
                  >
                    + Add
                  </span>
                )}
              </button>

              {isOpen && (
                <div style={{ padding: "0 14px 14px" }}>
                  {folder.blurb && <p style={{ fontSize: 11.5, color: "#999", margin: "0 0 8px" }}>{folder.blurb}</p>}

                  {addingIn === folder.key && (
                    <div style={{ background: "#f7f7f9", border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 10, display: "grid", gap: 8 }}>
                      <input placeholder="Title (e.g. Referral Letter — Aug 2026)" value={title} onChange={(e) => setTitle(e.target.value)} style={{ border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }} />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 11, color: "#888", marginBottom: 3 }}>Document / service date</div>
                          <input type="date" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} style={{ border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: "#888", marginBottom: 3 }}>Source</div>
                          <input placeholder="e.g. Patient, External clinic" value={source} onChange={(e) => setSource(e.target.value)} style={{ border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
                        </div>
                      </div>
                      {providers.length > 0 && (
                        <select value={providerId} onChange={(e) => setProviderId(e.target.value)} style={{ border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
                          <option value="">Provider — none / not applicable</option>
                          {providers.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title ? `${p.title} ` : ""}
                              {p.full_name}
                            </option>
                          ))}
                        </select>
                      )}
                      <textarea placeholder="Description / notes" value={description} onChange={(e) => setDescription(e.target.value)} style={{ border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, minHeight: 50, fontFamily: "inherit" }} />
                      <div>
                        <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/heic,image/webp" style={{ fontSize: 12 }} />
                        <p style={{ fontSize: 11, color: "#999", margin: "4px 0 0" }}>PDF, JPG, PNG, HEIC, or WEBP, up to 25MB. Optional — you can also just record the metadata.</p>
                      </div>
                      {error && <div style={{ color: "#a12a2a", fontSize: 12.5 }}>{error}</div>}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={save} disabled={pending} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", opacity: pending ? 0.6 : 1 }}>
                          {pending ? "Saving…" : "Save"}
                        </button>
                        <button onClick={() => setAddingIn(null)} style={{ background: "none", border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", color: "#555" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {docs.length === 0 ? (
                    <p style={{ color: "#999", fontSize: 12.5, margin: 0 }}>No documents in this folder.</p>
                  ) : (
                    <div style={{ display: "grid", gap: 6 }}>
                      {docs.map((d) => (
                        <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f7f7f9", border: "1px solid #eee", borderRadius: 8, padding: "8px 12px", fontSize: 13, opacity: d.status === "active" ? 1 : 0.6 }}>
                          <div>
                            <strong>{d.title}</strong>
                            {d.status !== "active" && <span style={{ marginLeft: 6, fontSize: 11, color: "#a12a2a", fontWeight: 600 }}>{STATUS_LABEL[d.status] ?? d.status}</span>}
                            <div style={{ color: "#888", fontSize: 11.5, marginTop: 2 }}>
                              {d.document_date ? `Service date ${new Date(d.document_date).toLocaleDateString()} · ` : ""}
                              Filed {new Date(d.created_at).toLocaleDateString()}
                              {d.user_profiles?.full_name ? ` · ${d.user_profiles.full_name}` : ""}
                              {d.source ? ` · ${d.source}` : ""}
                              {d.storage_path ? ` · ${d.mime_type ?? ""} ${formatSize(d.file_size_bytes)}` : " · Metadata only"}
                            </div>
                            {d.description && <div style={{ color: "#666", fontSize: 12, marginTop: 2 }}>{d.description}</div>}
                          </div>
                          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                            {d.storage_path && (
                              <button onClick={() => view(d.storage_path!)} style={{ background: "none", border: "none", color: "var(--text-heading)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
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
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 10 }}>
        {addingFolder ? (
          <div style={{ background: "#f7f7f9", border: "1px solid #eee", borderRadius: 8, padding: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              placeholder="New folder name (e.g. Surgical Clearance)"
              value={newFolderLabel}
              onChange={(e) => setNewFolderLabel(e.target.value)}
              style={{ border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", flex: 1, minWidth: 200 }}
            />
            <button onClick={saveFolder} disabled={pending || !newFolderLabel.trim()} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, cursor: "pointer" }}>
              {pending ? "Adding…" : "Add folder"}
            </button>
            <button onClick={() => { setAddingFolder(false); setNewFolderLabel(""); setError(null); }} style={{ background: "none", border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, cursor: "pointer", color: "#555" }}>
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setAddingFolder(true)} style={{ fontSize: 12.5, color: "var(--text-heading)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            + New folder
          </button>
        )}
        {error && addingFolder && <p style={{ fontSize: 11.5, color: "#a12a2a", marginTop: 6 }}>{error}</p>}
        {customFolders.length > 0 && !addingFolder && (
          <p style={{ fontSize: 11, color: "#999", marginTop: 6 }}>Custom folders apply clinic-wide — every patient's Documents tab shows the same list.</p>
        )}
      </div>
    </div>
  );
}
