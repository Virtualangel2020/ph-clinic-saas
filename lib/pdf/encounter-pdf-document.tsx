import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";

// Server-only — @react-pdf/renderer renders in Node, never import this
// from a "use client" component. Used exclusively by the export Route
// Handler (app/api/encounters/export-pdf/route.ts).
//
// Spec ("ENCOUNTER HISTORY, PDF EXPORT & PROVIDER SHARING UPDATE",
// section 4): clinic branding, patient identifiers, and per-encounter
// clinical content only — deliberately no internal administrative fields
// (no internal status workflow labels, no user-account IDs, no
// appointment bookkeeping) beyond what a real clinical record needs.

export type ClinicInfo = {
  name: string;
  logoUrl: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  website: string | null;
};

export type PatientInfo = {
  fullName: string;
  dateOfBirth: string;
  sex: string | null;
};

export type ProgressNoteEntry = {
  id: string;
  noteDate: string;
  chiefComplaint: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  authorName: string | null;
  isAmendment: boolean;
  amendmentReason: string | null;
  vitals: { label: string; value: string }[];
};

export type EncounterEntry = {
  id: string;
  encounterDate: string;
  encounterType: string | null;
  chiefComplaint: string | null;
  providerName: string | null;
  providerCredentials: string | null;
  signedAt: string | null;
  signedByName: string | null;
  signedByCredentials: string | null;
  signatureImageUrl: string | null;
  notes: ProgressNoteEntry[];
};

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", borderBottom: "2 solid #0c1730", paddingBottom: 12, marginBottom: 14 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 44, height: 44, objectFit: "contain" },
  clinicName: { fontSize: 15, fontWeight: 700, color: "#0c1730" },
  clinicMeta: { fontSize: 8.5, color: "#555", marginTop: 2, lineHeight: 1.4 },
  docTitle: { fontSize: 9, color: "#888", textAlign: "right" },
  patientBlock: { backgroundColor: "#f4f5f7", borderRadius: 4, padding: "8 12", marginBottom: 16, flexDirection: "row", justifyContent: "space-between" },
  patientLabel: { fontSize: 8, color: "#888", textTransform: "uppercase" },
  patientValue: { fontSize: 11, fontWeight: 700, color: "#0c1730", marginTop: 1 },
  encounterSection: { marginBottom: 18 },
  encounterHeaderBar: { backgroundColor: "#0c1730", color: "#e6c66b", padding: "6 10", borderRadius: 3, marginBottom: 8, flexDirection: "row", justifyContent: "space-between" },
  encounterHeaderTitle: { fontSize: 11, fontWeight: 700 },
  encounterHeaderMeta: { fontSize: 9 },
  fieldRow: { flexDirection: "row", marginBottom: 3 },
  fieldLabel: { width: 100, fontSize: 9, fontWeight: 700, color: "#444" },
  fieldValue: { flex: 1, fontSize: 9.5, color: "#1a1a1a", lineHeight: 1.4 },
  soapBlock: { marginTop: 6, marginBottom: 4 },
  soapLabel: { fontSize: 9, fontWeight: 700, color: "#0c1730", marginBottom: 1, marginTop: 6 },
  soapText: { fontSize: 9.5, lineHeight: 1.45, color: "#222" },
  vitalsRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 4, marginBottom: 4, gap: 10 },
  vitalChip: { fontSize: 8.5, color: "#555" },
  amendmentBadge: { fontSize: 8, fontWeight: 700, color: "#8a6100", backgroundColor: "#fff6e6", padding: "2 6", borderRadius: 3, marginBottom: 4, alignSelf: "flex-start" },
  noteDivider: { borderTop: "0.5 solid #ddd", marginTop: 8, marginBottom: 8 },
  signatureBlock: { marginTop: 12, paddingTop: 8, borderTop: "0.5 solid #ccc", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  signatureImage: { width: 168, height: 56, objectFit: "contain" },
  signatureMeta: { fontSize: 8.5, color: "#555", marginTop: 2 },
  unsignedNote: { fontSize: 8.5, color: "#a12a2a", fontStyle: "italic", marginTop: 12 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 7.5, color: "#aaa", textAlign: "center", borderTop: "0.5 solid #eee", paddingTop: 6 },
});

function clinicAddressLine(c: ClinicInfo): string {
  return [c.addressLine1, c.addressLine2, c.city, c.province, c.postalCode].filter(Boolean).join(", ");
}
function clinicContactLine(c: ClinicInfo): string {
  return [c.phone, c.mobile, c.email, c.website].filter(Boolean).join(" · ");
}

