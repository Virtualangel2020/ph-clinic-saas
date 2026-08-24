"use client";

import { useState, useTransition } from "react";
import {
  searchAngelClinicProvidersAction,
  searchExternalProvidersAction,
  setPrimaryProviderAction,
  setSharingPreferenceAction,
  revokeSharingPreferenceAction,
  type DirectoryProvider,
  type ExternalDirectoryProvider,
} from "../care-coordination-actions";

const FIELD_STYLE: React.CSSProperties = { border: "1px solid var(--input-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };

type PrimaryProvider = { kind: "angelclinic"; name: string; specialty: string | null; clinicName: string | null } | { kind: "external"; name: string; specialty: string | null; clinicName: string | null } | null;

type SharingPreference = { providerUserId: string; providerName: string; clinicName: string | null; authorizedAt: string } | null;

// Care Coordination (spec §8-11): Primary/Family Doctor selection and
// progress-note sharing authorization are shown together because they're
// both about who else is involved in this patient's care, but they are
// deliberately independent actions below — selecting a primary doctor
// never sets or implies sharing authorization.
export function CareCoordinationSection({ patientId, primaryProvider, sharingPreference }: { patientId: string; primaryProvider: PrimaryProvider; sharingPreference: SharingPreference }) {
  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
      <h2 style={{ fontSize: 15, marginBottom: 12 }}>Care Coordination</h2>
      <div style={{ display: "grid", gap: 16 }}>
        <PrimaryProviderRow patientId={patientId} current={primaryProvider} />
        <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 14 }}>
          <SharingPreferenceRow patientId={patientId} current={sharingPreference} />
        </div>
      </div>
    </div>
  );
}

