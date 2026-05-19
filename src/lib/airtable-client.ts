/**
 * Real Airtable client adapter.
 *
 * Wraps the official `airtable` npm package and exposes the same
 * create / update / list interface as AirtableMockClient so that
 * export-tasks.ts can be tested against the mock without modification.
 *
 * Required env vars: AIRTABLE_API_KEY, AIRTABLE_BASE_ID
 * Optional env var:  AIRTABLE_TABLE_NAME  (defaults to "Tasks")
 *
 * Required Airtable table columns:
 *   TaskID      – Single line text  (used as idempotency key)
 *   Title       – Single line text
 *   Description – Long text
 *   Status      – Single line text
 *   Assignee    – Single line text
 *   CreatedBy   – Single line text
 *   Position    – Number
 *   ProjectId   – Single line text
 *   CreatedAt   – Single line text
 */
import Airtable from "airtable";
import type { AirtableFields, AirtableRecord, AirtableCreateInput } from "./airtable-mock";

type RawRecord = { id: string; fields: Record<string, unknown>; _rawJson: { createdTime: string } };

export class AirtableRealClient {
  private table: Airtable.Table<Airtable.FieldSet>;

  constructor() {
    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;
    const tableName = process.env.AIRTABLE_TABLE_NAME || "Tasks";

    if (!apiKey || !baseId) {
      throw new Error("AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set");
    }

    const base = new Airtable({ apiKey }).base(baseId);
    this.table = base(tableName);
  }

  async create(input: AirtableCreateInput): Promise<AirtableRecord> {
    const fields = input.id
      ? { ...input.fields, TaskID: input.id }
      : input.fields;

    const record = (await this.table.create(fields as Airtable.FieldSet)) as unknown as RawRecord;
    return {
      id: record.id,
      fields: record.fields as AirtableFields,
      createdTime: record._rawJson?.createdTime ?? new Date().toISOString(),
    };
  }

  async update(id: string, fields: AirtableFields): Promise<AirtableRecord> {
    const record = (await this.table.update(id, fields as Airtable.FieldSet)) as unknown as RawRecord;
    return {
      id: record.id,
      fields: record.fields as AirtableFields,
      createdTime: record._rawJson?.createdTime ?? new Date().toISOString(),
    };
  }

  async list(): Promise<AirtableRecord[]> {
    const records = await this.table.select().all() as unknown as RawRecord[];
    return records.map((r) => ({
      id: r.id,
      fields: r.fields as AirtableFields,
      createdTime: r._rawJson?.createdTime ?? "",
    }));
  }
}
