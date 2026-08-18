import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Where Supabase Auth redirects after someone clicks an invite / magic
// link. Exchanges the one-time code for a real session (sets the auth
// cookies), then sends them on to wherever the link said to go next —
// for a staff invite that's /auth/set-password.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=invite_link_invalid`);
}
