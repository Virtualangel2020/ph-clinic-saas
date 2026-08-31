// Shared document-folder taxonomy — originally lived only inside
// documents-section.tsx, pulled out here so the Records Exchange "File to
// Patient" flow (app/dashboard/records-exchange/incoming-transfer-row.tsx)
// can offer the exact same folder choices when filing an incoming document
// instead of guessing at a duplicate list that could drift out of sync.
export const BUILTIN_FOLDERS: { key: string; label: string; docTypes: string[]; blurb: string }[] = [
  { key: "forms", label: "Forms", docTypes: ["forms"], blurb: "Patient-completed forms and consents." },
  { key: "ids", label: "IDs", docTypes: ["ids"], blurb: "Government ID or other identification." },
  { key: "insurance", label: "HMO / Insurance", docTypes: ["insurance"], blurb: "Insurance/HMO card, verification, and authorization documents." },
  { key: "philhealth", label: "PhilHealth", docTypes: ["philhealth"], blurb: "PhilHealth membership/supporting documents." },
  { key: "labs", label: "Labs", docTypes: ["labs"], blurb: "Scanned/external lab reports. Structured results live under the Orders & Results tab." },
  { key: "imaging", label: "Imaging", docTypes: ["imaging"], blurb: "X-ray, ultrasound, CT, MRI, mammography, or other imaging reports." },
  { key: "progress_notes", label: "Progress Notes", docTypes: ["progress_notes"], blurb: "Internal notes or external notes received from another provider." },
  { key: "referrals", label: "Referrals", docTypes: ["referrals"], blurb: "Referral orders, letters, and received/sent referral documents." },
  { key: "hospital_er", label: "Hospital / ER Records", docTypes: ["hospital_er"], blurb: "" },
  { key: "procedures", label: "Procedures", docTypes: ["procedures"], blurb: "" },
  { key: "medications", label: "Prescriptions / Medication Documents", docTypes: ["medications"], blurb: "Scanned/external prescription documents. Provider-issued prescriptions live under the Prescriptions tab." },
  { key: "medical_certificates", label: "Medical Certificates", docTypes: ["medical_certificates"], blurb: "" },
  { key: "patient_documents", label: "Patient-Uploaded Documents", docTypes: ["patient_documents"], blurb: "Filed by the patient through the Patient Portal." },
  { key: "other", label: "Other", docTypes: ["other"], blurb: "" },
];

export const BUILTIN_UPLOADABLE_TYPES: Record<string, string> = {
  forms: "Forms",
  ids: "IDs",
  insurance: "HMO / Insurance",
  philhealth: "PhilHealth",
  labs: "Labs (scanned report)",
  imaging: "Imaging",
  progress_notes: "Progress Notes",
  referrals: "Referrals",
  hospital_er: "Hospital / ER",
  procedures: "Procedures",
  medications: "Prescriptions / Medication Documents",
  medical_certificates: "Medical Certificates",
  other: "Other",
};

// Merges this tenant's custom folders (document_folders table) in just
// before the catch-all "Other" folder — same placement rule
// documents-section.tsx already used.
export function foldersWithCustom(customFolders: { key: string; label: string }[]) {
  return [...BUILTIN_FOLDERS.slice(0, -1), ...customFolders.map((f) => ({ key: f.key, label: f.label, docTypes: [f.key], blurb: "" })), BUILTIN_FOLDERS[BUILTIN_FOLDERS.length - 1]];
}

export function uploadableTypesWithCustom(customFolders: { key: string; label: string }[]): Record<string, string> {
  return { ...BUILTIN_UPLOADABLE_TYPES, ...Object.fromEntries(customFolders.map((f) => [f.key, f.label])) };
}
