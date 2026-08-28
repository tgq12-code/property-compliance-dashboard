import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/welcome-photo.jpg") {
    const url = request.nextUrl.clone();
    url.pathname = "/api/welcome-photo";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/welcome-photo.jpg"],
};
