"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LoadingButton } from "@/components/loading/loading-button";
import { DOB_MIN_DATE, dobMaxDate } from "@/lib/dob";

type Account = { id: string; first_name: string; last_name: string };

const input: React.CSSProperties = { padding: 9, borderRadius: 8, border: "1px solid #ccc", fontSize: 13.5, width: "100%", boxSizing: "border-box" };

// Angel: "if I want to create an account for my husband and kid, i should
// be able to create another one too." A dependent has no login of their
// own — the signed-in owner manages their Health Profile and any clinic
// access requests on their behalf (see create_dependent_mycaredesk_account
// / mycaredesk_family_dependent_accounts migration). This panel lists the
// owner + every dependent as switchable pills and a small "add" form.
export function FamilyPanel({ owner, family, activeAccountId }: { owner: Account; family: Account[]; activeAccountId: string }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex] = useState("female");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("create_dependent_mycaredesk_account", {
      p_first_name: firstName,
      p_last_name: lastName,
      p_date_of_birth: dateOfBirth,
      p_sex: sex,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setAdding(false);
    setFirstName("");
    setLastName("");
    setDateOfBirth("");
    setSex("female");
    router.push(`/portal/health-profile?for=${(data as any).id}`);
    router.refresh();
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <FamilyPill label={`${owner.first_name} ${owner.last_name} (You)`} href="/portal/health-profile" active={activeAccountId === owner.id} />
        {family.map((f) => (
          <FamilyPill key={f.id} label={`${f.first_name} ${f.last_name}`} href={`/portal/health-profile?for=${f.id}`} active={activeAccountId === f.id} />
        ))}
        <button
          onClick={() => setAdding((v) => !v)}
          style={{ fontSize: 12.5, fontWeight: 600, color: "var(--brand-primary)", background: "white", border: "1px dashed var(--brand-primary)", borderRadius: 999, padding: "6px 14px", cursor: "pointer" }}
        >
          + Add family member
        </button>
      </div>

      {adding && (
        <form onSubmit={submit} style={{ marginTop: 12, background: "white", border: "1px solid #eee", borderRadius: 10, padding: 14, display: "grid", gap: 10 }}>
          <p style={{ fontSize: 12, color: "#666", margin: 0 }}>
            For a spouse, child, or anyone else you're managing MyCareDesk for. They won't have their own login — you'll fill in their Health Profile and handle clinic
            requests on their behalf.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input required placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={input} />
            <input required placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} style={input} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input required type="date" min={DOB_MIN_DATE} max={dobMaxDate()} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} style={input} />
            <select value={sex} onChange={(e) => setSex(e.target.value)} style={input}>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </div>
          {error && <p style={{ color: "crimson", fontSize: 13, margin: 0 }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <LoadingButton
              type="submit"
              loading={saving}
              loadingText="Adding..."
              style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--brand-primary)", color: "white", fontWeight: 700, fontSize: 13 }}
            >
              Add family member
            </LoadingButton>
            <button
              type="button"
              onClick={() => setAdding(false)}
              style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ccc", background: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function FamilyPill({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <a
      href={href}
      style={{
        fontSize: 12.5,
        fontWeight: 700,
        padding: "6px 14px",
        borderRadius: 999,
        textDecoration: "none",
        border: active ? "1px solid var(--brand-primary)" : "1px solid #ddd",
        background: active ? "var(--brand-primary)" : "white",
        color: active ? "white" : "#444",
      }}
    >
      {label}
    </a>
  );
}
