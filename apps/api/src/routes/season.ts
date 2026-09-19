export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type SeasonName = (typeof SEASONS)[number];

const MONTH_IN_BUCHAREST = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Bucharest',
  month: 'numeric',
});

/**
 * The season a filter reads when the caller names none.
 *
 * Meteorological, not astronomical: March to May, June to August, September to November,
 * December to February. The catalogue's four season rows are about what the mountain is
 * like, and no route changes because of the solstice. Bucharest rather than the server's
 * clock, because the site is planned from Bucharest and a server in UTC would switch
 * season two or three hours late.
 */
export function currentSeason(now: Date = new Date()): SeasonName {
  const month = Number(MONTH_IN_BUCHAREST.format(now));
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}
