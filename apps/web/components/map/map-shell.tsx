'use client';

import type {
  GeoJSONSource,
  LngLatBoundsLike,
  Map as MapLibreMap,
  MapMouseEvent,
} from 'maplibre-gl';
import { useParams, useRouter } from 'next/navigation';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { Massif } from '@/lib/api';
import type { ThemeName } from '@/lib/shading';

import { MapAttribution } from './map-attribution';
import { type MapState, MapPlaceholder } from './map-placeholder';
import {
  MASSIF_FILL,
  MASSIF_SELECTED,
  MASSIF_SOURCE,
  type MassifCollection,
  buildStyle,
  elevationLayers,
  elevationSources,
  selectedMassifFilter,
  toMassifCollection,
} from './map-style';
import { BottomSheet, SheetProvider, type SheetRest, restHeightPx } from '../sheet/bottom-sheet';
import { type Resource, useResource } from '../use-resource';
import { useThemeName } from '../use-theme-name';
import './map.css';

/**
 * The map is the spine of this product, so it lives in the layout and not in a page.
 *
 * A country map opens into a massif and a massif into a trail. Next.js keeps a layout's
 * subtree mounted across a navigation between its children, so holding the MapLibre
 * instance here means a route change swaps what the sheet shows and the map is never torn
 * down. Put it inside a page component instead and every navigation costs a fresh WebGL
 * context, a fresh style and a fresh set of tile requests.
 *
 * It also must not block first paint. Nothing above is imported at the module top level
 * except types. `maplibre-gl` is 20 MB unpacked and its stylesheet is 81 KB, and both are
 * fetched inside an effect once the shell is already on screen.
 */

/** The country the map opens on. A bounding box, not a figure on a screen. */
const ROMANIA_BOUNDS: LngLatBoundsLike = [
  [20.22, 43.6],
  [29.75, 48.3],
];

/** Below this the contour and terrain archives hold nothing, so they are not asked for. */
const ELEVATION_ZOOM = 9;

interface MapData {
  massifs: Resource<Massif[]>;
  reload: () => void;
}

const MapDataContext = createContext<MapData | null>(null);

export function useMapData(): MapData {
  const value = useContext(MapDataContext);
  if (value === null) throw new Error('useMapData needs a MapShell above it.');
  return value;
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** The corners of a Polygon or a MultiPolygon, without pulling in a geometry library. */
function boundsOf(geometry: { coordinates: unknown }): LngLatBoundsLike | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return;
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      west = Math.min(west, node[0]);
      east = Math.max(east, node[0]);
      south = Math.min(south, node[1]);
      north = Math.max(north, node[1]);
      return;
    }
    for (const child of node) walk(child);
  };
  walk(geometry.coordinates);

  return Number.isFinite(west)
    ? [
        [west, south],
        [east, north],
      ]
    : null;
}

