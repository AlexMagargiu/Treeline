import { currentSeason, SEASONS } from './season';

describe('currentSeason', () => {
  const at = (iso: string) => currentSeason(new Date(iso));

  it('names every month', () => {
    const months = Array.from({ length: 12 }, (_, i) =>
      at(`2026-${String(i + 1).padStart(2, '0')}-15T12:00:00Z`),
    );
    expect(months).toEqual([
      'winter',
      'winter',
      'spring',
      'spring',
      'spring',
      'summer',
      'summer',
      'summer',
      'autumn',
      'autumn',
      'autumn',
      'winter',
    ]);
  });

  it('answers every month with one of the four seasons', () => {
    for (let month = 1; month <= 12; month += 1) {
      const season = at(`2026-${String(month).padStart(2, '0')}-01T00:00:00Z`);
      expect(SEASONS).toContain(season);
    }
  });

  // Meteorological, not astronomical. Astronomical autumn starts on 22 September, and a
  // route does not change on the solstice.
  it('calls the middle of September autumn, not summer', () => {
    expect(at('2026-09-19T09:00:00Z')).toBe('autumn');
  });

  it('switches on the first of the month, not on the twenty first', () => {
    expect(at('2026-08-31T20:00:00Z')).toBe('summer');
    expect(at('2026-09-01T09:00:00Z')).toBe('autumn');
  });

  // Bucharest is two or three hours ahead of UTC, so the turn of a season happens there
  // first. A server reading its own UTC clock would still say winter here.
  it('turns the season on Bucharest time, not on UTC', () => {
    expect(at('2026-02-28T22:30:00Z')).toBe('spring');
  });

  it('keeps December with January and February', () => {
    expect(at('2026-12-01T12:00:00Z')).toBe('winter');
    expect(at('2026-12-31T12:00:00Z')).toBe('winter');
  });
});
