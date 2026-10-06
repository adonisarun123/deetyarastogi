import { NextResponse } from "next/server";

// Earlier invite links (/sweet16/<code>) now point to /sweet16.
export function GET(req: Request) {
  return NextResponse.redirect(new URL("/sweet16", req.url), 308);
}
