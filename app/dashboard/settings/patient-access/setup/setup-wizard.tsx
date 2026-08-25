"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setClinicPatientAccessDefaultsAction, setPatientAccessSetupCompletedAction } from "../actions";
import { ClinicPatientAccessRow, toDefaultsActionInput } from "../shared";

const STEPS = [
  "How do you accept patients?",
  "When can patients book?",
  "Services & costs",
  "How do patients pay?",
  "HMO / YAKAP?",
  "Messaging?",
  "Instructions",
  "Cancellation policy",
  "Review & Activate",
];

const BOOKING_TYPES = [
  { value: "walk_in", label: "Walk-ins only", desc: "Patients just show up — no booking needed." },
  { value: "appointment", label: "Appointments only", desc: "Patients must book a time in advance." },
  { value: "both", label: "Both walk-ins and appointments", desc: "Patients can either walk in or book ahead." },
  { value: "appointment_request", label: "Appointment requests", desc: "Patients suggest a time; your clinic confirms it." },
  { value: "flexible", label: "Flexible / variable schedule", desc: "General hours only — no online self-booking yet." },
];

function cardStyle(): React.CSSProperties {
  return { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 22, marginBottom: 16 };
}
function inputStyle(): React.CSSProperties {
  return { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--input-border, #ddd)", fontSize: 13, background: "var(--input-bg, white)", color: "var(--text-heading)" };
}
function labelStyle(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6, display: "block" };
}
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-heading)", cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
function NavButtons({ step, setStep, onSave, saving, isLast }: { step: number; setStep: (n: number) => void; onSave: () => void; saving: boolean; isLast?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
      <button
        onClick={() => setStep(step - 1)}
        disabled={step === 0}
        style={{ background: "none", border: "1px solid var(--input-border, #ddd)", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "var(--text-heading)", cursor: step === 0 ? "default" : "pointer", opacity: step === 0 ? 0.4 : 1 }}
      >
        ← Back
      </button>
      <button
        onClick={onSave}
        disabled={saving}
        style={{ background: "var(--text-heading, #0c1730)", color: "white", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
      >
        {saving ? "Saving…" : isLast ? "Activate" : "Save & Continue →"}
      </button>
    </div>
  );
}

export function SetupWizard({
  clinicDefaults,
  cancellationPolicy,
  acceptOnlinePayments,
  serviceCount,
}: {
  clinicDefaults: ClinicPatientAccessRow;
  cancellationPolicy: any;
  acceptOnlinePayments: boolean;
  serviceCount: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [bookingType, setBookingType] = useState(clinicDefaults.default_booking_type);
  const [prioritizeScheduled, setPrioritizeScheduled] = useState(clinicDefaults.default_prioritize_scheduled);
  const [cutoffMinutes, setCutoffMinutes] = useState(clinicDefaults.booking_cutoff_minutes);
  const [advanceDays, setAdvanceDays] = useState(clinicDefaults.max_advance_booking_days);
  const [acceptHmo, setAcceptHmo] = useState(clinicDefaults.accept_hmo);
  const [acceptYakap, setAcceptYakap] = useState(clinicDefaults.accept_yakap);
  const [yakapInstructions, setYakapInstructions] = useState(clinicDefaults.yakap_instructions ?? "");
  const [messagingEnabled, setMessagingEnabled] = useState(clinicDefaults.default_messaging_enabled);
  const [arrivalEnabled, setArrivalEnabled] = useState(clinicDefaults.default_arrival_reminder_enabled);
  const [arrivalMinutes, setArrivalMinutes] = useState(clinicDefaults.default_arrival_reminder_minutes);
  const [instructions, setInstructions] = useState(clinicDefaults.default_appointment_instructions ?? "");

  function saveAndAdvance(patch: Partial<ClinicPatientAccessRow>) {
    setError(null);
    startTransition(async () => {
      try {
        await setClinicPatientAccessDefaultsAction({ ...toDefaultsActionInput(clinicDefaults), ...patch });
        setStep((s) => Math.min(s + 1, STEPS.length - 1));
        router.refresh();
      } catch (e: any) {
        setError(e.message || "Couldn't save.");
      }
    });
  }

  function advanceOnly() {
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function activate() {
    setError(null);
    startTransition(async () => {
      try {
        await setPatientAccessSetupCompletedAction(true);
        router.push("/dashboard/settings/patient-access");
      } catch (e: any) {
        setError(e.message || "Couldn't activate.");
      }
    });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {STEPS.map((s, i) => (
          <div key={s} title={s} style={{ height: 5, flex: 1, minWidth: 12, borderRadius: 3, background: i <= step ? "var(--text-heading, #0c1730)" : "#e2e2e5" }} />
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: "#888", marginBottom: 6 }}>
        Step {step + 1} of {STEPS.length}
      </div>
      <h2 style={{ fontSize: 17, marginTop: 0, marginBottom: 16 }}>{STEPS[step]}</h2>

      {step === 0 && (
        <div style={cardStyle()}>
          <div style={{ display: "grid", gap: 10 }}>
            {BOOKING_TYPES.map((b) => (
              <label key={b.value} style={{ display: "flex", gap: 10, alignItems: "flex-start", border: `1px solid ${bookingType === b.value ? "var(--text-heading)" : "var(--card-border)"}`, borderRadius: 10, padding: 12, cursor: "pointer" }}>
                <input type="radio" checked={bookingType === b.value} onChange={() => setBookingType(b.value)} style={{ marginTop: 3 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-heading)" }}>{b.label}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>{b.desc}</div>
                </div>
              </label>
            ))}
          </div>
          <NavButtons step={step} setStep={setStep} saving={pending} onSave={() => saveAndAdvance({ default_booking_type: bookingType })} />
        </div>
      )}

      {step === 1 && (
        <div style={cardStyle()}>
          {bookingType === "both" && <Toggle checked={prioritizeScheduled} onChange={setPrioritizeScheduled} label="Prioritize patients who booked ahead over walk-ins" />}
          {(bookingType === "appointment" || bookingType === "both" || bookingType === "appointment_request") && (
            <div style={{ display: "grid", gap: 14, marginTop: prioritizeScheduled !== undefined ? 12 : 0 }}>
              <div>
                <label style={labelStyle()}>How much notice do patients need to give?</label>
                <select value={cutoffMinutes} onChange={(e) => setCutoffMinutes(Number(e.target.value))} style={inputStyle()}>
                  <option value={0}>No minimum</option>
                  <option value={60}>1 hour</option>
                  <option value={180}>3 hours</option>
                  <option value={720}>12 hours</option>
                  <option value={1440}>24 hours</option>
                </select>
              </div>
              <div>
                <label style={labelStyle()}>How far ahead can patients book?</label>
                <select value={advanceDays} onChange={(e) => setAdvanceDays(Number(e.target.value))} style={inputStyle()}>
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                </select>
              </div>
            </div>
          )}
          {bookingType === "walk_in" && <p style={{ fontSize: 12.5, color: "#888" }}>Walk-in-only providers don&apos;t need booking rules — nothing to configure here.</p>}
          <NavButtons
            step={step}
            setStep={setStep}
            saving={pending}
            onSave={() => saveAndAdvance({ default_prioritize_scheduled: prioritizeScheduled, booking_cutoff_minutes: cutoffMinutes, max_advance_booking_days: advanceDays })}
          />
        </div>
      )}

      {step === 2 && (
        <div style={cardStyle()}>
          <p style={{ fontSize: 13, color: "var(--text-heading)", marginTop: 0 }}>
            You currently have <strong>{serviceCount}</strong> active service{serviceCount === 1 ? "" : "s"} configured. Each service can have its own
            price, whether that price is shown to patients, and whether advance payment is required — set that up on the Services & Fees page.
          </p>
          <Link
            href="/dashboard/settings/patient-access/services"
            target="_blank"
            style={{ display: "inline-block", fontSize: 12.5, fontWeight: 600, color: "var(--text-heading)", border: "1px solid var(--input-border, #ddd)", borderRadius: 8, padding: "8px 14px", textDecoration: "none" }}
          >
            Open Services & Fees →
          </Link>
          <p style={{ fontSize: 11.5, color: "#888", marginTop: 12 }}>You can always come back and add or price services later — this step never blocks anything.</p>
          <NavButtons step={step} setStep={setStep} saving={false} onSave={advanceOnly} />
        </div>
      )}

      {step === 3 && (
        <div style={cardStyle()}>
          <p style={{ fontSize: 13, color: "var(--text-heading)", marginTop: 0 }}>
            Online Payments is currently <strong>{acceptOnlinePayments ? "ON" : "OFF"}</strong> for your clinic. Every patient still sees only the
            payment methods you&apos;ve actually set up — cash, HMO, PhilHealth/YAKAP, or online — never something you don&apos;t offer.
          </p>
          <Link
            href="/dashboard/settings/payments"
            target="_blank"
            style={{ display: "inline-block", fontSize: 12.5, fontWeight: 600, color: "var(--text-heading)", border: "1px solid var(--input-border, #ddd)", borderRadius: 8, padding: "8px 14px", textDecoration: "none" }}
          >
            Open Payments Settings →
          </Link>
          <p style={{ fontSize: 11.5, color: "#888", marginTop: 12 }}>
            Whether a specific service requires payment before booking is set per-service on the Services & Fees page.
          </p>
          <NavButtons step={step} setStep={setStep} saving={false} onSave={advanceOnly} />
        </div>
      )}

      {step === 4 && (
        <div style={cardStyle()}>
          <div style={{ display: "grid", gap: 12 }}>
            <Toggle checked={acceptHmo} onChange={setAcceptHmo} label="We accept HMO patients" />
            <Toggle checked={acceptYakap} onChange={setAcceptYakap} label="We participate in YAKAP" />
            {acceptYakap && (
              <div>
                <label style={labelStyle()}>What should patients know about YAKAP here? (optional)</label>
                <textarea value={yakapInstructions} onChange={(e) => setYakapInstructions(e.target.value)} rows={2} style={{ ...inputStyle(), resize: "vertical", fontFamily: "inherit" }} />
              </div>
            )}
            {acceptHmo && (
              <p style={{ fontSize: 11.5, color: "#888", margin: 0 }}>
                Add which specific HMOs you accept on the HMO / YAKAP / Coverage page after this wizard — you can list them and set verification
                requirements there.
              </p>
            )}
          </div>
          <NavButtons step={step} setStep={setStep} saving={pending} onSave={() => saveAndAdvance({ accept_hmo: acceptHmo, accept_yakap: acceptYakap, yakap_instructions: yakapInstructions || null })} />
        </div>
      )}

      {step === 5 && (
        <div style={cardStyle()}>
          <Toggle checked={messagingEnabled} onChange={setMessagingEnabled} label="Let patients message providers through the Patient Portal" />
          <p style={{ fontSize: 11.5, color: "#888", marginTop: 10 }}>
            Off by default. You can turn this on per-provider, choose who can message and when, and add a disclaimer on the Patient Messaging page —
            this is just the clinic-wide starting point.
          </p>
          <NavButtons step={step} setStep={setStep} saving={pending} onSave={() => saveAndAdvance({ default_messaging_enabled: messagingEnabled })} />
        </div>
      )}

      {step === 6 && (
        <div style={cardStyle()}>
          <div style={{ display: "grid", gap: 12 }}>
            <Toggle checked={arrivalEnabled} onChange={setArrivalEnabled} label="Remind patients to arrive early" />
            {arrivalEnabled && (
              <select value={arrivalMinutes} onChange={(e) => setArrivalMinutes(Number(e.target.value))} style={{ ...inputStyle(), maxWidth: 220 }}>
                {[5, 10, 15, 20, 30].map((m) => (
                  <option key={m} value={m}>
                    Arrive {m} minutes early
                  </option>
                ))}
              </select>
            )}
            <div>
              <label style={labelStyle()}>Anything else patients should know before their visit? (optional)</label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={3}
                placeholder='e.g. "Please bring a valid ID and your HMO card if applicable."'
                style={{ ...inputStyle(), resize: "vertical", fontFamily: "inherit" }}
              />
            </div>
          </div>
          <NavButtons
            step={step}
            setStep={setStep}
            saving={pending}
            onSave={() => saveAndAdvance({ default_arrival_reminder_enabled: arrivalEnabled, default_arrival_reminder_minutes: arrivalMinutes, default_appointment_instructions: instructions || null })}
          />
        </div>
      )}

      {step === 7 && (
        <div style={cardStyle()}>
          <p style={{ fontSize: 13, color: "var(--text-heading)", marginTop: 0 }}>
            No-shows and cancellations are always tracked automatically — nothing here is ever auto-charged unless you configure it. The default is
            the simplest possible policy: full refunds, no no-show fee.
          </p>
          {cancellationPolicy ? (
            <p style={{ fontSize: 12, color: "#1a7f37" }}>
              You already have a policy configured — no-show fee: {cancellationPolicy.noShowFee?.afterCount === "never" ? "off" : "on"}.
            </p>
          ) : (
            <p style={{ fontSize: 12, color: "#888" }}>Using the simple default — full refunds, no fees.</p>
          )}
          <Link
            href="/dashboard/settings/patient-access/cancellation"
            target="_blank"
            style={{ display: "inline-block", fontSize: 12.5, fontWeight: 600, color: "var(--text-heading)", border: "1px solid var(--input-border, #ddd)", borderRadius: 8, padding: "8px 14px", textDecoration: "none" }}
          >
            Configure a fee/refund policy →
          </Link>
          <NavButtons step={step} setStep={setStep} saving={false} onSave={advanceOnly} />
        </div>
      )}

      {step === 8 && (
        <div style={cardStyle()}>
          <div style={{ display: "grid", gap: 8, fontSize: 13, marginBottom: 16 }}>
            <div>
              <strong>Booking:</strong> {BOOKING_TYPES.find((b) => b.value === bookingType)?.label}
            </div>
            <div>
              <strong>Services:</strong> {serviceCount} active
            </div>
            <div>
              <strong>Online Payments:</strong> {acceptOnlinePayments ? "ON" : "OFF"}
            </div>
            <div>
              <strong>HMO:</strong> {acceptHmo ? "Accepted" : "Not accepted"} · <strong>YAKAP:</strong> {acceptYakap ? "Available" : "Not available"}
            </div>
            <div>
              <strong>Messaging:</strong> {messagingEnabled ? "On (clinic default)" : "Off"}
            </div>
            <div>
              <strong>Arrival reminder:</strong> {arrivalEnabled ? `${arrivalMinutes} min early` : "Off"}
            </div>
          </div>
          <p style={{ fontSize: 11.5, color: "#888" }}>
            You can change any of this anytime from Patient Access & Payments — nothing is locked in by finishing this wizard.
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
            <button
              onClick={() => setStep(step - 1)}
              style={{ background: "none", border: "1px solid var(--input-border, #ddd)", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "var(--text-heading)", cursor: "pointer" }}
            >
              ← Back
            </button>
            <button onClick={activate} disabled={pending} style={{ background: "#1a7f37", color: "white", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {pending ? "Activating…" : "Activate"}
            </button>
          </div>
        </div>
      )}

      {error && <p style={{ fontSize: 12, color: "#a12a2a" }}>{error}</p>}
    </div>
  );
}
