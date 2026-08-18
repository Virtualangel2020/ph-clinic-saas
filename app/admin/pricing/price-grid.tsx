"use client";

import { useState, useTransition } from "react";
import {
  upsertPlanPriceAction,
  removePlanPriceAction,
  upsertAddonPriceAction,
  removeAddonPriceAction,
} from "@/app/admin/actions";

const CYCLES = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "one_time", label: "One-time" },
] as const;

type Item = { id: string; name: string; plan_prices?: any[]; addon_prices?: any[] };

export function PriceGrid({ kind, items }: { kind: "plan" | "addon"; items: Item[] }) {
  return (
    <div style={{ background: "white", border: "1px solid #e2e2e5", borderRadius: 12, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#fafafa", textAlign: "left" }}>
            <th style={{ padding: "10px 16px", fontWeight: 600, color: "#555" }}>{kind === "plan" ? "Plan" : "Add-on"}</th>
            {CYCLES.map((c) => (
              <th key={c.value} style={{ padding: "10px 16px", fontWeight: 600, color: "#555" }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <ItemRow key={item.id} kind={kind} item={item} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ItemRow({ kind, item }: { kind: "plan" | "addon"; item: Item }) {
  const prices = kind === "plan" ? item.plan_prices ?? [] : item.addon_prices ?? [];

  return (
    <tr style={{ borderTop: "1px solid #eee" }}>
      <td style={{ padding: "10px 16px", fontWeight: 600, verticalAlign: "top" }}>{item.name}</td>
      {CYCLES.map((c) => {
        const existing = prices.find((p: any) => p.billing_cycle === c.value);
        return (
          <td key={c.value} style={{ padding: "10px 16px", verticalAlign: "top" }}>
            <PriceCell kind={kind} itemId={item.id} cycle={c.value} initialPrice={existing?.price_php ?? null} />
          </td>
        );
      })}
    </tr>
  );
}

function PriceCell({
  kind,
  itemId,
  cycle,
  initialPrice,
}: {
  kind: "plan" | "addon";
  itemId: string;
  cycle: string;
  initialPrice: number | null;
}) {
  const [value, setValue] = useState(initialPrice !== null ? String(initialPrice) : "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    setSaved(false);
    const trimmed = value.trim();
    startTransition(async () => {
      try {
        if (trimmed === "") {
          if (kind === "plan") await removePlanPriceAction(itemId, cycle);
          else await removeAddonPriceAction(itemId, cycle);
        } else {
          const num = Number(trimmed);
          if (isNaN(num) || num < 0) {
            setError("Invalid price");
            return;
          }
          if (kind === "plan") await upsertPlanPriceAction(itemId, cycle, num);
          else await upsertAddonPriceAction(itemId, cycle, num);
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ color: "#888" }}>₱</span>
      <input
        type="number"
        min={0}
        placeholder="not offered"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        disabled={pending}
        style={{ width: 90, padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13 }}
      />
      {saved && <span style={{ color: "#1a7f37", fontSize: 11 }}>saved</span>}
      {error && <span style={{ color: "crimson", fontSize: 11 }}>{error}</span>}
    </div>
  );
}
