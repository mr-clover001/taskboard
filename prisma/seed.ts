import { PrismaClient, Role, TaskStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("seeding…");

  await prisma.task.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  const meera = await prisma.user.create({
    data: { email: "meera@taskboard.dev", name: "Meera Iyer", passwordHash },
  });
  const arjun = await prisma.user.create({
    data: { email: "arjun@taskboard.dev", name: "Arjun Rao", passwordHash },
  });
  const kavya = await prisma.user.create({
    data: { email: "kavya@example.com", name: "Kavya Reddy", passwordHash },
  });
  const dev = await prisma.user.create({
    data: { email: "dev@example.com", name: "Dev Sharma", passwordHash },
  });
  const lina = await prisma.user.create({
    data: { email: "lina@example.com", name: "Lina Joshi", passwordHash },
  });

  const launch = await prisma.project.create({
    data: {
      name: "Q3 Launch",
      description: "Coordinate the Q3 product launch across engineering, design, and marketing.",
      ownerId: meera.id,
      memberships: {
        create: [
          { userId: meera.id, role: Role.admin },
          { userId: arjun.id, role: Role.member },
          { userId: kavya.id, role: Role.member },
          { userId: dev.id, role: Role.viewer },
        ],
      },
    },
  });

  const onboarding = await prisma.project.create({
    data: {
      name: "Customer Onboarding Revamp",
      description: "Reduce time-to-first-value from 9 days to under 3 days.",
      ownerId: arjun.id,
      memberships: {
        create: [
          { userId: arjun.id, role: Role.admin },
          { userId: meera.id, role: Role.member },
          { userId: lina.id, role: Role.member },
        ],
      },
    },
  });

  await prisma.project.create({
    data: {
      name: "Internal Tools Cleanup",
      description: "Retire legacy admin tools and consolidate into the new console.",
      ownerId: meera.id,
      memberships: {
        create: [{ userId: meera.id, role: Role.admin }],
      },
    },
  });

  const launchTasks = [
    { title: "Finalize launch date with marketing", status: TaskStatus.done, assignee: meera.id, position: 0 },
    { title: "Draft press release", status: TaskStatus.review, assignee: arjun.id, position: 1 },
    { title: "Record demo video", status: TaskStatus.in_progress, assignee: kavya.id, position: 2 },
    { title: "Set up analytics dashboards", status: TaskStatus.in_progress, assignee: arjun.id, position: 3 },
    { title: "Prepare customer email blast", status: TaskStatus.todo, assignee: kavya.id, position: 4 },
    { title: "Update pricing page copy", status: TaskStatus.todo, assignee: null, position: 5 },
    { title: "QA the new signup flow end-to-end", status: TaskStatus.todo, assignee: arjun.id, position: 6 },
  ];

  for (const t of launchTasks) {
    await prisma.task.create({
      data: {
        projectId: launch.id,
        title: t.title,
        description: `Detail for: ${t.title}`,
        status: t.status,
        assigneeId: t.assignee,
        createdById: meera.id,
        position: t.position,
      },
    });
  }

  const onboardingTasks = [
    { title: "Map current onboarding funnel", status: TaskStatus.done, assignee: arjun.id, position: 0 },
    { title: "Interview 5 recently-onboarded customers", status: TaskStatus.review, assignee: lina.id, position: 1 },
    { title: "Wireframe new welcome screens", status: TaskStatus.in_progress, assignee: meera.id, position: 2 },
    { title: "Audit current onboarding emails", status: TaskStatus.todo, assignee: lina.id, position: 3 },
    { title: "Define success metric (TTFV target)", status: TaskStatus.todo, assignee: arjun.id, position: 4 },
  ];

  for (const t of onboardingTasks) {
    await prisma.task.create({
      data: {
        projectId: onboarding.id,
        title: t.title,
        description: `Detail for: ${t.title}`,
        status: t.status,
        assigneeId: t.assignee,
        createdById: arjun.id,
        position: t.position,
      },
    });
  }

  console.log("seed complete.");
  console.log("login with any of these (password: password123):");
  console.log("  meera@taskboard.dev   — admin on Q3 Launch, Internal Tools");
  console.log("  arjun@taskboard.dev   — admin on Onboarding, member on Q3 Launch");
  console.log("  kavya@example.com     — member on Q3 Launch");
  console.log("  dev@example.com       — viewer on Q3 Launch");
  console.log("  lina@example.com      — member on Onboarding");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
