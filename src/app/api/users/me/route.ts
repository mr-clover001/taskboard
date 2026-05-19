import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();
  return NextResponse.json({ user });
}
