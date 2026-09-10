"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setClinicPatientAccessDefaultsAction, setPatientAccessSetupCompletedAction } from "../actions";
import { ClinicPatientAccessRow, toDefaultsActionInput } from "../shared";
import { BOOKING_STYLE_LABEL, BOOKING_STYLE_DESCRIPTION, BOOKING_STYLE_PATIENT_WORDING, type BookingStyle } from "@/lib/patient-access";

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

const BOOKING_STYLES: BookingStyle[] = ["specific_times", "flexible_arrival", "walk_in"];

const INTERVAL_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "Patient does not choose a time — show clinic hours only" },
  { value: 15, label: "Every 15 minutes" },
  { value: 30, label: "Every 30 minutes" },
  { value: 60, label: "Every 1 hour" },
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
        style={{ background: "var(--text-heading, var(--brand-primary))", color: "white", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
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

  const [onlineBookingEnabled, setOnlineBookingEnabled] = useState(clinicDefaults.online_booking_enabled);
  const [bookingStyle, setBookingStyle] = useState<BookingStyle>(clinicDefaults.booking_style);
  const [flexibleIntervalMinutes, setFlexibleIntervalMinutes] = useState(clinicDefaults.flexible_arrival_interval_minutes);
  const [flexibleMaxPatients, setFlexibleMaxPatients] = useState(clinicDefaults.flexible_arrival_max_patients_per_day);
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
          <div key={s} title={s} style={{ height: 5, flex: 1, minWidth: 12, borderRadius: 3, background: i <= step ? "var(--text-heading, var(--brand-primary))" : "#e2e2e5" }} />
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: "#888", marginBottom: 6 }}>
        Step {step + 1} of {STEPS.length}
      </div>
      <h2 style={{ fontSize: 17, marginTop: 0, marginBottom: 16 }}>{STEPS[step]}</h2>

      {step === 0 && (
        <div style={cardStyle()}>
          <Toggle checked={onlineBookingEnabled} onChange={setOnlineBookingEnabled} label="Allow patients to book online" />
          {!onlineBookingEnabled && (
            <p style={{ fontSize: 12, color: "#888", fontStyle: "italic", marginTop: 10 }}>
              Patients can still find and view your providers — they&apos;ll see &quot;Please contact the clinic to schedule an appointment&quot; instead
              of a booking button.
            </p>
          )}
          {onlineBookingEnabled && (
            <div style={{ marginTop: 14 }}>
              <label style={labelStyle()}>How Should Patients Book?</label>
              <div style={{ display: "grid", gap: 10 }}>
                {BOOKING_STYLES.map((s) => (
                  <label
                    key={s}
                    style={{ display: "flex", gap: 10, alignItems: "flex-start", border: `1px solid ${bookingStyle === s ? "var(--text-heading)" : "var(--card-border)"}`, borderRadius: 10, padding: 12, cursor: "pointer" }}
                  >
                    <input type="radio" checked={bookingStyle === s} onChange={() => setBookingStyle(s)} style={{ marginTop: 3 }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-heading)" }}>{BOOKING_STYLE_LABEL[s]}</div>
                      <div style={{ fontSize: 12, color: "#888" }}>{BOOKING_STYLE_DESCRIPTION[s]}</div>
                    </div>
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: "#888", marginTop: 6, fontStyle: "italic" }}>Patients see: &quot;{BOOKING_STYLE_PATIENT_WORDING[bookingStyle]}&quot;</div>
            </div>
          )}
          <NavButtons
            step={step}
            setStep={setStep}
            saving={pending}
            onSave={() =>
              saveAndAdvance({
                online_booking_enabled: onlineBookingEnabled,
                booking_style: bookingStyle,
                flexible_arrival_interval_minutes: bookingStyle === "flexible_arrival" ? flexibleIntervalMinutes : null,
                flexible_arrival_max_patients_per_day: bookingStyle === "flexible_arrival" ? flexibleMaxPatients : null,
              })
            }
          />
        </div>
      )}

      {step === 1 && (
        <div style={cardStyle()}>
          {onlineBookingEnabled && bookingStyle === "flexible_arrival" && (
            <div style={{ display: "grid", gap: 14, marginBottom: 16, background: "var(--card-bg)", border: "1px dashed var(--card-border)", borderRadius: 8, padding: 12 }}>
              <div>
                <label style={labelStyle()}>Arrival Intervals</label>
                <select
                  value={flexibleIntervalMinutes ?? ""}
                  style={inputStyle()}
                  onChange={(e) => setFlexibleIntervalMinutes(e.target.value === "" ? null : Number(e.target.value))}
                >
                  {INTERVAL_OPTIONS.map((o) => (
                    <option key={o.label} value={o.value ?? ""}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle()}>Maximum Expected Patients Per Day (optional)</label>
                <input
                  type="number"
                  min={1}
                  value={flexibleMaxPatients ?? ""}
                  placeholder="Unlimited"
                  style={{ ...inputStyle(), maxWidth: 160 }}
                  onChange={(e) => setFlexibleMaxPatients(e.target.value === "" ? null : Math.max(1, Number(e.target.value)))}
                />
                <div style={{ fontSize: 11.5, color: "#888", marginTop: 4 }}>Once reached, patients see &quot;Fully Booked&quot; for that day.</div>
              </div>
            </div>
          )}
          {onlineBookingEnabled && bookingStyle !== "walk_in" && (
            <div style={{ display: "grid", gap: 14 }}>
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
          {(!onlineBookingEnabled || bookingStyle === "walk_in") && (
            <p style={{ fontSize: 12.5, color: "#888" }}>
              {!onlineBookingEnabled ? "Online booking is off — nothing to configure here." : "Walk-in-only providers don't need booking rules — nothing to configure here."}
            </p>
          )}
          <NavButtons
            step={step}
            setStep={setStep}
            saving={pending}
            onSave={() => saveAndAdvance({ booking_cutoff_minutes: cutoffMinutes, max_advance_booking_days: advanceDays })}
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
              <strong>Booking:</strong> {onlineBookingEnabled ? BOOKING_STYLE_LABEL[bookingStyle] : "Online booking off — contact clinic to schedule"}
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
