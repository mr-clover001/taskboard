import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorized, badRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: {
      project: {
        include: {
          owner: { select: { id: true, name: true, email: true } },
          tasks: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const projects = memberships.map((m) => ({
    id: m.project.id,
    name: m.project.name,
    description: m.project.description,
    role: m.role,
    owner: m.project.owner,
    taskCount: m.project.tasks.length,
    createdAt: m.project.createdAt,
  }));

  return NextResponse.json({ projects });
}

const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) return badRequest("invalid input", parsed.error.flatten());

  const project = await prisma.project.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      ownerId: user.id,
      memberships: {
        create: { userId: user.id, role: "admin" },
      },
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
