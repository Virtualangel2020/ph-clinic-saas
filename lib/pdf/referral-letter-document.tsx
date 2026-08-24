import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { ClinicInfo, PatientInfo } from "./encounter-pdf-document";

// Server-only — same @react-pdf/renderer constraint as encounter-pdf-
// document.tsx (Node-only render). Reuses that file's ClinicInfo/
// PatientInfo shapes and the same letterhead visual language, but this is
// a genuinely different document: a short referral letter, not a
// clinical-history export. Used for BOTH internal referrals (an optional
// printable copy) and external referrals (the only artifact the receiving
// side gets, since there's no AngelClinic account to deliver to).

export type ReferralLetterData = {
  clinic: ClinicInfo;
  patient: PatientInfo;
  referringProviderName: string;
  referringProviderCredentials: string | null;
  destinationLabel: string;
  destinationDetail: string | null;
  specialtyRequested: string | null;
  urgency: "routine" | "urgent";
  reason: string;
  clinicalSummary: string | null;
  referralDate: string;
};

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", borderBottom: "2 solid #0c1730", paddingBottom: 12, marginBottom: 14 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 44, height: 44, objectFit: "contain" },
  clinicName: { fontSize: 15, fontWeight: 700, color: "#0c1730" },
  clinicMeta: { fontSize: 8.5, color: "#555", marginTop: 2, lineHeight: 1.4 },
  docTitle: { fontSize: 9, color: "#888", textAlign: "right" },
  urgentBadge: { fontSize: 9, fontWeight: 700, color: "#a12a2a", textAlign: "right", marginTop: 3 },
  patientBlock: { backgroundColor: "#f4f5f7", borderRadius: 4, padding: "8 12", marginBottom: 16, flexDirection: "row", justifyContent: "space-between" },
  patientLabel: { fontSize: 8, color: "#888", textTransform: "uppercase" },
  patientValue: { fontSize: 11, fontWeight: 700, color: "#0c1730", marginTop: 1 },
  section: { marginBottom: 14 },
  sectionLabel: { fontSize: 9, fontWeight: 700, color: "#0c1730", marginBottom: 4, textTransform: "uppercase" },
  fieldRow: { flexDirection: "row", marginBottom: 4 },
  fieldLabel: { width: 130, fontSize: 9, fontWeight: 700, color: "#444" },
  fieldValue: { flex: 1, fontSize: 9.5, color: "#1a1a1a", lineHeight: 1.4 },
  bodyText: { fontSize: 10, lineHeight: 1.5, color: "#222" },
  signatureBlock: { marginTop: 30, paddingTop: 8, borderTop: "0.5 solid #ccc" },
  signatureMeta: { fontSize: 9, color: "#555", marginTop: 2 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 7.5, color: "#aaa", textAlign: "center", borderTop: "0.5 solid #eee", paddingTop: 6 },
});

function clinicAddressLine(c: ClinicInfo): string {
  return [c.addressLine1, c.addressLine2, c.city, c.province, c.postalCode].filter(Boolean).join(", ");
}
function clinicContactLine(c: ClinicInfo): string {
  return [c.phone, c.mobile, c.email, c.website].filter(Boolean).join(" · ");
}

export function ReferralLetterDocument({ data }: { data: ReferralLetterData }) {
  const { clinic, patient } = data;
  return (
    <Document title={`Referral Letter — ${patient.fullName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {clinic.logoUrl && <Image src={clinic.logoUrl} style={styles.logo} />}
            <View>
              <Text style={styles.clinicName}>{clinic.name}</Text>
              <Text style={styles.clinicMeta}>{clinicAddressLine(clinic)}</Text>
              <Text style={styles.clinicMeta}>{clinicContactLine(clinic)}</Text>
            </View>
          </View>
          <View>
            <Text style={styles.docTitle}>Referral Letter{"\n"}Date {data.referralDate}</Text>
            {data.urgency === "urgent" && <Text style={styles.urgentBadge}>URGENT</Text>}
          </View>
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

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Referral Details</Text>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Referring Provider</Text>
            <Text style={styles.fieldValue}>
              {data.referringProviderName}
              {data.referringProviderCredentials ? ` (${data.referringProviderCredentials})` : ""}
            </Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Referred To</Text>
            <Text style={styles.fieldValue}>
              {data.destinationLabel}
              {data.destinationDetail ? ` — ${data.destinationDetail}` : ""}
            </Text>
          </View>
          {data.specialtyRequested && (
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Specialty Requested</Text>
              <Text style={styles.fieldValue}>{data.specialtyRequested}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Reason for Referral</Text>
          <Text style={styles.bodyText}>{data.reason}</Text>
        </View>

        {data.clinicalSummary && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Relevant Clinical Summary</Text>
            <Text style={styles.bodyText}>{data.clinicalSummary}</Text>
          </View>
        )}

        <View style={styles.signatureBlock}>
          <Text style={styles.signatureMeta}>
            {data.referringProviderName}
            {data.referringProviderCredentials ? `, ${data.referringProviderCredentials}` : ""}
          </Text>
          <Text style={styles.signatureMeta}>{clinic.name}</Text>
        </View>

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => `${clinic.name} · Confidential referral letter · Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
