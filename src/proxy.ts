import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";

/** Wymaga loginu i hasła do /admin. */
export function proxy(request: NextRequest) {
  if (isAdminAuthorized(request.headers.get("authorization"))) {
    return NextResponse.next();
  }
  return new NextResponse("Wymagane logowanie do panelu.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Panel sklepu", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/admin/:path*"],
};
