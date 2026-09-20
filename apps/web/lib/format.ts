/**
 * Every number on a screen is formatted here and nowhere else.
 *
 * The view `route_derived` keeps full numeric precision on purpose, so that correcting a
 * distance moves every figure that depends on it, and the API returns those columns as
 * text rather than as floats so no precision is lost on the way out. That makes
 * `2.5238095238095238` a storage value, and it must never reach a screen.
 *
 * Nothing here groups thousands. docs/design.md writes the energy figures as 6830 and
 * 5120, and a separator in a column of four digit kcal figures buys nothing.
 */

/** What a missing or unparseable value renders as. Hyphen, never an en dash. */
const ABSENT = '-';

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** `16.0 km`. One decimal always, so a column of distances lines up. */
export function formatDistanceKm(value: string | number | null | undefined): string {
  const km = toNumber(value);
  return km === null ? ABSENT : `${km.toFixed(1)} km`;
}

/** `1050 m`. Whole metres: the source data is not accurate to a centimetre. */
export function formatAscentM(value: string | number | null | undefined): string {
  const metres = toNumber(value);
  return metres === null ? ABSENT : `${Math.round(metres)} m`;
}

/**
 * `8 h 20`. Hours and minutes, never a decimal hour.
 *
 * Nobody standing on a platform at 05:40 converts 8.33 h in their head, and the
 * spreadsheet this catalogue came from is the only reason the value is a decimal at all.
 * Minutes are zero padded so a column of durations lines up with tabular figures.
 */
export function formatDuration(hours: string | number | null | undefined): string {
  const value = toNumber(hours);
  if (value === null) return ABSENT;

  const totalMinutes = Math.round(value * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

/** `26.5`. One decimal, matching the precision the effort scale is defined at. */
export function formatEffortPoints(value: string | number | null | undefined): string {
  const points = toNumber(value);
  return points === null ? ABSENT : points.toFixed(1);
}

/** Difficulty and stage. Whole numbers, never a decimal. */
export function formatWhole(value: string | number | null | undefined): string {
  const number = toNumber(value);
  return number === null ? ABSENT : String(Math.round(number));
}

/**
 * `25 min`. The walk from the platform to where the trail starts.
 *
 * Minutes, not a decimal hour and not `0 h 25`: an approach is a short walk and nobody
 * thinks of it in hours. `route_access.approach_min` is null on all 370 seeded rows, so
 * today this renders the absent marker every time, which is the honest answer.
 */
export function formatApproachMin(value: string | number | null | undefined): string {
  const minutes = toNumber(value);
  return minutes === null ? ABSENT : `${Math.round(minutes)} min`;
}

/** `5700 kcal`. The view has already rounded these to the nearest ten. */
export function formatKcal(value: string | number | null | undefined): string {
  const kcal = toNumber(value);
  return kcal === null ? ABSENT : `${Math.round(kcal)} kcal`;
}
