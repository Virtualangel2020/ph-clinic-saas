"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/portal/login");
    router.refresh();
  }
  return (
    <button onClick={signOut} style={{ background: "none", border: "1px solid #ddd", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, cursor: "pointer", color: "#555" }}>
      Sign out
    </button>
  );
}
