import { BrandHeader } from "@/components/brand-header";

// Shown instead of a sign-in/sign-up form whenever Angel has maintenance
// mode on (toggled from /admin/settings) — "do not allow anybody to create
// an account or login, just let them know system is currently under
// maintenance and will be back in a few minutes." Deliberately does not
// render on /admin/login or anywhere under /admin/* — that console has to
// stay reachable so the toggle itself can be switched back off.
export function MaintenanceNotice({ message }: { message: string }) {
  return (
    <main style={{ maxWidth: 420, margin: "80px auto", padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <BrandHeader />
      </div>
      <div style={{ background: "white", border: "1px solid #eee", borderRadius: 12, padding: 24, textAlign: "center" }}>
        <h1 style={{ fontSize: 18, marginTop: 0 }}>Undergoing maintenance</h1>
        <p style={{ color: "#555", fontSize: 14, lineHeight: 1.6 }}>{message}</p>
      </div>
    </main>
  );
}
