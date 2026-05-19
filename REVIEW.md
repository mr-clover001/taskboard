# Code Review — TaskBoard Assessment

Top 3 issues, prioritized by business impact.

## Issue 1 — IDOR: No Authorization Check on `PATCH /api/tasks/[id]`

**File:** `src/app/api/tasks/[id]/route.ts` · lines 16–38  
**Category:** Security  
**Severity:** Critical

The `PATCH` handler verifies the caller is authenticated but **never checks project membership or role**. Any authenticated user who knows (or guesses) a task ID can overwrite its title, description, status, assignee, and position — even for projects they are not a member of. The `DELETE` handler (same file, lines 40–57) correctly checks membership; `PATCH` was simply missed.

**Recommended fix:** Look up the task's `projectId`, then call `getProjectMembership` and `canEditTasks` before applying the update — exactly as `DELETE` already does.

```ts
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) return notFound("task not found");

  // ← add these two lines (mirrors the DELETE handler)
  const membership = await getProjectMembership(user.id, existing.projectId);
  if (!membership) return forbidden("you are not a member of this project");
  if (!canEditTasks(membership.role))
    return forbidden("viewers cannot edit tasks");

  const body = await req.json().catch(() => null);
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success)
    return badRequest("invalid input", parsed.error.flatten());

  const task = await prisma.task.update({
    where: { id },
    data: parsed.data,
    include: { assignee: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json({ task });
}
```

### Bug in action

```bash
# Lina is a member of Onboarding ONLY — she has no membership in Q3 Launch.
TOKEN_LINA=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"lina@example.com","password":"password123"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

TASK_ID="cmpc7yxgi000v5h9b4tr5afe7"   # "Prepare customer email blast" — Q3 Launch task

# Step 1: confirm Lina cannot list Q3 Launch tasks (403)
curl -s "http://localhost:3001/api/projects/cmpc7yxg300065h9bxphjhm94/tasks" \
  -H "Authorization: Bearer $TOKEN_LINA"
# → {"error":"you are not a member of this project"}

# Step 2: Lina patches the task directly — should be 403, returns 200
curl -s -X PATCH "http://localhost:3001/api/tasks/$TASK_ID" \
  -H "Authorization: Bearer $TOKEN_LINA" \
  -H "Content-Type: application/json" \
  -d '{"title":"HACKED BY LINA","status":"done"}'
# → {"task":{"title":"HACKED BY LINA","status":"done",...}}   ← task mutated
```

---

## Issue 2 — Missing `@unique` Constraint on `User.email`

**File:** `prisma/schema.prisma` · line 25  
**Category:** Data Integrity  
**Severity:** High

The `email` field on the `User` model has no `@unique` attribute. The registration endpoint guards against duplicates with an application-level `findFirst` check, but this is a TOCTOU (time-of-check/time-of-use) race condition: two concurrent registration requests with the same email can both pass the check before either write completes, producing two accounts with identical emails. Once duplicates exist, `findFirst` in the login route returns an arbitrary one of them, making the account non-deterministically inaccessible.

**Recommended fix:** Add `@unique` to the field and a database migration.

```prisma
email  String  @unique
```

Also change `prisma.user.findFirst({ where: { email } })` in both `login/route.ts` and `register/route.ts` to `findUnique`, which is both safer and faster (index seek vs. sequential scan).

---

## Issue 3 — N+1 Over-fetch: Loading All Task Rows Just to Count Them

**File:** `src/app/api/projects/route.ts` · lines 10–21  
**Category:** Performance  
**Severity:** Medium

The `GET /api/projects` handler fetches every `Task` row for every project a user belongs to, then discards all field data and uses only `.length` for `taskCount`. For a user with access to three projects containing 1,000 tasks each, this transfers ~3,000 full task objects across the database connection for a number that Postgres can compute in a single `COUNT(*)`. At scale this will cause noticeable latency on the dashboard and wastes database memory.

**Recommended fix:** Use Prisma's `_count` relation aggregation instead of loading rows.

```ts
// Replace the current include block:
memberships = await prisma.membership.findMany({
  where: { userId: user.id },
  include: {
    project: {
      include: {
        owner:  { select: { id: true, name: true, email: true } },
        _count: { select: { tasks: true } },   // ← single COUNT(*) in DB
      },
    },
  },
  orderBy: { createdAt: "desc" },
});

// Then use:
taskCount: m.project._count.tasks,
```
