/**
 * Filter state, and the query string it is.
 *
 * docs/spec.md puts filter state in the URL so that a set is a link, and saved sets are
 * built on nothing more than that. So the URL is the state and this file is the only place
 * that knows how to read one and write the other. Two rules follow from "a set is a link"
 * and both are tested in filters.spec.ts:
 *
 *   - A filter that is off leaves no trace. `?quiet=false` is noise, and it would also make
 *     two URLs for one set, which breaks a saved set the moment the default changes.
 *   - The keys come out in one fixed order, so the same set is always the same string and
 *     toQueryString(parseFilters(s)) === s for any string this file wrote.
 *
 * The names are the API's own parameter names. A translation table between what the URL
 * calls a filter and what GET /routes calls it would be a second contract to keep in step,
 * and there is nothing to gain from the rename.
 *
 * Distances and travel times stay strings from the URL to the statement. The API casts
 * them to numeric in one parameterised query and docs/design.md keeps a double away from
 * the figures the view was written to hold exactly. The bounds that are int columns in the
 * API's own DTO are numbers here for the same reason: that is what they are.
 */

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type SeasonName = (typeof SEASONS)[number];

export const TRIP_TYPES = ['1 day', '1 long day', '2 days'] as const;
export type TripType = (typeof TRIP_TYPES)[number];

export const MODES = ['train', 'car', 'bus', 'mixed'] as const;
export type Mode = (typeof MODES)[number];

export const SORTS = ['fit', 'km', 'ascent', 'difficulty', 'dayLength', 'name'] as const;
export type Sort = (typeof SORTS)[number];

/** The server's own default. Writing it into the URL would be a trace of a filter that is off. */
export const DEFAULT_SORT: Sort = 'fit';

/** The chips hold one value each. They are here so the chip and the parser cannot drift. */
export const QUIET_CHIP = 4;
export const ONE_DAY_CHIP: TripType = '1 day';
export const MODE_CHIP: Mode = 'train';

/** What GET /routes accepts for a decimal bound: numeric(10,4) as the DTO writes it. */
const DECIMAL = /^\d{1,6}(\.\d{1,4})?$/;

export interface FilterState {
  /** Accepted and answered by the API, never applied: visit arrives in phase 4. */
  notWalked?: true;
  /** Which of the four season rows to read. The chip pins the current one. */
  season?: SeasonName;
  tripType?: TripType;
  minQuiet?: number;
  mode?: Mode;
  maxDifficulty?: number;
  maxTechnical?: number;
  minKm?: string;
  maxKm?: string;
  minAscent?: number;
  maxAscent?: number;
  maxTrainH?: string;
  sort?: Sort;
}

/**
 * The one order a set is ever written in. Chips first in the order they appear on screen,
 * then the drawer, then the sort, so a URL reads the way the panel does.
 */
const KEY_ORDER = [
  'notWalked',
  'season',
  'tripType',
  'minQuiet',
  'mode',
  'maxDifficulty',
  'maxTechnical',
  'minKm',
  'maxKm',
  'minAscent',
  'maxAscent',
  'maxTrainH',
  'sort',
] as const satisfies readonly (keyof FilterState)[];

function oneOf<T extends string>(allowed: readonly T[], value: string | null): T | undefined {
  return value !== null && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

function integer(value: string | null, low: number, high: number): number | undefined {
  if (value === null || !/^\d{1,7}$/.test(value)) return undefined;
  const parsed = Number(value);
  return parsed >= low && parsed <= high ? parsed : undefined;
}

function decimal(value: string | null): string | undefined {
  return value !== null && DECIMAL.test(value) ? value : undefined;
}

/**
 * A URL into a set, dropping anything the API would refuse.
 *
 * Silently rather than with an error. A pasted link with a stale or hand-edited parameter
 * should still open the massif it names, and a filter nobody can see is worse than one
 * that did not survive the paste. The bounds match the API's DTO exactly, so a state that
 * parses here is a state the statement accepts.
 */
export function parseFilters(params: URLSearchParams): FilterState {
  const state: FilterState = {};

  if (params.get('notWalked') === 'true') state.notWalked = true;

  const season = oneOf(SEASONS, params.get('season'));
  if (season !== undefined) state.season = season;

  const tripType = oneOf(TRIP_TYPES, params.get('tripType'));
  if (tripType !== undefined) state.tripType = tripType;

  const minQuiet = integer(params.get('minQuiet'), 1, 5);
  if (minQuiet !== undefined) state.minQuiet = minQuiet;

  const mode = oneOf(MODES, params.get('mode'));
  if (mode !== undefined) state.mode = mode;

  const maxDifficulty = integer(params.get('maxDifficulty'), 1, 10);
  if (maxDifficulty !== undefined) state.maxDifficulty = maxDifficulty;

  const maxTechnical = integer(params.get('maxTechnical'), 0, 9);
  if (maxTechnical !== undefined) state.maxTechnical = maxTechnical;

  const minKm = decimal(params.get('minKm'));
  if (minKm !== undefined) state.minKm = minKm;

  const maxKm = decimal(params.get('maxKm'));
  if (maxKm !== undefined) state.maxKm = maxKm;

  const minAscent = integer(params.get('minAscent'), 0, 10000);
  if (minAscent !== undefined) state.minAscent = minAscent;

  const maxAscent = integer(params.get('maxAscent'), 0, 10000);
  if (maxAscent !== undefined) state.maxAscent = maxAscent;

  const maxTrainH = decimal(params.get('maxTrainH'));
  if (maxTrainH !== undefined) state.maxTrainH = maxTrainH;

  // The default sort is not a filter that is on, so it never reaches the URL and reading
  // it back has to leave the field unset or the round trip grows a key it did not have.
  const sort = oneOf(SORTS, params.get('sort'));
  if (sort !== undefined && sort !== DEFAULT_SORT) state.sort = sort;

  return state;
}

/** A set as the query string it is: canonical order, nothing that is off, no leading "?". */
export function toQueryString(state: FilterState): string {
  const params = new URLSearchParams();

  for (const key of KEY_ORDER) {
    const value = state[key];
    if (value === undefined) continue;
    if (key === 'sort' && value === DEFAULT_SORT) continue;
    params.set(key, String(value));
  }

  return params.toString();
}

/**
 * The same set as the catalogue call, which is the browser's URL plus the two things the
 * reader never sees.
 *
 * `massif` comes from the path rather than the query, because the path is what the map
 * reads to decide which polygon is open, and a second copy in the query string could
 * disagree with it. `limit` is one call for the whole massif: the server caps it at 200
 * and the largest massif holds 64 routes, so paging would be machinery for a case that
 * cannot happen. Neither belongs in a saved set.
 */
export function toApiQuery(state: FilterState, massifId: string): string {
  const params = new URLSearchParams(toQueryString(state));
  params.set('massif', massifId);
  params.set('limit', '200');
  return params.toString();
}

/** The season the API says it read, narrowed to the four this app knows. */
export function toSeasonName(value: string | null | undefined): SeasonName | null {
  return value !== null && value !== undefined && (SEASONS as readonly string[]).includes(value)
    ? (value as SeasonName)
    : null;
}

/** How many filters are on, for the control that offers to clear them. Sort is not one. */
export function activeCount(state: FilterState): number {
  return KEY_ORDER.filter((key) => key !== 'sort' && state[key] !== undefined).length;
}

/** Clearing the filters keeps the sort, which is a way of reading the list, not a filter. */
export function clearFilters(state: FilterState): FilterState {
  return state.sort === undefined ? {} : { sort: state.sort };
}
