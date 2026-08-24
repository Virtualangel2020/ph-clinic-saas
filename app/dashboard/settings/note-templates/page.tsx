import { requireClinicAdmin } from "@/lib/require-clinic-admin";
import { BackLink } from "@/components/back-link";
import { NoteTemplatesClient } from "./note-templates-client";

// Progress note template builder. patient_progress_notes has FIXED columns
// (subjective, objective, assessment, plan) — there is no flexible/jsonb
// storage for note content itself, so a template can only relabel/reprompt
// those same 4 concepts (rename "Objective" to "Findings", tweak the
// placeholder hint, etc.) — it can't invent new fields. Exactly one
// template per tenant may be is_default=true (enforced by a partial unique
// index at the DB level); the default's labels/placeholders are what the
// patient-chart note composer actually shows.
export default async function NoteTemplatesSettingsPage() {
  const { supabase, profile } = await requireClinicAdmin();

  const { data: templates } = await supabase
    .from("note_templates")
    .select("id, name, based_on, sections, is_default, is_active")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at");

  return (
    <div style={{ maxWidth: 760 }}>
      <BackLink href="/dashboard/settings" label="Settings" />
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Progress Note Templates</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
        Customize how the Subjective, Objective, Assessment, and Plan sections are labeled and prompted when your
        providers write a progress note. Mark one template as the clinic default — it's the one providers see when
        charting a patient.
      </p>
      <NoteTemplatesClient initialTemplates={(templates as any) ?? []} />
    </div>
  );
}