function PrimaryProviderRow({ patientId, current }: { patientId: string; current: PrimaryProvider }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function choose(kind: "angelclinic" | "external", provider: DirectoryProvider | ExternalDirectoryProvider) {
    setError(null);
    startTransition(async () => {
      try {
        if (kind === "angelclinic") await setPrimaryProviderAction(patientId, provider.id, null);
        else await setPrimaryProviderAction(patientId, null, provider.id);
        setEditing(false);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function clear() {
    setError(null);
    startTransition(async () => {
      try {
        await setPrimaryProviderAction(patientId, null, null);
        setEditing(false);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 2 }}>Primary / Family Medicine Doctor</div>
          {current ? (
            <div style={{ fontSize: 13.5 }}>
              {current.name}
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: current.kind === "angelclinic" ? "#1a7f37" : "#666",
                  background: current.kind === "angelclinic" ? "#eaf7ee" : "#f2f2f2",
                  border: `1px solid ${current.kind === "angelclinic" ? "#bfe6c9" : "#ddd"}`,
                  borderRadius: 999,
                  padding: "2px 8px",
                }}
              >
                {current.kind === "angelclinic" ? "AngelClinic Provider ✓" : "External Provider"}
              </span>
              {(current.specialty || current.clinicName) && (
                <div style={{ fontSize: 11.5, color: "#888", marginTop: 2 }}>{[current.specialty, current.clinicName].filter(Boolean).join(" · ")}</div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: "#999" }}>Not set</div>
          )}
        </div>
        <button onClick={() => setEditing((v) => !v)} style={{ fontSize: 12, color: "var(--text-heading)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
          {editing ? "Cancel" : current ? "Change" : "+ Set"}
        </button>
      </div>

      {error && <p style={{ fontSize: 11.5, color: "crimson", marginTop: 6 }}>{error}</p>}

      {editing && (
        <div style={{ marginTop: 10 }}>
          <ProviderSearch onPickAngelClinic={(p) => choose("angelclinic", p)} onPickExternal={(p) => choose("external", p)} pending={pending} />
          {current && (
            <button onClick={clear} disabled={pending} style={{ marginTop: 8, fontSize: 11.5, color: "#999", background: "none", border: "none", cursor: "pointer" }}>
              Clear primary doctor
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SharingPreferenceRow({ patientId, current }: { patientId: string; current: SharingPreference }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function choose(provider: DirectoryProvider) {
    setError(null);
    startTransition(async () => {
      try {
        await setSharingPreferenceAction(patientId, provider.id);
        setEditing(false);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function revoke() {
    setError(null);
    startTransition(async () => {
      try {
        await revokeSharingPreferenceAction(patientId);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 4 }}>
        Send progress notes to another doctor for this patient's care?
      </div>
      <p style={{ fontSize: 11.5, color: "#999", margin: "0 0 8px" }}>
        Separate from the primary doctor above — this only controls whether staff are offered a "Send Copy" option
        when an encounter is completed. Nothing is ever shared automatically.
      </p>

      {current ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13.5 }}>
            {current.providerName}
            <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: "#1a7f37", background: "#eaf7ee", border: "1px solid #bfe6c9", borderRadius: 999, padding: "2px 8px" }}>
              Connected through AngelClinic
            </span>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
              {current.clinicName ? `${current.clinicName} · ` : ""}Authorized {new Date(current.authorizedAt).toLocaleDateString()}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setEditing((v) => !v)} style={{ fontSize: 12, color: "var(--text-heading)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
              Change
            </button>
            <button onClick={revoke} disabled={pending} style={{ fontSize: 12, color: "#a12a2a", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
              Revoke
            </button>
          </div>
        </div>
      ) : editing ? null : (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setEditing(true)} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Yes — set up
          </button>
          <span style={{ fontSize: 12, color: "#999", alignSelf: "center" }}>No sharing preference set.</span>
        </div>
      )}

      {error && <p style={{ fontSize: 11.5, color: "crimson", marginTop: 6 }}>{error}</p>}

      {editing && (
        <div style={{ marginTop: 10 }}>
          <ProviderSearch onPickAngelClinic={choose} pending={pending} angelClinicOnly />
        </div>
      )}
    </div>
  );
}

// Shared search widget — searches the cross-tenant AngelClinic provider
// directory, and (unless angelClinicOnly) the curated external-provider
// directory too, with a clear "AngelClinic Provider ✓" vs "External
// Provider" distinction on every result (spec §8).
function ProviderSearch({
  onPickAngelClinic,
  onPickExternal,
  pending,
  angelClinicOnly = false,
}: {
  onPickAngelClinic: (p: DirectoryProvider) => void;
  onPickExternal?: (p: ExternalDirectoryProvider) => void;
  pending: boolean;
  angelClinicOnly?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [angelResults, setAngelResults] = useState<DirectoryProvider[]>([]);
  const [externalResults, setExternalResults] = useState<ExternalDirectoryProvider[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  async function runSearch() {
    setSearching(true);
    try {
      const angel = await searchAngelClinicProvidersAction(query);
      setAngelResults(angel);
      if (!angelClinicOnly) setExternalResults(await searchExternalProvidersAction(query));
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          placeholder="Search by name, specialty, or clinic…"
          style={FIELD_STYLE}
        />
        <button onClick={runSearch} disabled={searching} style={{ background: "#0c1730", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
          {searching ? "…" : "Search"}
        </button>
      </div>

      {searched && (
        <div style={{ marginTop: 8, maxHeight: 260, overflowY: "auto", border: "1px solid #eee", borderRadius: 8 }}>
          {angelResults.length === 0 && externalResults.length === 0 && (
            <div style={{ padding: 12, fontSize: 12.5, color: "#999" }}>No providers found.</div>
          )}
          {angelResults.map((p) => (
            <button
              key={p.id}
              disabled={pending}
              onClick={() => onPickAngelClinic(p)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", border: "none", borderBottom: "1px solid #f2f2f2", background: "var(--card-bg)", cursor: "pointer", fontSize: 13 }}
            >
              {p.title ? `${p.title} ` : ""}
              {p.full_name}
              <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#1a7f37", background: "#eaf7ee", border: "1px solid #bfe6c9", borderRadius: 999, padding: "1px 6px" }}>AngelClinic ✓</span>
              <div style={{ fontSize: 11, color: "#888" }}>{[p.specialty, p.clinic_name].filter(Boolean).join(" · ")}</div>
            </button>
          ))}
          {externalResults.map((p) => (
            <button
              key={p.id}
              disabled={pending}
              onClick={() => onPickExternal?.(p)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", border: "none", borderBottom: "1px solid #f2f2f2", background: "var(--card-bg)", cursor: "pointer", fontSize: 13 }}
            >
              {p.full_name}
              <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#666", background: "#f2f2f2", border: "1px solid var(--input-border)", borderRadius: 999, padding: "1px 6px" }}>External</span>
              <div style={{ fontSize: 11, color: "#888" }}>{[p.specialty, p.clinic_name, p.city].filter(Boolean).join(" · ")}</div>
            </button>
          ))}
        </div>
      )}
      {angelClinicOnly && (
        <p style={{ fontSize: 10.5, color: "#aaa", marginTop: 6 }}>
          Only AngelClinic providers can be selected here — secure internal sending requires a real AngelClinic account.
        </p>
      )}
    </div>
  );
}
