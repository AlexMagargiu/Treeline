import { Prisma } from '@prisma/client';

/** The only columns of route that PATCH /routes/:id accepts. */
export const EDITABLE_FIELDS = [
  'nameRo',
  'nameEn',
  'km',
  'ascentM',
  'terrain',
  'technical',
  'quiet',
  'confidence',
  'seasonWindow',
  'notes',
  'shape',
] as const;

export type EditableField = (typeof EDITABLE_FIELDS)[number];

/**
 * edit_log.table_name is "route", so edit_log.field is the column, not the name the JSON
 * uses. The log is a record of what happened to the database and has to stay readable
 * beside a migration.
 */
export const COLUMN_OF: Record<EditableField, string> = {
  nameRo: 'name_ro',
  nameEn: 'name_en',
  km: 'km',
  ascentM: 'ascent_m',
  terrain: 'terrain',
  technical: 'technical',
  quiet: 'quiet',
  confidence: 'confidence',
  seasonWindow: 'season_window',
  notes: 'notes',
  shape: 'shape',
};

export type FieldValue = string | number | null;

export type RouteFields = Record<EditableField, FieldValue>;

export interface FieldChange {
  field: EditableField;
  column: string;
  oldValue: string | null;
  newValue: string | null;
}

/**
 * km is the one decimal among the eleven, and it is stored as numeric(5,2). A caller who
 * sends 16 for a route that already holds 16.00 has changed nothing, and comparing the
 * two as text would write an edit_log row saying so. Decimal, not Number: the catalogue
 * exists because these figures are exact.
 */
function sameValue(field: EditableField, before: FieldValue, after: FieldValue): boolean {
  if (before === null || after === null) return before === after;
  if (field === 'km') return new Prisma.Decimal(before).equals(new Prisma.Decimal(after));
  return String(before) === String(after);
}

/** edit_log.old_value and new_value are text. Nothing here is formatted for display. */
function asText(value: FieldValue): string | null {
  return value === null ? null : String(value);
}

/**
 * The fields a patch actually changes, one edit_log row each. A field submitted with the
 * value it already holds is not a change and writes nothing, so a form that posts every
 * field leaves no trail until something moves.
 */
export function changedFields(
  current: RouteFields,
  patch: Partial<RouteFields>,
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of EDITABLE_FIELDS) {
    if (!(field in patch)) continue;
    const after = patch[field];
    if (after === undefined) continue;
    const before = current[field];
    if (sameValue(field, before, after)) continue;
    changes.push({
      field,
      column: COLUMN_OF[field],
      oldValue: asText(before),
      newValue: asText(after),
    });
  }
  return changes;
}
