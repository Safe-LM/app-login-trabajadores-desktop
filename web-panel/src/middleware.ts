import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth"];
const ONBOARDING   = "/onboarding";

function redirectWithCookies(url: URL, supabaseResponse: NextResponse) {
  const res = NextResponse.redirect(url);
  // Propagar cookies de sesión renovadas al redirect para evitar "Already Used"
  supabaseResponse.cookies.getAll().forEach(({ name, value, ...opts }) =>
    res.cookies.set(name, value, opts as Parameters<typeof res.cookies.set>[2])
  );
  return res;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirectWithCookies(new URL("/login", request.url), supabaseResponse);
  }

  const empresaId =
    user.user_metadata?.empresa_id ||
    user.user_metadata?.raw_user_meta_data?.empresa_id;

  if (!empresaId && !pathname.startsWith(ONBOARDING) && !pathname.startsWith("/api")) {
    return redirectWithCookies(new URL(ONBOARDING, request.url), supabaseResponse);
  }

  if (empresaId && pathname.startsWith(ONBOARDING)) {
    return redirectWithCookies(new URL("/dashboard", request.url), supabaseResponse);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
