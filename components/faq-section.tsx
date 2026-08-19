"use client";

import { useState } from "react";

type Faq = { id: string; question: string; answer: string };

// Content comes entirely from Superadmin (/admin/faqs) — nothing here is
// hardcoded, so adding/editing/reordering questions there updates this
// section immediately, no deploy needed.
export function FaqSection({ faqs }: { faqs: Faq[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (faqs.length === 0) return null;

  return (
    <div style={{ marginTop: 48 }}>
      <h2 style={{ fontSize: 15, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16 }}>
        Frequently asked questions
      </h2>
      <div style={{ display: "grid", gap: 8 }}>
        {faqs.map((f) => {
          const open = openId === f.id;
          return (
            <div key={f.id} style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 10, overflow: "hidden" }}>
              <button
                onClick={() => setOpenId(open ? null : f.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "14px 16px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                {f.question}
                <span style={{ color: "#888", fontSize: 13 }}>{open ? "−" : "+"}</span>
              </button>
              {open && (
                <div style={{ padding: "0 16px 16px", color: "#555", fontSize: 13, lineHeight: 1.5 }}>{f.answer}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
