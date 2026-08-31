"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDocumentAction, addDocumentFolderAction, getDocumentSignedUrlAction } from "../actions";
import { sendDocumentRecordsTransferAction } from "../../encounters/records-exchange-actions";
import { searchAngelClinicProvidersAction, checkSharingAuthorizedAction, type DirectoryProvider } from "../care-coordination-actions";
import { foldersWithCustom, uploadableTypesWithCustom } from "@/lib/documents/folder-taxonomy";

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

// One row per (document, transfer) it was ever sent out on via Records
// Exchange — see lib/patients/get-patient-chart-data.ts and
// app/dashboard/documents/page.tsx for the query. Only outgoing sends from
// THIS patient's chart show up here (sending_tenant_id-scoped by RLS).
type DocTransfer = {
  source_document_id: string;
  filed_document_id: string | null;
  transfer: { status: string; receiving_provider_name: string | null; receiving_clinic_name: string | null; sent_at: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  entered_in_error: "Entered in Error",
  duplicate: "Duplicate",
  administrative_correction: "Administrative Correction",
  superseded: "Superseded",
  archived: "Archived",
};

const TRANSFER_STATUS_LABEL: Record<string, string> = {
  sent: "Awaiting their review",
  accepted: "Accepted",
  declined: "Declined",
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
// + send-to-provider on the right (spec follow-up: "Documents should show
// folders on the left, preview on the right, with download and send-to-
// provider options"). Same underlying patient_documents rows the global
// Documents tab shows after a patient is selected there (see
// app/dashboard/documents/page.tsx) — this is the one implementation both
// places render, not a fork.
//
// "Send to provider" goes through Records Exchange (spec follow-up: "like
// in the provider message... as long as the provider has the same
// system") — the same cross-clinic transfer/accept/file architecture
// already built for Encounters, extended (migration
// records_exchange_document_attachments) to carry individual document
// files. That's also where the receiving provider goes to find what was
// sent to them: the "M" (Provider messages) badge in the top nav now links
// to /dashboard/records-exchange.
export function DocumentsSection({
  patientId,
  documents,
  providers = [],
  customFolders = [],
  sentTransfers = [],
}: {
  patientId: string;
  documents: Doc[];
  providers?: Provider[];
  customFolders?: { key: string; label: string }[];
  sentTransfers?: DocTransfer[];
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
  const [shareQuery, setShareQuery] = useState("");
  const [shareResults, setShareResults] = useState<DirectoryProvider[]>([]);
  const [shareSearching, setShareSearching] = useState(false);
  const [shareSearched, setShareSearched] = useState(false);
  const [pickedProvider, setPickedProvider] = useState<DirectoryProvider | null>(null);
  const [shareAuthorized, setShareAuthorized] = useState(false);
  const [shareNote, setShareNote] = useState("");
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharePending, setSharePending] = useState(false);

  const allFolders = foldersWithCustom(customFolders);
  const allUploadableTypes = uploadableTypesWithCustom(customFolders);

  const visible = documents.filter((d) => (showResolved ? true : d.status === "active"));

  function byFolder(folderKey: string) {
    const folder = allFolders.find((f) => f.key === folderKey)!;
    return visible.filter((d) => folder.docTypes.includes(d.doc_type));
  }

  function transfersFor(docId: string) {
    return sentTransfers.filter((t) => t.source_document_id === docId && t.transfer);
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
    setShareQuery("");
    setShareResults([]);
    setShareSearched(false);
    setPickedProvider(null);
    setShareAuthorized(false);
    setShareNote("");
    setShareError(null);
  }

  function closeShareModal() {
    setShareTargetIds(null);
    setShareError(null);
  }

  async function runShareSearch() {
    setShareSearching(true);
    try {
      setShareResults(await searchAngelClinicProvidersAction(shareQuery));
      setShareSearched(true);
    } catch (e: any) {
      setShareError(e.message || "Search failed.");
    } finally {
      setShareSearching(false);
    }
  }

  async function pickProvider(p: DirectoryProvider) {
    setPickedProvider(p);
    setShareError(null);
    setShareAuthorized(await checkSharingAuthorizedAction(patientId, p.id));
    setShareStep("confirm");
  }

  function sendShare() {
    if (!shareTargetIds || !pickedProvider) return;
    setSharePending(true);
    setShareError(null);
    startTransition(async () => {
      try {
        await sendDocumentRecordsTransferAction(patientId, shareTargetIds, pickedProvider.id, shareNote);
        setSharePending(false);
        setShareTargetIds(null);
        setSelectedIds(new Set());
        router.refresh();
      } catch (e: any) {
        setSharePending(false);
        setShareError(e.message || "Couldn't send these records.");
      }
    });
  }

  const shareTargetDocs = documents.filter((d) => shareTargetIds?.includes(d.id));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: 15 }}>Documents</h2>
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#888" }}>
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
          Show entered-in-error / archived
        </label>
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
                          const transfers = transfersFor(d.id);
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
                                {transfers.length > 0 && (
                                  <div style={{ color: "#4a7a4a", fontSize: 11, marginTop: 3 }}>
                                    Sent to {transfers.map((t, i) => `${t.transfer!.receiving_provider_name ?? "a provider"}${t.transfer!.status !== "sent" ? ` (${TRANSFER_STATUS_LABEL[t.transfer!.status] ?? t.transfer!.status})` : ""}`).join(", ")}
                                  </div>
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

                {transfersFor(selectedDoc.id).length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#0c1730", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>Sent to</div>
                    <div style={{ display: "grid", gap: 4 }}>
                      {transfersFor(selectedDoc.id).map((t, i) => (
                        <div key={i} style={{ fontSize: 12, color: "#555" }}>
                          {t.transfer!.receiving_provider_name ?? "a provider"}
                          {t.transfer!.receiving_clinic_name ? ` (${t.transfer!.receiving_clinic_name})` : ""} — {new Date(t.transfer!.sent_at).toLocaleDateString()}
                          {" · "}
                          {t.filed_document_id ? "Filed by them" : TRANSFER_STATUS_LABEL[t.transfer!.status] ?? t.transfer!.status}
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

      {/* Send-to-provider modal — searches every AngelClinic provider,
          same clinic or a different one; picking a provider doesn't send
          anything, the confirm step is the actual point of no return
          (mirrors app/dashboard/encounters/encounter-selection-list.tsx's
          SendToProviderPanel, generalized to multi-document + an optional
          note). */}
      {shareTargetIds && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}
          onClick={closeShareModal}
        >
          <div
            style={{ background: "var(--card-bg)", borderRadius: 12, padding: 20, width: "100%", maxWidth: 440, boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <h3 style={{ fontSize: 15, margin: 0 }}>
                Send {shareTargetIds.length > 1 ? `${shareTargetIds.length} documents` : "document"} to a provider
              </h3>
              <button onClick={closeShareModal} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 12 }}>Cancel</button>
            </div>

            {shareStep === "pick" ? (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: 12.5, color: "#666", marginBottom: 10 }}>
                  Search any AngelClinic provider — this clinic or another clinic on AngelClinic. They&apos;ll see this in their Records Exchange inbox.
                </p>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input
                    value={shareQuery}
                    onChange={(e) => setShareQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && runShareSearch()}
                    placeholder="Search by name, specialty, or clinic…"
                    style={{ border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, flex: 1 }}
                  />
                  <button onClick={runShareSearch} disabled={shareSearching} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                    {shareSearching ? "…" : "Search"}
                  </button>
                </div>
                {shareSearched && (
                  <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid #eee", borderRadius: 8 }}>
                    {shareResults.length === 0 && <div style={{ padding: 12, fontSize: 12.5, color: "#999" }}>No providers found.</div>}
                    {shareResults.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => pickProvider(p)}
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", border: "none", borderBottom: "1px solid #f2f2f2", background: "var(--card-bg)", cursor: "pointer", fontSize: 13 }}
                      >
                        {p.title ? `${p.title} ` : ""}{p.full_name}
                        <div style={{ fontSize: 11, color: "#888" }}>{[p.specialty, p.clinic_name].filter(Boolean).join(" · ")}</div>
                      </button>
                    ))}
                  </div>
                )}
                {shareError && <div style={{ color: "#a12a2a", fontSize: 12.5, marginTop: 8 }}>{shareError}</div>}
              </div>
            ) : (
              pickedProvider && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: "grid", gap: 6, fontSize: 13, marginBottom: 10 }}>
                    <Row label="Documents" value={shareTargetDocs.map((d) => d.title).join(", ")} />
                    <Row label="Receiving provider" value={`${pickedProvider.title ? pickedProvider.title + " " : ""}${pickedProvider.full_name}${pickedProvider.clinic_name ? ` (${pickedProvider.clinic_name})` : ""}`} />
                    <Row
                      label="Authorization"
                      value={shareAuthorized ? "✓ Patient has authorized sharing with this provider" : "Not on file"}
                    />
                  </div>

                  {!shareAuthorized && (
                    <div style={{ background: "#fff6e6", border: "1px solid #e6c66b", borderRadius: 8, padding: 12, marginBottom: 10, fontSize: 12.5, color: "#7a5c12" }}>
                      There&apos;s no sharing authorization on file for this patient and provider. Have you asked <strong>the patient</strong> for consent to send{" "}
                      {shareTargetIds.length > 1 ? "these records" : "this record"} to <strong>{pickedProvider.full_name}</strong>?
                    </div>
                  )}

                  <textarea
                    placeholder="Add a note for them (optional)"
                    value={shareNote}
                    onChange={(e) => setShareNote(e.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, minHeight: 56, fontFamily: "inherit", marginBottom: 10 }}
                  />

                  {shareError && <div style={{ color: "#a12a2a", fontSize: 12.5, marginBottom: 8 }}>{shareError}</div>}
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => setShareStep("pick")} disabled={sharePending} style={{ background: "none", border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", color: "#555" }}>
                      Back
                    </button>
                    <button onClick={sendShare} disabled={sharePending} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", opacity: sharePending ? 0.6 : 1 }}>
                      {sharePending ? "Sending…" : shareAuthorized ? "Send Securely" : "Yes, consent obtained — send"}
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: "#888", flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 600, color: "var(--text-heading)", textAlign: "right" }}>{value}</span>
    </div>
  );
}
