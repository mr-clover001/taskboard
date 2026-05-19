/**
 * Core export logic: push all tasks for a project to Airtable.
 *
 * Accepts any client that implements the create/update/list interface
 * (AirtableMockClient in tests, AirtableRealClient in production).
 *
 * Idempotency: each task is stored with its TaskBoard task.id in the
 * Airtable "TaskID" field. On re-run, existing records are updated
 * rather than duplicated.
 *
 * Error handling:
 *   - Transient failures (429, 5xx, network) → retry up to MAX_RETRIES times
 *     with exponential back-off.
 *   - Permanent failures (4xx except 429) → skip that record, continue.
 *   - A single record failure never aborts the whole export.
 */

import type { AirtableCreateInput, AirtableFields } from "./airtable-mock";

export type ExportClient = {
  create(input: AirtableCreateInput): Promise<{ id: string }>;
  update(id: string, fields: AirtableFields): Promise<{ id: string }>;
  list(): Promise<Array<{ id: string; fields: AirtableFields }>>;
};

export type TaskForExport = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  position: number;
  createdAt: Date | string;
  assignee?: { name: string; email: string } | null;
  createdBy?: { name: string; email: string } | null;
};

export type ExportResult = {
  exported: number;
  failed: number;
  errors: Array<{ taskId: string; error: string }>;
};

const MAX_RETRIES = 3;
const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

function isTransient(err: unknown): boolean {
  if (err && typeof err === "object") {
    const code = (err as { statusCode?: number }).statusCode;
    if (typeof code === "number") return TRANSIENT_STATUS_CODES.has(code);
  }
  // Network-level errors (ECONNRESET, ETIMEDOUT, etc.) have no statusCode
  return err instanceof TypeError || err instanceof Error && /network|ECONNRESET|ETIMEDOUT/i.test(err.message);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isTransient(err)) throw err;
      lastError = err;
      if (attempt < MAX_RETRIES) {
        await sleep(Math.pow(2, attempt - 1) * 500); // 500ms, 1s, 2s
      }
    }
  }
  throw lastError;
}

function taskToFields(task: TaskForExport): AirtableFields {
  return {
    Title: task.title,
    Description: task.description ?? "",
    Status: task.status,
    Assignee: task.assignee?.name ?? "",
    CreatedBy: task.createdBy?.name ?? "",
    Position: task.position,
    ProjectId: task.projectId,
    CreatedAt: typeof task.createdAt === "string" ? task.createdAt : task.createdAt.toISOString(),
  };
}

export async function exportTasksToAirtable(
  client: ExportClient,
  tasks: TaskForExport[]
): Promise<ExportResult> {
  // Build a map of TaskID → Airtable record ID from existing records
  const existing = await client.list();
  const existingMap = new Map<string, string>(
    existing
      .filter((r) => typeof r.fields["TaskID"] === "string")
      .map((r) => [r.fields["TaskID"] as string, r.id])
  );

  let exported = 0;
  const errors: ExportResult["errors"] = [];

  for (const task of tasks) {
    const fields = taskToFields(task);
    const existingId = existingMap.get(task.id);

    try {
      if (existingId) {
        await withRetry(() => client.update(existingId, fields));
      } else {
        await withRetry(() => client.create({ id: task.id, fields }));
      }
      exported++;
    } catch (err) {
      errors.push({
        taskId: task.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { exported, failed: errors.length, errors };
}
