import type { Json } from "@/types/database";

// Turns the audit_logs.changes jsonb ({old?, new?}) into a readable list of
// what changed. For UPDATE we diff old vs new; for INSERT/DELETE we surface the
// notable fields of the row.

// Fields that are noise in an activity feed — hidden from the diff.
const HIDDEN_FIELDS = new Set([
  "id",
  "created_at",
  "updated_at",
  "generated_at",
  "recorded_at",
  "submitted_at",
  "joined_at",
  "assigned_at",
  "synced_at",
  "completed_at",
  "access_token",
  "refresh_token",
]);

// For INSERT/DELETE summaries, prefer these identifying fields (in order).
const TITLE_FIELDS = [
  "name_ar",
  "name",
  "title",
  "arabic_name",
  "full_name",
  "content",
  "email",
];

export interface FieldChange {
  field: string;
  from: string | null;
  to: string | null;
}

export interface AuditSummary {
  // A short label identifying the affected record (e.g. the task title).
  subject: string | null;
  // The per-field changes (UPDATE) or notable fields (INSERT/DELETE).
  changes: FieldChange[];
}

type Row = Record<string, unknown>;

function asRow(v: unknown): Row | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : null;
}

// Renders a single value for display.
function fmt(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (Array.isArray(value)) return value.length ? `${value.length} عنصر` : null;
  if (typeof value === "object") return JSON.stringify(value).slice(0, 80);
  const s = String(value);
  return s.length > 120 ? s.slice(0, 120) + "…" : s;
}

function pickSubject(row: Row | null): string | null {
  if (!row) return null;
  for (const f of TITLE_FIELDS) {
    const v = row[f];
    if (typeof v === "string" && v.trim()) {
      return v.length > 60 ? v.slice(0, 60) + "…" : v;
    }
  }
  return null;
}

export function summarizeAudit(action: string, changes: Json | null): AuditSummary {
  const root = asRow(changes);
  const oldRow = asRow(root?.old);
  const newRow = asRow(root?.new);

  if (action === "UPDATE" && oldRow && newRow) {
    const fields: FieldChange[] = [];
    const keys = new Set([...Object.keys(oldRow), ...Object.keys(newRow)]);
    for (const key of keys) {
      if (HIDDEN_FIELDS.has(key)) continue;
      const before = fmt(oldRow[key]);
      const after = fmt(newRow[key]);
      if (before === after) continue;
      fields.push({ field: key, from: before, to: after });
    }
    return { subject: pickSubject(newRow) ?? pickSubject(oldRow), changes: fields };
  }

  // INSERT / DELETE — show the notable fields of the row.
  const row = newRow ?? oldRow;
  const fields: FieldChange[] = [];
  if (row) {
    for (const [key, value] of Object.entries(row)) {
      if (HIDDEN_FIELDS.has(key)) continue;
      const v = fmt(value);
      if (v === null) continue;
      fields.push({ field: key, from: null, to: v });
    }
  }
  return { subject: pickSubject(row), changes: fields.slice(0, 8) };
}
