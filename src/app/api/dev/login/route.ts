import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// DEV ONLY: signs in using a token_hash minted by scripts/login-link.mjs,
// skipping the email round-trip. Returns 404 in production builds.
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  if (!tokenHash) {
    return NextResponse.json({ error: "token_hash required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: tokenHash,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  return NextResponse.redirect(`${origin}/quotes`);
}
