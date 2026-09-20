'use client';

import { Check, Pencil, X } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, type RouteDetail, apiSend } from '@/lib/api';

/**
 * One field of a route, with the affordance that corrects it.
 *
 * docs/spec.md asks for the site to make it faster to correct a number than to remember it
 * wrongly, so the edit is on the page the number is read from and not in a form somewhere
 * else. One field at a time, because that is what a thumb on a platform can do, and
 * because PATCH /routes/:id writes one edit_log row per changed field and a single-field
 * body makes that history readable.
 *
 * The response is the new page. Nothing refetches and nothing recomputes: the API returns
 * the route read back through `route_derived` inside the same transaction, so correcting a
 * distance arrives with the moved difficulty, stage, trip type and energy already in it.
 * That is the proof that one SQL view owns all of them, and recomputing any of it here
 * would destroy the proof as well as breaking the rule.
 */

export type EditControl =
  | { kind: 'text'; maxLength: number }
  | { kind: 'decimal'; pattern: RegExp; message: string }
  | { kind: 'integer'; min: number; max: number }
  | { kind: 'note'; maxLength: number }
  | { kind: 'choice'; options: readonly string[] }
  // A short whole-number scale, such as the sheet's Quiet 1 to 5. A list of values rather
  // than a numeric keyboard, because there are five of them and a thumb should not have to
  // summon a keypad to change one.
  | { kind: 'level'; min: number; max: number };

interface EditFieldProps {
  routeId: string;
  /** The key in the PATCH body. The API accepts eleven, and nothing else is editable. */
  field: string;
  label: string;
  /** What the value looks like when it is not being edited, already formatted. */
  display: ReactNode;
  /** The value as the control holds it, which for a decimal is the string the API sent. */
  initial: string;
  control: EditControl;
  /** Whether an empty box clears the column or is refused. Three of the eleven are nullable. */
  nullable?: boolean;
  /**
   * `row` puts the value on the right of its label, which is how a column of figures is
   * read. `block` puts it under the label on a full width line, for the one field that
   * holds prose: a sentence right aligned against a label is unreadable.
   */
  layout?: 'row' | 'block';
  onSaved: (route: RouteDetail) => void;
}

export function EditField({
  routeId,
  field,
  label,
  display,
  initial,
  control,
  nullable = false,
  layout = 'row',
  onSaved,
}: EditFieldProps): ReactNode {
  const inputId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open(): void {
    setDraft(initial);
    setError(null);
    setEditing(true);
  }

  async function save(): Promise<void> {
    const value = draft.trim();

    if (value === '' && !nullable) {
      setError('This one cannot be left empty.');
      return;
    }

    const problem = check(value, control);
    if (problem !== null) {
      setError(problem);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const route = await apiSend<RouteDetail>(`/api/routes/${routeId}`, 'PATCH', {
        [field]: toBody(value, control, nullable),
      });
      onSaved(route);
      setEditing(false);
    } catch (cause) {
      if (cause instanceof ApiError && cause.kind !== 'unauthorized') setError(cause.message);
    } finally {
      setSaving(false);
    }
  }

  const pencil = (
    <button
      type="button"
      onClick={open}
      className="inline-flex size-12 shrink-0 items-center justify-center rounded-md border border-input bg-card text-muted-foreground transition-colors active:translate-y-px"
    >
      <Pencil aria-hidden strokeWidth={1.75} className="size-4" />
      <span className="sr-only">Correct the {label.toLowerCase()}</span>
    </button>
  );

  if (!editing && layout === 'block') {
    return (
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <div className="mt-1 leading-6 break-words">{display}</div>
        </div>
        {pencil}
      </div>
    );
  }

  if (!editing) {
    return (
      <div className="flex min-h-14 items-center gap-3 py-1">
        <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
        <span className="min-w-0 flex-1 text-right break-words">{display}</span>
        {pencil}
      </div>
    );
  }

  return (
    <div className="py-3">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="mt-2">
        {control.kind === 'choice' || control.kind === 'level' ? (
          <NativeSelect
            id={inputId}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          >
            {optionsOf(control).map((option) => (
              <option key={option} value={option}>
                {control.kind === 'level' ? option : readable(option)}
              </option>
            ))}
          </NativeSelect>
        ) : control.kind === 'note' ? (
          <Textarea
            id={inputId}
            value={draft}
            maxLength={control.maxLength}
            aria-invalid={error !== null}
            onChange={(event) => setDraft(event.target.value)}
          />
        ) : (
          <Input
            id={inputId}
            value={draft}
            inputMode={
              control.kind === 'decimal'
                ? 'decimal'
                : control.kind === 'integer'
                  ? 'numeric'
                  : 'text'
            }
            maxLength={control.kind === 'text' ? control.maxLength : undefined}
            aria-invalid={error !== null}
            onChange={(event) => setDraft(event.target.value)}
            className={control.kind === 'text' ? undefined : 'font-mono tabular-nums'}
          />
        )}
      </div>

      {error !== null && (
        <p role="alert" className="mt-2 text-sm leading-6 text-destructive">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="w-auto flex-1 px-6"
        >
          <Check aria-hidden strokeWidth={1.75} />
          {saving ? 'Saving' : 'Save'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setEditing(false)}
          className="w-auto flex-1 px-6"
        >
          <X aria-hidden strokeWidth={1.75} />
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** The values a select offers, which for a level is the scale itself. */
function optionsOf(control: EditControl): readonly string[] {
  if (control.kind === 'choice') return control.options;
  if (control.kind !== 'level') return [];
  return Array.from({ length: control.max - control.min + 1 }, (_, index) =>
    String(control.min + index),
  );
}

/** The API's own bounds, checked here so a typo is answered in place rather than by a 400. */
function check(value: string, control: EditControl): string | null {
  if (value === '') return null;

  if (control.kind === 'decimal' && !control.pattern.test(value)) return control.message;

  if (control.kind === 'integer') {
    if (!/^\d{1,7}$/.test(value)) return 'Use a whole number.';
    const parsed = Number(value);
    if (parsed < control.min || parsed > control.max) {
      return `Use a whole number from ${control.min} to ${control.max}.`;
    }
  }

  return null;
}

function toBody(
  value: string,
  control: EditControl,
  nullable: boolean,
): string | number | null {
  if (value === '' && nullable) return null;
  return control.kind === 'integer' || control.kind === 'level' ? Number(value) : value;
}

/** `BEGINNER_CLIMB` as a person reads it. Presentation only: the stored value is untouched. */
export function readable(value: string): string {
  const words = value.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