export function MapShell({ children }: { children: ReactNode }): ReactNode {
  const theme = useThemeName();
  const router = useRouter();
  const params = useParams<{ massifId?: string; routeId?: string }>();
  const selectedId = params.massifId ?? null;
  const onTrail = params.routeId !== undefined;

  const { state: massifs, reload } = useResource<Massif[]>('/api/massifs');
  const [rest, setRest] = useState<SheetRest>('peek');
  const [ready, setReady] = useState(false);
  const [broken, setBroken] = useState(false);

  /* The URL decides which massif is open, and two effects below read it without depending
     on it, so it is kept on a ref beside the state. */
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const elevationOn = useRef(false);

  const collection = useMemo<MassifCollection>(
    () => toMassifCollection(massifs.status === 'ready' ? massifs.data : []),
    [massifs],
  );

  /*
   * What the effects below read without wanting to re-run when it changes. Assigned during
   * render rather than in an effect, because the effect that builds the map runs before
   * any effect that would fill it in.
   */
  const latest = useRef({ theme, collection, router });
  latest.current = { theme, collection, router };

  /** Sources and layers the elevation archives add, put back after a style is replaced. */
  const attachElevation = useCallback((instance: MapLibreMap, forTheme: ThemeName): void => {
    for (const [id, source] of Object.entries(elevationSources())) {
      if (!instance.getSource(id)) instance.addSource(id, source);
    }
    for (const { layer, before } of elevationLayers(forTheme)) {
      if (instance.getLayer(layer.id)) continue;
      instance.addLayer(layer, instance.getLayer(before) ? before : undefined);
    }
    elevationOn.current = true;
  }, []);

  /* The map, created once and never again for the life of the shell. */
  useEffect(() => {
    let live = true;
    let cleanup = (): void => {};

    void (async () => {
      try {
        const maplibre = await import('./maplibre-runtime');
        if (!live || container.current === null) return;

        const protocol = new maplibre.Protocol();
        maplibre.addProtocol('pmtiles', protocol.tile);

        const instance = new maplibre.Map({
          container: container.current,
          style: buildStyle(latest.current.theme, latest.current.collection),
          bounds: ROMANIA_BOUNDS,
          /*
           * The controls that float over the map are ours. MapLibre's own attribution
           * control is a 24 px target and carries the library's grey, and every target in
           * this product is at least 48 px and wears our tokens.
           */
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          maxZoom: 14,
        });
        instance.touchZoomRotate.disableRotation();
        map.current = instance;

        let loaded = false;

        const onZoom = (): void => {
          if (!elevationOn.current && instance.getZoom() >= ELEVATION_ZOOM) {
            attachElevation(instance, latest.current.theme);
          }
        };
        const onClick = (
          event: MapMouseEvent & { features?: { properties: unknown }[] },
        ): void => {
          const properties = event.features?.[0]?.properties as { id?: string } | undefined;
          if (properties?.id) latest.current.router.push(`/massif/${properties.id}`);
        };
        const cursor = (value: string) => (): void => {
          instance.getCanvas().style.cursor = value;
        };

        instance.on('load', () => {
          loaded = true;
          if (live) setReady(true);
          onZoom();
        });
        /*
         * A tile that is not there is not a broken map: the contour and terrain archives
         * cover Bucegi only, so asking them for anywhere else is expected to come back
         * empty. Only a failure before the style ever loaded means there is no map.
         */
        instance.on('error', () => {
          if (!loaded && live) setBroken(true);
        });
        instance.on('zoomend', onZoom);
        instance.on('click', MASSIF_FILL, onClick);
        instance.on('mouseenter', MASSIF_FILL, cursor('pointer'));
        instance.on('mouseleave', MASSIF_FILL, cursor(''));

        cleanup = () => {
          instance.remove();
          maplibre.removeProtocol('pmtiles');
          map.current = null;
          elevationOn.current = false;
        };
      } catch {
        // The library did not load, or the browser has no WebGL. Either way there is no
        // map, and the screen says so rather than leaving the ground colour up forever.
        if (live) setBroken(true);
      }
    })();

    return () => {
      live = false;
      cleanup();
    };
  }, [attachElevation]);

  /* New massif data, pushed into the source the style already declared. */
  useEffect(() => {
    const instance = map.current;
    if (instance === null || !ready) return;
    const source = instance.getSource(MASSIF_SOURCE) as GeoJSONSource | undefined;
    source?.setData(collection);
  }, [collection, ready]);

  /*
   * A theme change rebuilds the style, not the map. `setStyle` drops every source the old
   * style declared, so the elevation layers go back on once the new one has settled.
   */
  useEffect(() => {
    const instance = map.current;
    if (instance === null || !ready) return;

    const wasOn = elevationOn.current;
    elevationOn.current = false;
    instance.setStyle(buildStyle(theme, latest.current.collection));

    const settle = (): void => {
      if (!instance.isStyleLoaded()) return;
      instance.off('styledata', settle);
      instance.setFilter(MASSIF_SELECTED, selectedMassifFilter(selectedIdRef.current));
      if (wasOn) attachElevation(instance, theme);
    };
    instance.on('styledata', settle);
    return () => {
      instance.off('styledata', settle);
    };
  }, [theme, ready, attachElevation]);

  /*
   * Opening a massif raises the sheet to its summary, opening a trail raises it the rest of
   * the way, and going back drops it to peek. The trail takes the tallest rest the list
   * already uses rather than a fourth of its own, which is the one it will keep.
   */
  useEffect(() => {
    setRest(selectedId === null ? 'peek' : onTrail ? 'list' : 'summary');
  }, [selectedId, onTrail]);

  useEffect(() => {
    const instance = map.current;
    if (instance === null || !ready) return;

    instance.setFilter(MASSIF_SELECTED, selectedMassifFilter(selectedId));

    const open =
      massifs.status === 'ready'
        ? (massifs.data.find((massif) => massif.id === selectedId) ?? null)
        : null;
    const bounds =
      selectedId === null ? ROMANIA_BOUNDS : open?.geometry ? boundsOf(open.geometry) : null;
    if (bounds === null) return;

    instance.fitBounds(bounds, {
      padding: {
        top: 24,
        right: 24,
        left: 24,
        // Keep the massif clear of the sheet it is about to open underneath.
        bottom: Math.round(restHeightPx(selectedId === null ? 'peek' : 'summary')) + 24,
      },
      maxZoom: selectedId === null ? 8 : 12,
      duration: reducedMotion() ? 0 : 600,
    });
  }, [selectedId, ready, massifs]);

  const sheet = useMemo(() => ({ rest, setRest }), [rest]);
  const data = useMemo(() => ({ massifs, reload }), [massifs, reload]);

  const offline = massifs.status === 'failed' && massifs.kind === 'offline';
  const mapState: MapState | null = offline
    ? 'offline'
    : broken
      ? 'failed'
      : ready
        ? null
        : 'loading';

  return (
    <MapDataContext.Provider value={data}>
      <div className="fixed inset-0 overflow-hidden">
        <div
          ref={container}
          role="region"
          aria-label="Map of Romania. Massifs are shaded by how many routes the catalogue knows in each."
          /*
           * `h-full w-full` and not only `inset-0`. MapLibre puts `.maplibregl-map` on this
           * element and its own stylesheet sets `position: relative` at the same
           * specificity as Tailwind's `absolute`. That sheet arrives in the map's async
           * chunk, so it is the later rule and it wins, and an element in normal flow with
           * `inset-0` and no content is zero pixels tall. An explicit size does not care
           * which of the two won.
           */
          className="treeline-map absolute inset-0 h-full w-full"
        />
        {mapState !== null && (
          <MapPlaceholder
            state={mapState}
            theme={theme}
            onRetry={() => (offline ? reload() : window.location.reload())}
          />
        )}
        <MapAttribution elevation={selectedId !== null} />
        <SheetProvider value={sheet}>
          <BottomSheet rest={rest} onRestChange={setRest} label="Map panel">
            {children}
          </BottomSheet>
        </SheetProvider>
      </div>
    </MapDataContext.Provider>
  );
}
