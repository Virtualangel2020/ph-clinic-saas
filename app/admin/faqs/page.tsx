import { requireAdmin } from "@/lib/require-admin";
import { FaqManager } from "./faq-manager";

export default async function FaqsPage() {
  const { supabase } = await requireAdmin();

  const { data: faqs } = await supabase
    .from("faqs")
    .select("id, question, answer, sort_order, is_active")
    .order("sort_order")
    .order("created_at");

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>FAQ</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Shown at the bottom of the public pricing page. Only active entries are visible to customers — order
        controls the sequence (lowest first).
      </p>
      <FaqManager faqs={(faqs as any) ?? []} />
    </div>
  );
}
