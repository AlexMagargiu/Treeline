// The derived view against the spreadsheet it replaces.
//
// The test loads the two CSV fixtures exported from the workbook, builds the eleven
// tables the view reads, queries route_derived and compares every derived value with the
// sheet's own. It runs inside one transaction and rolls back, so it leaves the database
// as it found it.
//
// Nothing here uses a JavaScript number for a derived value. A double cannot hold
// 6825.00 as the product of 6.3, 130 and 25/3, and that single value is the difference
// between 6830 and 6820 in the energy column. Every expected figure is an exact fraction
// of two BigInts, and the view is queried as text so that no precision is lost on the way
// out of Postgres either.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';

const FIXTURES = join(__dirname, '..', '..', '..', 'prisma', 'fixtures');

const ROUTES = 185;
const MASSES = [130, 120, 110, 100];
const ENERGY_VALUES = ROUTES * MASSES.length;

// The sheet's three hour columns are Excel doubles written out to fifteen significant
// digits, so what the file holds is not the number the formula defines: moving time is
// km / 3 and ascent / 350, and neither terminates. Exact equality against those three is
// therefore unreachable in any arithmetic. Measured over all 555 of them, the largest
// disagreement with exact arithmetic is 5.3e-14, all 555 agree to thirteen significant
// digits, and 20 disagree at fourteen, where the sheet's fifteenth digit is a half and
// rounds the other way. So the view is held to the contract exactly, and the sheet is
// reconciled with the contract at the precision the sheet carries. Every other column
// terminates and is compared for equality.
const SHEET_DIGITS = 13;

// Route 135, "Breaza terraces loop", starts and finishes at Breaza. The Stations sheet
// lists no Breaza, so the sheet's own lookup fell through to zero and that row understates
// the day by two train journeys. The user settled this on 2026-09-19: Breaza is a real
// station, 1.50 h from Bucuresti Nord, and stations.csv carries it. Three of the sheet's
// columns are therefore wrong for this one row, and for no other row. Any further
// disagreement is a finding, not a case to widen this exception with.
const BREAZA_SEED_ID = 135;
const BREAZA_TRAIN_H = '1.50';
const BREAZA_DAY_LENGTH_ADDED = '3.00';

const CONFIDENCE: Record<string, string> = { H: 'high', M: 'medium', V: 'verify' };

/** An exact value: a numerator over a positive denominator, never a float. */
interface Exact {
  n: bigint;
  d: bigint;
}

/** The exact value of a decimal string such as "1.60", "8" or "-3.5". */
function exact(text: string): Exact {
  const [whole, fraction = ''] = text.split('.');
  const sign = whole.startsWith('-') ? -1n : 1n;
  return {
    n: sign * BigInt(whole.replace('-', '') + fraction),
    d: 10n ** BigInt(fraction.length),
  };
}

function plus(a: Exact, b: Exact): Exact {
  return { n: a.n * b.d + b.n * a.d, d: a.d * b.d };
}

/** A decimal string as an integer count of hundredths. km and train_h carry two places. */
function hundredths(text: string): bigint {
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole + fraction.padEnd(2, '0'));
}

/** The value, correctly rounded half away from zero to `places` decimals. */
function fixed({ n, d }: Exact, places: number): string {
  const scaled = n * 10n ** BigInt(places);
  const remainder = scaled % d;
  let whole = scaled / d;
  if ((remainder < 0n ? -remainder : remainder) * 2n >= d) whole += n < 0n ? -1n : 1n;
  const sign = whole < 0n ? '-' : '';
  const digits = (whole < 0n ? -whole : whole).toString().padStart(places + 1, '0');
  return places === 0
    ? sign + digits
    : `${sign}${digits.slice(0, -places)}.${digits.slice(-places)}`;
}

/** The value rounded to `digits` significant digits. */
function significant(value: Exact, digits: number): string {
  const whole = value.n / value.d;
  const integerDigits = whole === 0n ? 0 : whole.toString().replace('-', '').length;
  return fixed(value, Math.max(digits - integerDigits, 0));
}

/** The value rounded to the nearest ten, a half away from zero, as the sheet rounds. */
function nearestTen({ n, d }: Exact): string {
  return `${fixed({ n, d: d * 10n }, 0)}0`;
}

