// The nine endpoints against the real stack: the seeded Postgres and Treeline's Redis,
// no mocks. The suite starts the API on an ephemeral port and drives it with fetch, so
// what it exercises is the whole HTTP path, cookies and headers included.
//
// It writes to a shared database, so everything it changes it puts back: the route it
// patches is restored to the distance it had, the edit_log rows it caused are deleted,
// its saved filters are deleted, and its Redis keys are removed. The existing
// route_derived suite rolls a transaction back; this one cannot, because it goes through
// HTTP, so it undoes itself instead.
//
// Every response shape is declared rather than read as any, so a change to the contract
// the frontend is about to be written against fails here at compile time.

import { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { AppModule } from '../src/app.module';

const PASSWORD = 'the-e2e-password-nobody-deploys';
const WRONG = 'not-the-password';

// Three addresses, because the rate limit counts per address and one test spends a whole
// window on purpose. X-Forwarded-For is what the API reads behind Caddy.
const CALLER = '203.0.113.11';
const GUESSER = '203.0.113.99';
const ELSEWHERE = '198.51.100.4';

const ROUTES = 185;
const MASSIFS = 15;
const OWNER = '00000000-0000-0000-0000-000000000001';

interface ErrorBody {
  error: { code: string; message: string };
}

interface Geometry {
  type: string;
  coordinates: unknown;
}

interface MassifBody {
  id: string;
  name: string;
  routesKnown: number;
  routesWalked: number;
  lastVisitedAt: string | null;
  geometry: Geometry | null;
}

interface SeasonBody {
  season: string;
  status: string;
  overall: number;
}

interface RouteBody {
  id: string;
  nameRo: string;
  massif: { id: string; name: string };
  km: string;
  ascentM: number;
  quiet: number;
  trainH: string | null;
  movingNowH: string;
  dayLengthH: string | null;
  effortPoints: string;
  hikingDifficulty: number;
  overallDifficulty: number;
  stage: number;
  tripType: string | null;
  kcal: string | null;
  kcalNet: string | null;
  season: SeasonBody;
}

interface RouteDetailBody extends RouteBody {
  categories: { category: string; isPrimary: boolean }[];
  seasons: { season: string }[];
  access: { name: string; role: string; point: Geometry | null }[];
  derived: { kcalLow: string | null; kcalNetHigh: string | null };
}

interface ListBody {
  total: number;
  limit: number;
  offset: number;
  season: string;
  notWalkedApplied: boolean;
  routes: RouteBody[];
}

interface LoginBody {
  token: string;
  expiresAt: string;
}

interface SessionBody {
  validUntil: string;
}

interface SavedFilterBody {
  id: string;
  name: string;
  query: string;
  createdAt: string;
}

interface Reply<T> {
  status: number;
  body: T;
  setCookie: string[];
  headers: Headers;
}

describe('api', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaClient;
  let redis: Redis;
  let cookie = '';
  let token = '';

  // The catalogue rows this suite changes, remembered so it can put them back.
  let patchedRouteId = '';
  let patchedRouteKm = '';
  const savedFilterIds: string[] = [];

  async function call<T>(
    path: string,
    init: RequestInit & { address?: string; auth?: 'cookie' | 'bearer' | 'none' } = {},
  ): Promise<Reply<T>> {
    const { address = CALLER, auth = 'cookie', ...rest } = init;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-forwarded-for': address,
      ...((rest.headers as Record<string, string>) ?? {}),
    };
    if (auth === 'cookie' && cookie) headers.cookie = cookie;
    if (auth === 'bearer' && token) headers.authorization = `Bearer ${token}`;

    const response = await fetch(`${base}${path}`, { ...rest, headers });
    const text = await response.text();
    return {
      status: response.status,
      body: (text ? JSON.parse(text) : null) as T,
      setCookie: response.headers.getSetCookie(),
      headers: response.headers,
    };
  }

  const login = <T>(password: string, address = CALLER) =>
    call<T>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
      address,
      auth: 'none',
    });

  beforeAll(async () => {
    // The hash is made here and never leaves the process, so no real password and no real
    // hash has to exist anywhere for the suite to run.
    process.env.TREELINE_PASSWORD_HASH = await hash(PASSWORD);
    process.env.LOGIN_MAX_ATTEMPTS = '5';
    process.env.LOGIN_WINDOW_MINUTES = '15';
    // Treeline's Redis publishes no host port on the box. Locally the untracked
    // docker-compose.override.yml binds it on the loopback, the same way it binds the
    // database for the prisma CLI, and REDIS_URL_HOST is that view of it.
    process.env.REDIS_URL = process.env.REDIS_URL_HOST ?? 'redis://127.0.0.1:56379';

    prisma = new PrismaClient();
    redis = new Redis(process.env.REDIS_URL);
    await redis.del(`login:${CALLER}`, `login:${GUESSER}`, `login:${ELSEWHERE}`);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    await app.listen(0);
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  }, 60_000);

  afterAll(async () => {
    if (patchedRouteId) {
      await prisma.route.update({
        where: { id: patchedRouteId },
        data: { km: patchedRouteKm },
      });
      await prisma.editLog.deleteMany({
        where: { tableName: 'route', rowId: patchedRouteId },
      });
    }
    if (savedFilterIds.length > 0) {
      await prisma.savedFilter.deleteMany({ where: { id: { in: savedFilterIds } } });
    }
    await redis.del(`login:${CALLER}`, `login:${GUESSER}`, `login:${ELSEWHERE}`);
    if (token) await redis.del(`session:${token}`);
    await redis.quit();
    await prisma.$disconnect();
    await app?.close();
  }, 60_000);

  describe('the password gate', () => {
    it('refuses a wrong password without saying why', async () => {
      const reply = await login<ErrorBody>(WRONG);
      expect(reply.status).toBe(401);
      expect(reply.body.error.code).toBe('invalid_password');
      expect(reply.body.error.message).toBe('Login failed.');
      expect(reply.setCookie).toEqual([]);
    });

    it('lets the right password in and sets the session cookie', async () => {
      const reply = await login<LoginBody>(PASSWORD);
      expect(reply.status).toBe(200);
      expect(typeof reply.body.token).toBe('string');
      expect(new Date(reply.body.expiresAt).getTime()).toBeGreaterThan(Date.now());

      const header = reply.setCookie.find((value) => value.startsWith('treeline_session='));
      expect(header).toBeDefined();
      expect(header).toContain('HttpOnly');
      expect(header).toContain('Secure');
      expect(header).toContain('SameSite=Lax');
      expect(header).toContain('Path=/');
      // The cookie carries the session id and nothing else.
      expect(header?.split(';')[0]).toBe(`treeline_session=${reply.body.token}`);

      token = reply.body.token;
      cookie = `treeline_session=${token}`;
    });

    it('reports the session for the cookie and for the bearer token', async () => {
      const byCookie = await call<SessionBody>('/api/auth/session');
      const byBearer = await call<SessionBody>('/api/auth/session', { auth: 'bearer' });
      expect([byCookie.status, byBearer.status]).toEqual([200, 200]);
      expect(new Date(byCookie.body.validUntil).getTime()).toBeGreaterThan(Date.now());
    });

    it('refuses every endpoint without a session', async () => {
      const paths = ['/api/auth/session', '/api/massifs', '/api/routes', '/api/saved-filters'];
      for (const path of paths) {
        const reply = await call<ErrorBody>(path, { auth: 'none' });
        expect([path, reply.status, reply.body.error.code]).toEqual([path, 401, 'no_session']);
      }
    });

    it('leaves the health check open', async () => {
      const reply = await call<{ status: string }>('/api/health', { auth: 'none' });
      expect([reply.status, reply.body]).toEqual([200, { status: 'ok' }]);
    });

    // Five attempts per address per fifteen minutes, failures and successes alike.
    it('rate limits the sixth attempt from one address', async () => {
      const codes: number[] = [];
      for (let i = 0; i < 5; i += 1) codes.push((await login<ErrorBody>(WRONG, GUESSER)).status);
      const sixth = await login<ErrorBody>(WRONG, GUESSER);
      codes.push(sixth.status);

      expect(codes).toEqual([401, 401, 401, 401, 401, 429]);
      expect(sixth.body.error.code).toBe('too_many_attempts');
      const retryAfter = Number(sixth.headers.get('retry-after'));
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(15 * 60);

      // Even the right password is refused once the window is spent.
      const seventh = await login<ErrorBody>(PASSWORD, GUESSER);
      expect(seventh.status).toBe(429);

      // One address locked out does not lock out another.
      const elsewhere = await login<ErrorBody>(WRONG, ELSEWHERE);
      expect(elsewhere.status).toBe(401);
    }, 60_000);
  });

  describe('GET /massifs', () => {
    it('returns every massif with its counts and a parsed polygon', async () => {
      const reply = await call<MassifBody[]>('/api/massifs');
      expect(reply.status).toBe(200);
      expect(reply.body).toHaveLength(MASSIFS);

      const known = reply.body.reduce((sum, massif) => sum + massif.routesKnown, 0);
      expect(known).toBe(ROUTES);

      for (const massif of reply.body) {
        // visit arrives in phase 4, so these two are the same for every massif.
        expect([massif.routesWalked, massif.lastVisitedAt]).toEqual([0, null]);
        if (massif.geometry === null) continue;
        // A parsed object, never the string ST_AsGeoJSON returned.
        expect(typeof massif.geometry).toBe('object');
        expect(massif.geometry.type).toBe('Polygon');
        expect(Array.isArray(massif.geometry.coordinates)).toBe(true);
      }
    });

    it('orders by routes known, descending', async () => {
      const reply = await call<MassifBody[]>('/api/massifs');
      const counts = reply.body.map((massif) => massif.routesKnown);
      expect(counts).toEqual([...counts].sort((a, b) => b - a));
    });
  });

  describe('GET /routes', () => {
    it('returns the whole catalogue, paged, with the current season', async () => {
      const reply = await call<ListBody>('/api/routes');
      expect(reply.status).toBe(200);
      expect(reply.body.total).toBe(ROUTES);
      expect(reply.body.limit).toBe(50);
      expect(reply.body.offset).toBe(0);
      expect(reply.body.routes).toHaveLength(50);
      expect(['spring', 'summer', 'autumn', 'winter']).toContain(reply.body.season);
      // visit arrives in phase 4, so the parameter is accepted and filters nothing.
      expect(reply.body.notWalkedApplied).toBe(false);
    });

    it('prints every derived figure as the database printed it, never as a float', async () => {
      const [route] = (await call<ListBody>('/api/routes?limit=1')).body.routes;
      const asText = ['km', 'trainH', 'movingNowH', 'dayLengthH', 'effortPoints', 'kcal', 'kcalNet'] as const;
      for (const field of asText) expect([field, typeof route[field]]).toEqual([field, 'string']);

      const asNumber = ['ascentM', 'quiet', 'hikingDifficulty', 'overallDifficulty', 'stage'] as const;
      for (const field of asNumber) expect([field, typeof route[field]]).toEqual([field, 'number']);

      // numeric(5,2), printed with both decimals, not rounded and not made a float.
      expect(route.km).toMatch(/^\d+\.\d{2}$/);
    });

    it('caps the limit at 200', async () => {
      const reply = await call<ListBody>('/api/routes?limit=500');
      expect(reply.body.limit).toBe(200);
      expect(reply.body.routes).toHaveLength(ROUTES);
    });

    it('narrows on a filter and keeps the total in step with the rows', async () => {
      const all = await call<ListBody>('/api/routes?limit=200');
      const easy = await call<ListBody>('/api/routes?maxDifficulty=3&limit=200');
      expect(easy.body.total).toBeLessThan(all.body.total);
      expect(easy.body.routes).toHaveLength(easy.body.total);
      for (const route of easy.body.routes) expect(route.season.overall).toBeLessThanOrEqual(3);
    });

    it('accepts a repeated massif and returns only those massifs', async () => {
      const massifs = (await call<MassifBody[]>('/api/massifs')).body.slice(0, 2);
      const ids = massifs.map((massif) => massif.id);
      const reply = await call<ListBody>(
        `/api/routes?massif=${ids[0]}&massif=${ids[1]}&limit=200`,
      );
      expect(reply.body.total).toBe(massifs[0].routesKnown + massifs[1].routesKnown);
      for (const route of reply.body.routes) expect(ids).toContain(route.massif.id);
    });

    // Nobody types s-comma and t-comma on a phone in the rain.
    it('matches a name with and without diacritics, in both directions', async () => {
      const [plain, accented, shouted] = await Promise.all([
        call<ListBody>('/api/routes?q=zarnesti'),
        call<ListBody>(`/api/routes?q=${encodeURIComponent('Zărnești')}`),
        call<ListBody>('/api/routes?q=ZARNESTI'),
      ]);
      const names = (reply: Reply<ListBody>) =>
        reply.body.routes.map((route) => route.nameRo).sort();
      expect(plain.body.total).toBeGreaterThan(0);
      expect(names(accented)).toEqual(names(plain));
      expect(names(shouted)).toEqual(names(plain));
    });

    it('sorts by distance as a number, not as text', async () => {
      const reply = await call<ListBody>('/api/routes?sort=km&limit=200');
      const km = reply.body.routes.map((route) => Number(route.km));
      expect(km).toEqual([...km].sort((a, b) => a - b));
    });

    it('puts the shortest day first when sorting by fit', async () => {
      const reply = await call<ListBody>('/api/routes?sort=fit&limit=200');
      const days = reply.body.routes
        .filter((route) => route.season.status === 'normal')
        .map((route) => Number(route.dayLengthH));
      expect(days).toEqual([...days].sort((a, b) => a - b));
    });

    it('refuses a filter value outside its range', async () => {
      const reply = await call<ErrorBody>('/api/routes?maxDifficulty=99');
      expect([reply.status, reply.body.error.code]).toEqual([400, 'invalid_request']);
    });
  });

  describe('GET /routes/:id', () => {
    it('opens a route with its categories, all four seasons, access and derived row', async () => {
      const [first] = (await call<ListBody>('/api/routes?limit=1')).body.routes;
      const reply = await call<RouteDetailBody>(`/api/routes/${first.id}`);
      expect(reply.status).toBe(200);
      expect(reply.body.id).toBe(first.id);
      expect(Array.isArray(reply.body.categories)).toBe(true);
      expect(reply.body.seasons).toHaveLength(4);
      // The current season first, the other three behind it.
      expect(reply.body.seasons[0].season).toBe(reply.body.season.season);
      expect(reply.body.access.length).toBeGreaterThan(0);
      expect(reply.body.access[0].point?.type).toBe('Point');
      // Both energy figures and both bands.
      expect(reply.body.derived.kcalLow).not.toBeNull();
      expect(reply.body.derived.kcalNetHigh).not.toBeNull();
    });

    it('answers route_not_found for an id that is not there', async () => {
      const reply = await call<ErrorBody>('/api/routes/00000000-0000-0000-0000-0000000000ff');
      expect([reply.status, reply.body.error.code]).toEqual([404, 'route_not_found']);
    });

    it('answers invalid_request for something that is not an id', async () => {
      const reply = await call<ErrorBody>('/api/routes/not-a-uuid');
      expect([reply.status, reply.body.error.code]).toEqual([400, 'invalid_request']);
    });
  });

  describe('PATCH /routes/:id', () => {
    const patch = <T>(id: string, body: unknown) =>
      call<T>(`/api/routes/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

    it('refuses a field that is not editable', async () => {
      const [first] = (await call<ListBody>('/api/routes?limit=1')).body.routes;
      const reply = await patch<ErrorBody>(first.id, { massifId: OWNER });
      expect([reply.status, reply.body.error.code]).toEqual([400, 'unknown_field']);
    });

    // The proof that the view owns the derivation: one corrected distance, and every
    // figure that depends on it moves in the same response.
    it('moves every derived figure when the distance is corrected', async () => {
      const route = await prisma.route.findFirstOrThrow({ where: { seedId: 52 } });
      patchedRouteId = route.id;
      patchedRouteKm = route.km.toString();

      const before = (await call<RouteDetailBody>(`/api/routes/${route.id}`)).body;
      const reply = await patch<RouteDetailBody>(route.id, { km: '24.00' });
      expect(reply.status).toBe(200);

      expect(reply.body.km).toBe('24.00');
      expect(reply.body.movingNowH).not.toBe(before.movingNowH);
      expect(reply.body.dayLengthH).not.toBe(before.dayLengthH);
      expect(reply.body.effortPoints).not.toBe(before.effortPoints);
      expect(reply.body.kcal).not.toBe(before.kcal);
      expect(reply.body.kcalNet).not.toBe(before.kcalNet);
      expect(reply.body.hikingDifficulty).toBeGreaterThan(before.hikingDifficulty);
      expect(reply.body.overallDifficulty).toBeGreaterThan(before.overallDifficulty);
      expect(reply.body.stage).toBeGreaterThan(before.stage);
      expect(reply.body.tripType).not.toBe(before.tripType);
    });

    it('writes one edit_log row for the change, with the owner against it', async () => {
      const rows = await prisma.editLog.findMany({
        where: { tableName: 'route', rowId: patchedRouteId },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].field).toBe('km');
      expect(rows[0].oldValue).toBe('16.00');
      expect(rows[0].newValue).toBe('24.00');
      expect(rows[0].by).toBe(OWNER);
    });

    // A form that posts every field should leave no trail until something moves.
    it('writes nothing for a field submitted with the value it already holds', async () => {
      const before = await prisma.editLog.count({ where: { rowId: patchedRouteId } });
      const reply = await patch<RouteDetailBody>(patchedRouteId, { km: '24' });
      expect(reply.status).toBe(200);
      expect(await prisma.editLog.count({ where: { rowId: patchedRouteId } })).toBe(before);
    });

    it('answers route_not_found for an id that is not there', async () => {
      const reply = await patch<ErrorBody>('00000000-0000-0000-0000-0000000000ff', { quiet: 3 });
      expect([reply.status, reply.body.error.code]).toEqual([404, 'route_not_found']);
    });
  });

  describe('saved filters', () => {
    const name = `e2e ${Date.now()}`;

    it('adds one to whatever this owner already has', async () => {
      const before = await call<SavedFilterBody[]>('/api/saved-filters');
      expect(before.status).toBe(200);

      const created = await call<SavedFilterBody>('/api/saved-filters', {
        method: 'POST',
        body: JSON.stringify({ name, query: 'maxDifficulty=4&sort=fit' }),
      });
      expect(created.status).toBe(201);
      expect(created.body.name).toBe(name);
      expect(created.body.query).toBe('maxDifficulty=4&sort=fit');
      savedFilterIds.push(created.body.id);

      const after = await call<SavedFilterBody[]>('/api/saved-filters');
      expect(after.body).toHaveLength(before.body.length + 1);
    });

    it('refuses a second filter with the same name', async () => {
      const reply = await call<ErrorBody>('/api/saved-filters', {
        method: 'POST',
        body: JSON.stringify({ name, query: 'sort=km' }),
      });
      expect([reply.status, reply.body.error.code]).toEqual([409, 'name_taken']);
    });

    it('deletes one, and answers 404 rather than 403 for an id it does not own', async () => {
      const id = savedFilterIds.pop() ?? '';
      const deleted = await call<null>(`/api/saved-filters/${id}`, { method: 'DELETE' });
      expect(deleted.status).toBe(204);

      const again = await call<ErrorBody>(`/api/saved-filters/${id}`, { method: 'DELETE' });
      expect([again.status, again.body.error.code]).toEqual([404, 'saved_filter_not_found']);
    });
  });

  // Last, because it ends the session everything above used.
  describe('POST /auth/logout', () => {
    it('ends the session and clears the cookie', async () => {
      const reply = await call<null>('/api/auth/logout', { method: 'POST' });
      expect(reply.status).toBe(204);
      expect(reply.setCookie.some((value) => value.startsWith('treeline_session='))).toBe(true);

      const after = await call<ErrorBody>('/api/auth/session');
      expect([after.status, after.body.error.code]).toEqual([401, 'no_session']);
    });

    it('succeeds when there is no session at all', async () => {
      const reply = await call<null>('/api/auth/logout', { method: 'POST', auth: 'none' });
      expect(reply.status).toBe(204);
    });
  });
});
