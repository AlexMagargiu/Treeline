/**
 * The only way the browser talks to the API.
 *
 * Same origin and relative, because Caddy hands `/api/*` to Nest and everything else to
 * Next, so the path is identical with and without the proxy. That is also why there is no
 * base URL to configure and no `NEXT_PUBLIC_` variable to get wrong.
 *
 * The 401 matters more than it looks. The route guard in middleware.ts checks that a
 * session cookie is present and nothing else, because the cookie is an opaque id and only
 * Redis knows whether the session is still live. So an expired session reaches a screen,
 * and the first data call is where it is found out. That call sends the browser back to
 * the gate, which is the behaviour the guard's own comment promises.
 */

/** What went wrong, in the terms a screen has to answer in. */
export type FailureKind = 'offline' | 'unauthorized' | 'server';

export class ApiError extends Error {
  constructor(
    readonly kind: FailureKind,
    /** The HTTP status, or null when the request never got a reply. */
    readonly status: number | null,
    /** The API's own error code, when it sent one. */
    readonly code: string | null,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Where an expired session is sent, with the path to come back to. */
export function loginUrl(current: string): string {
  return `/login?next=${encodeURIComponent(current)}`;
}

interface ErrorBody {
  error?: { code?: string; message?: string };
}

async function readError(response: Response): Promise<ErrorBody> {
  try {
    return (await response.json()) as ErrorBody;
  } catch {
    return {};
  }
}

async function request(path: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, { credentials: 'same-origin', ...init });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError('offline', null, null, 'No connection.');
  }

  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      window.location.assign(loginUrl(window.location.pathname + window.location.search));
    }
    throw new ApiError('unauthorized', 401, 'no_session', 'The session expired.');
  }

  if (!response.ok) {
    const body = await readError(response);
    throw new ApiError(
      'server',
      response.status,
      body.error?.code ?? null,
      body.error?.message ?? 'The server could not answer.',
    );
  }

  return response;
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await request(path, { signal });
  return (await response.json()) as T;
}

/**
 * A write, which is the other half of the trail page and of a saved set.
 *
 * The same failure handling as `apiGet`, because a 401 on a save has to reach the gate the
 * same way a 401 on a read does. `DELETE /saved-filters/:id` answers 204 with no body, so
 * an empty reply resolves to undefined rather than throwing on a JSON parse; callers that
 * expect nothing back type it as void.
 */
export async function apiSend<T>(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<T> {
  const response = await request(path, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  });

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** A massif as `GET /api/massifs` returns it. The array is bare, with no envelope. */
export interface Massif {
  id: string;
  name: string;
  /** "osm" or "own". Ten of the fifteen polygons are the project's own hand drawn work. */
  source: string | null;
  licence: string | null;
  routesKnown: number;
  routesWalked: number;
  lastVisitedAt: string | null;
  geometry: { type: string; coordinates: unknown } | null;
}

/**
 * A route as `GET /api/routes` returns it.
 *
 * `km`, `dayLengthH` and `effortPoints` are strings and stay strings. The view keeps full
 * numeric precision and the API prints it as text so nothing is lost on the way out, which
 * means a double never sees them. Never sort or compare them here: "9.00" sorts after
 * "16.00". The server has `sort=km` and `sort=dayLength` for that.
 */
export interface RouteListItem {
  id: string;
  nameRo: string;
  nameEn: string | null;
  massif: { id: string; name: string };
  km: string;
  ascentM: number;
  dayLengthH: string | null;
  overallDifficulty: number;
  season: { season: string; status: string; overall: number | null } | null;
}

export interface RouteList {
  total: number;
  limit: number;
  offset: number;
  season: string;
  /**
   * False, and false for the whole of phase 1. `visit` arrives in phase 4, so the server
   * accepts the chip's parameter and says plainly that it narrowed nothing. The screen
   * reads this rather than knowing it, so the chip tells the truth by itself the day the
   * server starts applying it.
   */
  notWalkedApplied: boolean;
  routes: RouteListItem[];
}

/** A saved set: a name and the query string it stands for, stored verbatim by the API. */
export interface SavedFilter {
  id: string;
  name: string;
  query: string;
  createdAt: string;
}

/** One of the four rows of `route_season`. Stored numbers, not derived ones. */
export interface RouteSeason {
  season: string;
  hikingDifficulty: number;
  technicalGrade: number;
  overall: number;
  requiredGear: string[];
  daylightNote: string | null;
  status: string;
  note: string | null;
  setBy: string;
  setOn: string;
}

export interface RouteCategory {
  category: string;
  isPrimary: boolean;
  setBy: string;
  setOn: string;
}

export interface RouteAccess {
  accessPointId: string;
  name: string;
  kind: string;
  role: string;
  mode: string;
  approachMin: number | null;
  altitudeM: number | null;
  note: string | null;
}

/**
 * The derived block, every figure of it computed by the view `route_derived`.
 *
 * All the numerics arrive as text and stay text. Correcting a distance moves every one of
 * them, which is the whole reason the view exists, and formatting is the only thing the
 * browser is allowed to do to them.
 */
export interface RouteDerived {
  trainH: string | null;
  met: string;
  movingNowH: string;
  movingFitH: string;
  dayLengthH: string | null;
  effortPoints: string;
  hikingDifficulty: number;
  technicalScore: number;
  overallDifficulty: number;
  stage: number;
  tripType: string | null;
  kcal: string | null;
  kcalLow: string | null;
  kcalHigh: string | null;
  kcalNet: string | null;
  kcalNetLow: string | null;
  kcalNetHigh: string | null;
}

/** A route as `GET /api/routes/:id` and `PATCH /api/routes/:id` both return it. */
export interface RouteDetail {
  id: string;
  seedId: number | null;
  nameRo: string;
  nameEn: string | null;
  massif: { id: string; name: string };
  km: string;
  ascentM: number;
  terrain: string;
  technical: string;
  quiet: number;
  confidence: string;
  seasonWindow: string;
  shape: string | null;
  notes: string | null;
  season: { season: string; status: string; overall: number | null } | null;
  categories: RouteCategory[];
  seasons: RouteSeason[];
  access: RouteAccess[];
  derived: RouteDerived | null;
}
