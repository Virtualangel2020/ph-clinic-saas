"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addDocumentAction,
  addDocumentFolderAction,
  getDocumentSignedUrlAction,
  setPatientRecordsSharingModeAction,
  shareDocumentsWithProviderAction,
} from "../actions";

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

type DocShare = {
  document_id: string;
  consent_confirmed: boolean;
  created_at: string;
  provider_name: string;
  shared_by_name: string | null;
};

type RecordsSharingMode = "allowed" | "needs_consent";

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

function isPreviewableImage(mime: string | null) {
  return mime === "image/jpeg" || mime === "image/png" || mime === "image/webp";
}

// Patient Documents — collapsible folder tree on the left, inline preview
// + sharing on the right (spec follow-up: "Documents should show folders
// on the left, preview on the right, with download and send-to-provider
// options"). Same underlying patient_documents rows the global Documents
// tab shows after a patient is selected there (see
// app/dashboard/documents/page.tsx) — this is the one implementation both
// places render, not a fork.
export function DocumentsSection({
  patientId,
  documents,
  providers = [],
  customFolders = [],
  documentShares = [],
  recordsSharingMode = "needs_consent",
}: {
  patientId: string;
  documents: Doc[];
  providers?: Provider[];
  customFolders?: { key: string; label: string }[];
  documentShares?: DocShare[];
  recordsSharingMode?: RecordsSharingMode;
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

  // Right-pane preview state.
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Multi-select for bulk "send to provider".
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Send-to-provider modal (single doc from the preview pane, or a bulk
  // send from the selection bar — same modal, different target id list).
  const [shareTargetIds, setShareTargetIds] = useState<string[] | null>(null);
  const [shareStep, setShareStep] = useState<"pick" | "confirm">("pick");
  const [shareProviderId, setShareProviderId] = useState("");
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharePending, setSharePending] = useState(false);

  // Records-sharing consent toggle (patient-profile setting).
  const [modeSaving, setModeSaving] = useState(false);

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

  function sharesFor(docId: string) {
    return documentShares.filter((s) => s.document_id === docId);
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

  // Selecting a document (clicking its title, not the checkbox) opens it
  // in the right-pane preview instead of a new browser tab — the earlier
  // behavior ("redirected me outside the system") is exactly what this
  // replaces.
  function selectForPreview(d: Doc) {
    setSelectedDoc(d);
    setPreviewUrl(null);
    setPreviewError(null);
    if (!d.storage_path) return;
    setPreviewLoading(true);
    startTransition(async () => {
      try {
        const url = await getDocumentSignedUrlAction(d.storage_path!);
        setPreviewUrl(url);
      } catch (e: any) {
        setPreviewError(e.message || "Couldn't load a preview for this file.");
      } finally {
        setPreviewLoading(false);
      }
    });
  }

  function toggleCheck(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function downloadDoc(d: Doc) {
    if (!d.storage_path) return;
    try {
      const url = await getDocumentSignedUrlAction(d.storage_path);
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = blobUrl;
      a.download = d.title || "document";
      window.document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (e: any) {
      alert(e.message || "Couldn't download this file.");
    }
  }

  function openShareModal(ids: string[]) {
    if (ids.length === 0) return;
    setShareTargetIds(ids);
    setShareStep("pick");
    setShareProviderId("");
    setShareError(null);
  }

  function closeShareModal() {
    setShareTargetIds(null);
    setShareError(null);
  }

  function proceedFromPick() {
    if (!shareProviderId) {
      setShareError("Choose a provider first.");
      return;
    }
    setShareError(null);
    if (recordsSharingMode === "allowed") {
      doShare(false);
    } else {
      setShareStep("confirm");
    }
  }

  function doShare(consentConfirmed: boolean) {
    if (!shareTargetIds || !shareProviderId) return;
    setSharePending(true);
    setShareError(null);
    startTransition(async () => {
      try {
        await shareDocumentsWithProviderAction(patientId, shareTargetIds, shareProviderId, consentConfirmed);
        setSharePending(false);
        setShareTargetIds(null);
        setSelectedIds(new Set());
        router.refresh();
      } catch (e: any) {
        setSharePending(false);
        setShareError(e.message || "Couldn't share these records.");
      }
    });
  }

  function changeSharingMode(mode: RecordsSharingMode) {
    setModeSaving(true);
    startTransition(async () => {
      try {
        await setPatientRecordsSharingModeAction(patientId, mode);
        router.refresh();
      } catch (e: any) {
        alert(e.message || "Couldn't update the sharing setting.");
      } finally {
        setModeSaving(false);
      }
    });
  }

  const shareModalProviderName = providers.find((p) => p.id === shareProviderId);
  const shareModalProviderLabel = shareModalProviderName ? `${shareModalProviderName.title ? shareModalProviderName.title + " " : ""}${shareModalProviderName.full_name}` : "";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: 15 }}>Documents</h2>
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#888" }}>
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
          Show entered-in-error / archived
        </label>
      </div>

      {/* Records-sharing consent — patient-profile setting controlling
          whether "send to provider" below needs a consent confirmation. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          background: "#f7f7f9",
          border: "1px solid #eee",
          borderRadius: 8,
          padding: "8px 12px",
          marginBottom: 12,
          fontSize: 12.5,
        }}
      >
        <span style={{ color: "#555" }}>
          <strong style={{ color: "var(--text-heading)" }}>Records sharing:</strong>{" "}
          {recordsSharingMode === "allowed" ? "Share with other treating providers without asking each time" : "Ask for the patient's consent before every share"}
        </span>
        <select
          value={recordsSharingMode}
          disabled={modeSaving}
          onChange={(e) => changeSharingMode(e.target.value as RecordsSharingMode)}
          style={{ border: "1px solid var(--input-border)", borderRadius: 6, padding: "4px 8px", fontSize: 12 }}
        >
          <option value="needs_consent">Needs consent from patient first</option>
          <option value="allowed">Allowed — patient has consented</option>
        </select>
      </div>

      {selectedIds.size > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#0c1730",
            color: "white",
            borderRadius: 8,
            padding: "8px 14px",
            marginBottom: 12,
            fontSize: 13,
          }}
        >
          <span>{selectedIds.size} document{selectedIds.size > 1 ? "s" : ""} selected</span>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => openShareModal(Array.from(selectedIds))}
              style={{ background: "#e6c66b", color: "#0c1730", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
            >
              Send to provider
            </button>
            <button onClick={() => setSelectedIds(new Set())} style={{ background: "none", border: "1px solid rgba(255,255,255,0.4)", color: "white", borderRadius: 6, padding: "6px 12px", fontSize: 12.5, cursor: "pointer" }}>
              Clear
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* Left: folder tree */}
        <div style={{ flex: "1 1 380px", minWidth: 300, display: "grid", gap: 6 }}>
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
                        {docs.map((d) => {
                          const shares = sharesFor(d.id);
                          const isSelectedPreview = selectedDoc?.id === d.id;
                          return (
                            <div
                              key={d.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                gap: 8,
                                background: isSelectedPreview ? "#eef1fb" : "#f7f7f9",
                                border: isSelectedPreview ? "1px solid #b9c2ea" : "1px solid #eee",
                                borderRadius: 8,
                                padding: "8px 12px",
                                fontSize: 13,
                                opacity: d.status === "active" ? 1 : 0.6,
                              }}
                            >
                              <input type="checkbox" checked={selectedIds.has(d.id)} onChange={() => toggleCheck(d.id)} style={{ marginTop: 3, flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => selectForPreview(d)}>
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
                                {shares.length > 0 && (
                                  <div style={{ color: "#4a7a4a", fontSize: 11, marginTop: 3 }}>Shared with {shares.map((s) => s.provider_name).join(", ")}</div>
                                )}
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0, alignItems: "flex-end" }}>
                                <button onClick={() => selectForPreview(d)} style={{ background: "none", border: "none", color: "var(--text-heading)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                                  Preview
                                </button>
                                {d.storage_path && (
                                  <button onClick={() => openShareModal([d.id])} style={{ background: "none", border: "none", color: "#8a6100", cursor: "pointer", fontSize: 12 }}>
                                    Send
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ marginTop: 4 }}>
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

        {/* Right: preview */}
        <div style={{ flex: "1 1 420px", minWidth: 300, position: "sticky", top: 12 }}>
          <div style={{ border: "1px solid var(--card-border)", borderRadius: 10, background: "var(--card-bg)", padding: 14, minHeight: 320 }}>
            {!selectedDoc ? (
              <div style={{ color: "#999", fontSize: 13, textAlign: "center", padding: "60px 20px" }}>Select a document on the left to preview it here.</div>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, wordBreak: "break-word" }}>{selectedDoc.title}</div>
                    <div style={{ fontSize: 11.5, color: "#888", marginTop: 2 }}>
                      {selectedDoc.document_date ? `Service date ${new Date(selectedDoc.document_date).toLocaleDateString()} · ` : ""}
                      Filed {new Date(selectedDoc.created_at).toLocaleDateString()}
                      {selectedDoc.user_profiles?.full_name ? ` · ${selectedDoc.user_profiles.full_name}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    {selectedDoc.storage_path && (
                      <button onClick={() => downloadDoc(selectedDoc)} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
                        Download
                      </button>
                    )}
                    {selectedDoc.storage_path && (
                      <button onClick={() => openShareModal([selectedDoc.id])} style={{ background: "#e6c66b", color: "#0c1730", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        Send to provider
                      </button>
                    )}
                  </div>
                </div>

                {selectedDoc.description && <p style={{ fontSize: 12.5, color: "#555", marginBottom: 10 }}>{selectedDoc.description}</p>}

                <div style={{ borderRadius: 8, overflow: "hidden", background: "#f4f5f7", minHeight: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {!selectedDoc.storage_path ? (
                    <span style={{ color: "#999", fontSize: 12.5, padding: 20 }}>No file attached — metadata only.</span>
                  ) : previewLoading ? (
                    <span style={{ color: "#999", fontSize: 12.5 }}>Loading preview…</span>
                  ) : previewError ? (
                    <span style={{ color: "#a12a2a", fontSize: 12.5, padding: 20 }}>{previewError}</span>
                  ) : previewUrl && selectedDoc.mime_type === "application/pdf" ? (
                    <iframe src={previewUrl} title={selectedDoc.title} style={{ width: "100%", height: "65vh", border: "none" }} />
                  ) : previewUrl && isPreviewableImage(selectedDoc.mime_type) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt={selectedDoc.title} style={{ maxWidth: "100%", maxHeight: "65vh", display: "block" }} />
                  ) : (
                    <span style={{ color: "#999", fontSize: 12.5, padding: 20, textAlign: "center" }}>
                      Preview isn&apos;t available for this file type — use Download to view it.
                    </span>
                  )}
                </div>

                {sharesFor(selectedDoc.id).length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#0c1730", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>Shared with</div>
                    <div style={{ display: "grid", gap: 4 }}>
                      {sharesFor(selectedDoc.id).map((s, i) => (
                        <div key={i} style={{ fontSize: 12, color: "#555" }}>
                          {s.provider_name} — {new Date(s.created_at).toLocaleDateString()}
                          {s.shared_by_name ? ` · sent by ${s.shared_by_name}` : ""}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Send-to-provider modal */}
      {shareTargetIds && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}
          onClick={closeShareModal}
        >
          <div
            style={{ background: "var(--card-bg)", borderRadius: 12, padding: 20, width: "100%", maxWidth: 420, boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 15, marginBottom: 4 }}>
              Send {shareTargetIds.length > 1 ? `${shareTargetIds.length} documents` : "document"} to a provider
            </h3>

            {shareStep === "pick" ? (
              <div>
                <p style={{ fontSize: 12.5, color: "#666", marginBottom: 10 }}>Choose which provider should be able to see this in the patient&apos;s chart.</p>
                <select
                  value={shareProviderId}
                  onChange={(e) => setShareProviderId(e.target.value)}
                  style={{ width: "100%", border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, boxSizing: "border-box", marginBottom: 10 }}
                >
                  <option value="">Select a provider…</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title ? `${p.title} ` : ""}
                      {p.full_name}
                    </option>
                  ))}
                </select>
                {shareError && <div style={{ color: "#a12a2a", fontSize: 12.5, marginBottom: 8 }}>{shareError}</div>}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={closeShareModal} style={{ background: "none", border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", color: "#555" }}>
                    Cancel
                  </button>
                  <button onClick={proceedFromPick} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>
                    {recordsSharingMode === "allowed" ? "Send" : "Continue"}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ background: "#fff6e6", border: "1px solid #e6c66b", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 12.5, color: "#7a5c12" }}>
                  This patient&apos;s records-sharing setting requires consent before every share. Have you asked{" "}
                  <strong>the patient</strong> for consent to send {shareTargetIds.length > 1 ? "these records" : "this record"} to{" "}
                  <strong>{shareModalProviderLabel}</strong>?
                </div>
                {shareError && <div style={{ color: "#a12a2a", fontSize: 12.5, marginBottom: 8 }}>{shareError}</div>}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => setShareStep("pick")} disabled={sharePending} style={{ background: "none", border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", color: "#555" }}>
                    Back
                  </button>
                  <button onClick={closeShareModal} disabled={sharePending} style={{ background: "none", border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", color: "#555" }}>
                    Cancel
                  </button>
                  <button onClick={() => doShare(true)} disabled={sharePending} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", opacity: sharePending ? 0.6 : 1 }}>
                    {sharePending ? "Sending…" : "Yes, consent obtained — send"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
