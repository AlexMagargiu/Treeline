import {
  formatAscentM,
  formatDistanceKm,
  formatDuration,
  formatEffortPoints,
  formatKcal,
  formatWhole,
} from './format';

// The strings the API actually sends. Numeric columns arrive as text, so every formatter
// is exercised with the text form first and the number form second.
describe('formatDistanceKm', () => {
  it('always shows one decimal', () => {
    expect(formatDistanceKm('16')).toBe('16.0 km');
    expect(formatDistanceKm('16.04')).toBe('16.0 km');
    expect(formatDistanceKm(16.05)).toBe('16.1 km');
  });

  it('cuts a stored value down to what a person reads', () => {
    expect(formatDistanceKm('2.5238095238095238')).toBe('2.5 km');
  });

  it('renders a hyphen when there is no value', () => {
    expect(formatDistanceKm(null)).toBe('-');
    expect(formatDistanceKm(undefined)).toBe('-');
    expect(formatDistanceKm('')).toBe('-');
    expect(formatDistanceKm('not a number')).toBe('-');
  });
});

describe('formatAscentM', () => {
  it('rounds to whole metres', () => {
    expect(formatAscentM('1050.00')).toBe('1050 m');
    expect(formatAscentM('1049.6')).toBe('1050 m');
    expect(formatAscentM(0)).toBe('0 m');
  });

  it('renders a hyphen when there is no value', () => {
    expect(formatAscentM(null)).toBe('-');
  });
});

describe('formatDuration', () => {
  it('turns a decimal hour into hours and minutes', () => {
    expect(formatDuration('8.3333333333333333')).toBe('8 h 20');
    expect(formatDuration(8.5)).toBe('8 h 30');
    expect(formatDuration('0.5')).toBe('0 h 30');
  });

  it('pads the minutes so a column lines up', () => {
    expect(formatDuration(2)).toBe('2 h 00');
    expect(formatDuration('2.05')).toBe('2 h 03');
  });

  it('carries into the hour when the minutes round up to sixty', () => {
    expect(formatDuration(1.9999)).toBe('2 h 00');
  });

  it('renders a hyphen when there is no value', () => {
    expect(formatDuration(undefined)).toBe('-');
  });
});

describe('formatEffortPoints', () => {
  it('shows one decimal', () => {
    expect(formatEffortPoints('26.5000000000000000')).toBe('26.5');
    expect(formatEffortPoints(26)).toBe('26.0');
  });
});

describe('formatWhole', () => {
  it('never shows a decimal', () => {
    expect(formatWhole('4')).toBe('4');
    expect(formatWhole(4.4)).toBe('4');
    expect(formatWhole('4.6')).toBe('5');
  });
});

describe('formatKcal', () => {
  it('shows whole kilocalories with no thousands separator', () => {
    expect(formatKcal('5720')).toBe('5720 kcal');
    expect(formatKcal(6830)).toBe('6830 kcal');
  });

  it('renders a hyphen when there is no value', () => {
    expect(formatKcal(null)).toBe('-');
  });
});

describe('every formatter', () => {
  // The em dash and en dash ban covers every shipped string, and a formatter's output is
  // one. The hyphen placeholder is the only dash any of them can produce.
  it('emits no em dash and no en dash', () => {
    const outputs = [
      formatDistanceKm(null),
      formatDistanceKm('16'),
      formatAscentM(null),
      formatDuration(null),
      formatDuration(8.33),
      formatEffortPoints(null),
      formatWhole(null),
      formatKcal(null),
    ].join('');
    expect(outputs).not.toMatch(/[\u2013\u2014]/);
  });
});
