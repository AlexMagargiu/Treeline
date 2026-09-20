'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';

import { useMapData } from '@/components/map/map-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { type FilterState, DEFAULT_SORT, SORTS, type Sort, clearFilters } from '@/lib/filters';
import { createGloss } from '@/lib/gloss';

/**
 * Everything that is not a chip, behind one control.
 *
 * Six of the spec's seventeen drawer rows are here. Nine of them (water, shelter, camping,
 * protected area, rock, forest, my rating, last visited, warnings) each need a table that
 * does not exist, and a disabled control for a feature three phases away teaches the
 * reader to stop opening the drawer. Three more are absent for a reason worth writing
 * down: `category` is accepted by the API and `route_category` is empty, so it would match
 * nothing at all; `shape` and the approach time have no parameter on GET /routes and no
 * data in their columns either. A filter that can only ever return zero rows is worse than
 * a missing one.
 *
 * Massif is here as the spec asks, and it moves the path rather than adding a second
 * `massif` to the query string. The path is what the map reads to decide which polygon is
 * open and which one to fit the camera to, so a query parameter beside it would be a
 * second opinion the screen could not reconcile: three massifs selected, one highlighted.
 *
 * The panel holds a draft and commits once. The alternative, writing the URL on every
 * keystroke, puts a history entry between "1" and "16" and makes the back button useless.
 */

interface Draft {
  massifId: string;
  maxTechnical: string;
  minKm: string;
  maxKm: string;
  minAscent: string;
  maxAscent: string;
  maxTrainH: string;
  sort: Sort;
}

type Errors = Partial<Record<keyof Draft, string>>;

const DECIMAL = /^\d{1,6}(\.\d{1,4})?$/;
const WHOLE = /^\d{1,7}$/;

const SORT_LABELS: Record<Sort, string> = {
  fit: 'Best fit',
  km: 'Shortest first',
  ascent: 'Least ascent first',
  difficulty: 'Easiest first',
  dayLength: 'Shortest day first',
  name: 'By name',
};

/** The technical grade runs 0 to 9 in `route_derived`, and these two are its ends. */
const TECHNICAL_GRADES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

function draftFrom(filters: FilterState, massifId: string): Draft {
  return {
    massifId,
    maxTechnical: filters.maxTechnical === undefined ? '' : String(filters.maxTechnical),
    minKm: filters.minKm ?? '',
    maxKm: filters.maxKm ?? '',
    minAscent: filters.minAscent === undefined ? '' : String(filters.minAscent),
    maxAscent: filters.maxAscent === undefined ? '' : String(filters.maxAscent),
    maxTrainH: filters.maxTrainH ?? '',
    sort: filters.sort ?? DEFAULT_SORT,
  };
}

/** How many drawer filters are on, for the label on the control that opens it. */
export function drawerCount(filters: FilterState): number {
  return [
    filters.maxTechnical,
    filters.minKm,
    filters.maxKm,
    filters.minAscent,
    filters.maxAscent,
    filters.maxTrainH,
  ].filter((value) => value !== undefined).length;
}