const decimalsIn = (text: string): number => (text.split('.')[1] ?? '').length;

/** Both sides of every terminating column fit well inside six decimals. */
const plain = (text: string): string => fixed(exact(text), 6);

/** A lookup or a nullable column that the fixtures guarantee is present. */
function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`no ${what}`);
  return value;
}

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

interface Derived {
  seed_id: number;
  train_h: string | null;
  met: string;
  moving_now_h: string;
  moving_fit_h: string;
  day_length_h: string | null;
  effort_points: string;
  hiking_difficulty: number;
  technical_score: number;
  overall_difficulty: number;
  stage: number;
  trip_type: string | null;
  kcal: string | null;
  kcal_low: string | null;
  kcal_high: string | null;
  kcal_net: string | null;
  kcal_net_low: string | null;
  kcal_net_high: string | null;
}

/** Thrown to roll the transaction back once every row has been read out of it. */
class Rollback extends Error {}

async function load(tx: Prisma.TransactionClient, routes: Row[], stations: Row[]) {
  const massifNames = [...new Set(routes.map((route) => route.Massif))];
  const massifs = await tx.$queryRaw<{ id: string; name: string }[]>(Prisma.sql`
    INSERT INTO massif (name)
    VALUES ${Prisma.join(massifNames.map((name) => Prisma.sql`(${name})`))}
    RETURNING id, name`);
  const massifId = new Map(massifs.map((massif) => [massif.name, massif.id]));

  // The Stations sheet carries no coordinates, so the fixture has none either. The view
  // never reads the geometry, and inventing one would put a station somewhere it is not.
  const points = await tx.$queryRaw<{ id: string; name: string }[]>(Prisma.sql`
    INSERT INTO access_point (kind, name, point)
    VALUES ${Prisma.join(
      stations.map(
        (station) =>
          Prisma.sql`('station'::access_point_kind, ${station.Station},
                      ST_GeogFromText('SRID=4326;POINT(0 0)'))`,
      ),
    )}
    RETURNING id, name`);
  const pointId = new Map(points.map((point) => [point.name, point.id]));

  await tx.$executeRaw(Prisma.sql`
    INSERT INTO station (access_point_id, train_h, changes, line, note)
    VALUES ${Prisma.join(
      stations.map(
        (station) => Prisma.sql`(
          ${must(pointId.get(station.Station), `access point for ${station.Station}`)}::uuid,
          ${station['Train h from Bucuresti Nord']}::numeric,
          ${Number(station.Changes)},
          ${station.Line || null},
          ${station.Note || null})`,
      ),
    )}`);

  // source and licence are fixture values. These rows carry no geometry at all, and which
  // pair the seed writes is settled by the seed prompt, not here. The view reads neither.
  const inserted = await tx.$queryRaw<{ id: string; seed_id: number }[]>(Prisma.sql`
    INSERT INTO route (massif_id, name_ro, km, ascent_m, terrain, technical, quiet,
                       confidence, season_window, walk_min, bus_min, notes,
                       source, licence, seed_id)
    VALUES ${Prisma.join(
      routes.map(
        (route) => Prisma.sql`(
          ${must(massifId.get(route.Massif), `massif ${route.Massif}`)}::uuid,
          ${route.Route},
          ${route.Km}::numeric,
          ${Number(route['Ascent m'])},
          ${route.Terrain}::terrain,
          ${route.Technical}::technical,
          ${Number(route['Quiet 1-5'])},
          ${must(CONFIDENCE[route.Confidence], `confidence ${route.Confidence}`)}::confidence,
          ${route.Season},
          ${Number(route['Walk to start min'])},
          ${Number(route['Bus min'])},
          ${route.Notes || null},
          'own'::geometry_source,
          'own'::licence,
          ${Number(route.ID)})`,
      ),
    )}
    RETURNING id, seed_id`);
  const routeId = new Map(inserted.map((route) => [route.seed_id, route.id]));

  await tx.$executeRaw(Prisma.sql`
    INSERT INTO route_access (route_id, access_point_id, role, mode)
    VALUES ${Prisma.join(
      routes.flatMap((route) => {
        const id = must(routeId.get(Number(route.ID)), `route ${route.ID}`);
        const at = (name: string) => must(pointId.get(name), `station ${name}`);
        return [
          Prisma.sql`(${id}::uuid, ${at(route['Start station'])}::uuid,
                      'start'::access_role, 'train'::access_mode)`,
          Prisma.sql`(${id}::uuid, ${at(route['Finish station'])}::uuid,
                      'finish'::access_role, 'train'::access_mode)`,
        ];
      }),
    )}`);

  // pack_kg is zero, so the mass in the energy formula is the body mass alone and the
  // figures reproduce the sheet's four kcal columns.
  await tx.$executeRaw`INSERT INTO profile (weight_kg, pack_kg) VALUES (130, 0)`;
}

