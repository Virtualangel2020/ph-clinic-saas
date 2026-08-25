"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { sendPatientMessageAction, markPatientThreadReadAction } from "../actions";

type Message = {
  id: string;
  sender_type: "patient" | "provider";
  sender_name: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export function StaffThread({ patientId, initialMessages, messagingEnabled }: { patientId: string; initialMessages: Message[]; messagingEnabled: boolean }) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const markedRef = useRef(false);

  useEffect(() => {
    if (markedRef.current) return;
    markedRef.current = true;
    const hasUnread = initialMessages.some((m) => m.sender_type === "patient" && !m.read_at);
    if (hasUnread) {
      markPatientThreadReadAction(patientId).catch(() => {});
    }
  }, [initialMessages, patientId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  function send() {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    const optimistic: Message = {
      id: `pending-${Math.random()}`,
      sender_type: "provider",
      sender_name: "You",
      body,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    startTransition(async () => {
      try {
        await sendPatientMessageAction(patientId, body);
      } catch (e: any) {
        setError(e.message || "Couldn't send that message. Please try again.");
      }
    });
  }

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, display: "flex", flexDirection: "column", height: 520 }}>
      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && <div style={{ color: "#999", fontSize: 13, textAlign: "center", marginTop: 24 }}>No messages yet.</div>}
        {messages.map((m) => {
          const mine = m.sender_type === "provider";
          return (
            <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "80%" }}>
              <div
                style={{
                  background: mine ? "#0c1730" : "#f1f2f5",
                  color: mine ? "white" : "#222",
                  borderRadius: 14,
                  padding: "8px 12px",
                  fontSize: 13.5,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {m.body}
              </div>
              <div style={{ fontSize: 10.5, color: "#999", marginTop: 3, textAlign: mine ? "right" : "left" }}>
                {mine ? "You" : m.sender_name} · {new Date(m.created_at).toLocaleString()}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <div style={{ color: "#a12a2a", fontSize: 12.5, padding: "0 16px 8px" }}>{error}</div>}

      {messagingEnabled ? (
        <div style={{ borderTop: "1px solid #eee", padding: 12, display: "flex", gap: 8 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Reply to this patient…"
            rows={2}
            style={{ flex: 1, resize: "none", border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", fontSize: 13.5, fontFamily: "inherit" }}
          />
          <button
            onClick={send}
            disabled={pending || !draft.trim()}
            style={{ alignSelf: "flex-end", background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", opacity: pending || !draft.trim() ? 0.6 : 1 }}
          >
            Send
          </button>
        </div>
      ) : (
        <div style={{ borderTop: "1px solid #eee", padding: "14px 16px", fontSize: 12.5, color: "#888", background: "#f8f8f9" }}>
          🔒 Messaging is currently off for your profile — turn it back on in Patient Access settings to reply.
        </div>
      )}
    </div>
  );
}
