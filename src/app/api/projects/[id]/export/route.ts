import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  unauthorized,
  forbidden,
  getProjectMembership,
} from "@/lib/auth";
import { AirtableRealClient } from "@/lib/airtable-client";
import { exportTasksToAirtable } from "@/lib/export-tasks";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const { id: projectId } = await params;
  const membership = await getProjectMembership(user.id, projectId);
  if (!membership) return forbidden("you are not a member of this project");
  if (membership.role === "viewer") {
    return forbidden("only admins and members can export tasks");
  }

  const tasks = await prisma.task.findMany({
    where: { projectId },
    include: {
      assignee:  { select: { name: true, email: true } },
      createdBy: { select: { name: true, email: true } },
    },
    orderBy: { position: "asc" },
  });

  let client: AirtableRealClient;
  try {
    client = new AirtableRealClient();
  } catch (err) {
    return NextResponse.json(
      { error: "Airtable is not configured", details: (err as Error).message },
      { status: 503 }
    );
  }

  const result = await exportTasksToAirtable(client, tasks);

  return NextResponse.json(result, { status: 200 });
}
