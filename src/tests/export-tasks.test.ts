/**
 * Tests for exportTasksToAirtable (Part 3c).
 *
 * Uses AirtableMockClient as the test double so no real credentials are needed.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { AirtableMockClient, AirtableError } from "@/lib/airtable-mock";
import { exportTasksToAirtable, type TaskForExport } from "@/lib/export-tasks";

function makeTask(overrides: Partial<TaskForExport> = {}): TaskForExport {
  return {
    id: `task_${Math.random().toString(36).slice(2, 8)}`,
    projectId: "proj1",
    title: "Test task",
    description: "A description",
    status: "todo",
    position: 0,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    assignee: { name: "Alice", email: "alice@example.com" },
    createdBy: { name: "Bob", email: "bob@example.com" },
    ...overrides,
  };
}

describe("exportTasksToAirtable", () => {
  let client: AirtableMockClient;

  beforeEach(() => {
    client = new AirtableMockClient();
  });

  it("creates a record in Airtable for each task", async () => {
    const tasks = [makeTask({ title: "Task A" }), makeTask({ title: "Task B" })];
    const result = await exportTasksToAirtable(client, tasks);

    expect(result.exported).toBe(2);
    expect(result.failed).toBe(0);

    const records = client.__getRecords();
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.fields["Title"])).toEqual(
      expect.arrayContaining(["Task A", "Task B"])
    );
  });

  it("maps all task fields correctly", async () => {
    const task = makeTask({
      id: "fixed-id",
      title: "Check fields",
      description: "Desc here",
      status: "in_progress",
      position: 3,
      assignee: { name: "Eve", email: "eve@example.com" },
      createdBy: { name: "Dave", email: "dave@example.com" },
      projectId: "proj-abc",
    });

    await exportTasksToAirtable(client, [task]);
    const record = client.__getRecords()[0];

    expect(record.fields["Title"]).toBe("Check fields");
    expect(record.fields["Description"]).toBe("Desc here");
    expect(record.fields["Status"]).toBe("in_progress");
    expect(record.fields["Position"]).toBe(3);
    expect(record.fields["Assignee"]).toBe("Eve");
    expect(record.fields["CreatedBy"]).toBe("Dave");
    expect(record.fields["ProjectId"]).toBe("proj-abc");
  });

  it("is idempotent: re-running updates existing records, not duplicating them", async () => {
    const task = makeTask({ id: "idempotent-task", title: "Original title" });

    // First export
    await exportTasksToAirtable(client, [task]);
    expect(client.__getRecordCount()).toBe(1);

    // Second export with updated title
    await exportTasksToAirtable(client, [{ ...task, title: "Updated title" }]);
    expect(client.__getRecordCount()).toBe(1);

    const record = client.__getRecords()[0];
    expect(record.fields["Title"]).toBe("Updated title");
  });

  it("returns exported=0 and failed=0 for an empty task list", async () => {
    const result = await exportTasksToAirtable(client, []);
    expect(result.exported).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("skips a failed record but continues exporting the rest", async () => {
    const tasks = [
      makeTask({ title: "Will succeed" }),
      makeTask({ title: "Will fail" }),
      makeTask({ title: "Also succeeds" }),
    ];

    // Make exactly the second task fail permanently (422 = permanent)
    let callCount = 0;
    const originalCreate = client.create.bind(client);
    client.create = async (input) => {
      callCount++;
      if (callCount === 2) {
        throw new AirtableError("Invalid field", "server-error", 422);
      }
      return originalCreate(input);
    };

    const result = await exportTasksToAirtable(client, tasks);

    expect(result.exported).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.errors[0].error).toContain("Invalid field");
  });

  it("retries transient errors (rate-limit) and eventually succeeds", async () => {
    const task = makeTask();
    let attempts = 0;

    const originalCreate = client.create.bind(client);
    client.create = async (input) => {
      attempts++;
      if (attempts < 3) {
        throw new AirtableError("Rate limited", "rate-limit", 429);
      }
      return originalCreate(input);
    };

    const result = await exportTasksToAirtable(client, [task]);

    expect(result.exported).toBe(1);
    expect(result.failed).toBe(0);
    expect(attempts).toBe(3);
  });

  it("does not retry permanent (non-5xx, non-429) errors", async () => {
    const task = makeTask();
    let callCount = 0;

    client.create = async () => {
      callCount++;
      throw new AirtableError("Not found", "server-error", 404);
    };

    const result = await exportTasksToAirtable(client, [task]);

    expect(result.failed).toBe(1);
    expect(callCount).toBe(1); // no retries
  });

  it("handles tasks with null description and no assignee gracefully", async () => {
    const task = makeTask({ description: null, assignee: null, createdBy: null });
    const result = await exportTasksToAirtable(client, [task]);

    expect(result.exported).toBe(1);
    const record = client.__getRecords()[0];
    expect(record.fields["Description"]).toBe("");
    expect(record.fields["Assignee"]).toBe("");
  });
});