export function EncounterExportDocument({
  clinic,
  patient,
  encounters,
  generatedAt,
}: {
  clinic: ClinicInfo;
  patient: PatientInfo;
  encounters: EncounterEntry[];
  generatedAt: string;
}) {
  return (
    <Document title={`${patient.fullName} — Clinical Record`}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <View style={styles.headerLeft}>
            {clinic.logoUrl && <Image src={clinic.logoUrl} style={styles.logo} />}
            <View>
              <Text style={styles.clinicName}>{clinic.name}</Text>
              <Text style={styles.clinicMeta}>{clinicAddressLine(clinic)}</Text>
              <Text style={styles.clinicMeta}>{clinicContactLine(clinic)}</Text>
            </View>
          </View>
          <Text style={styles.docTitle}>Clinical Record{"\n"}Generated {generatedAt}</Text>
        </View>

        <View style={styles.patientBlock}>
          <View>
            <Text style={styles.patientLabel}>Patient</Text>
            <Text style={styles.patientValue}>{patient.fullName}</Text>
          </View>
          <View>
            <Text style={styles.patientLabel}>Date of birth</Text>
            <Text style={styles.patientValue}>{patient.dateOfBirth}</Text>
          </View>
          {patient.sex && (
            <View>
              <Text style={styles.patientLabel}>Sex</Text>
              <Text style={styles.patientValue}>{patient.sex}</Text>
            </View>
          )}
        </View>

        {encounters.map((e) => (
          <View key={e.id} style={styles.encounterSection} wrap={false}>
            <View style={styles.encounterHeaderBar}>
              <Text style={styles.encounterHeaderTitle}>Encounter — {e.encounterDate}</Text>
              <Text style={styles.encounterHeaderMeta}>{e.encounterType ?? "Visit"}</Text>
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Provider</Text>
              <Text style={styles.fieldValue}>
                {e.providerName ?? "—"}
                {e.providerCredentials ? ` (${e.providerCredentials})` : ""}
              </Text>
            </View>
            {e.chiefComplaint && (
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Chief complaint</Text>
                <Text style={styles.fieldValue}>{e.chiefComplaint}</Text>
              </View>
            )}

            {e.notes.length === 0 ? (
              <Text style={{ fontSize: 9, color: "#999", fontStyle: "italic", marginTop: 6 }}>No documentation recorded for this encounter.</Text>
            ) : (
              e.notes.map((n, i) => (
                <View key={n.id}>
                  {i > 0 && <View style={styles.noteDivider} />}
                  {n.isAmendment && <Text style={styles.amendmentBadge}>AMENDMENT{n.authorName ? ` — ${n.authorName}` : ""}{n.amendmentReason ? `: ${n.amendmentReason}` : ""}</Text>}
                  {n.vitals.length > 0 && (
                    <View style={styles.vitalsRow}>
                      {n.vitals.map((v, vi) => (
                        <Text key={vi} style={styles.vitalChip}>
                          {v.label}: {v.value}
                        </Text>
                      ))}
                    </View>
                  )}
                  {n.subjective && (
                    <View style={styles.soapBlock}>
                      <Text style={styles.soapLabel}>Subjective</Text>
                      <Text style={styles.soapText}>{n.subjective}</Text>
                    </View>
                  )}
                  {n.objective && (
                    <View style={styles.soapBlock}>
                      <Text style={styles.soapLabel}>Objective</Text>
                      <Text style={styles.soapText}>{n.objective}</Text>
                    </View>
                  )}
                  {n.assessment && (
                    <View style={styles.soapBlock}>
                      <Text style={styles.soapLabel}>Assessment / Diagnosis</Text>
                      <Text style={styles.soapText}>{n.assessment}</Text>
                    </View>
                  )}
                  {n.plan && (
                    <View style={styles.soapBlock}>
                      <Text style={styles.soapLabel}>Plan</Text>
                      <Text style={styles.soapText}>{n.plan}</Text>
                    </View>
                  )}
                </View>
              ))
            )}

            {e.signedAt ? (
              <View style={styles.signatureBlock}>
                <View>
                  <Text style={styles.signatureMeta}>
                    Signed by {e.signedByName ?? "—"}
                    {e.signedByCredentials ? ` (${e.signedByCredentials})` : ""}
                  </Text>
                  <Text style={styles.signatureMeta}>Date/time signed: {e.signedAt}</Text>
                </View>
                {e.signatureImageUrl && <Image src={e.signatureImageUrl} style={styles.signatureImage} />}
              </View>
            ) : (
              <Text style={styles.unsignedNote}>This encounter has not yet been signed by the provider.</Text>
            )}
          </View>
        ))}

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) => `${clinic.name} · Confidential clinical record · Page ${pageNumber} of ${totalPages}`}
        />
      </Page>
    </Document>
  );
}
