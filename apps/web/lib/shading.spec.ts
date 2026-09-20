import {
  BASEMAP_LAND,
  SHADING_CLASSES,
  SHADING_OPACITY,
  SHADING_RAMP,
  THEMES,
  shadingClass,
  shadingSwatch,
} from './shading';

/** sRGB to linear, for the OKLab lightness below. */
function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/**
 * OKLab L. The `dataviz` skill says the check for a sequential ramp is lightness
 * monotonicity, not the adjacency check a categorical palette gets, so that is what this
 * measures.
 */
function lightness(hex: string): number {
  const [r, g, b] = channels(hex).map(linear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
}

/** What the eye actually sees: the ramp step mixed over the basemap land colour. */
function composited(hex: string, land: string, opacity: number): string {
  const fg = channels(hex);
  const bg = channels(land);
  return (
    '#' +
    fg
      .map((value, i) => Math.round(value * opacity + bg[i] * (1 - opacity)))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')
  );
}

describe('the shading classes', () => {
  it('covers every count from one upwards with no gap and no overlap', () => {
    for (let count = 1; count <= 200; count += 1) {
      const matches = SHADING_CLASSES.filter(
        (band) => count >= band.from && (band.to === null || count <= band.to),
      );
      expect(matches).toHaveLength(1);
    }
  });

  it('puts the fifteen seeded massifs in every class', () => {
    const seeded = [64, 32, 19, 16, 12, 11, 9, 5, 4, 3, 3, 2, 2, 2, 1];
    const perClass = SHADING_CLASSES.map(
      (_, index) => seeded.filter((count) => shadingClass(count) === index).length,
    );
    expect(perClass).toEqual([4, 4, 2, 3, 2]);
  });

  it('places the ends where the legend says they are', () => {
    expect(shadingClass(1)).toBe(0);
    expect(shadingClass(2)).toBe(0);
    expect(shadingClass(3)).toBe(1);
    expect(shadingClass(23)).toBe(3);
    expect(shadingClass(24)).toBe(4);
    expect(shadingClass(64)).toBe(4);
  });

  it('shades nothing when there is nothing to shade', () => {
    expect(shadingClass(0)).toBeNull();
    expect(shadingClass(-1)).toBeNull();
    expect(shadingClass(Number.NaN)).toBeNull();
  });

  it('labels every class without an em dash or an en dash', () => {
    for (const band of SHADING_CLASSES) {
      expect(band.label).not.toMatch(/[\u2013\u2014]/);
    }
  });
});

describe('the ramp', () => {
  it('has one step per class in every theme', () => {
    for (const theme of THEMES) {
      expect(SHADING_RAMP[theme]).toHaveLength(SHADING_CLASSES.length);
    }
  });

  it('changes lightness in one direction only, once composited over the basemap', () => {
    for (const theme of THEMES) {
      const steps = SHADING_RAMP[theme].map((hex) =>
        lightness(composited(hex, BASEMAP_LAND[theme], SHADING_OPACITY[theme])),
      );
      // Dark flips the anchor, so the direction is read off the ends rather than assumed.
      const rising = steps[steps.length - 1] > steps[0];
      for (let i = 1; i < steps.length; i += 1) {
        expect(rising ? steps[i] > steps[i - 1] : steps[i] < steps[i - 1]).toBe(true);
      }
    }
  });

  it('separates every adjacent pair by enough lightness to be seen', () => {
    for (const theme of THEMES) {
      const steps = SHADING_RAMP[theme].map((hex) =>
        lightness(composited(hex, BASEMAP_LAND[theme], SHADING_OPACITY[theme])),
      );
      for (let i = 1; i < steps.length; i += 1) {
        expect(Math.abs(steps[i] - steps[i - 1])).toBeGreaterThan(0.05);
      }
    }
  });

  it('mixes the swatch in the same proportion the map paints', () => {
    expect(shadingSwatch('light', 0)).toBe('color-mix(in srgb, #e5caae 78%, #eaeef1)');
    expect(shadingSwatch('contrast', 4)).toBe('color-mix(in srgb, #582d00 82%, #f4f5f6)');
  });
});
