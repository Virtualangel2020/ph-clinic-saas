"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { sendClinicSupportMessageAction, markClinicSupportReadAction } from "../actions";

type Message = {
  id: string;
  sender_type: "clinic" | "platform";
  sender_name: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

// Messenger-style: one persistent thread, always here, no ticket/session
// concept. Marks the platform's messages as read as soon as the clinic
// opens this page (matches how the admin side decrements its own badge).
export function SupportThread({ initialMessages }: { initialMessages: Message[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const markedRef = useRef(false);

  useEffect(() => {
    if (markedRef.current) return;
    markedRef.current = true;
    const hasUnread = initialMessages.some((m) => m.sender_type === "platform" && !m.read_at);
    if (hasUnread) {
      markClinicSupportReadAction().catch(() => {});
    }
  }, [initialMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  function send() {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    const optimistic: Message = {
      id: `pending-${Date.now()}`,
      sender_type: "clinic",
      sender_name: "You",
      body,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    startTransition(async () => {
      try {
        await sendClinicSupportMessageAction(body);
      } catch (e: any) {
        setError(e.message || "Couldn't send that message. Please try again.");
      }
    });
  }

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, display: "flex", flexDirection: "column", height: 480 }}>
      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ color: "#999", fontSize: 13, textAlign: "center", marginTop: 24 }}>
            No messages yet — say hello! We usually reply within a business day.
          </div>
        )}
        {messages.map((m) => {
          const mine = m.sender_type === "clinic";
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
          placeholder="Type a message…"
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
    </div>
  );
}
