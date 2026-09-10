import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";

// Server-only (@react-pdf/renderer). "Download PDF" on the Patient Portal
// Health Profile — a printable summary the patient can bring to a visit
// or hand to a new provider. This is a MyCareDesk PLATFORM document (the
// mycaredesk_accounts / mycaredesk_health_profiles identity, not any one
// clinic's chart), so it's branded MyCareDesk rather than any clinic's
// own logo — unlike the per-clinic receipt/encounter exports elsewhere in
// lib/pdf.

export type SectionStatus = "unknown" | "none" | "has_entries";

export type HealthProfilePatient = {
  fullName: string;
  patientNumber: string | null;
  dateOfBirth: string | null;
  sex: string | null;
};

export type HealthProfileData = {
  patient: HealthProfilePatient;
  logoUrl: string;
  allergiesStatus: SectionStatus;
  allergies: string[];
  medicationsStatus: SectionStatus;
  medications: string[];
  conditionsStatus: SectionStatus;
  conditions: string[];
  surgicalHistoryStatus: SectionStatus;
  surgicalHistory: string | null;
  familyHistoryStatus: SectionStatus;
  familyHistory: string | null;
  socialHistory: string | null;
  hmoName: string | null;
  hmoNumber: string | null;
  philhealthNumber: string | null;
  emergencyContactName: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactPhone: string | null;
  generatedAt: string;
  generatedByName: string | null;
};

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottom: "2 solid #049ca0", paddingBottom: 12, marginBottom: 14 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 34, height: 34, borderRadius: 6 },
  wordmark: { fontSize: 15, fontWeight: 700, color: "#0f5a8c" },
  tagline: { fontSize: 8, color: "#888", marginTop: 1 },
  docTitle: { fontSize: 9, color: "#888", textAlign: "right" },
  title: { fontSize: 16, fontWeight: 700, textAlign: "center", letterSpacing: 1, marginBottom: 4 },
  subtitle: { fontSize: 9, color: "#888", textAlign: "center", marginBottom: 18 },
  patientBlock: { flexDirection: "row", justifyContent: "space-between", background: "#f7f7f9", borderRadius: 4, padding: "10 14", marginBottom: 16 },
  patientName: { fontSize: 13, fontWeight: 700 },
  patientMeta: { fontSize: 9, color: "#666", marginTop: 2 },
  patientIdLabel: { fontSize: 8, color: "#999", textTransform: "uppercase", letterSpacing: 0.3 },
  patientId: { fontSize: 11, fontWeight: 700, color: "#049ca0", fontFamily: "Courier" },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 10.5, fontWeight: 700, color: "#0f5a8c", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 5, borderBottom: "0.5 solid #eee", paddingBottom: 3 },
  bullet: { flexDirection: "row", marginBottom: 2 },
  bulletDot: { width: 10, fontSize: 10 },
  bulletText: { fontSize: 10, flex: 1 },
  none: { fontSize: 9.5, color: "#2a8f5a", fontStyle: "italic" },
  unknown: { fontSize: 9.5, color: "#aaa", fontStyle: "italic" },
  twoCol: { flexDirection: "row", gap: 24 },
  col: { flex: 1 },
  kv: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottom: "0.5 solid #f2f2f2" },
  kvLabel: { fontSize: 9, color: "#888" },
  kvValue: { fontSize: 10, fontWeight: 600 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 7.5, color: "#aaa", textAlign: "center", borderTop: "0.5 solid #eee", paddingTop: 6 },
});

function age(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a;
}

function ListSection({ title, status, items }: { title: string; status: SectionStatus; items: string[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {status === "none" ? (
        <Text style={styles.none}>None reported.</Text>
      ) : items.length > 0 ? (
        items.map((it, i) => (
          <View key={i} style={styles.bullet}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>{it}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.unknown}>Not yet provided.</Text>
      )}
    </View>
  );
}

function TextSection({ title, status, text }: { title: string; status: SectionStatus; text: string | null }) {
  const lines = (text ?? "").split("\n").filter(Boolean);
  return <ListSection title={title} status={status} items={lines} />;
}

export function HealthProfileDocument({ data }: { data: HealthProfileData }) {
  const { patient } = data;
  const patientAge = age(patient.dateOfBirth);
  return (
    <Document title={`Patient Profile — ${patient.fullName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image src={data.logoUrl} style={styles.logo} />
            <View>
              <Text style={styles.wordmark}>MyCareDesk</Text>
              <Text style={styles.tagline}>Patient Health Profile</Text>
            </View>
          </View>
          <Text style={styles.docTitle}>Generated{"\n"}{data.generatedAt}</Text>
        </View>

        <Text style={styles.title}>PATIENT HEALTH PROFILE</Text>
        <Text style={styles.subtitle}>Patient-reported information — not a clinical record from any one visit.</Text>

        <View style={styles.patientBlock}>
          <View>
            <Text style={styles.patientName}>{patient.fullName}</Text>
            <Text style={styles.patientMeta}>
              {[patient.sex, patientAge !== null ? `${patientAge}y` : null, patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : null].filter(Boolean).join(" · ")}
            </Text>
          </View>
          {patient.patientNumber && (
            <View>
              <Text style={styles.patientIdLabel}>MyCareDesk Patient ID</Text>
              <Text style={styles.patientId}>{patient.patientNumber}</Text>
            </View>
          )}
        </View>

        <ListSection title="Allergies" status={data.allergiesStatus} items={data.allergies} />
        <ListSection title="Current Medications" status={data.medicationsStatus} items={data.medications} />
        <ListSection title="Medical Conditions" status={data.conditionsStatus} items={data.conditions} />
        <TextSection title="Previous Surgeries" status={data.surgicalHistoryStatus} text={data.surgicalHistory} />
        <TextSection title="Family History" status={data.familyHistoryStatus} text={data.familyHistory} />

        {data.socialHistory && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Other Health History</Text>
            <Text style={styles.bulletText}>{data.socialHistory}</Text>
          </View>
        )}

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Insurance</Text>
            <View style={styles.kv}>
              <Text style={styles.kvLabel}>HMO / Insurance</Text>
              <Text style={styles.kvValue}>{data.hmoName || "—"}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.kvLabel}>HMO Number</Text>
              <Text style={styles.kvValue}>{data.hmoNumber || "—"}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.kvLabel}>PhilHealth No.</Text>
              <Text style={styles.kvValue}>{data.philhealthNumber || "—"}</Text>
            </View>
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Emergency Contact</Text>
            <View style={styles.kv}>
              <Text style={styles.kvLabel}>Name</Text>
              <Text style={styles.kvValue}>{data.emergencyContactName || "—"}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.kvLabel}>Relationship</Text>
              <Text style={styles.kvValue}>{data.emergencyContactRelationship || "—"}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.kvLabel}>Phone</Text>
              <Text style={styles.kvValue}>{data.emergencyContactPhone || "—"}</Text>
            </View>
          </View>
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `MyCareDesk Patient Profile · ${patient.fullName}${data.generatedByName ? ` · Generated by ${data.generatedByName}` : ""} · ${data.generatedAt} · Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
