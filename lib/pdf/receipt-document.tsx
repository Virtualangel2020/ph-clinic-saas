import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { ClinicInfo, PatientInfo } from "./encounter-pdf-document";

// Server-only (@react-pdf/renderer). A payment receipt — Patient Portal
// Billing "download receipt" (spec §38) and, for staff, the same receipt
// from the chart's Billing tab. One receipt per patient_charge_payments
// row; works for any method (cash/HMO/PhilHealth/PayMongo/etc.), not just
// online payments.

export type ReceiptData = {
  clinic: ClinicInfo;
  patient: PatientInfo;
  receiptNumber: string;
  serviceDescription: string;
  amountPhp: number;
  paidAt: string;
  method: string;
  reference: string | null;
  status: string;
  generatedAt: string;
};

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", borderBottom: "2 solid #0c1730", paddingBottom: 12, marginBottom: 14 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 44, height: 44, objectFit: "contain" },
  clinicName: { fontSize: 15, fontWeight: 700, color: "#0c1730" },
  clinicMeta: { fontSize: 8.5, color: "#555", marginTop: 2, lineHeight: 1.4 },
  docTitle: { fontSize: 9, color: "#888", textAlign: "right" },
  receiptNumber: { fontSize: 9, color: "#555", textAlign: "right", marginTop: 3 },
  title: { fontSize: 16, fontWeight: 700, textAlign: "center", letterSpacing: 1.5, marginBottom: 24 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottom: "0.5 solid #eee" },
  label: { fontSize: 9, color: "#888", textTransform: "uppercase", letterSpacing: 0.3 },
  value: { fontSize: 11, fontWeight: 700, color: "#1a1a1a", textAlign: "right" },
  amountBlock: { marginTop: 24, marginBottom: 24, alignItems: "center" },
  amountLabel: { fontSize: 9, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  amount: { fontSize: 28, fontWeight: 700, color: "#0c1730" },
  statusBadge: { fontSize: 10, fontWeight: 700, color: "#1a7f37", marginTop: 6 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 7.5, color: "#aaa", textAlign: "center", borderTop: "0.5 solid #eee", paddingTop: 6 },
});

function clinicAddressLine(c: ClinicInfo): string {
  return [c.addressLine1, c.addressLine2, c.city, c.province, c.postalCode].filter(Boolean).join(", ");
}
function clinicContactLine(c: ClinicInfo): string {
  return [c.phone, c.mobile, c.email, c.website].filter(Boolean).join(" · ");
}
function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ReceiptDocument({ data }: { data: ReceiptData }) {
  const { clinic, patient } = data;
  return (
    <Document title={`Receipt ${data.receiptNumber} — ${patient.fullName}`}>
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
            <Text style={styles.docTitle}>Date{"\n"}{data.paidAt}</Text>
            <Text style={styles.receiptNumber}>Receipt No. {data.receiptNumber}</Text>
          </View>
        </View>

        <Text style={styles.title}>PAYMENT RECEIPT</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Patient</Text>
          <Text style={styles.value}>{patient.fullName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Service</Text>
          <Text style={styles.value}>{data.serviceDescription}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Payment Method</Text>
          <Text style={styles.value}>{data.method}</Text>
        </View>
        {data.reference && (
          <View style={styles.row}>
            <Text style={styles.label}>Transaction Reference</Text>
            <Text style={styles.value}>{data.reference}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Date Paid</Text>
          <Text style={styles.value}>{data.paidAt}</Text>
        </View>

        <View style={styles.amountBlock}>
          <Text style={styles.amountLabel}>Amount Paid</Text>
          <Text style={styles.amount}>{peso(data.amountPhp)}</Text>
          <Text style={styles.statusBadge}>{data.status}</Text>
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `${clinic.name} · Receipt No. ${data.receiptNumber} · Generated ${data.generatedAt} · Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
