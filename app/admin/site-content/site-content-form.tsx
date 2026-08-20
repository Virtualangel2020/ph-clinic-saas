"use client";

import { useState, useTransition } from "react";
import { setSiteContentAction } from "../actions";

type Site = {
  hero_heading: string;
  hero_subheading: string;
  welcome_heading: string;
  welcome_body: string;
  promo_banner_enabled: boolean;
  promo_banner_text: string;
  promo_banner_cta_label: string;
  promo_banner_promotion_id: string | null;
  demo_cta_heading: string;
  demo_cta_body: string;
  about_body: string;
  security_intro: string;
} | null;

type Promotion = { id: string; label: string; code: string | null; is_active: boolean };

const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13.5, boxSizing: "border-box" };
const labelStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "#333", marginBottom: 5, display: "block" };
const section: React.CSSProperties = { background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 22, marginBottom: 16, display: "grid", gap: 12 };

export function SiteContentForm({ site, promotions }: { site: Site; promotions: Promotion[] }) {
  const [form, setForm] = useState({
    heroHeading: site?.hero_heading ?? "",
    heroSubheading: site?.hero_subheading ?? "",
    welcomeHeading: site?.welcome_heading ?? "",
    welcomeBody: site?.welcome_body ?? "",
    promoBannerEnabled: site?.promo_banner_enabled ?? false,
    promoBannerText: site?.promo_banner_text ?? "",
    promoBannerCtaLabel: site?.promo_banner_cta_label ?? "See Offer",
    promoBannerPromotionId: site?.promo_banner_promotion_id ?? "",
    demoCtaHeading: site?.demo_cta_heading ?? "",
    demoCtaBody: site?.demo_cta_body ?? "",
    aboutBody: site?.about_body ?? "",
    securityIntro: site?.security_intro ?? "",
  });
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      try {
        await setSiteContentAction({
          ...form,
          promoBannerPromotionId: form.promoBannerPromotionId || null,
        });
        setMessage("Saved.");
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  return (
    <div>
      <div style={section}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Homepage hero</h2>
        <div>
          <label style={labelStyle}>Heading</label>
          <input style={inputStyle} value={form.heroHeading} onChange={(e) => set("heroHeading", e.target.value)} placeholder="Smart Clinic. Better Care." />
        </div>
        <div>
          <label style={labelStyle}>Subheading</label>
          <textarea style={{ ...inputStyle, minHeight: 60, fontFamily: "inherit" }} value={form.heroSubheading} onChange={(e) => set("heroSubheading", e.target.value)} />
        </div>
      </div>

      <div style={section}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Warm welcome card</h2>
        <div>
          <label style={labelStyle}>Heading</label>
          <input style={inputStyle} value={form.welcomeHeading} onChange={(e) => set("welcomeHeading", e.target.value)} placeholder="Hey, Doc! 👋 Welcome to AngelClinic." />
        </div>
        <div>
          <label style={labelStyle}>Body</label>
          <textarea style={{ ...inputStyle, minHeight: 70, fontFamily: "inherit" }} value={form.welcomeBody} onChange={(e) => set("welcomeBody", e.target.value)} />
        </div>
      </div>

      <div style={section}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Promo banner</h2>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={form.promoBannerEnabled} onChange={(e) => set("promoBannerEnabled", e.target.checked)} />
          Show promo banner on homepage
        </label>
        <div>
          <label style={labelStyle}>Banner text</label>
          <input style={inputStyle} value={form.promoBannerText} onChange={(e) => set("promoBannerText", e.target.value)} placeholder="20% off your first 3 months" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Button label</label>
            <input style={inputStyle} value={form.promoBannerCtaLabel} onChange={(e) => set("promoBannerCtaLabel", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Tied to a real promotion (recommended)</label>
            <select style={inputStyle} value={form.promoBannerPromotionId} onChange={(e) => set("promoBannerPromotionId", e.target.value)}>
              <option value="">— No linked promotion —</option>
              {promotions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} {p.code ? `(${p.code})` : ""} {p.is_active ? "" : "— inactive"}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p style={{ fontSize: 11.5, color: "#999", margin: 0 }}>
          If a linked promotion is picked and it's inactive or expires, the banner stops showing automatically —
          it never claims an offer that isn't actually live.
        </p>
      </div>

      <div style={section}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Demo CTA section</h2>
        <div>
          <label style={labelStyle}>Heading</label>
          <input style={inputStyle} value={form.demoCtaHeading} onChange={(e) => set("demoCtaHeading", e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Body</label>
          <textarea style={{ ...inputStyle, minHeight: 60, fontFamily: "inherit" }} value={form.demoCtaBody} onChange={(e) => set("demoCtaBody", e.target.value)} />
        </div>
      </div>

      <div style={section}>
        <h2 style={{ fontSize: 15, margin: 0 }}>About Us page body</h2>
        <textarea style={{ ...inputStyle, minHeight: 160, fontFamily: "inherit" }} value={form.aboutBody} onChange={(e) => set("aboutBody", e.target.value)} placeholder="Separate paragraphs with a blank line." />
      </div>

      <div style={section}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Security page intro</h2>
        <textarea style={{ ...inputStyle, minHeight: 80, fontFamily: "inherit" }} value={form.securityIntro} onChange={(e) => set("securityIntro", e.target.value)} />
      </div>

      {message && <p style={{ fontSize: 13, color: message.startsWith("Error") ? "crimson" : "#1a7f37", marginBottom: 12 }}>{message}</p>}

      <button
        onClick={save}
        disabled={pending}
        style={{ background: "#0c1730", color: "#e6c66b", fontWeight: 700, fontSize: 13.5, padding: "11px 22px", borderRadius: 8, border: "none", cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}
      >
        {pending ? "Saving…" : "Save Site Content"}
      </button>
    </div>
  );
}