export function FilterDrawer({
  filters,
  massifId,
  apply,
  applyTo,
}: {
  filters: FilterState;
  massifId: string;
  apply: (next: FilterState) => void;
  applyTo: (massifId: string, next: FilterState) => void;
}): ReactNode {
  const { massifs } = useMapData();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(filters, massifId));
  const [errors, setErrors] = useState<Errors>({});

  const count = drawerCount(filters);
  const Chevron = open ? ChevronUp : ChevronDown;

  const gloss = createGloss();
  const options = massifs.status === 'ready' ? massifs.data : [];

  function change(field: Exclude<keyof Draft, 'sort'>, value: string): void {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  // Its own setter, because the select hands back a string and the draft holds a Sort.
  function chooseSort(value: string): void {
    if ((SORTS as readonly string[]).includes(value)) {
      setDraft((current) => ({ ...current, sort: value as Sort }));
    }
  }

  function toggle(): void {
    if (!open) {
      setDraft(draftFrom(filters, massifId));
      setErrors({});
    }
    setOpen(!open);
  }

  function submit(): void {
    const found = validate(draft);
    setErrors(found);
    if (Object.values(found).some((message) => message !== undefined)) return;

    const next: FilterState = {
      ...filters,
      maxTechnical: draft.maxTechnical === '' ? undefined : Number(draft.maxTechnical),
      minKm: draft.minKm === '' ? undefined : draft.minKm,
      maxKm: draft.maxKm === '' ? undefined : draft.maxKm,
      minAscent: draft.minAscent === '' ? undefined : Number(draft.minAscent),
      maxAscent: draft.maxAscent === '' ? undefined : Number(draft.maxAscent),
      maxTrainH: draft.maxTrainH === '' ? undefined : draft.maxTrainH,
      sort: draft.sort === DEFAULT_SORT ? undefined : draft.sort,
    };

    if (draft.massifId !== massifId) applyTo(draft.massifId, next);
    else apply(next);
    setOpen(false);
  }

  function clear(): void {
    const next = clearFilters(filters);
    setDraft(draftFrom(next, massifId));
    setErrors({});
    apply(next);
  }

  return (
    <div className="mt-3">
      <Button
        type="button"
        variant="outline"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className="w-auto justify-between px-4"
      >
        <span>
          More filters
          {count > 0 && (
            <span className="font-mono tabular-nums"> ({count})</span>
          )}
        </span>
        <Chevron aria-hidden strokeWidth={1.75} />
      </Button>

      {open && (
        <div id={panelId} className="mt-3 grid gap-5 rounded-md border p-4">
          <Field
            label="Massif"
            help="Opens that massif, keeping the filters you have set."
            control={(id) => (
              <NativeSelect
                id={id}
                value={draft.massifId}
                onChange={(event) => change('massifId', event.target.value)}
              >
                {options.length === 0 && <option value={massifId}>This massif</option>}
                {options.map((massif) => (
                  <option key={massif.id} value={massif.id}>
                    {gloss(massif.name)}
                  </option>
                ))}
              </NativeSelect>
            )}
          />

          <Field
            label="Technical grade at most"
            help="0 needs no hands. 9 is climbing."
            error={errors.maxTechnical}
            control={(id) => (
              <NativeSelect
                id={id}
                value={draft.maxTechnical}
                onChange={(event) => change('maxTechnical', event.target.value)}
              >
                <option value="">Any</option>
                {TECHNICAL_GRADES.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </NativeSelect>
            )}
          />

          <Pair
            legend="Distance"
            unit="km"
            help="A number like 16.5."
            from={{
              value: draft.minKm,
              error: errors.minKm,
              onChange: (value) => change('minKm', value),
            }}
            to={{
              value: draft.maxKm,
              error: errors.maxKm,
              onChange: (value) => change('maxKm', value),
            }}
            inputMode="decimal"
          />

          <Pair
            legend="Ascent"
            unit="m"
            help="Whole metres."
            from={{
              value: draft.minAscent,
              error: errors.minAscent,
              onChange: (value) => change('minAscent', value),
            }}
            to={{
              value: draft.maxAscent,
              error: errors.maxAscent,
              onChange: (value) => change('maxAscent', value),
            }}
            inputMode="numeric"
          />

          <Field
            label="Travel time at most"
            help="Hours on the train, one way. A number like 2.5."
            error={errors.maxTrainH}
            control={(id) => (
              <Input
                id={id}
                inputMode="decimal"
                value={draft.maxTrainH}
                aria-invalid={errors.maxTrainH !== undefined}
                onChange={(event) => change('maxTrainH', event.target.value)}
                className="font-mono tabular-nums"
              />
            )}
          />

          <Field
            label="Order"
            help="Best fit puts anything unusual for the season last, then the shortest days."
            control={(id) => (
              <NativeSelect
                id={id}
                value={draft.sort}
                onChange={(event) => chooseSort(event.target.value)}
              >
                {Object.entries(SORT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            )}
          />

          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button type="button" onClick={submit} className="w-auto flex-1 px-6">
              Apply
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={clear}
              className="w-auto flex-1 px-6"
            >
              Clear all
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Label above, helper text under the label, error below the control. */
function Field({
  label,
  help,
  error,
  control,
}: {
  label: string;
  help?: string;
  error?: string;
  control: (id: string) => ReactNode;
}): ReactNode {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {help !== undefined && (
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{help}</p>
      )}
      <div className="mt-2">{control(id)}</div>
      {error !== undefined && (
        <p role="alert" className="mt-2 text-sm leading-6 text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

interface Bound {
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

/** A lowest and a highest, which is how distance and ascent are actually chosen. */
function Pair({
  legend,
  unit,
  help,
  from,
  to,
  inputMode,
}: {
  legend: string;
  unit: string;
  help: string;
  from: Bound;
  to: Bound;
  inputMode: 'decimal' | 'numeric';
}): ReactNode {
  const fromId = useId();
  const toId = useId();

  return (
    <fieldset>
      <legend className="text-base leading-6 font-medium text-foreground">
        {legend} in {unit}
      </legend>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{help}</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={fromId} className="text-sm text-muted-foreground">
            From
          </Label>
          <Input
            id={fromId}
            inputMode={inputMode}
            value={from.value}
            aria-invalid={from.error !== undefined}
            onChange={(event) => from.onChange(event.target.value)}
            className="mt-1 font-mono tabular-nums"
          />
        </div>
        <div>
          <Label htmlFor={toId} className="text-sm text-muted-foreground">
            To
          </Label>
          <Input
            id={toId}
            inputMode={inputMode}
            value={to.value}
            aria-invalid={to.error !== undefined}
            onChange={(event) => to.onChange(event.target.value)}
            className="mt-1 font-mono tabular-nums"
          />
        </div>
      </div>
      {(from.error ?? to.error) !== undefined && (
        <p role="alert" className="mt-2 text-sm leading-6 text-destructive">
          {from.error ?? to.error}
        </p>
      )}
    </fieldset>
  );
}

/**
 * The same bounds the API's own DTO enforces, checked here so a typo is answered in place
 * rather than by a 400 the reader has to interpret.
 */
function validate(draft: Draft): Errors {
  const errors: Errors = {};

  for (const field of ['minKm', 'maxKm', 'maxTrainH'] as const) {
    const value = draft[field];
    if (value !== '' && !DECIMAL.test(value)) errors[field] = 'Use a number like 16.5.';
  }

  for (const field of ['minAscent', 'maxAscent'] as const) {
    const value = draft[field];
    if (value === '') continue;
    if (!WHOLE.test(value) || Number(value) > 10000) {
      errors[field] = 'Use whole metres, up to 10000.';
    }
  }

  if (
    errors.minKm === undefined &&
    errors.maxKm === undefined &&
    draft.minKm !== '' &&
    draft.maxKm !== '' &&
    Number(draft.minKm) > Number(draft.maxKm)
  ) {
    errors.minKm = 'The lowest distance is above the highest.';
  }

  if (
    errors.minAscent === undefined &&
    errors.maxAscent === undefined &&
    draft.minAscent !== '' &&
    draft.maxAscent !== '' &&
    Number(draft.minAscent) > Number(draft.maxAscent)
  ) {
    errors.minAscent = 'The lowest ascent is above the highest.';
  }

  return errors;
}
