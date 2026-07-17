import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * OAuth redirect target for both `signInWithGoogle()` and
 * `signInWithGithub()` (`src/lib/supabase/oauth.ts`) — a single shared
 * callback route for every provider, since Supabase's `exchangeCodeForSession`
 * call is identical regardless of which provider issued the `code`.
 *
 * Google/GitHub redirects the browser here (via Supabase) with either a
 * `code` query param to exchange for a session, or an `error_description`
 * if the user cancelled/denied access. This is a Route Handler — not a Server
 * Component — so it's exactly the place `src/lib/supabase/server.ts`'s
 * `setAll` cookie adapter can actually write the resulting Supabase auth
 * cookies (Server Components can only read cookies).
 *
 * Always redirects back to `/`, never renders anything itself, and never
 * throws: any failure is reported via an `auth_error` query param instead,
 * which `SessionProvider` reads on next mount and surfaces through
 * `useAuth().error` — the calculator itself is never blocked either way.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorDescription = searchParams.get("error_description") ?? searchParams.get("error");

  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent(errorDescription)}`
    );
  }

  if (!code) {
    // Nothing to exchange — just bounce home; guest mode is unaffected.
    return NextResponse.redirect(origin);
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent(
        "Sign-in isn't set up for this app yet."
      )}`
    );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${origin}/?auth_error=${encodeURIComponent(error.message)}`
      );
    }
  } catch {
    return NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent("Sign-in failed. Please try again.")}`
    );
  }

  return NextResponse.redirect(`${origin}/?auth=success`);
}