function query(tx: Prisma.TransactionClient) {
  return tx.$queryRaw<Derived[]>`
    SELECT r.seed_id,
           d.train_h::text       AS train_h,
           d.met::text           AS met,
           d.moving_now_h::text  AS moving_now_h,
           d.moving_fit_h::text  AS moving_fit_h,
           d.day_length_h::text  AS day_length_h,
           d.effort_points::text AS effort_points,
           d.hiking_difficulty,
           d.technical_score,
           d.overall_difficulty,
           d.stage,
           d.trip_type,
           d.kcal::text          AS kcal,
           d.kcal_low::text      AS kcal_low,
           d.kcal_high::text     AS kcal_high,
           d.kcal_net::text      AS kcal_net,
           d.kcal_net_low::text  AS kcal_net_low,
           d.kcal_net_high::text AS kcal_net_high
    FROM route_derived d
    JOIN route r ON r.id = d.route_id
    ORDER BY r.seed_id`;
}

describe('route_derived', () => {
  const prisma = new PrismaClient();
  const routes = readFixture('routes.csv');
  const stations = readFixture('stations.csv');
  const bySeedId = new Map(routes.map((route) => [Number(route.ID), route]));
  const byMass = new Map<number, Derived[]>();

  beforeAll(async () => {
    try {
      await prisma.$transaction(
        async (tx) => {
          await load(tx, routes, stations);
          for (const mass of MASSES) {
            await tx.$executeRaw`UPDATE profile SET weight_kg = ${mass}`;
            byMass.set(mass, await query(tx));
          }
          throw new Rollback();
        },
        { maxWait: 30_000, timeout: 300_000 },
      );
    } catch (error) {
      if (!(error instanceof Rollback)) throw error;
    }
  }, 300_000);

  afterAll(() => prisma.$disconnect());

  it('leaves no fixture behind', async () => {
    const [{ count }] = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) FROM route`;
    expect(Number(count)).toBe(0);
  });

  it('reproduces the spreadsheet', () => {
    const wrong: string[] = [];
    let rowsCompared = 0;
    let energyCompared = 0;

    const check = (label: string, expected: string, actual: string) => {
      if (expected !== actual) wrong.push(`${label}: expected ${expected}, got ${actual}`);
    };

    for (const mass of MASSES) {
      const derived = must(byMass.get(mass), `view at ${mass} kg`);
      expect(derived).toHaveLength(ROUTES);

      for (const row of derived) {
        const sheet = must(bySeedId.get(row.seed_id), `fixture row ${row.seed_id}`);
        const at = `route ${row.seed_id} at ${mass} kg`;
        const breaza = row.seed_id === BREAZA_SEED_ID;

        const km = hundredths(sheet.Km);
        const ascent = BigInt(sheet['Ascent m']);
        const walk = BigInt(sheet['Walk to start min']);
        const bus = BigInt(sheet['Bus min']);
        const trainH = hundredths(breaza ? BREAZA_TRAIN_H : sheet['Train h one way']);
        const met = exact(sheet.MET);

        const movingNow: Exact = { n: 350n * km + 300n * ascent, d: 105_000n };
        const movingFit: Exact = { n: 5000n * km + 4200n * ascent, d: 2_100_000n };
        const dayLength: Exact = {
          n:
            2100n * trainH +
            3500n * walk +
            3500n * bus +
            350n * km +
            300n * ascent +
            105_000n,
          d: 105_000n,
        };
        const effort = km + ascent;
        const kcal = nearestTen({
          n: met.n * BigInt(mass) * (350n * km + 300n * ascent),
          d: met.d * 105_000n,
        });
        // Net of resting metabolism, so (met - 1). The sheet has no column for this,
        // which is why it is checked against the contract alone.
        const kcalNet = nearestTen({
          n: (met.n - met.d) * BigInt(mass) * (350n * km + 300n * ascent),
          d: met.d * 105_000n,
        });

        // Energy, every mass, every route: 740 values. Exact equality, no tolerance.
        check(
          `${at} kcal against the sheet`,
          plain(sheet[`kcal ${mass} kg`]),
          plain(must(row.kcal, 'kcal')),
        );
        check(
          `${at} kcal against the contract`,
          plain(kcal),
          plain(must(row.kcal, 'kcal')),
        );
        check(
          `${at} kcal_low`,
          plain(nearestTen({ n: BigInt(kcal) * 75n, d: 100n })),
          plain(must(row.kcal_low, 'kcal_low')),
        );
        check(
          `${at} kcal_high`,
          plain(nearestTen({ n: BigInt(kcal) * 125n, d: 100n })),
          plain(must(row.kcal_high, 'kcal_high')),
        );
        check(
          `${at} kcal_net against the contract`,
          plain(kcalNet),
          plain(must(row.kcal_net, 'kcal_net')),
        );
        check(
          `${at} kcal_net_low`,
          plain(nearestTen({ n: BigInt(kcalNet) * 75n, d: 100n })),
          plain(must(row.kcal_net_low, 'kcal_net_low')),
        );
        check(
          `${at} kcal_net_high`,
          plain(nearestTen({ n: BigInt(kcalNet) * 125n, d: 100n })),
          plain(must(row.kcal_net_high, 'kcal_net_high')),
        );
        energyCompared += 1;

        if (mass !== MASSES[0]) continue;

        check(
          `${at} train_h`,
          plain(fixed({ n: trainH, d: 100n }, 2)),
          plain(must(row.train_h, 'train_h')),
        );
        check(`${at} met`, plain(sheet.MET), plain(row.met));
        check(`${at} effort_points against the sheet`, plain(sheet['Effort points']), plain(row.effort_points));
        check(
          `${at} effort_points against the contract`,
          plain(fixed({ n: effort, d: 100n }, 2)),
          plain(row.effort_points),
        );

        // Each hour column twice: the view against the contract, at the full precision
        // Postgres published, and the contract against the sheet at the precision the
        // sheet carries.
        const hours: [string, Exact, string, string][] = [
          ['moving_now_h', movingNow, row.moving_now_h, sheet['Moving time now h']],
          ['moving_fit_h', movingFit, row.moving_fit_h, sheet['Moving time fit h']],
          [
            'day_length_h',
            dayLength,
            must(row.day_length_h, 'day_length_h'),
            breaza
              ? fixed(plus(exact(sheet['Day length h']), exact(BREAZA_DAY_LENGTH_ADDED)), 14)
              : sheet['Day length h'],
          ],
        ];
        for (const [name, contract, view, printed] of hours) {
          check(`${at} ${name} against the contract`, fixed(contract, decimalsIn(view)), view);
          check(
            `${at} ${name} against the sheet`,
            significant(exact(printed), SHEET_DIGITS),
            significant(contract, SHEET_DIGITS),
          );
        }

        const tripType = (value: Exact): string => {
          if (value.n <= 13n * value.d) return '1 day';
          if (value.n <= 15n * value.d) return '1 long day';
          return '2 days';
        };
        check(`${at} trip_type`, breaza ? tripType(dayLength) : sheet['Trip type'],
          must(row.trip_type, 'trip_type'));
        check(`${at} hiking_difficulty`, sheet['Hiking difficulty'], `${row.hiking_difficulty}`);
        check(`${at} technical_score`, sheet['Technical score'], `${row.technical_score}`);
        check(`${at} overall_difficulty`, sheet['Overall difficulty'], `${row.overall_difficulty}`);
        check(`${at} stage`, sheet.Stage, `${row.stage}`);
        rowsCompared += 1;
      }
    }

    // A test that silently compares nothing must fail.
    expect(wrong).toEqual([]);
    expect(rowsCompared).toBe(ROUTES);
    expect(energyCompared).toBe(ENERGY_VALUES);
    console.log(`compared ${rowsCompared} rows and ${energyCompared} energy values`);
  });
});
