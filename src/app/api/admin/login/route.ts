import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Production-safe twin of /api/dev/login, for admin-generated support links
// (see generateLoginLink in the admin actions). Whoever opens the URL is
// signed in as the link's contractor — exactly like clicking the magic link
// in their email. The token_hash is single-use and expires, so the URL is
// the secret; no extra gating needed or possible (the clicker is usually
// not signed in as an admin).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  if (!tokenHash) {
    return NextResponse.json({ error: "Missing token_hash" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: tokenHash,
  });
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }
  return NextResponse.redirect(`${origin}/quotes`);
}
