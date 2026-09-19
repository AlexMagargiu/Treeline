// Loads the curated catalogue: 15 massifs, 31 stations, 185 routes, 370 access rows, 740
// season rows and the one profile. The fixtures in prisma/fixtures are the source of
// truth and this script does not second-guess them. A row that will not load is a finding
// to report, not a fixture to edit.
//
// Everything runs inside one transaction, so a half-loaded catalogue cannot exist, and
// everything upserts on a natural key, so a second run leaves the same row counts.
//
// Rule 1 of CLAUDE.md keeps spatial queries in src/spatial/*.repository.ts. This is a
// one-shot script rather than a service, so its inserts stay here and no src/spatial is
// created for them. Every geometry still goes through $queryRaw with ST_GeomFromText or
// ST_MakePoint, because Prisma cannot write a geography column at all.
//
// Nothing here computes a derived value. The four season rows read their difficulties
// back out of route_derived, so the seed cannot disagree with the view and a corrected
// distance moves the difficulty by itself.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';

const FIXTURES = join(__dirname, 'fixtures');

const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;

// The sheet's Confidence column: H high, M medium, V verify on a map before you go.
const CONFIDENCE: Record<string, string> = { H: 'high', M: 'medium', V: 'verify' };

// The fixtures write "drawn" where they mean the project's own work. GeometrySource
// admits only osm and own, and the note column carries the detail the enum cannot.
const SOURCE: Record<string, string> = { osm: 'osm', drawn: 'own', own: 'own' };

// The user's figures. They make the energy columns non-null from the first page load.
const WEIGHT_KG = '130';
const PACK_KG = '5';

/**
 * stations.csv spells a station in ASCII and station-points.csv spells it with the
 * diacritics, so the join key is the name with its combining marks stripped. Romanian
 * ș ț ă â î all decompose under NFD, whether they are written with a comma below or a
 * cedilla, and the fold is a bijection over the 31 rows of each file.
 */
function fold(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** routes.csv quotes the fields that contain a comma, so a split on commas will not do. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') field += char;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

type Row = Record<string, string>;

function readFixture(name: string): Row[] {
  const rows = parseCsv(readFileSync(join(FIXTURES, name), 'utf8'));
  const header = rows[0];
  return rows
    .slice(1)
    .map((row) => Object.fromEntries(header.map((column, i) => [column, row[i] ?? ''])));
}

/** A missing lookup is a fixture the seed cannot load, which the prompt says to report. */
function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`no ${what}`);
  return value;
}

function blank(value: string): string | null {
  return value.trim() === '' ? null : value;
}

