import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./prisma";
import { verifyToken, type JWTPayload } from "./jwt";

export type AuthedUser = {
  id: string;
  email: string;
  name: string;
};

export async function getCurrentUser(req: NextRequest): Promise<AuthedUser | null> {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;

  const token = auth.slice(7);
  const payload: JWTPayload | null = verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true },
  });
  return user ?? null;
}

export function unauthorized(message = "unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function badRequest(message = "bad request", details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function notFound(message = "not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export type ProjectRole = "admin" | "member" | "viewer";

export async function getProjectMembership(userId: string, projectId: string) {
  return prisma.membership.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: { role: true },
  });
}

export function canEditProject(role: ProjectRole | null | undefined): boolean {
  return role === "admin";
}

export function canEditTasks(role: ProjectRole | null | undefined): boolean {
  return role === "admin" || role === "member";
}
