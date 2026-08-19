import { requireAdmin } from "@/lib/require-admin";
import { WhatsappSettingsForm } from "./whatsapp-settings-form";

export default async function AdminSettingsPage() {
  const { supabase } = await requireAdmin();

  const { data: whatsapp } = await supabase
    .from("whatsapp_settings")
    .select("phone_number, default_message, is_enabled")
    .single();

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Settings</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Platform-wide settings that aren't specific to one client.
      </p>

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>WhatsApp support button</h2>
        <p style={{ color: "#888", fontSize: 12, marginBottom: 10 }}>
          When enabled, a floating "Need help?" button appears throughout the customer-facing pricing/checkout
          flow. Clicking it opens WhatsApp with this number and a prefilled message — nothing is hardcoded, so
          changing the number here updates it everywhere immediately.
        </p>
        <WhatsappSettingsForm settings={whatsapp as any} />
      </div>
    </div>
  );
}
