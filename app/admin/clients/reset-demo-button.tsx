"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetDemoTenantAction } from "@/app/admin/actions";

// Same confirm()-then-act pattern as DeleteTenantButton. Only ever
// rendered for tenants flagged is_test (see app/admin/clients/[id]/page.tsx)
// — the RPC itself also refuses to run against a non-test tenant, so this
// is belt-and-suspenders, not the only safeguard.
export function ResetDemoButton({ tenantId, tenantName }: { tenantId: string; tenantName: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function reset() {
    const sure = confirm(
      `Reset "${tenantName}" back to its factory demo state?\n\nAny patients, notes, documents, or settings changes you made will be wiped and replaced with the original demo data (3 patients, 3 doctors, appointment types, etc). This cannot be undone.`
    );
    if (!sure) return;

    startTransition(async () => {
      try {
        await resetDemoTenantAction(tenantId);
        router.refresh();
      } catch (e: any) {
        alert(`Couldn't reset this demo account: ${e.message}`);
      }
    });
  }

  return (
    <button
      onClick={reset}
      disabled={pending}
      style={{ background: "white", border: "1px solid #0c1730", color: "#0c1730", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: pending ? "default" : "pointer" }}
    >
      {pending ? "Resetting…" : "Reset demo data"}
    </button>
  );
}
