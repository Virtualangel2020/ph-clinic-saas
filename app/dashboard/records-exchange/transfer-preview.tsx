"use client";

import { useState, useTransition } from "react";
import { getTransferPdfUrlAction, getTransferDocumentPreviewUrlAction, type TransferDocumentAttachment } from "../encounters/records-exchange-actions";

function isPreviewableImage(mime: string | null) {
  return mime === "image/jpeg" || mime === "image/png" || mime === "image/webp";
}

// Inline "Preview" toggle shared by IncomingTransferRow and
// SentTransferRow — replaces the old "View PDF" (window.open, a new
// browser tab) with a preview rendered right inside the card, matching how
// the Documents tab's own split-pane preview behaves (spec follow-up:
// "attachment preview will be shown on the right side... instead of
// opening a new tab"). A documents-source transfer can carry several
// files, so this shows a small picker when there's more than one; an
// encounters-source transfer is always exactly one combined PDF, so it
// loads straight into the preview with no picker.
export function TransferPreview({
  transferId,
  source,
  attachments,
}: {
  transferId: string;
  source: "encounters" | "documents";
  attachments: TransferDocumentAttachment[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const items =
    source === "documents"
      ? attachments
      : [{ id: "pdf", title: "Combined encounter record (PDF)", mime_type: "application/pdf" as const, storage_path: null }];

  const selected = items.find((i) => i.id === selectedId) ?? (items.length === 1 ? items[0] : null);

  function load() {
    setOpen(true);
    if (previewUrl || items.length === 0) return;
    const first = items[0];
    setSelectedId(first.id);
    fetchPreview(first);
  }

  function fetchPreview(item: (typeof items)[number]) {
    setError(null);
    setPreviewUrl(null);
    startTransition(async () => {
      try {
        const url = source === "documents" && "storage_path" in item && item.storage_path ? await getTransferDocumentPreviewUrlAction(item.storage_path) : await getTransferPdfUrlAction(transferId);
        setPreviewUrl(url);
      } catch (e: any) {
        setError(e.message || "Couldn't load a preview for this file.");
      }
    });
  }

  function pick(item: (typeof items)[number]) {
    setSelectedId(item.id);
    fetchPreview(item);
  }

  if (!open) {
    return (
      <button onClick={load} style={{ fontSize: 12, color: "var(--text-heading)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
        Preview
      </button>
    );
  }

  return (
    <div style={{ width: "100%", marginTop: 10, borderTop: "1px solid #eee", paddingTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
        <button onClick={() => setOpen(false)} style={{ fontSize: 11.5, color: "#999", background: "none", border: "none", cursor: "pointer" }}>
          Hide preview
        </button>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        {items.length > 1 && (
          <div style={{ flex: "0 0 200px", display: "grid", gap: 4 }}>
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => pick(item)}
                style={{
                  textAlign: "left",
                  fontSize: 12.5,
                  padding: "7px 10px",
                  borderRadius: 6,
                  border: `1px solid ${selectedId === item.id ? "#0c1730" : "#eee"}`,
                  background: selectedId === item.id ? "#f5f6fa" : "var(--card-bg)",
                  cursor: "pointer",
                  color: "var(--text-heading)",
                }}
              >
                {item.title}
              </button>
            ))}
          </div>
        )}
        <div style={{ flex: "1 1 260px", minWidth: 220, borderRadius: 8, overflow: "hidden", background: "#f4f5f7", minHeight: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {pending ? (
            <span style={{ color: "#999", fontSize: 12.5 }}>Loading preview…</span>
          ) : error ? (
            <span style={{ color: "#a12a2a", fontSize: 12.5, padding: 20, textAlign: "center" }}>{error}</span>
          ) : previewUrl && selected?.mime_type === "application/pdf" ? (
            <iframe src={previewUrl} title={selected.title} style={{ width: "100%", height: "55vh", border: "none" }} />
          ) : previewUrl && selected && isPreviewableImage(selected.mime_type) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={selected.title} style={{ maxWidth: "100%", maxHeight: "55vh", display: "block" }} />
          ) : (
            <span style={{ color: "#999", fontSize: 12.5, padding: 20, textAlign: "center" }}>Preview isn&apos;t available for this file type.</span>
          )}
        </div>
      </div>
    </div>
  );
}
