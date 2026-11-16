import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/dashboard`);
    console.error("auth callback: exchange failed", error.code ?? error.name);
  } else if (searchParams.get("error")) {
    console.error("auth callback: provider error", searchParams.get("error"), searchParams.get("error_description"));
  }
  // Fixed relative target, no user-supplied redirect.
  return NextResponse.redirect(`${origin}/login?error=1`);
}
