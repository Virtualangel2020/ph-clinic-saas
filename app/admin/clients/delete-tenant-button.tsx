"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTenantAction } from "@/app/admin/actions";

// Same confirm-then-delete pattern as the external provider directory —
// a plain browser confirm() showing exactly what's about to happen, no
// custom modal needed for something this rare and this destructive.
export function DeleteTenantButton({
  tenantId,
  tenantName,
  redirectTo,
  compact,
}: {
  tenantId: string;
  tenantName: string;
  redirectTo?: string;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function remove() {
    const sure = confirm(
      `Are you sure you want to delete "${tenantName}"?\n\nThis permanently removes this clinic's subscription, invoices, payments, staff accounts, and all other data. This cannot be undone.`
    );
    if (!sure) return;

    startTransition(async () => {
      try {
        await deleteTenantAction(tenantId);
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      } catch (e: any) {
        alert(`Couldn't delete this client: ${e.message}`);
      }
    });
  }

  return (
    <button
      onClick={remove}
      disabled={pending}
      style={
        compact
          ? { background: "none", border: "none", color: "crimson", fontSize: 12.5, cursor: pending ? "default" : "pointer", padding: 0, textDecoration: "underline" }
          : { background: "#a12a2a", color: "white", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: pending ? "default" : "pointer" }
      }
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
