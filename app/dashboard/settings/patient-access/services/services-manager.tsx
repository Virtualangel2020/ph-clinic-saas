"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setServiceAction, setAppointmentTypeProvidersAction } from "../actions";

const PRICE_TYPE_OPTIONS = [
  { value: "fixed", label: "Fixed Price" },
  { value: "starting_at", label: "Starting At" },
  { value: "range", label: "Price Range" },
  { value: "variable", label: "Variable (depends on visit)" },
  { value: "free", label: "Free" },
];

const DELIVERY_MODE_OPTIONS = [
  { value: "in_person", label: "In-Person" },
  { value: "telehealth", label: "Telehealth" },
  { value: "both", label: "In-Person or Telehealth" },
];

type ServiceType = {
  id: string;
  name: string;
  color: string;
  default_duration_minutes: number;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  price_php: number | null;
  price_max_php: number | null;
  price_type: string;
  show_price_to_patient: boolean;
  allow_advance_payment: boolean;
  require_advance_payment: boolean;
  patient_booking_enabled: boolean;
  delivery_mode: string;
};

type Provider = { id: string; full_name: string; title: string | null };

function cardStyle(): React.CSSProperties {
  return { border: "1px solid var(--card-border)", borderRadius: 10, padding: 14 };
}
function labelStyle(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6, display: "block" };
}
function inputStyle(): React.CSSProperties {
  return { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--input-border, #ddd)", fontSize: 13, background: "var(--input-bg, white)", color: "var(--text-heading)" };
}
function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-heading)", cursor: disabled ? "default" : "pointer" }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function priceSummary(t: ServiceType): string {
  if (t.price_type === "free") return "Free";
  if (t.price_type === "variable") return "Variable — depends on visit";
  if (t.price_php == null) return "No price set";
  const base = `₱${t.price_php.toLocaleString("en-PH")}`;
  if (t.price_type === "starting_at") return `Starting at ${base}`;
  if (t.price_type === "range" && t.price_max_php != null) return `${base}–₱${t.price_max_php.toLocaleString("en-PH")}`;
  return base;
}

