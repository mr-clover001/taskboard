/**
 * Tests for the task comments API (Part 3a).
 *
 * Covers: listing, posting, authorization (viewer cannot post),
 * and append-only enforcement (no DELETE/PATCH routes exist).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoisted mocks — must use vi.hoisted so variables are ready inside vi.mock
// ---------------------------------------------------------------------------
const {
  mockCommentFindMany,
  mockCommentCreate,
  mockTaskFindUnique,
  mockMembershipFindUnique,
  mockGetCurrentUser,
} = vi.hoisted(() => ({
  mockCommentFindMany: vi.fn(),
  mockCommentCreate: vi.fn(),
  mockTaskFindUnique: vi.fn(),
  mockMembershipFindUnique: vi.fn(),
  mockGetCurrentUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    comment: { findMany: mockCommentFindMany, create: mockCommentCreate },
    task: { findUnique: mockTaskFindUnique },
    membership: { findUnique: mockMembershipFindUnique },
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...real,
    getCurrentUser: mockGetCurrentUser,
    getProjectMembership: vi.fn(async (_userId: string, _projectId: string) =>
      mockMembershipFindUnique()
    ),
  };
});

import { GET, POST } from "@/app/api/tasks/[id]/comments/route";

function makeReq(method: "GET" | "POST", taskId: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/tasks/${taskId}/comments`, {
    method,
    headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const PARAMS = (id: string) => ({ params: Promise.resolve({ id }) });

const TASK = { projectId: "proj1" };
const COMMENT = {
  id: "c1",
  body: "Hello world",
  createdAt: new Date("2024-01-01").toISOString(),
  author: { id: "u1", name: "Alice", email: "alice@example.com" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockTaskFindUnique.mockResolvedValue(TASK);
  mockMembershipFindUnique.mockResolvedValue({ role: "member" });
  mockGetCurrentUser.mockResolvedValue({ id: "u1", email: "alice@example.com", name: "Alice" });
  mockCommentFindMany.mockResolvedValue([COMMENT]);
  mockCommentCreate.mockResolvedValue(COMMENT);
});

describe("GET /api/tasks/[id]/comments", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeReq("GET", "task1"), PARAMS("task1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 if task does not exist", async () => {
    mockTaskFindUnique.mockResolvedValue(null);
    const res = await GET(makeReq("GET", "missing"), PARAMS("missing"));
    expect(res.status).toBe(404);
  });

  it("returns 403 if caller is not a project member", async () => {
    mockMembershipFindUnique.mockResolvedValue(null);
    const res = await GET(makeReq("GET", "task1"), PARAMS("task1"));
    expect(res.status).toBe(403);
  });

  it("returns comments in chronological order for a project member", async () => {
    const res = await GET(makeReq("GET", "task1"), PARAMS("task1"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.comments).toHaveLength(1);
    expect(data.comments[0].body).toBe("Hello world");

    // Verify orderBy was called with ascending createdAt
    expect(mockCommentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "asc" },
      })
    );
  });

  it("viewers can read comments", async () => {
    mockMembershipFindUnique.mockResolvedValue({ role: "viewer" });
    const res = await GET(makeReq("GET", "task1"), PARAMS("task1"));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/tasks/[id]/comments", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeReq("POST", "task1", { body: "hi" }), PARAMS("task1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 if task does not exist", async () => {
    mockTaskFindUnique.mockResolvedValue(null);
    const res = await POST(makeReq("POST", "missing", { body: "hi" }), PARAMS("missing"));
    expect(res.status).toBe(404);
  });

  it("returns 403 if caller is not a project member", async () => {
    mockMembershipFindUnique.mockResolvedValue(null);
    const res = await POST(makeReq("POST", "task1", { body: "hi" }), PARAMS("task1"));
    expect(res.status).toBe(403);
  });

  it("returns 403 if caller is a viewer", async () => {
    mockMembershipFindUnique.mockResolvedValue({ role: "viewer" });
    const res = await POST(makeReq("POST", "task1", { body: "hi" }), PARAMS("task1"));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/viewer/i);
  });

  it("creates and returns a comment for admin/member", async () => {
    const res = await POST(makeReq("POST", "task1", { body: "Great work!" }), PARAMS("task1"));
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.comment.body).toBe("Hello world"); // mock return value

    expect(mockCommentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ body: "Great work!", authorId: "u1", taskId: "task1" }),
      })
    );
  });

  it("returns 400 for an empty body", async () => {
    const res = await POST(makeReq("POST", "task1", { body: "" }), PARAMS("task1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body field is missing", async () => {
    const res = await POST(makeReq("POST", "task1", {}), PARAMS("task1"));
    expect(res.status).toBe(400);
  });

  it("admin can also post comments", async () => {
    mockMembershipFindUnique.mockResolvedValue({ role: "admin" });
    const res = await POST(makeReq("POST", "task1", { body: "Admin comment" }), PARAMS("task1"));
    expect(res.status).toBe(201);
  });
});

describe("Comments append-only enforcement", () => {
  it("no DELETE route is exported from the comments handler", async () => {
    const mod = await import("@/app/api/tasks/[id]/comments/route");
    expect((mod as Record<string, unknown>)["DELETE"]).toBeUndefined();
  });

  it("no PATCH/PUT route is exported from the comments handler", async () => {
    const mod = await import("@/app/api/tasks/[id]/comments/route");
    expect((mod as Record<string, unknown>)["PATCH"]).toBeUndefined();
    expect((mod as Record<string, unknown>)["PUT"]).toBeUndefined();
  });
});
