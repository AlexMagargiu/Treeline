import {
  type FilterState,
  DEFAULT_SORT,
  activeCount,
  clearFilters,
  parseFilters,
  toApiQuery,
  toQueryString,
} from './filters';

const parse = (query: string): FilterState => parseFilters(new URLSearchParams(query));

/** The whole set, one value per filter, in the order toQueryString writes them. */
const EVERYTHING =
  'notWalked=true&season=winter&tripType=1+day&minQuiet=4&mode=train&maxDifficulty=5' +
  '&maxTechnical=2&minKm=5&maxKm=16.5&minAscent=200&maxAscent=1200&maxTrainH=2.5&sort=km';

describe('parseFilters', () => {
  it('reads every filter the drawer and the chips can set', () => {
    expect(parse(EVERYTHING)).toEqual({
      notWalked: true,
      season: 'winter',
      tripType: '1 day',
      minQuiet: 4,
      mode: 'train',
      maxDifficulty: 5,
      maxTechnical: 2,
      minKm: '5',
      maxKm: '16.5',
      minAscent: 200,
      maxAscent: 1200,
      maxTrainH: '2.5',
      sort: 'km',
    });
  });

  it('reads nothing out of an empty query string', () => {
    expect(parse('')).toEqual({});
  });

  it('keeps a distance as the string it was, so no double touches it', () => {
    const state = parse('minKm=5.25&maxKm=16.00&maxTrainH=0.4000');
    expect(state.minKm).toBe('5.25');
    expect(state.maxKm).toBe('16.00');
    expect(state.maxTrainH).toBe('0.4000');
  });

  it('drops a key the API does not take', () => {
    expect(parse('quiet=false&category=hiking&shape=loop&limit=1000&offset=50')).toEqual({});
  });

  it('drops a value outside what the API would accept', () => {
    expect(parse('maxDifficulty=11')).toEqual({});
    expect(parse('maxDifficulty=0')).toEqual({});
    expect(parse('maxTechnical=10')).toEqual({});
    expect(parse('minQuiet=6')).toEqual({});
    expect(parse('season=autumnal')).toEqual({});
    expect(parse('mode=helicopter')).toEqual({});
    expect(parse('tripType=3+days')).toEqual({});
    expect(parse('sort=nearest')).toEqual({});
    expect(parse('minKm=-4')).toEqual({});
    expect(parse('maxKm=sixteen')).toEqual({});
    expect(parse('maxAscent=1.5')).toEqual({});
  });

  it('takes notWalked only when it says true, because the chip is on or absent', () => {
    expect(parse('notWalked=true')).toEqual({ notWalked: true });
    expect(parse('notWalked=false')).toEqual({});
    expect(parse('notWalked=1')).toEqual({});
  });

  it('leaves the default sort unset, so reading it back does not grow a key', () => {
    expect(parse(`sort=${DEFAULT_SORT}`)).toEqual({});
  });
});

describe('toQueryString', () => {
  it('writes nothing for a set with nothing on', () => {
    expect(toQueryString({})).toBe('');
  });

  it('leaves no trace of a filter that is off', () => {
    expect(toQueryString({ maxDifficulty: 5 })).toBe('maxDifficulty=5');
  });

  it('leaves no trace of the default sort', () => {
    expect(toQueryString({ sort: DEFAULT_SORT })).toBe('');
    expect(toQueryString({ sort: 'name' })).toBe('sort=name');
  });

  it('writes the keys in one order whatever order the object holds them in', () => {
    const forwards = toQueryString({ notWalked: true, minQuiet: 4, sort: 'km' });
    const backwards = toQueryString({ sort: 'km', minQuiet: 4, notWalked: true });
    expect(forwards).toBe('notWalked=true&minQuiet=4&sort=km');
    expect(backwards).toBe(forwards);
  });
});

describe('the round trip, which is what makes a set a link', () => {
  it('restores the whole set exactly', () => {
    expect(toQueryString(parse(EVERYTHING))).toBe(EVERYTHING);
  });

  it.each([
    '',
    'notWalked=true',
    'season=summer',
    'tripType=1+long+day',
    'minQuiet=4',
    'mode=train',
    'maxDifficulty=5',
    'maxTechnical=0',
    'minKm=5&maxKm=16.5',
    'minAscent=0&maxAscent=1900',
    'maxTrainH=2.5',
    'sort=dayLength',
    'tripType=2+days&minQuiet=5&maxDifficulty=7&sort=ascent',
  ])('survives a paste of %p', (query) => {
    expect(toQueryString(parse(query))).toBe(query);
  });

  it('drops the noise a hand-edited link carries and keeps the rest', () => {
    expect(toQueryString(parse('quiet=false&maxDifficulty=5&category=hiking'))).toBe(
      'maxDifficulty=5',
    );
  });
});

describe('toApiQuery', () => {
  it('adds the massif and the limit, which the reader never sees', () => {
    expect(toApiQuery({ maxDifficulty: 5 }, 'bucegi-id')).toBe(
      'maxDifficulty=5&massif=bucegi-id&limit=200',
    );
  });

  it('asks for the whole massif when nothing is filtered', () => {
    expect(toApiQuery({}, 'bucegi-id')).toBe('massif=bucegi-id&limit=200');
  });

  it('never lets the query string override the massif in the path', () => {
    const query = toApiQuery(parse('massif=somewhere-else&maxKm=10'), 'bucegi-id');
    expect(new URLSearchParams(query).getAll('massif')).toEqual(['bucegi-id']);
  });
});

describe('activeCount and clearFilters', () => {
  it('counts the filters that are on and not the sort', () => {
    expect(activeCount({})).toBe(0);
    expect(activeCount({ sort: 'km' })).toBe(0);
    expect(activeCount(parse(EVERYTHING))).toBe(12);
  });

  it('clears the filters and keeps the sort, which is a way of reading, not a filter', () => {
    expect(clearFilters(parse(EVERYTHING))).toEqual({ sort: 'km' });
    expect(clearFilters({ maxDifficulty: 5 })).toEqual({});
  });
});
