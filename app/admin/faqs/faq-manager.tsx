"use client";

import { useState, useTransition } from "react";
import { upsertFaqAction, deleteFaqAction } from "@/app/admin/actions";

type Faq = { id: string; question: string; answer: string; sort_order: number; is_active: boolean };

export function FaqManager({ faqs }: { faqs: Faq[] }) {
  const [showNew, setShowNew] = useState(false);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {faqs.map((f) => (
        <FaqRow key={f.id} faq={f} />
      ))}

      {showNew ? (
        <FaqRow faq={null} onDone={() => setShowNew(false)} />
      ) : (
        <button
          onClick={() => setShowNew(true)}
          style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #2563eb", background: "white", color: "#2563eb", fontWeight: 600, fontSize: 13, cursor: "pointer", justifySelf: "start" }}
        >
          + Add FAQ
        </button>
      )}

      {faqs.length === 0 && !showNew && (
        <p style={{ color: "#888", fontSize: 13 }}>No FAQ entries yet — add the first one above.</p>
      )}
    </div>
  );
}

function FaqRow({ faq, onDone }: { faq: Faq | null; onDone?: () => void }) {
  const [question, setQuestion] = useState(faq?.question ?? "");
  const [answer, setAnswer] = useState(faq?.answer ?? "");
  const [sortOrder, setSortOrder] = useState(String(faq?.sort_order ?? 0));
  const [isActive, setIsActive] = useState(faq?.is_active ?? true);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    if (!question.trim() || !answer.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await upsertFaqAction({
          id: faq?.id ?? null,
          question: question.trim(),
          answer: answer.trim(),
          sortOrder: Number(sortOrder) || 0,
          isActive,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        if (!faq) {
          setQuestion("");
          setAnswer("");
          onDone?.();
        }
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function remove() {
    if (!faq) return;
    startTransition(async () => {
      try {
        await deleteFaqAction(faq.id);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 10, padding: 14 }}>
      <input
        placeholder="Question — e.g. Can I upgrade later?"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onBlur={save}
        disabled={pending}
        style={{ ...inputStyle, fontWeight: 600, marginBottom: 8 }}
      />
      <textarea
        placeholder="Answer"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onBlur={save}
        disabled={pending}
        rows={2}
        style={{ ...inputStyle, marginBottom: 8, resize: "vertical" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          Order
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            onBlur={save}
            style={{ ...inputStyle, width: 56, padding: "4px 6px" }}
          />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => {
              setIsActive(e.target.checked);
              startTransition(async () => {
                try {
                  await upsertFaqAction({
                    id: faq?.id ?? null,
                    question: question.trim(),
                    answer: answer.trim(),
                    sortOrder: Number(sortOrder) || 0,
                    isActive: e.target.checked,
                  });
                } catch (err: any) {
                  setError(err.message);
                }
              });
            }}
          />
          Active
        </label>
        {faq && (
          <button onClick={remove} disabled={pending} style={{ marginLeft: "auto", background: "none", border: "none", color: "crimson", fontSize: 12, cursor: "pointer" }}>
            Delete
          </button>
        )}
        {faq && !faq.id && null}
        {faq === null && (
          <button onClick={save} disabled={pending} style={{ marginLeft: "auto", ...saveBtn }}>
            {pending ? "Saving..." : "Save"}
          </button>
        )}
        {saved && <span style={{ color: "#1a7f37" }}>saved</span>}
        {error && <span style={{ color: "crimson" }}>{error}</span>}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #ccc",
  fontSize: 13,
  fontFamily: "inherit",
};

const saveBtn: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 6,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
};
