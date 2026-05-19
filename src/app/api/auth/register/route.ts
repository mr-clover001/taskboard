import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/jwt";
import { registerSchema } from "@/schemas/auth";
import { badRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("invalid input", parsed.error.flatten());
  }

  const { email, password, name } = parsed.data;

  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    return badRequest("an account with that email already exists");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, name, passwordHash },
    select: { id: true, email: true, name: true },
  });

  const token = signToken({ userId: user.id, email: user.email });
  return NextResponse.json({ user, token }, { status: 201 });
}
