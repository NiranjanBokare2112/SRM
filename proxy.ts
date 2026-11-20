import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/localdb/session";

/**
 * Optimistic guard for the owner portal: refreshes the Supabase session cookie and
 * sends signed-out visitors to the login page. Real protection is enforced by the
 * database (row level security + owner checks in every billing function).
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isLogin = request.nextUrl.pathname.startsWith("/admin/login");

  if (process.env.NEXT_PUBLIC_DB_MODE === "local") {
    // Local PostgreSQL mode: our own signed session cookie.
    const signedIn = Boolean(await verifySession(request.cookies.get(SESSION_COOKIE)?.value));
    if (!signedIn && !isLogin) return NextResponse.redirect(new URL("/admin/login", request.url));
    if (signedIn && isLogin) return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    return NextResponse.next();
  }

  if (!url || !anonKey) {
    // Demo mode (no database configured): a cookie set by the demo login stands in for the session.
    const demoSession = request.cookies.get("srm-demo-session")?.value ?? "";
    const signedIn = demoSession === "owner" || decodeURIComponent(demoSession).startsWith("operator:");
    if (!signedIn && !isLogin) return NextResponse.redirect(new URL("/admin/login", request.url));
    if (signedIn && isLogin) return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  if (!data.user && !isLogin) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  if (data.user && isLogin && !request.nextUrl.searchParams.has("mode")) {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
