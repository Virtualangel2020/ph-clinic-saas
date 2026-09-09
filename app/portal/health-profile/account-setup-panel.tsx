"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LoadingButton } from "@/components/loading/loading-button";

type Prefill = { first_name: string; last_name: string; date_of_birth: string; sex: string; mobile_phone: string | null; email: string | null } | null;

const input: React.CSSProperties = { padding: 10, borderRadius: 8, border: "1px solid #ccc", fontSize: 14, width: "100%", boxSizing: "border-box" };

// Handles the one case where a signed-in Patient Portal user reaches
// /portal/health-profile without yet holding a platform-level MyCareDesk
// account (an existing, staff-invited patient who never went through
// /patient-signup). Creates the account, then links whichever per-clinic
// patient records this same login already has active portal access to —
// see link_my_existing_patients_to_mycaredesk_account in the migration.
export function AccountSetupPanel({ prefill, email }: { prefill: Prefill; email: string }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(prefill?.first_name ?? "");
  const [lastName, setLastName] = useState(prefill?.last_name ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(prefill?.date_of_birth ?? "");
  const [sex, setSex] = useState(prefill?.sex ?? "female");
  const [mobilePhone, setMobilePhone] = useState(prefill?.mobile_phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const { error: createError } = await supabase.rpc("self_register_mycaredesk_account", {
      p_first_name: firstName,
      p_last_name: lastName,
      p_date_of_birth: dateOfBirth,
      p_sex: sex,
      p_mobile_phone: mobilePhone,
      p_email: prefill?.email ?? email,
    });
    if (createError) {
      setSaving(false);
      setError(createError.message);
      return;
    }

    // Best-effort — link whichever existing per-clinic patient records this
    // login already has active portal access to. Not fatal if it errors.
    await supabase.rpc("link_my_existing_patients_to_mycaredesk_account");

    setSaving(false);
    router.push("/portal/health-profile");
    router.refresh();
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <input required placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={input} />
        <input required placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} style={input} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <input required type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} style={input} />
        <select value={sex} onChange={(e) => setSex(e.target.value)} style={input}>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="other">Other</option>
        </select>
      </div>
      <input required placeholder="Mobile number" value={mobilePhone} onChange={(e) => setMobilePhone(e.target.value)} style={input} />
      {error && <p style={{ color: "crimson", fontSize: 13 }}>{error}</p>}
      <LoadingButton
        type="submit"
        loading={saving}
        loadingText="Setting up..."
        style={{ padding: 11, borderRadius: 8, border: "none", background: "var(--brand-primary)", color: "white", fontWeight: 700, fontSize: 14 }}
      >
        Set up my MyCareDesk account →
      </LoadingButton>
    </form>
  );
}
