import { type Flavor, layers, namedFlavor } from '@protomaps/basemaps';
import type {
  FilterSpecification,
  LayerSpecification,
  SourceSpecification,
  StyleSpecification,
} from 'maplibre-gl';

import {
  BASEMAP_LAND,
  SHADING_OPACITY,
  SHADING_RAMP,
  type ThemeName,
  shadingClass,
} from '@/lib/shading';
import type { Massif } from '@/lib/api';

/**
 * The style, built once per theme.
 *
 * Every source below is copied from infra/tiles/README.md rather than guessed, because a
 * style that guesses them renders nothing and says nothing about why. The terrain is
 * Mapbox Terrain-RGB and not Terrarium: the wrong encoding draws a psychedelic mess
 * instead of raising an error, so it is worth being explicit about.
 *
 * The URLs are relative to whatever origin the page is on. Caddy serves /tiles/* from a
 * read-only volume on the same host, so the map never carries a hostname and works
 * unchanged on localhost and on the box.
 */

export const BASEMAP_SOURCE = 'romania';
export const CONTOUR_SOURCE = 'bucegi-contours';
export const TERRAIN_SOURCE = 'bucegi-terrain';

export const MASSIF_SOURCE = 'massifs';
export const MASSIF_FILL = 'massif-fill';
export const MASSIF_EDGE = 'massif-edge';
export const MASSIF_SELECTED = 'massif-selected';
export const HILLSHADE_LAYER = 'hillshade';
export const CONTOUR_INDEX_LAYER = 'contours-index';
export const CONTOUR_MINOR_LAYER = 'contours-minor';

/** Paste these, do not invent your own. Both licences require credit. */
export const OSM_ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap</a>';
export const DEM_ATTRIBUTION_SHORT = 'Elevation: Copernicus DEM © DLR e.V., Airbus DS, EU and ESA';
export const DEM_ATTRIBUTION_FULL =
  '© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under ' +
  'COPERNICUS by the European Union and ESA, all rights reserved';

/**
 * The ground under the data.
 *
 * A choropleth wants the only colour on the screen to be the one carrying the count, so
 * the basemap is pushed into the neutral family the tokens already use: no green landuse,
 * no cyan water, nothing that competes with the umber wash. One neutral family, cool,
 * matching docs/design.md, and never pure black or pure white.
 */
interface Ground {
  land: string;
  sea: string;
  green: string;
  built: string;
  boundary: string;
  ink: string;
  inkQuiet: string;
  halo: string;
}

const GROUND: Record<ThemeName, Ground> = {
  light: {
    land: BASEMAP_LAND.light,
    sea: '#ccd8e0',
    green: '#e1e7e9',
    built: '#dfe4e8',
    boundary: '#b6c2cb',
    ink: '#3b4a57',
    inkQuiet: '#6a7b88',
    halo: '#eaeef1',
  },
  dark: {
    land: BASEMAP_LAND.dark,
    sea: '#0e161d',
    green: '#18212a',
    built: '#1b242e',
    boundary: '#3a4a59',
    ink: '#8fa3b4',
    inkQuiet: '#67798a',
    halo: '#0d141b',
  },
  contrast: {
    land: BASEMAP_LAND.contrast,
    sea: '#d5dde2',
    green: '#eceff1',
    built: '#e6eaed',
    boundary: '#5a6773',
    ink: '#0a0e12',
    inkQuiet: '#2a3138',
    halo: '#f4f5f6',
  },
};

/** Which named flavour each theme starts from before the ground above is applied. */
const BASE_FLAVOR: Record<ThemeName, string> = {
  light: 'grayscale',
  dark: 'black',
  contrast: 'grayscale',
};

