"use client";

import { useTransition } from "react";
import { portalDocumentSignedUrlAction } from "../actions";

type Doc = {
  id: string;
  title: string;
  doc_type: string;
  description: string | null;
  created_at: string;
  storage_path: string | null;
  mime_type: string | null;
  document_date: string | null;
};

export function PortalDocumentsList({ documents }: { documents: Doc[] }) {
  const [pending, startTransition] = useTransition();

  function view(storagePath: string) {
    startTransition(async () => {
      try {
        const url = await portalDocumentSignedUrlAction(storagePath);
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (e: any) {
        alert(e.message || "Couldn't open this file.");
      }
    });
  }

  if (documents.length === 0) {
    return <p style={{ color: "#999", fontSize: 12.5 }}>No documents on file yet.</p>;
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {documents.map((d) => (
        <div key={d.id} style={{ background: "white", border: "1px solid #eee", borderRadius: 10, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <strong style={{ fontSize: 13.5 }}>{d.title}</strong>
            <div style={{ color: "#888", fontSize: 11.5, marginTop: 3 }}>
              {d.document_date ? `Service date ${new Date(d.document_date).toLocaleDateString()} · ` : ""}
              Filed {new Date(d.created_at).toLocaleDateString()}
            </div>
            {d.description && <div style={{ color: "#666", fontSize: 12, marginTop: 2 }}>{d.description}</div>}
          </div>
          {d.storage_path && (
            <button
              onClick={() => view(d.storage_path!)}
              disabled={pending}
              style={{ background: "none", border: "1px solid #ddd", color: "#0c1730", cursor: "pointer", fontSize: 12, fontWeight: 600, borderRadius: 7, padding: "6px 12px", flexShrink: 0 }}
            >
              View
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
