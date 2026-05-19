/**
 * Airtable mock client — test double only.
 *
 * Use this in unit tests so tests run without real credentials. Your
 * production implementation must call the real Airtable API using the
 * official `airtable` npm package.
 */

export type AirtableFields = Record<string, unknown>;

export type AirtableRecord = {
  id: string;
  fields: AirtableFields;
  createdTime: string;
};

export type AirtableCreateInput = {
  fields: AirtableFields;
  /**
   * Optional client-supplied identifier. If supplied, the mock will use this
   * as the record id (instead of generating one). Useful for idempotency:
   * pass the TaskBoard task id and the mock will treat repeated calls as
   * upserts on this id.
   */
  id?: string;
};

export type AirtableErrorType = "rate-limit" | "server-error" | "network";

export class AirtableError extends Error {
  constructor(
    message: string,
    public readonly type: AirtableErrorType,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AirtableError";
  }
}

type MockOptions = {
  /** 0..1 probability that any single API call will throw. */
  failureRate?: number;
  /** Which kind of error to simulate when a call fails. */
  failureType?: AirtableErrorType;
};

export class AirtableMockClient {
  private records = new Map<string, AirtableRecord>();
  private options: MockOptions;

  constructor(options: MockOptions = {}) {
    this.options = options;
  }

  /**
   * Create a new record. If `input.id` is provided, this acts as an upsert:
   * an existing record with that id will be replaced.
   */
  async create(input: AirtableCreateInput): Promise<AirtableRecord> {
    this.maybeThrow();
    const id = input.id ?? `rec_${cryptoRandom()}`;
    const record: AirtableRecord = {
      id,
      fields: input.fields,
      createdTime: this.records.get(id)?.createdTime ?? new Date().toISOString(),
    };
    this.records.set(id, record);
    return record;
  }

  /**
   * Update an existing record. Throws if the id does not exist.
   */
  async update(id: string, fields: AirtableFields): Promise<AirtableRecord> {
    this.maybeThrow();
    const existing = this.records.get(id);
    if (!existing) {
      throw new AirtableError(`Record ${id} not found`, "server-error", 404);
    }
    const updated: AirtableRecord = {
      id,
      fields: { ...existing.fields, ...fields },
      createdTime: existing.createdTime,
    };
    this.records.set(id, updated);
    return updated;
  }

  /**
   * Return all records in insertion order.
   */
  async list(): Promise<AirtableRecord[]> {
    this.maybeThrow();
    return Array.from(this.records.values());
  }

  // ---------- test-only helpers (not part of the real Airtable API) ----------

  /** Reset the mock to an empty state. Useful between tests. */
  __reset(): void {
    this.records.clear();
    this.options = {};
  }

  /** Configure the failure simulation. Set rate to 0 to disable. */
  __setFailureRate(rate: number, type: AirtableErrorType = "server-error"): void {
    this.options = { failureRate: rate, failureType: type };
  }

  /** Inspect the in-memory state. Use this in tests to assert what was pushed. */
  __getRecords(): AirtableRecord[] {
    return Array.from(this.records.values());
  }

  /** Get the count of stored records. Use this in idempotency tests. */
  __getRecordCount(): number {
    return this.records.size;
  }

  // ---------- internals ----------

  private maybeThrow(): void {
    const rate = this.options.failureRate ?? 0;
    if (rate > 0 && Math.random() < rate) {
      const type = this.options.failureType ?? "server-error";
      const statusCode = type === "rate-limit" ? 429 : type === "network" ? 0 : 500;
      throw new AirtableError(`Simulated ${type}`, type, statusCode);
    }
  }
}

/**
 * Cheap collision-resistant random id. We avoid pulling in the `crypto`
 * module from Node so this works in any runtime.
 */
function cryptoRandom(): string {
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}

/**
 * Singleton instance the candidate's code can import directly:
 *
 *   import { airtable } from "@/lib/airtable-mock";
 *   await airtable.create({ id: task.id, fields: { ... } });
 *
 * For tests you can either use this singleton (calling `airtable.__reset()`
 * between tests) or instantiate your own `new AirtableMockClient()`.
 */
export const airtable = new AirtableMockClient();
