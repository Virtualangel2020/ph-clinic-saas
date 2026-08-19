"use client";

import { useState, useTransition } from "react";
import { setTenantTestFlagAction } from "@/app/admin/actions";

// Quick inline toggle right in the clients list, so marking someone as a
// test client doesn't require opening into their full Manage page first.
export function TestToggle({ tenantId, initialIsTest }: { tenantId: string; initialIsTest: boolean }) {
  const [isTest, setIsTest] = useState(initialIsTest);
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    setIsTest(next);
    startTransition(async () => {
      try {
        await setTenantTestFlagAction(tenantId, next);
      } catch {
        setIsTest(!next);
      }
    });
  }

  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#666", cursor: "pointer" }}>
      <input type="checkbox" checked={isTest} disabled={pending} onChange={(e) => toggle(e.target.checked)} />
      Test
    </label>
  );
}
