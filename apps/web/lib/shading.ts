/**
 * How the country map shades a massif.
 *
 * It shades by routes known. `GET /massifs` also returns `routesWalked` and
 * `lastVisitedAt`, and both are dead in phase 1: walked is zero for all fifteen massifs
 * and last visited is null for all fifteen, because `visit` arrives in phase 4. Shading
 * by either would paint fifteen identical polygons, so there is one measure and no
 * switch. The switch arrives with the first visit.
 *
 * Five classes on a doubling scale, not a linear ramp. The real distribution is 64, 32,
 * 19, 16, 12, 11, 9, 5, 4, 3, 3, 2, 2, 2, 1, so a linear ramp over 1 to 64 puts eleven of
 * the fifteen inside the bottom sixth of the scale and they stop being told apart. The
 * breaks below spread them 4, 4, 2, 3, 2 and the legend prints every one of them.
 *
 * Five is also inside the ceiling the `dataviz` skill sets: past about seven classes
 * adjacent steps blur into each other.
 */

export type ThemeName = 'light' | 'dark' | 'contrast';

export const THEMES: readonly ThemeName[] = ['light', 'dark', 'contrast'];

export interface ShadingClass {
  /** Lowest route count in the class. */
  readonly from: number;
  /** Highest route count, or null for the open top class. */
  readonly to: number | null;
  /** What the legend prints. Hyphen never appears here; "to" reads at a glance. */
  readonly label: string;
}

export const SHADING_CLASSES: readonly ShadingClass[] = [
  { from: 1, to: 2, label: '1 to 2' },
  { from: 3, to: 5, label: '3 to 5' },
  { from: 6, to: 11, label: '6 to 11' },
  { from: 12, to: 23, label: '12 to 23' },
  { from: 24, to: null, label: '24 or more' },
];

/**
 * The ramp, one hue, light to dark, per the `dataviz` rule for a sequential encoding.
 *
 * Umber, and deliberately not the accent. The topographic blue in docs/design.md is the
 * accent and it is also the colour of water on the basemap, so a blue ramp would say two
 * other things at once. The difficulty scale runs green to amber to red and is reserved
 * for it. Umber is the language of the paper topographic sheets docs/design.md names as
 * the reference, and it collides with nothing else on the screen.
 *
 * Dark flips the anchor: on a dark ground the darkest step is the brightest, so more
 * routes still reads as more ink. Measured in OKLab after compositing over the basemap
 * land colour below: every theme is monotonic, with steps of 0.074 to 0.104 lightness,
 * and the span from the lightest class to the darkest is 3.26 to 1 in light, 4.10 in
 * dark and 4.71 in high contrast.
 */
export const SHADING_RAMP: Record<ThemeName, readonly string[]> = {
  light: ['#e5caae', '#d0a980', '#b78853', '#97682f', '#714815'],
  dark: ['#483013', '#6a4820', '#8e6332', '#b2834f', '#d5a776'],
  contrast: ['#e5c6a6', '#cd9d68', '#ad742f', '#864f00', '#582d00'],
};

/** How much of the basemap shows through the wash. */
export const SHADING_OPACITY: Record<ThemeName, number> = {
  light: 0.78,
  dark: 0.78,
  contrast: 0.82,
};

/**
 * The land colour the basemap paints under the wash, and therefore the colour the ramp
 * composites against. The legend swatch mixes the same two values in the same proportion,
 * so what the legend shows is what the map draws.
 */
export const BASEMAP_LAND: Record<ThemeName, string> = {
  light: '#eaeef1',
  dark: '#141c24',
  contrast: '#f4f5f6',
};

/**
 * Which class a count falls in, or null when there is nothing to shade.
 *
 * No seeded massif has zero routes, but one could, and a massif with none is not the same
 * as a massif with one. Null draws the outline and leaves the fill off rather than
 * telling the reader it holds one or two.
 */
export function shadingClass(routesKnown: number): number | null {
  if (!Number.isFinite(routesKnown) || routesKnown < 1) return null;

  const index = SHADING_CLASSES.findIndex(
    (band) => routesKnown >= band.from && (band.to === null || routesKnown <= band.to),
  );
  return index === -1 ? null : index;
}

/**
 * The swatch as CSS. The browser mixes the two colours, so the ramp, the opacity and the
 * land colour above stay the only place any of this is decided.
 */
export function shadingSwatch(theme: ThemeName, index: number): string {
  const percent = Math.round(SHADING_OPACITY[theme] * 100);
  return `color-mix(in srgb, ${SHADING_RAMP[theme][index]} ${percent}%, ${BASEMAP_LAND[theme]})`;
}
