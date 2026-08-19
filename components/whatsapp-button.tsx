"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Floating support button for the customer-facing purchase flow. The
// number/message/on-off switch all come from Superadmin (see
// /admin/settings) — nothing here is hardcoded, so changing them there
// updates every page that renders this component immediately.
export function WhatsappButton() {
  const [settings, setSettings] = useState<{ phone_number: string | null; default_message: string; is_enabled: boolean } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("whatsapp_settings")
      .select("phone_number, default_message, is_enabled")
      .single()
      .then(({ data }) => setSettings(data as any));
  }, []);

  if (!settings?.is_enabled || !settings.phone_number) return null;

  const href = `https://wa.me/${settings.phone_number}?text=${encodeURIComponent(settings.default_message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "12px 16px",
        borderRadius: 999,
        background: "#25D366",
        color: "white",
        fontWeight: 700,
        fontSize: 13,
        textDecoration: "none",
        boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
      }}
    >
      <span style={{ fontSize: 16 }}>💬</span> Need help?
    </a>
  );
}
