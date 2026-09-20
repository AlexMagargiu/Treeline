'use client';

import type { ReactNode } from 'react';

import {
  type FilterState,
  MODE_CHIP,
  ONE_DAY_CHIP,
  QUIET_CHIP,
  type SeasonName,
} from '@/lib/filters';
import { cn } from '@/lib/utils';

import { Chip } from './chip';

/** Where the difficulty chip starts when it is switched on. The middle of the 1 to 10 scale. */
const DIFFICULTY_DEFAULT = 5;
const DIFFICULTIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

interface FilterChipsProps {
  filters: FilterState;
  apply: (next: FilterState) => void;
  /** The season the server is in, taken off the last list response. Null until one arrives. */
  season: SeasonName | null;
  /** The server's own answer about whether it applied the not-walked filter. */
  notWalkedApplied: boolean;
  /** Whether every route in the list reads `normal` for the season being shown. */
  allNormal: boolean;
}

/**
 * The six chips, always visible above the list.
 *
 * Four of them cannot change the result set today, and the answer to that is neither to
 * hide them nor to fake them. They are shown, they write the parameter they say they
 * write, and one line under the row names the ones that are currently on and cannot narrow
 * anything yet. One line, once, rather than a badge on every chip, because a chip that
 * carries an apology is a chip nobody reads.
 *
 * Two of the three claims in that line are read back from the data rather than asserted:
 * the server answers `notWalkedApplied`, and whether every route reads normal this season
 * is counted off the rows on screen. The third, that every access point in the catalogue
 * is a station, is the one statement made from what the seed holds (370 of 370 rows are
 * `train`) rather than from the response, because the list endpoint does not return a
 * route's access modes. If a car access point is ever added, that clause goes.
 */
export function FilterChips({
  filters,
  apply,
  season,
  notWalkedApplied,
  allNormal,
}: FilterChipsProps): ReactNode {
  const difficultyOn = filters.maxDifficulty !== undefined;

  const set = (patch: FilterState): void => apply({ ...filters, ...patch });

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Chip
          pressed={filters.notWalked === true}
          onClick={() => set({ notWalked: filters.notWalked === true ? undefined : true })}
        >
          Not walked
        </Chip>

        <Chip
          pressed={filters.season !== undefined}
          disabled={season === null && filters.season === undefined}
          onClick={() =>
            set({ season: filters.season !== undefined ? undefined : (season ?? undefined) })
          }
        >
          {filters.season === undefined || filters.season === season
            ? 'In season now'
            : `Season: ${capitalise(filters.season)}`}
        </Chip>

        <Chip
          pressed={filters.tripType === ONE_DAY_CHIP}
          onClick={() =>
            set({ tripType: filters.tripType === ONE_DAY_CHIP ? undefined : ONE_DAY_CHIP })
          }
        >
          Fits one day
        </Chip>

        <Chip
          pressed={filters.minQuiet === QUIET_CHIP}
          onClick={() =>
            set({ minQuiet: filters.minQuiet === QUIET_CHIP ? undefined : QUIET_CHIP })
          }
        >
          Quiet
        </Chip>

        <Chip
          pressed={filters.mode === MODE_CHIP}
          onClick={() => set({ mode: filters.mode === MODE_CHIP ? undefined : MODE_CHIP })}
        >
          Reachable by train
        </Chip>

        <Chip
          pressed={difficultyOn}
          // Only while the scale is rendered: aria-controls pointing at nothing is worse
          // than none, because a screen reader offers a jump that lands on the page itself.
          aria-controls={difficultyOn ? 'difficulty-scale' : undefined}
          aria-expanded={difficultyOn}
          onClick={() =>
            set({ maxDifficulty: difficultyOn ? undefined : DIFFICULTY_DEFAULT })
          }
        >
          {difficultyOn ? `Difficulty at most ${filters.maxDifficulty}` : 'Difficulty'}
        </Chip>
      </div>

      {/*
        Ten targets rather than a slider. docs/design.md puts every target at 48 px and says
        no control may need precision, and a slider handle is the one control on a phone
        that does. Every value is one tap from every other value, which a stepper is not.
      */}
      {difficultyOn && (
        <fieldset id="difficulty-scale" className="mt-3">
          <legend className="text-sm text-muted-foreground">
            Show routes rated up to, out of 10
          </legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DIFFICULTIES.map((value) => {
              const chosen = filters.maxDifficulty === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={chosen}
                  onClick={() => set({ maxDifficulty: value })}
                  className={cn(
                    'min-h-12 min-w-12 flex-1 rounded-md border font-mono text-base tabular-nums transition-colors active:translate-y-px',
                    chosen
                      ? 'border-primary bg-primary font-medium text-primary-foreground'
                      : 'border-input bg-card text-foreground',
                  )}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <InertNote
        filters={filters}
        notWalkedApplied={notWalkedApplied}
        allNormal={allNormal}
      />
    </div>
  );
}

/** The one line that says which of the chips now on cannot narrow the list yet. */
function InertNote({
  filters,
  notWalkedApplied,
  allNormal,
}: {
  filters: FilterState;
  notWalkedApplied: boolean;
  allNormal: boolean;
}): ReactNode {
  const inert: { name: string; because: string }[] = [];

  if (filters.notWalked === true && !notWalkedApplied) {
    inert.push({ name: 'Not walked', because: 'no walk is recorded' });
  }
  if (filters.season !== undefined && allNormal) {
    inert.push({ name: 'In season now', because: 'every route here reads normal' });
  }
  if (filters.mode === MODE_CHIP) {
    // The gating column is route_access.mode, not access_point.kind. Say mode, so the
    // sentence stops being true the moment a bus or a car row appears, not only a car one.
    inert.push({ name: 'Reachable by train', because: 'every access row is a train' });
  }

  if (inert.length === 0) return null;

  return (
    <p className="mt-3 text-sm leading-6 text-muted-foreground">
      {list(inert.map((item) => item.name))} {inert.length === 1 ? 'changes' : 'change'}{' '}
      nothing yet, because {list(inert.map((item) => item.because))}.
    </p>
  );
}

/** `a`, `a and b`, `a, b and c`. */
function list(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
