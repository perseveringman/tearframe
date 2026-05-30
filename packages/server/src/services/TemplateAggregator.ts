import { CardType } from "@tearframe/shared";
import { ulid } from "ulid";
import { createSqliteDatabase, parseJson, SqliteDatabase, toJson } from "../db/sqlite";

export type TemplateRecord = {
  id: string;
  type: CardType;
  level: 1 | 2 | 3;
  title: string;
  body_md: string;
  applicable_categories?: string[];
  source_teardowns: string[];
  created_at: string;
  updated_at: string;
};

type TemplateRow = Omit<TemplateRecord, "applicable_categories" | "source_teardowns"> & {
  applicable_categories?: string | null;
  source_teardowns?: string | null;
};

export class TemplateAggregator {
  constructor(private readonly db: SqliteDatabase = createSqliteDatabase()) {}

  add(input: Omit<TemplateRecord, "id" | "created_at" | "updated_at">) {
    const now = new Date().toISOString();
    const template: TemplateRecord = { ...input, id: `tpl_${ulid()}`, created_at: now, updated_at: now };
    this.db
      .prepare(
        `INSERT INTO templates (
          id, type, level, title, body_md, applicable_categories, source_teardowns, created_at, updated_at
        ) VALUES (
          @id, @type, @level, @title, @body_md, @applicable_categories, @source_teardowns, @created_at, @updated_at
        )`
      )
      .run({
        ...template,
        applicable_categories: toJson(template.applicable_categories ?? []),
        source_teardowns: toJson(template.source_teardowns)
      });
    return template;
  }

  list(query: { type?: CardType; q?: string; sourceTeardown?: string } = {}) {
    const rows = this.db.prepare("SELECT * FROM templates ORDER BY updated_at DESC").all() as TemplateRow[];
    const normalizedQ = query.q?.trim().toLowerCase();
    return rows.map(fromRow).filter((template) => {
      if (query.type && template.type !== query.type) return false;
      if (query.sourceTeardown && !template.source_teardowns.includes(query.sourceTeardown)) return false;
      if (normalizedQ && !`${template.title} ${template.body_md}`.toLowerCase().includes(normalizedQ)) return false;
      return true;
    });
  }
}

function fromRow(row: TemplateRow): TemplateRecord {
  return {
    ...row,
    applicable_categories: parseJson<string[]>(row.applicable_categories, []),
    source_teardowns: parseJson<string[]>(row.source_teardowns, [])
  };
}
