/**
 * Magic-link callback (Phase C · C5a).
 *
 * Supabase redirects here after the user clicks the email link, with a `?code=`.
 * We exchange that code for a session (which sets the auth cookies), then send
 * the user into the app.
 */

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.warn("[auth] exchangeCodeForSession failed:", error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