async function seed(tx: Prisma.TransactionClient) {
  // Massifs. The polygon is WKT in EPSG:4326, rebuilt and simplified by the fixture
  // build, and is inserted as written.
  const massifs = readFixture('massifs.csv');
  const massifRows = await tx.$queryRaw<{ id: string; name: string }[]>(Prisma.sql`
    INSERT INTO massif (name, area, source, licence, note)
    VALUES ${Prisma.join(
      massifs.map(
        (massif) => Prisma.sql`(
          ${massif.name},
          ST_GeomFromText(${massif.wkt}, 4326)::geography,
          ${must(SOURCE[massif.source], `source mapping for ${massif.source}`)}::geometry_source,
          ${massif.licence}::licence,
          ${blank(massif.note)})`,
      ),
    )}
    ON CONFLICT (name) DO UPDATE SET
      area = EXCLUDED.area,
      source = EXCLUDED.source,
      licence = EXCLUDED.licence,
      note = EXCLUDED.note,
      updated_at = now()
    RETURNING id, name`);
  const massifId = new Map(massifRows.map((massif) => [massif.name, massif.id]));

  // Stations. access_point carries no unique index on the name, so rather than add one
  // this prompt does not authorise, the insert is guarded by NOT EXISTS, the rows already
  // there are updated, and the map is read back afterwards.
  const points = readFixture('station-points.csv');
  const values = Prisma.join(
    points.map(
      (point) => Prisma.sql`(
        ${point.name_ro},
        ${Number(point.lat)}::double precision,
        ${Number(point.lon)}::double precision,
        ${blank(point.note)},
        ${must(SOURCE[point.source], `source mapping for ${point.source}`)}::geometry_source,
        ${point.licence}::licence)`,
    ),
  );

  await tx.$executeRaw(Prisma.sql`
    INSERT INTO access_point (kind, name, point, note, source, licence)
    SELECT 'station'::access_point_kind, v.name,
           ST_SetSRID(ST_MakePoint(v.lon, v.lat), 4326)::geography,
           v.note, v.source, v.licence
    FROM (VALUES ${values}) AS v(name, lat, lon, note, source, licence)
    WHERE NOT EXISTS (
      SELECT 1 FROM access_point a WHERE a.kind = 'station' AND a.name = v.name)`);

  await tx.$executeRaw(Prisma.sql`
    UPDATE access_point a SET
      point = ST_SetSRID(ST_MakePoint(v.lon, v.lat), 4326)::geography,
      note = v.note,
      source = v.source,
      licence = v.licence,
      updated_at = now()
    FROM (VALUES ${values}) AS v(name, lat, lon, note, source, licence)
    WHERE a.kind = 'station' AND a.name = v.name`);

  const pointRows = await tx.$queryRaw<{ id: string; name: string }[]>`
    SELECT id, name FROM access_point WHERE kind = 'station'`;
  // Keyed on the folded name, because stations.csv and routes.csv both spell it in ASCII.
  const pointId = new Map(pointRows.map((point) => [fold(point.name), point.id]));

  // The station row itself. train_h is the hours from Bucuresti Nord the derived view
  // reads; it is passed as text and cast, never through a JavaScript number.
  const stations = readFixture('stations.csv');
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO station (access_point_id, train_h, changes, line, note)
    VALUES ${Prisma.join(
      stations.map(
        (station) => Prisma.sql`(
          ${must(pointId.get(fold(station.Station)), `station point for ${station.Station}`)}::uuid,
          ${station['Train h from Bucuresti Nord']}::numeric,
          ${Number(station.Changes)},
          ${blank(station.Line)},
          ${blank(station.Note)})`,
      ),
    )}
    ON CONFLICT (access_point_id) DO UPDATE SET
      train_h = EXCLUDED.train_h,
      changes = EXCLUDED.changes,
      line = EXCLUDED.line,
      note = EXCLUDED.note`);

  // Routes. name_ro comes from route-names.csv and the massif from route-massif.csv, both
  // keyed on the sheet's ID, which becomes route.seed_id. Only the catalogue's own
  // columns are stored: everything from MET rightwards in the sheet is derived and
  // belongs to the view. source and licence are own, because these are the user's own
  // research and no route has geometry yet.
  const routes = readFixture('routes.csv');
  const nameRo = new Map(readFixture('route-names.csv').map((row) => [row.seed_id, row.name_ro]));
  const routeMassif = new Map(
    readFixture('route-massif.csv').map((row) => [row.seed_id, row.massif]),
  );

  const routeRows = await tx.$queryRaw<{ id: string; seed_id: number }[]>(Prisma.sql`
    INSERT INTO route (massif_id, name_ro, km, ascent_m, terrain, technical, quiet,
                       confidence, season_window, walk_min, bus_min, notes,
                       source, licence, seed_id)
    VALUES ${Prisma.join(
      routes.map((route) => {
        const massif = must(routeMassif.get(route.ID), `massif for route ${route.ID}`);
        return Prisma.sql`(
          ${must(massifId.get(massif), `massif ${massif}`)}::uuid,
          ${must(nameRo.get(route.ID), `name for route ${route.ID}`)},
          ${route.Km}::numeric,
          ${Number(route['Ascent m'])},
          ${route.Terrain}::terrain,
          ${route.Technical}::technical,
          ${Number(route['Quiet 1-5'])},
          ${must(CONFIDENCE[route.Confidence], `confidence ${route.Confidence}`)}::confidence,
          ${route.Season},
          ${Number(route['Walk to start min'])},
          ${Number(route['Bus min'])},
          ${blank(route.Notes)},
          'own'::geometry_source,
          'own'::licence,
          ${Number(route.ID)})`;
      }),
    )}
    ON CONFLICT (seed_id) DO UPDATE SET
      massif_id = EXCLUDED.massif_id,
      name_ro = EXCLUDED.name_ro,
      km = EXCLUDED.km,
      ascent_m = EXCLUDED.ascent_m,
      terrain = EXCLUDED.terrain,
      technical = EXCLUDED.technical,
      quiet = EXCLUDED.quiet,
      confidence = EXCLUDED.confidence,
      season_window = EXCLUDED.season_window,
      walk_min = EXCLUDED.walk_min,
      bus_min = EXCLUDED.bus_min,
      notes = EXCLUDED.notes,
      source = EXCLUDED.source,
      licence = EXCLUDED.licence,
      updated_at = now()
    RETURNING id, seed_id`);
  const routeId = new Map(routeRows.map((route) => [route.seed_id, route.id]));

  // One row per route per end. 154 of the 185 routes start and finish at the same
  // station and get two rows, which the composite key allows because the roles differ.
  // approach_min stays null: the sheet's walk minutes live on the route.
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO route_access (route_id, access_point_id, role, mode)
    VALUES ${Prisma.join(
      routes.flatMap((route) => {
        const id = must(routeId.get(Number(route.ID)), `route ${route.ID}`);
        const at = (name: string) =>
          must(pointId.get(fold(name)), `station ${name} for route ${route.ID}`);
        return [
          Prisma.sql`(${id}::uuid, ${at(route['Start station'])}::uuid,
                      'start'::access_role, 'train'::access_mode)`,
          Prisma.sql`(${id}::uuid, ${at(route['Finish station'])}::uuid,
                      'finish'::access_role, 'train'::access_mode)`,
        ];
      }),
    )}
    ON CONFLICT (route_id, access_point_id, role) DO UPDATE SET mode = EXCLUDED.mode`);

  // Four rows per route, read straight out of the view. All four are normal deliberately:
  // the sheet's Season column is an availability window, not a judgement about danger, and
  // nobody has walked these routes in winter to say otherwise. The window itself is on
  // route.season_window and the trail page shows it verbatim beside these rows.
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO route_season (route_id, season, hiking_difficulty, technical_grade, overall,
                              required_gear, status, set_by, set_on)
    SELECT d.route_id, s.season, d.hiking_difficulty, d.technical_score, d.overall_difficulty,
           ARRAY[]::text[], 'normal'::season_status, 'seed', now()
    FROM route_derived d
    JOIN route r ON r.id = d.route_id AND r.seed_id IS NOT NULL
    CROSS JOIN (VALUES ${Prisma.join(
      SEASONS.map((season) => Prisma.sql`(${season}::season)`),
    )}) AS s(season)
    ON CONFLICT (route_id, season) DO UPDATE SET
      hiking_difficulty = EXCLUDED.hiking_difficulty,
      technical_grade = EXCLUDED.technical_grade,
      overall = EXCLUDED.overall,
      required_gear = EXCLUDED.required_gear,
      status = EXCLUDED.status,
      set_by = EXCLUDED.set_by,
      set_on = EXCLUDED.set_on`);

  // owner_id takes its column default, the one seed user. home_clip_m keeps its default
  // of 500, the distance an export clips from each end of a track.
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO profile (weight_kg, pack_kg)
    VALUES (${WEIGHT_KG}::numeric, ${PACK_KG}::numeric)
    ON CONFLICT (owner_id) DO UPDATE SET
      weight_kg = EXCLUDED.weight_kg,
      pack_kg = EXCLUDED.pack_kg,
      updated_at = now()`);
}

async function counts(tx: Prisma.TransactionClient) {
  return tx.$queryRaw<Record<string, bigint>[]>`
    SELECT (SELECT count(*) FROM massif)       AS massif,
           (SELECT count(*) FROM access_point) AS access_point,
           (SELECT count(*) FROM station)      AS station,
           (SELECT count(*) FROM route)        AS route,
           (SELECT count(*) FROM route_access) AS route_access,
           (SELECT count(*) FROM route_season) AS route_season,
           (SELECT count(*) FROM profile)      AS profile`;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const [loaded] = await prisma.$transaction(
      async (tx) => {
        await seed(tx);
        return counts(tx);
      },
      { maxWait: 30_000, timeout: 300_000 },
    );
    for (const [table, count] of Object.entries(loaded)) {
      console.log(`${table.padEnd(12)} ${count}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
