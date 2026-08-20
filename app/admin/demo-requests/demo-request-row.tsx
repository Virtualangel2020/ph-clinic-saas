"use client";

import { useTransition } from "react";
import { setDemoRequestStatusAction } from "../actions";

type Request = {
  id: string;
  full_name: string;
  clinic_name: string;
  email: string;
  phone: string | null;
  location: string | null;
  specialty: string | null;
  provider_count: string | null;
  current_system: string | null;
  help_with: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

const STATUSES = ["new", "contacted", "scheduled", "closed", "not_interested"];

export function DemoRequestRow({ request }: { request: Request }) {
  const [pending, startTransition] = useTransition();

  function updateStatus(status: string) {
    startTransition(async () => {
      await setDemoRequestStatusAction(request.id, status);
    });
  }

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>
            {request.full_name} <span style={{ color: "#888", fontWeight: 400 }}>— {request.clinic_name}</span>
          </div>
          <div style={{ color: "#666", fontSize: 12.5, marginTop: 3 }}>
            {request.email} {request.phone ? `· ${request.phone}` : ""} {request.location ? `· ${request.location}` : ""}
          </div>
          {(request.specialty || request.provider_count || request.current_system) && (
            <div style={{ color: "#999", fontSize: 12, marginTop: 3 }}>
              {[request.specialty, request.provider_count ? `${request.provider_count} providers` : null, request.current_system ? `currently using: ${request.current_system}` : null]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
          {request.help_with && <div style={{ color: "#555", fontSize: 12.5, marginTop: 6 }}>Help with: {request.help_with}</div>}
          {request.message && <div style={{ color: "#555", fontSize: 12.5, marginTop: 4 }}>"{request.message}"</div>}
          <div style={{ color: "#bbb", fontSize: 11, marginTop: 6 }}>{new Date(request.created_at).toLocaleString()}</div>
        </div>
        <select
          value={request.status}
          disabled={pending}
          onChange={(e) => updateStatus(e.target.value)}
          style={{ height: 32, borderRadius: 8, border: "1px solid #ddd", fontSize: 12.5, padding: "0 8px", alignSelf: "flex-start" }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
