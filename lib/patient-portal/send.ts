import { createAdminClient } from "@/lib/supabase/admin";

// Actually dispatches Patient Portal invite emails/SMS using the
// platform-level provider credentials Superadmin saved in Settings (see
// app/admin/settings). Runs from Server Actions only — uses the
// service-role client to read the provider's api_key (RLS on
// email_provider_settings/sms_provider_settings only allows
// is_platform_admin() to read it directly; this bypasses that
// intentionally and safely, since the key never leaves this server-only
// module and never reaches the browser).
//
// Only the providers matching the dropdown defaults (Resend / Semaphore)
// are actually wired up to send for now. Any other provider a Superadmin
// picks in Settings will show as "Live" but fail here with a clear error
// rather than silently pretending to send — extend this file when a real
// integration is added for it.

export async function sendPortalEmail(opts: { toEmail: string; toName: string; subject: string; html: string }) {
  const admin = createAdminClient();
  const { data: settings, error } = await admin.from("email_provider_settings").select("provider, api_key, from_email, from_name, is_enabled").single();
  if (error || !settings || !settings.is_enabled || !settings.api_key) {
    throw new Error("Email sending isn't active on the platform yet — ask Virtual Angel Systems to finish setting up the email provider.");
  }

  if (settings.provider === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${settings.api_key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${settings.from_name || "AngelClinic"} <${settings.from_email}>`,
        to: [opts.toEmail],
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Email provider rejected the message (${res.status}): ${body.slice(0, 300)}`);
    }
    return;
  }

  throw new Error(`Live sending for "${settings.provider}" isn't wired up yet — only Resend is implemented so far. Switch the platform's email provider to Resend, or ask for support to add this one.`);
}

export async function sendPortalSms(opts: { toPhone: string; message: string }) {
  const admin = createAdminClient();
  const { data: settings, error } = await admin.from("sms_provider_settings").select("provider, api_key, sender_id, is_enabled").single();
  if (error || !settings || !settings.is_enabled || !settings.api_key) {
    throw new Error("SMS sending isn't active on the platform yet — ask Virtual Angel Systems to finish setting up the SMS provider.");
  }

  if (settings.provider === "semaphore") {
    const body = new URLSearchParams({
      apikey: settings.api_key,
      number: opts.toPhone,
      message: opts.message,
      ...(settings.sender_id ? { sendername: settings.sender_id } : {}),
    });
    const res = await fetch("https://api.semaphore.co/api/v4/messages", { method: "POST", body });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      throw new Error(`SMS provider rejected the message (${res.status}): ${bodyText.slice(0, 300)}`);
    }
    return;
  }

  throw new Error(`Live sending for "${settings.provider}" isn't wired up yet — only Semaphore is implemented so far. Switch the platform's SMS provider to Semaphore, or ask for support to add this one.`);
}

// Supabase's phone-auth identity expects digits with country code, no "+"
// or spaces (e.g. "639171234567"). PH numbers are stored however staff
// typed them (e.g. "0917 000 0001") — normalize just for the auth call.
export function normalizePhMobile(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("63")) return digits;
  if (digits.startsWith("0")) return "63" + digits.slice(1);
  if (digits.length === 10) return "63" + digits;
  return digits;
}
