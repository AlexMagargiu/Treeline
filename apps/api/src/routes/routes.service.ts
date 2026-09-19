import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiError } from '../common/api-error';
import { config } from '../common/config';
import { PrismaService } from '../prisma/prisma.service';
import { AccessPointRepository } from '../spatial/access-point.repository';
import { ListRoutesDto } from './dto/list-routes.dto';
import { PatchRouteDto } from './dto/patch-route.dto';
import { changedFields, RouteFields } from './route-edits';
import { currentSeason } from './season';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// Every figure the view computes is numeric and comes back as the text Postgres printed.
// Not one of them is parsed into a JavaScript number on the way out: a double cannot hold
// 6825.00 as the product of 6.3, 130 and 25/3, and docs/design.md says the screen formats
// these, not the API. ascent_m, quiet, the difficulties and stage are int columns, so
// they stay integers.
const ROUTE_COLUMNS = Prisma.sql`
  r.id::text            AS id,
  r.seed_id             AS seed_id,
  r.name_ro,
  r.name_en,
  m.id::text            AS massif_id,
  m.name                AS massif_name,
  r.km::text            AS km,
  r.ascent_m,
  r.terrain::text       AS terrain,
  r.technical::text     AS technical,
  r.quiet,
  r.confidence::text    AS confidence,
  r.season_window,
  d.train_h::text       AS train_h,
  d.moving_now_h::text  AS moving_now_h,
  d.day_length_h::text  AS day_length_h,
  d.effort_points::text AS effort_points,
  d.hiking_difficulty,
  d.technical_score,
  d.overall_difficulty,
  d.stage,
  d.trip_type,
  d.kcal_net::text      AS kcal_net,
  d.kcal::text          AS kcal,
  rs.season::text       AS season_season,
  rs.status::text       AS season_status,
  rs.overall            AS season_overall
`;

interface RawRoute {
  id: string;
  seed_id: number | null;
  name_ro: string;
  name_en: string | null;
  massif_id: string;
  massif_name: string;
  km: string;
  ascent_m: number;
  terrain: string;
  technical: string;
  quiet: number;
  confidence: string;
  season_window: string;
  train_h: string | null;
  moving_now_h: string;
  day_length_h: string | null;
  effort_points: string;
  hiking_difficulty: number;
  technical_score: number;
  overall_difficulty: number;
  stage: number;
  trip_type: string | null;
  kcal_net: string | null;
  kcal: string | null;
  season_season: string | null;
  season_status: string | null;
  season_overall: number | null;
}

interface RawListRoute extends RawRoute {
  total: number;
}

interface RawDetailRoute extends RawRoute {
  shape: string | null;
  notes: string | null;
}

