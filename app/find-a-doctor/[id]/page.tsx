import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteNav } from "@/components/public/site-nav";
import { SiteFooter } from "@/components/public/site-footer";
import { resolveEffectiveSettings, BOOKING_TYPE_PATIENT_WORDING, BOOKING_TYPE_LABEL } from "@/lib/patient-access";
import { ProfileActions } from "./profile-actions";

const NAVY = "#0c1730";
const GOLD = "#e6c66b";
const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function peso(n: number) {
  return `₱${Number(n).toLocaleString("en-PH")}`;
}
function priceLabel(s: any): string {
  if (s.price_type === "free") return "Free";
  if (s.price_type === "variable") return "Variable — depends on visit";
  if (!s.show_price_to_patient || s.price_php == null) return "Contact clinic for pricing";
  const base = peso(s.price_php);
  if (s.price_type === "starting_at") return `Starting at ${base}`;
  if (s.price_type === "range" && s.price_max_php != null) return `${base}–${peso(s.price_max_php)}`;
  return base;
}
function timeLabel(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// The patient-facing provider profile (spec §49-54 mockup) — one public
// RPC (public_get_provider_profile) resolved through the SAME
// resolveEffectiveSettings() the Patient Portal booking flow uses, so
// this page and the actual booking flow can never disagree about what a
// provider offers. Every wording requirement from the spec is rendered
// verbatim: booking-type patient wording, the locked messaging state, the
// "Online Payment — Not available for this clinic." notice, and the YAKAP
// eligibility disclaimer.
export default async function ProviderProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_get_provider_profile", { p_provider_id: id });
  if (!data) notFound();

  const d = data as any;
  const effective = resolveEffectiveSettings(d.clinic, d.override);
  const services: any[] = d.services ?? [];
  const hmos: any[] = d.accepted_hmos ?? [];
  const weeklyHours: any[] = d.weekly_hours ?? [];

  const pricedServices = services.filter((s) => s.show_price_to_patient && s.price_type !== "free" && s.price_type !== "variable" && s.price_php != null);
  const onlinePaymentNotAvailable = !effective.acceptOnlinePayments && d.clinic.financial_active && pricedServices.length > 0;

  const paymentBadges: string[] = ["Cash / Self-Pay"];
  if (effective.acceptHmo) paymentBadges.push("HMO");
  if (effective.acceptYakap) paymentBadges.push("YAKAP");
  if (effective.acceptOnlinePayments) paymentBadges.push("Online Payment");

  const hoursByDay = new Map<number, { start_time: string; end_time: string }[]>();
  for (const h of weeklyHours) {
    if (!hoursByDay.has(h.day_of_week)) hoursByDay.set(h.day_of_week, []);
    hoursByDay.get(h.day_of_week)!.push(h);
  }

  return (
    <div style={{ background: "#faf9f6" }}>
      <SiteNav />

      <section style={{ background: `linear-gradient(180deg, ${NAVY} 0%, #14213f 100%)`, color: "#f4f5f7", padding: "44px 24px 36px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>
            {d.clinic.clinic_name ?? "AngelClinic"}
          </div>
          <h1 style={{ fontSize: 28, margin: "0 0 6px" }}>
            {d.provider.title ? `${d.provider.title} ` : ""}
            {d.provider.full_name}
          </h1>
          <p style={{ color: "rgba(244,245,247,0.85)", fontSize: 14, margin: 0 }}>
            {[d.provider.specialty, d.provider.subspecialty].filter(Boolean).join(" · ") || "General practice"}
            {d.clinic.city ? ` · ${d.clinic.city}` : ""}
          </p>
          {d.provider.public_bio && <p style={{ color: "rgba(244,245,247,0.75)", fontSize: 13.5, lineHeight: 1.7, maxWidth: 560, marginTop: 12 }}>{d.provider.public_bio}</p>}
        </div>
      </section>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px 72px", display: "grid", gap: 20 }}>
        <Card>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#7a5c12", background: "#fff7e6", border: "1px solid #e6c66b", borderRadius: 999, padding: "4px 12px", display: "inline-block", marginBottom: 8 }}>
            {BOOKING_TYPE_LABEL[effective.bookingType] ?? effective.bookingType}
          </div>
          <p style={{ fontSize: 13.5, color: "#444", margin: 0 }}>{BOOKING_TYPE_PATIENT_WORDING[effective.bookingType] ?? ""}</p>
        </Card>

        <Card title="Services & Pricing">
          {services.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "#888", margin: 0 }}>Contact the clinic for available services and pricing.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {services.map((s) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f0f0f0", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: NAVY, wordBreak: "break-word" }}>{s.name}</div>
                    {s.description && <div style={{ fontSize: 11.5, color: "#888", wordBreak: "break-word" }}>{s.description}</div>}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "#555", whiteSpace: "nowrap", marginLeft: 12 }}>{priceLabel(s)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Payment & Coverage">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: onlinePaymentNotAvailable ? 10 : 0 }}>
            {paymentBadges.map((b) => (
              <span key={b} style={{ fontSize: 11.5, fontWeight: 600, color: "#1a7f37", background: "#eaf7ee", border: "1px solid #bfe6c9", borderRadius: 999, padding: "4px 10px" }}>
                {b}
              </span>
            ))}
          </div>
          {onlinePaymentNotAvailable && <p style={{ fontSize: 12, color: "#a12a2a", margin: 0 }}>Online Payment — Not available for this clinic.</p>}

          {effective.acceptHmo && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#888", marginBottom: 6 }}>Accepted HMOs</div>
              {hmos.length === 0 ? (
                <p style={{ fontSize: 12, color: "#999", margin: 0 }}>Contact the clinic for the current HMO list.</p>
              ) : (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {hmos.map((h: any) => (
                    <span key={h.id} title={h.patient_instructions ?? undefined} style={{ fontSize: 11.5, color: "#444", background: "#f4f4f5", border: "1px solid #e2e2e5", borderRadius: 999, padding: "3px 10px" }}>
                      {h.hmo_name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {effective.acceptYakap && (
            <div style={{ marginTop: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#1a7f37" }}>YAKAP Available ✓</span>
              <p style={{ fontSize: 11.5, color: "#888", marginTop: 4, marginBottom: 0 }}>
                {d.clinic.yakap_instructions || "Eligibility and coverage may need verification — this doesn't guarantee automatic coverage."}
              </p>
            </div>
          )}
        </Card>

        {weeklyHours.length > 0 && (
          <Card title="Clinic Hours">
            <div style={{ display: "grid", gap: 4 }}>
              {Array.from(hoursByDay.entries())
                .sort(([a], [b]) => a - b)
                .map(([day, ranges]) => (
                  <div key={day} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                    <span style={{ color: "#444", fontWeight: 600 }}>{DAY_LABELS[day]}</span>
                    <span style={{ color: "#888" }}>{ranges.map((r) => `${timeLabel(r.start_time)}–${timeLabel(r.end_time)}`).join(", ")}</span>
                  </div>
                ))}
            </div>
          </Card>
        )}

        <ProfileActions provider={{ id: d.provider.id, full_name: d.provider.full_name }} bookingType={effective.bookingType} messagingEnabled={effective.messagingEnabled} />
      </main>

      <SiteFooter />
    </div>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: "18px 20px" }}>
      {title && <h2 style={{ fontSize: 14, margin: "0 0 10px", color: NAVY }}>{title}</h2>}
      {children}
    </div>
  );
}
