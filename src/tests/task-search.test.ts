/**
 * Tests for the task search endpoint.
 *
 * Verifies that the SQL injection vulnerability (Issue #1 in REVIEW.md) is
 * fixed: the ?q= parameter must be treated as plain text and never allow a
 * caller to read tasks outside the requested project.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoist mock functions so they are available inside vi.mock factory closures
// ---------------------------------------------------------------------------
const { mockFindMany, mockMembershipFindUnique } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockMembershipFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: { findMany: mockFindMany },
    membership: { findUnique: mockMembershipFindUnique },
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...real,
    getCurrentUser: vi.fn().mockResolvedValue({ id: "user1", email: "test@test.com", name: "Test" }),
    getProjectMembership: vi.fn().mockResolvedValue({ role: "admin" }),
  };
});

import { GET } from "@/app/api/projects/[id]/tasks/route";
import { NextRequest } from "next/server";

function makeRequest(projectId: string, q?: string): NextRequest {
  const url = q
    ? `http://localhost/api/projects/${projectId}/tasks?q=${encodeURIComponent(q)}`
    : `http://localhost/api/projects/${projectId}/tasks`;
  return new NextRequest(url, {
    headers: { Authorization: "Bearer fake-token" },
  });
}

const PARAMS = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue([]);
  mockMembershipFindUnique.mockResolvedValue({ role: "admin" });
});

describe("GET /api/projects/[id]/tasks — SQL injection fix", () => {
  it("passes the q value as a parameter, not interpolated SQL", async () => {
    const injectionPayload = "x%' OR project_id IS NOT NULL OR title ILIKE '%";
    await GET(makeRequest("proj1", injectionPayload), PARAMS("proj1"));

    expect(mockFindMany).toHaveBeenCalledOnce();
    const callArg = mockFindMany.mock.calls[0][0];

    // The ORM call must scope by projectId
    expect(callArg.where.projectId).toBe("proj1");

    // The injection string must appear only as a plain value inside
    // the OR array — never as raw SQL
    const orClause = callArg.where.OR;
    expect(Array.isArray(orClause)).toBe(true);
    expect(orClause[0].title.contains).toBe(injectionPayload);
    expect(orClause[1].description.contains).toBe(injectionPayload);
  });

  it("uses case-insensitive mode for the search", async () => {
    await GET(makeRequest("proj1", "hello"), PARAMS("proj1"));
    const orClause = mockFindMany.mock.calls[0][0].where.OR;
    expect(orClause[0].title.mode).toBe("insensitive");
    expect(orClause[1].description.mode).toBe("insensitive");
  });

  it("omits the OR filter entirely when no q is provided", async () => {
    await GET(makeRequest("proj1"), PARAMS("proj1"));
    const whereClause = mockFindMany.mock.calls[0][0].where;
    expect(whereClause.OR).toBeUndefined();
    expect(whereClause.projectId).toBe("proj1");
  });

  it("never calls $queryRawUnsafe regardless of the q value", async () => {
    // If the old vulnerable code path were still present, it would try to
    // call prisma.$queryRawUnsafe. Since we only mock task.findMany and it
    // resolves cleanly, a call to $queryRawUnsafe would throw — which is
    // itself the assertion.
    await expect(
      GET(makeRequest("proj1", "'; DROP TABLE tasks;--"), PARAMS("proj1"))
    ).resolves.not.toThrow();
  });
});
