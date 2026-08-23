import { requireAdmin } from "@/lib/require-admin";
import { WhatsappSettingsForm } from "./whatsapp-settings-form";
import { CommerceSettingsForm } from "./commerce-settings-form";
import { EmailProviderSettingsForm } from "./email-provider-settings-form";
import { SmsProviderSettingsForm } from "./sms-provider-settings-form";

export default async function AdminSettingsPage() {
  const { supabase } = await requireAdmin();

  const [{ data: whatsapp }, { data: commerce }, { data: emailSettings }, { data: smsSettings }] = await Promise.all([
    supabase.from("whatsapp_settings").select("phone_number, default_message, is_enabled").single(),
    supabase.from("commerce_settings").select("offer_monthly, offer_yearly, offer_one_time").eq("id", true).single(),
    supabase.from("email_provider_settings").select("provider, api_key, from_email, from_name, is_enabled").single(),
    supabase.from("sms_provider_settings").select("provider, api_key, sender_id, is_enabled").single(),
  ]);

  // The api_key column never reaches the client — collapse it to a
  // boolean here, server-side, before this ever gets serialized into props.
  const emailProviderSettings = emailSettings
    ? { provider: emailSettings.provider, has_api_key: !!emailSettings.api_key, from_email: emailSettings.from_email, from_name: emailSettings.from_name, is_enabled: emailSettings.is_enabled }
    : null;
  const smsProviderSettings = smsSettings
    ? { provider: smsSettings.provider, has_api_key: !!smsSettings.api_key, sender_id: smsSettings.sender_id, is_enabled: smsSettings.is_enabled }
    : null;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Settings</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Platform-wide settings that aren't specific to one client.
      </p>

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Billing options</h2>
        <p style={{ color: "#888", fontSize: 12, marginBottom: 10 }}>
          Control which billing cycles customers can choose on the pricing page and checkout — no code changes
          needed to turn one on or off.
        </p>
        <CommerceSettingsForm settings={commerce as any} />
      </div>

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>WhatsApp support button</h2>
        <p style={{ color: "#888", fontSize: 12, marginBottom: 10 }}>
          When enabled, a floating "Need help?" button appears throughout the customer-facing pricing/checkout
          flow. Clicking it opens WhatsApp with this number and a prefilled message — nothing is hardcoded, so
          changing the number here updates it everywhere immediately.
        </p>
        <WhatsappSettingsForm settings={whatsapp as any} />
      </div>

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Email provider</h2>
        <p style={{ color: "#888", fontSize: 12, marginBottom: 10 }}>
          Powers real email delivery once a clinic has the Email Communications add-on — appointment reminders,
          patient portal invites, and notifications. Without a key here, those stay entitlement-only and nothing
          actually sends.
        </p>
        <EmailProviderSettingsForm settings={emailProviderSettings} />
      </div>

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>SMS provider</h2>
        <p style={{ color: "#888", fontSize: 12, marginBottom: 10 }}>
          Powers real SMS delivery once a clinic has the SMS add-on (and has SMS credits) — appointment reminders
          and, going forward, patient portal OTP login. Without a key here, nothing actually sends.
        </p>
        <SmsProviderSettingsForm settings={smsProviderSettings} />
      </div>
    </div>
  );
}