function flavorFor(theme: ThemeName): Flavor {
  const g = GROUND[theme];
  return {
    ...namedFlavor(BASE_FLAVOR[theme]),
    background: g.sea,
    earth: g.land,
    water: g.sea,
    ocean_label: g.inkQuiet,
    glacier: g.built,
    sand: g.land,
    beach: g.land,
    park_a: g.green,
    park_b: g.green,
    wood_a: g.green,
    wood_b: g.green,
    scrub_a: g.green,
    scrub_b: g.green,
    zoo: g.green,
    hospital: g.built,
    industrial: g.built,
    school: g.built,
    military: g.built,
    pedestrian: g.built,
    aerodrome: g.built,
    buildings: g.built,
    boundaries: g.boundary,
    city_label: g.ink,
    city_label_halo: g.halo,
    subplace_label: g.inkQuiet,
    subplace_label_halo: g.halo,
    state_label: g.inkQuiet,
    state_label_halo: g.halo,
    country_label: g.ink,
    roads_label_major: g.inkQuiet,
    roads_label_major_halo: g.halo,
    roads_label_minor: g.inkQuiet,
    roads_label_minor_halo: g.halo,
    address_label: g.inkQuiet,
    address_label_halo: g.halo,
  };
}

export interface MassifFeature {
  type: 'Feature';
  id: number;
  properties: {
    id: string;
    name: string;
    routesKnown: number;
    /** The class index the legend prints, or -1 when there is nothing to shade. */
    shadingClass: number;
  };
  geometry: { type: string; coordinates: unknown };
}

export interface MassifCollection {
  type: 'FeatureCollection';
  features: MassifFeature[];
}

/**
 * `GET /massifs` returns a bare geometry per massif, not a Feature, so the wrapping
 * happens here. The class index is computed once and travels in the properties, because
 * it does not depend on the theme and the style is rebuilt every time the theme changes.
 */
export function toMassifCollection(massifs: Massif[]): MassifCollection {
  return {
    type: 'FeatureCollection',
    features: massifs
      .filter((massif): massif is Massif & { geometry: NonNullable<Massif['geometry']> } =>
        massif.geometry !== null,
      )
      .map((massif, index) => ({
        type: 'Feature',
        id: index,
        properties: {
          id: massif.id,
          name: massif.name,
          routesKnown: massif.routesKnown,
          shadingClass: shadingClass(massif.routesKnown) ?? -1,
        },
        geometry: massif.geometry,
      })),
  };
}

/** Nothing selected. A filter that matches no feature, rather than a layer removed. */
export const NO_MASSIF: FilterSpecification = ['==', ['get', 'id'], ''];

export function selectedMassifFilter(massifId: string | null): FilterSpecification {
  return massifId === null ? NO_MASSIF : ['==', ['get', 'id'], massifId];
}

/** The accent, read off the token layer so the map can never disagree with the interface. */
function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function massifLayers(theme: ThemeName): LayerSpecification[] {
  const ramp = SHADING_RAMP[theme];
  const opacity = SHADING_OPACITY[theme];
  const accent = token('--primary');

  return [
    {
      id: MASSIF_FILL,
      type: 'fill',
      source: MASSIF_SOURCE,
      paint: {
        'fill-color': [
          'match',
          ['get', 'shadingClass'],
          0,
          ramp[0],
          1,
          ramp[1],
          2,
          ramp[2],
          3,
          ramp[3],
          4,
          ramp[4],
          'rgba(0, 0, 0, 0)',
        ],
        /*
         * The choropleth is a country zoom instrument. Once you are inside a massif the
         * terrain and the contours are what you are reading, so the wash gets out of the
         * way rather than tinting the relief.
         */
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 5, opacity, 9, opacity * 0.4, 10.5, 0.1],
      },
    },
    {
      /*
       * Ten of the fifteen polygons are drawn by hand and none of them is surveyed, so the
       * edge is a blurred wash rather than a hairline. A crisp border would claim a
       * precision that does not exist.
       */
      id: MASSIF_EDGE,
      type: 'line',
      source: MASSIF_SOURCE,
      paint: {
        'line-color': ramp[4],
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 2, 9, 4],
        'line-blur': ['interpolate', ['linear'], ['zoom'], 5, 3, 9, 6],
        'line-opacity': 0.6,
      },
    },
    {
      /* Selection is an interface state, so it wears the accent. The ramp never does. */
      id: MASSIF_SELECTED,
      type: 'line',
      source: MASSIF_SOURCE,
      filter: NO_MASSIF,
      paint: {
        'line-color': accent,
        'line-width': 3,
        'line-blur': 1.5,
        'line-opacity': 0.95,
      },
    },
  ];
}

