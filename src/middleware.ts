import { NextResponse } from "next/server";

export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/coordinator/:path*", "/adjudicator/:path*", "/ha/:path*"],
};
