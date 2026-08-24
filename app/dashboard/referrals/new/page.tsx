import Link from "next/link";
import { NewReferralClient } from "./new-referral-client";

// Global "+ New Referral" entry point (spec §22-25): search-patient-first,
// then place the referral. Once a patient is picked, this calls the exact
// same createReferralAction (../actions.ts) the patient chart's own
// Referrals tab uses — no separate referral-creation path, just a
// different starting point for staff who don't already have a chart open.
export default function NewReferralPage() {
  return (
    <div>
      <Link href="/dashboard/referrals" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "#666", textDecoration: "none", marginBottom: 14 }}>
        ← Back to Referrals
      </Link>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>New Referral</h1>
      <p style={{ color: "#666", marginBottom: 20, fontSize: 13 }}>
        Search for the patient this referral is for. To create a referral while already viewing a chart, use "+ New
        Referral" on that patient's Referrals tab instead — it's the same action, just with the patient
        pre-selected.
      </p>
      <NewReferralClient />
    </div>
  );
}
