import { NextResponse, type NextRequest } from "next/server";

// Fast path only: send signed-out visitors to the sign-in page and mark private routes noindex.
// Real authorization happens in every page and API handler (client-side checks are not access control).
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get("bakes_session")?.value);
  if (pathname.startsWith("/dashboard") && pathname !== "/dashboard/login" && !hasSession) {
    return NextResponse.redirect(new URL("/dashboard/login", req.url));
  }
  const res = NextResponse.next();
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/preview") || pathname.startsWith("/invite")) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Cache-Control", "private, no-store");
  }
  return res;
}

export const config = {
  matcher: ["/dashboard/:path*", "/preview/:path*", "/invite/:path*"],
};