interface RawDerived {
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

interface RawSeason {
  season: string;
  hiking_difficulty: number;
  technical_grade: number;
  overall: number;
  required_gear: string[];
  daylight_note: string | null;
  status: string;
  note: string | null;
  set_by: string;
  set_on: Date;
}

interface RawCategory {
  category: string;
  is_primary: boolean;
  set_by: string;
  set_on: Date;
}

function toRoute(raw: RawRoute) {
  return {
    id: raw.id,
    seedId: raw.seed_id,
    nameRo: raw.name_ro,
    nameEn: raw.name_en,
    massif: { id: raw.massif_id, name: raw.massif_name },
    km: raw.km,
    ascentM: raw.ascent_m,
    terrain: raw.terrain,
    technical: raw.technical,
    quiet: raw.quiet,
    confidence: raw.confidence,
    seasonWindow: raw.season_window,
    trainH: raw.train_h,
    movingNowH: raw.moving_now_h,
    dayLengthH: raw.day_length_h,
    effortPoints: raw.effort_points,
    hikingDifficulty: raw.hiking_difficulty,
    technicalScore: raw.technical_score,
    overallDifficulty: raw.overall_difficulty,
    stage: raw.stage,
    tripType: raw.trip_type,
    kcalNet: raw.kcal_net,
    kcal: raw.kcal,
    season:
      raw.season_season === null
        ? null
        : {
            season: raw.season_season,
            status: raw.season_status,
            overall: raw.season_overall,
          },
  };
}

@Injectable()
export class RoutesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPoints: AccessPointRepository,
  ) {}

  /**
   * The catalogue query: one parameterised statement, every filter a bound parameter in a
   * (:param IS NULL OR column = :param) clause. A query builder assembling twenty
   * optional WHERE clauses produces unreadable SQL and a different plan per combination.
   *
   * count(*) OVER () carries the total, so the list and the count are the same statement
   * and cannot disagree with each other. docs/phase-1.md asks for exactly that: the
   * filter endpoint returns the same counts the map shows.
   */
  async list(query: ListRoutesDto) {
    const season = query.season ?? currentSeason();
    const sort = query.sort ?? 'fit';
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = query.offset ?? 0;
    const massif = query.massif ?? null;
    const category = query.category ?? null;
    const maxDifficulty = query.maxDifficulty ?? null;
    const maxTechnical = query.maxTechnical ?? null;
    const maxKm = query.maxKm ?? null;
    const minKm = query.minKm ?? null;
    const maxAscent = query.maxAscent ?? null;
    const minAscent = query.minAscent ?? null;
    const maxDayLength = query.maxDayLength ?? null;
    const maxTrainH = query.maxTrainH ?? null;
    const tripType = query.tripType ?? null;
    const stage = query.stage ?? null;
    const minQuiet = query.minQuiet ?? null;
    const confidence = query.confidence ?? null;
    const mode = query.mode ?? null;
    const startStation = query.startStation ?? null;
    const q = query.q ?? null;

    const rows = await this.prisma.$queryRaw<RawListRoute[]>`
      WITH filtered AS (
        SELECT ${ROUTE_COLUMNS},
               -- The raw numerics the sort reads. The projection above casts km and
               -- day_length_h to text, and ordering text puts 9.00 after 16.00.
               r.km                    AS sort_km,
               d.day_length_h          AS sort_day_length,
               (count(*) OVER ())::int AS total
        FROM route r
        JOIN massif m ON m.id = r.massif_id
        JOIN route_derived d ON d.route_id = r.id
        JOIN route_season rs ON rs.route_id = r.id AND rs.season = ${season}::season
        WHERE (${massif}::uuid[] IS NULL OR r.massif_id = ANY(${massif}::uuid[]))
          AND (${category}::route_category_name[] IS NULL OR EXISTS (
                SELECT 1 FROM route_category rc
                WHERE rc.route_id = r.id
                  AND rc.category = ANY(${category}::route_category_name[])))
          AND (${maxDifficulty}::int IS NULL OR rs.overall <= ${maxDifficulty}::int)
          AND (${maxTechnical}::int IS NULL OR d.technical_score <= ${maxTechnical}::int)
          AND (${maxKm}::numeric IS NULL OR r.km <= ${maxKm}::numeric)
          AND (${minKm}::numeric IS NULL OR r.km >= ${minKm}::numeric)
          AND (${maxAscent}::int IS NULL OR r.ascent_m <= ${maxAscent}::int)
          AND (${minAscent}::int IS NULL OR r.ascent_m >= ${minAscent}::int)
          AND (${maxDayLength}::numeric IS NULL OR d.day_length_h <= ${maxDayLength}::numeric)
          AND (${maxTrainH}::numeric IS NULL OR d.train_h <= ${maxTrainH}::numeric)
          AND (${tripType}::text IS NULL OR d.trip_type = ${tripType}::text)
          AND (${stage}::int[] IS NULL OR d.stage = ANY(${stage}::int[]))
          AND (${minQuiet}::int IS NULL OR r.quiet >= ${minQuiet}::int)
          AND (${confidence}::confidence[] IS NULL
               OR r.confidence = ANY(${confidence}::confidence[]))
          AND (${mode}::access_mode IS NULL OR EXISTS (
                SELECT 1 FROM route_access ra
                WHERE ra.route_id = r.id AND ra.mode = ${mode}::access_mode))
          AND (${startStation}::uuid[] IS NULL OR EXISTS (
                SELECT 1 FROM route_access ra
                WHERE ra.route_id = r.id AND ra.role = 'start'
                  AND ra.access_point_id = ANY(${startStation}::uuid[])))
          -- Both directions, with and without diacritics: zarnesti finds Zarnesti and
          -- Zarnesti finds zarnesti. Nobody types s-comma and t-comma on a phone.
          AND (${q}::text IS NULL
               OR treeline_unaccent(lower(r.name_ro))
                  LIKE '%' || treeline_unaccent(lower(${q}::text)) || '%'
               OR treeline_unaccent(lower(r.name_en))
                  LIKE '%' || treeline_unaccent(lower(${q}::text)) || '%')
      )
      -- sort_km and sort_day_length come back with the rest and are dropped by toRoute;
      -- naming every output column again to hide two of them is a contract in two places.
      SELECT * FROM filtered
      -- The sort is a bound parameter like every filter. For one value of sort the other
      -- branches are a NULL constant and order nothing. sort=fit is the spec's "best fit
      -- for the coming weekend" reduced to what phase 1 can know: in season first, then
      -- the shortest day, then the easiest. Daylight and the forecast arrive in phase 6
      -- and replace this sort.
      ORDER BY CASE WHEN ${sort}::text = 'fit'        THEN (season_status <> 'normal')::int END,
               CASE WHEN ${sort}::text = 'fit'        THEN sort_day_length END,
               CASE WHEN ${sort}::text = 'fit'        THEN season_overall END,
               CASE WHEN ${sort}::text = 'km'         THEN sort_km END,
               CASE WHEN ${sort}::text = 'ascent'     THEN ascent_m END,
               CASE WHEN ${sort}::text = 'difficulty' THEN season_overall END,
               CASE WHEN ${sort}::text = 'dayLength'  THEN sort_day_length END,
               name_ro
      LIMIT ${limit} OFFSET ${offset}`;

    return {
      total: rows[0]?.total ?? 0,
      limit,
      offset,
      season,
      // visit arrives in phase 4, so in phase 1 every route is one you have not walked.
      // The parameter is accepted because the frontend chip depends on it existing, and
      // the answer says plainly that it filtered nothing.
      notWalkedApplied: false,
      routes: rows.map(toRoute),
    };
  }

  async detail(id: string) {
    return this.read(this.prisma, id);
  }

  /**
   * The update and its edit_log rows are one transaction, and the route is read back
   * inside it. Correcting km moves moving time, day length, effort, difficulty, stage,
   * trip type and both energy figures in the same response, because the read goes through
   * route_derived. Nothing here recomputes a derived value.
   */
  async patch(id: string, patch: PatchRouteDto) {
    return this.prisma.$transaction(async (tx) => {
      const [current] = await tx.$queryRaw<RouteFields[]>`
        SELECT name_ro           AS "nameRo",
               name_en           AS "nameEn",
               km::text          AS "km",
               ascent_m          AS "ascentM",
               terrain::text     AS "terrain",
               technical::text   AS "technical",
               quiet             AS "quiet",
               confidence::text  AS "confidence",
               season_window     AS "seasonWindow",
               notes             AS "notes",
               shape             AS "shape"
        FROM route WHERE id = ${id}::uuid
        FOR UPDATE`;
      if (!current) throw new ApiError(404, 'route_not_found', 'No route with that id.');

      const changes = changedFields(current, patch);
      if (changes.length > 0) {
        await tx.route.update({ where: { id }, data: patch });
        await tx.editLog.createMany({
          data: changes.map((change) => ({
            tableName: 'route',
            rowId: id,
            field: change.column,
            oldValue: change.oldValue,
            newValue: change.newValue,
            by: config.ownerId,
          })),
        });
      }

      return this.read(tx, id);
    });
  }

  private async read(db: Prisma.TransactionClient, id: string) {
    const season = currentSeason();

    // LEFT JOIN, not JOIN: a route that somehow has no row for this season still opens,
    // with season null, rather than answering 404 for a route that plainly exists.
    const [route] = await db.$queryRaw<RawDetailRoute[]>`
      SELECT ${ROUTE_COLUMNS}, r.shape, r.notes
      FROM route r
      JOIN massif m ON m.id = r.massif_id
      JOIN route_derived d ON d.route_id = r.id
      LEFT JOIN route_season rs ON rs.route_id = r.id AND rs.season = ${season}::season
      WHERE r.id = ${id}::uuid`;
    if (!route) throw new ApiError(404, 'route_not_found', 'No route with that id.');

    const [categories, seasons, derived, access] = await Promise.all([
      db.$queryRaw<RawCategory[]>`
        SELECT category::text AS category, is_primary, set_by, set_on
        FROM route_category WHERE route_id = ${id}::uuid
        ORDER BY is_primary DESC, category`,
      db.$queryRaw<RawSeason[]>`
        SELECT season::text AS season, hiking_difficulty, technical_grade, overall,
               required_gear, daylight_note, status::text AS status, note, set_by, set_on
        FROM route_season WHERE route_id = ${id}::uuid
        -- The current season first, then the other three in their declared order, which
        -- is the order docs/spec.md asks the route page to show them in.
        ORDER BY (season = ${season}::season) DESC, season`,
      db.$queryRaw<RawDerived[]>`
        SELECT train_h::text        AS train_h,
               met::text            AS met,
               moving_now_h::text   AS moving_now_h,
               moving_fit_h::text   AS moving_fit_h,
               day_length_h::text   AS day_length_h,
               effort_points::text  AS effort_points,
               hiking_difficulty, technical_score, overall_difficulty, stage, trip_type,
               kcal::text           AS kcal,
               kcal_low::text       AS kcal_low,
               kcal_high::text      AS kcal_high,
               kcal_net::text       AS kcal_net,
               kcal_net_low::text   AS kcal_net_low,
               kcal_net_high::text  AS kcal_net_high
        FROM route_derived WHERE route_id = ${id}::uuid`,
      this.accessPoints.forRoute(db, id),
    ]);

    return {
      ...toRoute(route),
      shape: route.shape,
      notes: route.notes,
      categories: categories.map((row) => ({
        category: row.category,
        isPrimary: row.is_primary,
        setBy: row.set_by,
        setOn: row.set_on.toISOString(),
      })),
      seasons: seasons.map((row) => ({
        season: row.season,
        hikingDifficulty: row.hiking_difficulty,
        technicalGrade: row.technical_grade,
        overall: row.overall,
        requiredGear: row.required_gear,
        daylightNote: row.daylight_note,
        status: row.status,
        note: row.note,
        setBy: row.set_by,
        setOn: row.set_on.toISOString(),
      })),
      access,
      derived: toDerived(derived[0]),
    };
  }
}

function toDerived(raw: RawDerived | undefined) {
  if (!raw) return null;
  return {
    trainH: raw.train_h,
    met: raw.met,
    movingNowH: raw.moving_now_h,
    movingFitH: raw.moving_fit_h,
    dayLengthH: raw.day_length_h,
    effortPoints: raw.effort_points,
    hikingDifficulty: raw.hiking_difficulty,
    technicalScore: raw.technical_score,
    overallDifficulty: raw.overall_difficulty,
    stage: raw.stage,
    tripType: raw.trip_type,
    kcal: raw.kcal,
    kcalLow: raw.kcal_low,
    kcalHigh: raw.kcal_high,
    kcalNet: raw.kcal_net,
    kcalNetLow: raw.kcal_net_low,
    kcalNetHigh: raw.kcal_net_high,
  };
}
