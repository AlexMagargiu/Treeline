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

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { credentials: 'same-origin', signal });
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
  routes: RouteListItem[];
}
