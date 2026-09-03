import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { ClinicInfo, PatientInfo } from "./encounter-pdf-document";

// Server-only (@react-pdf/renderer, Node-only render) — same letterhead
// visual language as encounter-pdf-document.tsx / referral-letter-
// document.tsx, applied to a finalized, numbered medical certificate.

export type CertificateFieldValue = { label: string; type: "text" | "textarea" | "date"; value: string };

export type MedicalCertificateData = {
  clinic: ClinicInfo;
  patient: PatientInfo;
  patientAddress: string | null;
  certificateNumber: string;
  templateName: string;
  fields: CertificateFieldValue[];
  providerName: string;
  providerCredentials: string | null;
  signatureImageUrl: string | null;
  issuedAt: string;
  voided?: boolean;
  voidedAt?: string | null;
};

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", borderBottom: "2 solid #0c1730", paddingBottom: 12, marginBottom: 14 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 44, height: 44, objectFit: "contain" },
  clinicName: { fontSize: 15, fontWeight: 700, color: "#0c1730" },
  clinicMeta: { fontSize: 8.5, color: "#555", marginTop: 2, lineHeight: 1.4 },
  docTitle: { fontSize: 9, color: "#888", textAlign: "right" },
  certNumber: { fontSize: 9, color: "#555", textAlign: "right", marginTop: 3 },
  voidBadge: { fontSize: 11, fontWeight: 700, color: "#a12a2a", textAlign: "right", marginTop: 4 },
  title: { fontSize: 16, fontWeight: 700, textAlign: "center", letterSpacing: 1.5, marginBottom: 20 },
  bodyText: { fontSize: 10.5, lineHeight: 1.6, color: "#222", marginBottom: 14 },
  bold: { fontWeight: 700 },
  fieldBlock: { marginBottom: 12 },
  fieldLabel: { fontSize: 8.5, fontWeight: 700, color: "#0c1730", textTransform: "uppercase", marginBottom: 2, letterSpacing: 0.3 },
  fieldValue: { fontSize: 10.5, lineHeight: 1.5, color: "#1a1a1a" },
  // Fixed-width, centered block (still anchored to the right side of the
  // page via signatureBlock's own alignItems: "flex-end") so the signature
  // image, printed name, and credentials all line up on the same center
  // line instead of the image sitting flush to one edge of a wider box.
  signatureBlock: { marginTop: 40, alignItems: "flex-end" },
  signatureInner: { width: 190, alignItems: "center" },
  // Bottom-aligned so the visible ink sits close to the name below it
  // regardless of the signature image's own aspect ratio.
  signatureImageWrap: { height: 54, width: "100%", justifyContent: "flex-end", alignItems: "center", marginBottom: 3 },
  signatureImage: { maxWidth: 170, maxHeight: 54, objectFit: "contain" },
  signatureLine: { borderBottom: "0.75 solid #999", width: 170, marginBottom: 4, height: 40 },
  signatureName: { fontSize: 10.5, fontWeight: 700, textAlign: "center" },
  signatureMeta: { fontSize: 8.5, color: "#777", textAlign: "center", marginTop: 1 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 7.5, color: "#aaa", textAlign: "center", borderTop: "0.5 solid #eee", paddingTop: 6 },
  watermark: { position: "absolute", top: "45%", left: "15%", fontSize: 46, color: "#e0b0b0", opacity: 0.5, transform: "rotate(-25deg)", fontWeight: 700 },
});

function clinicAddressLine(c: ClinicInfo): string {
  return [c.addressLine1, c.addressLine2, c.city, c.province, c.postalCode].filter(Boolean).join(", ");
}
function clinicContactLine(c: ClinicInfo): string {
  return [c.phone, c.mobile, c.email, c.website].filter(Boolean).join(" · ");
}

export function MedicalCertificateDocument({ data }: { data: MedicalCertificateData }) {
  const { clinic, patient } = data;
  return (
    <Document title={`Medical Certificate — ${patient.fullName}`}>
      <Page size="A4" style={styles.page}>
        {data.voided && <Text style={styles.watermark}>VOID</Text>}

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
            <Text style={styles.docTitle}>Date issued{"\n"}{data.issuedAt}</Text>
            <Text style={styles.certNumber}>No. {data.certificateNumber}</Text>
            {data.voided && <Text style={styles.voidBadge}>VOID{data.voidedAt ? ` — ${data.voidedAt}` : ""}</Text>}
          </View>
        </View>

        <Text style={styles.title}>MEDICAL CERTIFICATE</Text>

        <Text style={styles.bodyText}>
          This is to certify that <Text style={styles.bold}>{patient.fullName}</Text>, {patient.sex ?? ""}, born {patient.dateOfBirth}
          {data.patientAddress ? `, of ${data.patientAddress}` : ""}, was examined/consulted at this clinic.
        </Text>

        {data.fields.map((f, i) => (
          <View key={i} style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>{f.label}</Text>
            <Text style={styles.fieldValue}>{f.value || "—"}</Text>
          </View>
        ))}

        <Text style={{ ...styles.bodyText, marginTop: 12 }}>
          This certification is issued upon the patient&apos;s request for whatever legal purpose it may serve.
        </Text>

        <View style={styles.signatureBlock}>
          <View style={styles.signatureInner}>
            {data.signatureImageUrl ? (
              <View style={styles.signatureImageWrap}>
                <Image src={data.signatureImageUrl} style={styles.signatureImage} />
              </View>
            ) : (
              <View style={styles.signatureLine} />
            )}
            <Text style={styles.signatureName}>{data.providerName}</Text>
            {data.providerCredentials && <Text style={styles.signatureMeta}>{data.providerCredentials}</Text>}
          </View>
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `${clinic.name} · Certificate No. ${data.certificateNumber}${data.voided ? " · VOID" : ""} · Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
