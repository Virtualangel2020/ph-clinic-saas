"use client";

import { useState, useTransition } from "react";
import { setUserPermissionAction } from "../actions";

type Staff = { id: string; full_name: string | null; role: string };
type PermissionDef = { key: string; label: string; description: string | null; module_key: string; default_value: boolean };
type UserPermission = { user_id: string; permission_key: string; is_enabled: boolean };

export function PermissionsGrid({
  staff,
  permissionDefs,
  userPermissions,
}: {
  staff: Staff[];
  permissionDefs: PermissionDef[];
  userPermissions: UserPermission[];
}) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>(
    Object.fromEntries(userPermissions.map((p) => [`${p.user_id}:${p.permission_key}`, p.is_enabled]))
  );
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function isEnabled(userId: string, permKey: string, defaultValue: boolean) {
    const k = `${userId}:${permKey}`;
    return k in overrides ? overrides[k] : defaultValue;
  }

  function toggle(userId: string, permKey: string, defaultValue: boolean) {
    const next = !isEnabled(userId, permKey, defaultValue);
    setOverrides((prev) => ({ ...prev, [`${userId}:${permKey}`]: next }));
    startTransition(async () => {
      try {
        await setUserPermissionAction(userId, permKey, next);
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    });
  }

  if (staff.length === 0) {
    return null;
  }

  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, padding: 24, overflowX: "auto" }}>
      <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 4 }}>Permissions</h2>
      <p style={{ fontSize: 12, color: "#999", marginBottom: 14 }}>
        Each toggle starts at that permission's sensible default and can be adjusted per person. Clinic admins
        always have full access and aren't shown here.
      </p>
      <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 600 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "6px 10px", color: "#888" }}>Staff</th>
            {permissionDefs.map((p) => (
              <th key={p.key} title={p.description ?? undefined} style={{ padding: "6px 8px", color: "#888", fontWeight: 600, textAlign: "center", writingMode: "vertical-rl", minWidth: 28 }}>
                {p.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {staff.map((s) => (
            <tr key={s.id} style={{ borderTop: "1px solid #eee" }}>
              <td style={{ padding: "8px 10px" }}>
                {s.full_name || "—"} <span style={{ color: "#bbb", fontSize: 11, textTransform: "capitalize" }}>({s.role.replace("_", " ")})</span>
              </td>
              {permissionDefs.map((p) => (
                <td key={p.key} style={{ padding: "6px 8px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={isEnabled(s.id, p.key, p.default_value)}
                    disabled={pending}
                    onChange={() => toggle(s.id, p.key, p.default_value)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {message && <p style={{ fontSize: 12, color: "crimson", marginTop: 10 }}>{message}</p>}
    </div>
  );
}