export function ServicesManager({ initialTypes, providers, eligibility }: { initialTypes: ServiceType[]; providers: Provider[]; eligibility: { appointment_type_id: string; provider_id: string }[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {initialTypes.map((t) => (
        <ServiceRow key={t.id} service={t} providers={providers} selectedProviderIds={eligibility.filter((e) => e.appointment_type_id === t.id).map((e) => e.provider_id)} />
      ))}
      {initialTypes.length === 0 && !adding && <p style={{ fontSize: 12.5, color: "#999" }}>No services yet — add one below.</p>}

      {adding ? (
        <ServiceRow
          service={{
            id: "",
            name: "",
            color: "#4a86e8",
            default_duration_minutes: 30,
            description: "",
            is_active: true,
            sort_order: initialTypes.length,
            price_php: null,
            price_max_php: null,
            price_type: "fixed",
            show_price_to_patient: false,
            allow_advance_payment: false,
            require_advance_payment: false,
            patient_booking_enabled: false,
            delivery_mode: "in_person",
          }}
          providers={providers}
          selectedProviderIds={[]}
          forceExpanded
          onDone={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)", background: "none", border: "1px dashed var(--input-border, #ddd)", borderRadius: 10, padding: "12px 14px", cursor: "pointer", width: "fit-content" }}
        >
          + Add Service
        </button>
      )}
    </div>
  );
}

function ServiceRow({
  service,
  providers,
  selectedProviderIds,
  forceExpanded,
  onDone,
}: {
  service: ServiceType;
  providers: Provider[];
  selectedProviderIds: string[];
  forceExpanded?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(!!forceExpanded);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState({
    name: service.name,
    color: service.color,
    durationMinutes: service.default_duration_minutes,
    description: service.description ?? "",
    isActive: service.is_active,
    priceType: service.price_type,
    pricePhp: service.price_php,
    priceMaxPhp: service.price_max_php,
    showPriceToPatient: service.show_price_to_patient,
    allowAdvancePayment: service.allow_advance_payment,
    requireAdvancePayment: service.require_advance_payment,
    patientBookingEnabled: service.patient_booking_enabled,
    deliveryMode: service.delivery_mode,
  });
  const [eligibleProviders, setEligibleProviders] = useState<string[]>(selectedProviderIds);

  function save() {
    if (!value.name.trim()) {
      setError("Service name is required.");
      return;
    }
    if (value.priceType === "range" && (value.pricePhp == null || value.priceMaxPhp == null || value.priceMaxPhp < value.pricePhp)) {
      setError("A price range needs both a minimum and a maximum (maximum ≥ minimum).");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const newId = await setServiceAction({
          id: service.id || null,
          name: value.name.trim(),
          color: value.color,
          durationMinutes: value.durationMinutes,
          description: value.description,
          isActive: value.isActive,
          sortOrder: service.sort_order,
          pricePhp: value.priceType === "free" || value.priceType === "variable" ? null : value.pricePhp,
          priceMaxPhp: value.priceType === "range" ? value.priceMaxPhp : null,
          priceType: value.priceType,
          showPriceToPatient: value.priceType === "variable" ? false : value.showPriceToPatient,
          allowAdvancePayment: value.allowAdvancePayment,
          requireAdvancePayment: value.allowAdvancePayment ? value.requireAdvancePayment : false,
          patientBookingEnabled: value.patientBookingEnabled,
          deliveryMode: value.deliveryMode,
        });
        await setAppointmentTypeProvidersAction(service.id || newId, eligibleProviders);
        if (onDone) onDone();
        else {
          setExpanded(false);
          router.refresh();
        }
      } catch (e: any) {
        setError(e.message || "Couldn't save.");
      }
    });
  }

  return (
    <div style={cardStyle()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: service.color || "#4a86e8", flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-heading)" }}>{service.name || "New Service"}</div>
            <div style={{ fontSize: 11.5, color: "#888" }}>
              {service.default_duration_minutes} min · {priceSummary(service)}
              {!service.show_price_to_patient && service.price_type !== "free" ? " (hidden from patients)" : ""}
              {!service.is_active ? " · Inactive" : ""}
            </div>
          </div>
        </div>
        {!forceExpanded && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ fontSize: 12, fontWeight: 600, color: "var(--text-heading)", background: "none", border: "1px solid var(--input-border, #ddd)", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}
          >
            {expanded ? "Close" : "Edit"}
          </button>
        )}
      </div>

      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--card-border)", display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "end" }}>
            <div>
              <label style={labelStyle()}>Color</label>
              <input type="color" value={value.color} onChange={(e) => setValue({ ...value, color: e.target.value })} style={{ width: 40, height: 34, border: "none", background: "none" }} />
            </div>
            <div>
              <label style={labelStyle()}>Service Name</label>
              <input value={value.name} onChange={(e) => setValue({ ...value, name: e.target.value })} style={inputStyle()} placeholder="e.g. Follow-up Consultation" />
            </div>
            <div>
              <label style={labelStyle()}>Duration (min)</label>
              <input type="number" min={5} value={value.durationMinutes} onChange={(e) => setValue({ ...value, durationMinutes: Number(e.target.value) })} style={{ ...inputStyle(), width: 90 }} />
            </div>
          </div>

          <div>
            <label style={labelStyle()}>Description (optional)</label>
            <textarea value={value.description} onChange={(e) => setValue({ ...value, description: e.target.value })} rows={2} style={{ ...inputStyle(), resize: "vertical", fontFamily: "inherit" }} />
          </div>

          <div>
            <label style={labelStyle()}>Delivery Mode</label>
            <select value={value.deliveryMode} onChange={(e) => setValue({ ...value, deliveryMode: e.target.value })} style={inputStyle()}>
              {DELIVERY_MODE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle()}>Price Type</label>
            <select value={value.priceType} onChange={(e) => setValue({ ...value, priceType: e.target.value })} style={inputStyle()}>
              {PRICE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {value.priceType !== "free" && value.priceType !== "variable" && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <label style={labelStyle()}>{value.priceType === "range" ? "Minimum (₱)" : "Price (₱)"}</label>
                <input type="number" min={0} value={value.pricePhp ?? ""} onChange={(e) => setValue({ ...value, pricePhp: Number(e.target.value) })} style={{ ...inputStyle(), width: 130 }} />
              </div>
              {value.priceType === "range" && (
                <div>
                  <label style={labelStyle()}>Maximum (₱)</label>
                  <input type="number" min={0} value={value.priceMaxPhp ?? ""} onChange={(e) => setValue({ ...value, priceMaxPhp: Number(e.target.value) })} style={{ ...inputStyle(), width: 130 }} />
                </div>
              )}
            </div>
          )}

          {value.priceType === "variable" ? (
            <div style={{ fontSize: 11.5, color: "#888" }}>Patients will simply see this service&apos;s price as &quot;Variable — depends on visit,&quot; nothing else to configure.</div>
          ) : (
            <Toggle checked={value.showPriceToPatient} onChange={(v) => setValue({ ...value, showPriceToPatient: v })} label="Show Price to Patient (public visibility only — internal billing is unaffected either way)" />
          )}

          <Toggle checked={value.patientBookingEnabled} onChange={(v) => setValue({ ...value, patientBookingEnabled: v })} label="Allow Patients to Book This Service Online" />
          <Toggle checked={value.allowAdvancePayment} onChange={(v) => setValue({ ...value, allowAdvancePayment: v, requireAdvancePayment: v ? value.requireAdvancePayment : false })} label="Allow Advance Payment" />
          {value.allowAdvancePayment && (
            <Toggle checked={value.requireAdvancePayment} onChange={(v) => setValue({ ...value, requireAdvancePayment: v })} label="Require Advance Payment to Confirm Booking" />
          )}
          <Toggle checked={value.isActive} onChange={(v) => setValue({ ...value, isActive: v })} label="Active" />

          <div>
            <label style={labelStyle()}>Eligible Providers</label>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>Leave all unchecked to make this service available for every provider.</div>
            <div style={{ display: "grid", gap: 6 }}>
              {providers.map((p) => (
                <Toggle
                  key={p.id}
                  checked={eligibleProviders.includes(p.id)}
                  onChange={() => setEligibleProviders((prev) => (prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]))}
                  label={`${p.title ? p.title + " " : ""}${p.full_name}`}
                />
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={save} disabled={pending} style={{ background: "var(--text-heading, #0c1730)", color: "white", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              {pending ? "Saving…" : "Save Service"}
            </button>
            {error && <span style={{ fontSize: 12, color: "#a12a2a" }}>{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
