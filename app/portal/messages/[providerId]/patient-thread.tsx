"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { sendProviderMessageAction, markProviderThreadReadAction } from "../actions";

type Message = {
  id: string;
  sender_type: "patient" | "provider";
  sender_name: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

type Status = {
  providerName: string;
  providerTitle: string | null;
  enabled: boolean;
  eligible: boolean;
  withinWindow: boolean;
  withinHours: boolean;
  outsideHoursBehavior: "allow_queue" | "disable";
  availabilityMode: string;
  disclaimer: string | null;
  canSend: boolean;
};

// Patient-side thread. When canSend is false, the reason is shown in
// plain language and NO composer is rendered — never a text box that
// silently fails on submit. The exact "Messaging is currently
// unavailable for this provider." wording (spec §33) is used specifically
// for the master-toggle-off case, matching the locked badge on the
// provider profile.
export function PatientThread({ providerId, status, initialMessages }: { providerId: string; status: Status; initialMessages: Message[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const markedRef = useRef(false);

  useEffect(() => {
    if (markedRef.current) return;
    markedRef.current = true;
    const hasUnread = initialMessages.some((m) => m.sender_type === "provider" && !m.read_at);
    if (hasUnread) {
      markProviderThreadReadAction(providerId).catch(() => {});
    }
  }, [initialMessages, providerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  function send() {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    const optimistic: Message = {
      id: `pending-${Math.random()}`,
      sender_type: "patient",
      sender_name: "You",
      body,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    startTransition(async () => {
      try {
        await sendProviderMessageAction(providerId, body);
      } catch (e: any) {
        setError(e.message || "Couldn't send that message. Please try again.");
      }
    });
  }

  let lockedReason: string | null = null;
  if (!status.enabled) {
    lockedReason = "Messaging is currently unavailable for this provider.";
  } else if (!status.eligible) {
    lockedReason = "You aren't currently able to message this provider. This is usually because messaging opens up around an appointment — please check back closer to your visit.";
  } else if (!status.withinWindow) {
    lockedReason = "Messaging is only available around your appointment with this provider.";
  } else if (!status.withinHours && status.outsideHoursBehavior === "disable") {
    lockedReason = "This provider is outside messaging hours right now — please try again later.";
  }

  const showOutsideHoursNotice = status.canSend && !status.withinHours && status.outsideHoursBehavior === "allow_queue";

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {status.disclaimer && (
        <div style={{ fontSize: 11.5, color: "#999", background: "#f8f8f9", border: "1px solid #eee", borderRadius: 8, padding: "8px 12px" }}>{status.disclaimer}</div>
      )}

      <div style={{ background: "white", border: "1px solid #eee", borderRadius: 12, display: "flex", flexDirection: "column", height: 480 }}>
        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {messages.length === 0 && (
            <div style={{ color: "#999", fontSize: 13, textAlign: "center", marginTop: 24 }}>
              {lockedReason ? "No messages yet." : "No messages yet — say hello!"}
            </div>
          )}
          {messages.map((m) => {
            const mine = m.sender_type === "patient";
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

        {lockedReason ? (
          <div style={{ borderTop: "1px solid #eee", padding: "14px 16px", display: "flex", alignItems: "center", gap: 8, background: "#f8f8f9" }}>
            <span style={{ fontSize: 15 }}>🔒</span>
            <span style={{ fontSize: 12.5, color: "#888" }}>{lockedReason}</span>
          </div>
        ) : (
          <>
            {showOutsideHoursNotice && (
              <div style={{ borderTop: "1px solid #eee", padding: "8px 16px 0", fontSize: 11.5, color: "#7a5c12" }}>
                This provider is outside messaging hours right now — your message will be seen when they're back.
              </div>
            )}
            <div style={{ borderTop: showOutsideHoursNotice ? "none" : "1px solid #eee", padding: 12, display: "flex", gap: 8 }}>
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
          </>
        )}
      </div>
    </div>
  );
}