export function buildStyle(theme: ThemeName, massifs: MassifCollection): StyleSpecification {
  const origin = window.location.origin;
  const flavor = flavorFor(theme);

  const all = layers(BASEMAP_SOURCE, flavor, { lang: 'en' });
  const labelIds = new Set(
    layers(BASEMAP_SOURCE, flavor, { lang: 'en', labelsOnly: true }).map((layer) => layer.id),
  );
  const ground = all.filter((layer) => !labelIds.has(layer.id));
  const labels = all.filter((layer) => labelIds.has(layer.id));

  return {
    version: 8,
    /*
     * Both self hosted. MapLibre draws no label at all without glyphs, and the Protomaps
     * default points at protomaps.github.io, which is the one external service that
     * self hosting the tiles exists to remove. See public/basemap/README.md.
     */
    glyphs: `${origin}/basemap/fonts/{fontstack}/{range}.pbf`,
    sprite: `${origin}/basemap/sprites/${BASE_FLAVOR[theme]}`,
    sources: {
      [BASEMAP_SOURCE]: {
        type: 'vector',
        url: `pmtiles://${origin}/tiles/romania.pmtiles`,
        attribution: OSM_ATTRIBUTION,
      },
      [MASSIF_SOURCE]: {
        type: 'geojson',
        data: massifs,
      },
    },
    layers: [...ground, ...massifLayers(theme), ...labels],
  };
}

/**
 * Contours and terrain, attached only once the map is inside a massif.
 *
 * Both archives cover Bucegi and nothing else, and neither has a tile below z10 and z8,
 * so at country zoom they would cost two archive header reads and return nothing. They
 * are added against layer ids this file owns, so the ordering stays decided in one place:
 * hillshade under the wash because it is ground, contours over it because they are read.
 */
export function elevationSources(): Record<string, SourceSpecification> {
  const origin = window.location.origin;
  return {
    [CONTOUR_SOURCE]: {
      type: 'vector',
      url: `pmtiles://${origin}/tiles/bucegi-contours.pmtiles`,
      attribution: DEM_ATTRIBUTION_SHORT,
    },
    [TERRAIN_SOURCE]: {
      type: 'raster-dem',
      url: `pmtiles://${origin}/tiles/bucegi-terrain.pmtiles`,
      // Mapbox, not Terrarium. rio-rgbify writes 512 pixel PNGs.
      encoding: 'mapbox',
      tileSize: 512,
      attribution: DEM_ATTRIBUTION_SHORT,
    },
  };
}

export function elevationLayers(theme: ThemeName): { layer: LayerSpecification; before: string }[] {
  const g = GROUND[theme];
  const contour = theme === 'dark' ? '#9a7f5e' : theme === 'contrast' ? '#6b512c' : '#9c8360';

  return [
    {
      layer: {
        id: HILLSHADE_LAYER,
        type: 'hillshade',
        source: TERRAIN_SOURCE,
        paint: {
          'hillshade-exaggeration': 0.4,
          'hillshade-shadow-color': theme === 'dark' ? '#000000' : g.ink,
          'hillshade-highlight-color': theme === 'dark' ? '#4e6272' : '#ffffff',
          'hillshade-accent-color': g.inkQuiet,
        },
      },
      before: MASSIF_FILL,
    },
    {
      /*
       * tippecanoe drops the densest lines to fit a tile at z10 and z11, so the minor
       * contours only earn their place once every line is actually there.
       */
      layer: {
        id: CONTOUR_MINOR_LAYER,
        type: 'line',
        source: CONTOUR_SOURCE,
        'source-layer': 'contours',
        minzoom: 12,
        filter: ['!=', ['%', ['get', 'elev'], 100], 0],
        paint: { 'line-color': contour, 'line-width': 0.6, 'line-opacity': 0.45 },
      },
      before: MASSIF_EDGE,
    },
    {
      layer: {
        id: CONTOUR_INDEX_LAYER,
        type: 'line',
        source: CONTOUR_SOURCE,
        'source-layer': 'contours',
        minzoom: 10,
        filter: ['==', ['%', ['get', 'elev'], 100], 0],
        paint: { 'line-color': contour, 'line-width': 1, 'line-opacity': 0.7 },
      },
      before: MASSIF_EDGE,
    },
  ];
}
