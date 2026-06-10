import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase auth session on every request so server components
// always see a valid token.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and getUser() — it can cause
  // random logouts (per Supabase SSR docs).
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Skip static assets and the public customer quote page.
    "/((?!_next/static|_next/image|favicon.ico|q/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
