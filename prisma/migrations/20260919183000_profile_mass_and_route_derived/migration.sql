-- Body mass and pack weight sit on the profile, not on the route. The spec says the
-- energy figure reads them live, so correcting a weight moves all 185 routes at once
-- instead of freezing a number into each row. weight_kg is nullable because a profile
-- with no weight yet is a real state, and the energy figure is then null rather than
-- wrong. body_metric in phase 8 supersedes weight_kg, which is a later migration.
ALTER TABLE "profile" ADD COLUMN "weight_kg" numeric(5,2);
ALTER TABLE "profile" ADD COLUMN "pack_kg"   numeric(5,2) NOT NULL DEFAULT 0;

-- One view turns the stored catalogue columns into every derived figure, so a corrected
-- distance updates moving time, day length, effort, difficulty, stage, trip type and
-- energy together. Nothing here is computed in TypeScript.
--
-- Every number is numeric. Not one double precision, not one real, not one float cast.
-- This is measured, not stylistic: in exact decimal the view reproduces all 185 rows of
-- the source spreadsheet with no mismatch, and in IEEE doubles fourteen energy values
-- move by ten. round(numeric, -1) rounds a half away from zero, which is what the sheet
-- does; round(double precision) does not.
--
-- Each of the four quotients is written as a single division of an exact numerator,
-- rather than as the sum of divisions the formula reads as. The two forms are the same
-- algebra but not the same arithmetic, because Postgres gives a numeric division about
-- sixteen significant digits and the error survives into the energy figure. Route 52 is
-- the case that decides it: 6.3 MET, 130 kg, 16 km, 1050 m gives exactly 6825, which
-- rounds to 6830. Dividing first gives 6824.99999999999997, which rounds to 6820.
--   km / 3.0     + ascent_m / 350  ->  (350 * km + 3 * ascent_m)          / 1050
--   km / 4.2     + ascent_m / 500  ->  (5000 * km + 42 * ascent_m)        / 21000
--   km           + ascent_m / 100  ->  (100 * km + ascent_m)              / 100
--   2 * train_h + 2 * walk_min / 60 + 2 * bus_min / 60 + moving_now_h + 1
--                                  ->  (2100 * train_h + 35 * walk_min
--                                       + 35 * bus_min + 350 * km
--                                       + 3 * ascent_m + 1050)            / 1050
-- The energy figure divides last, after the MET value and the mass, for the same reason.
--
-- Nothing is rounded except energy. Rounding for display belongs to the frontend.
CREATE VIEW "route_derived" AS
WITH input AS (
    SELECT
        r.id AS route_id,
        r.km,
        r.ascent_m,
        r.walk_min,
        r.bus_min,
        -- The larger of the start and the finish station. route_access.role admits
        -- nothing but start and finish, so every station row of the route counts.
        -- Null when the route reaches no station, which is a car-only route.
        s.train_h,
        CASE r.terrain
            WHEN 'FLAT'    THEN 4
            WHEN 'ROAD'    THEN 4.5
            WHEN 'FOREST'  THEN 5.5
            WHEN 'TRAIL'   THEN 6.3
            WHEN 'ROCKY'   THEN 7
            WHEN 'SCREE'   THEN 7.5
            WHEN 'LADDERS' THEN 7
            WHEN 'CHAINS'  THEN 7.5
            WHEN 'EXPOSED' THEN 7.5
            WHEN 'FERRATA' THEN 8
            WHEN 'CLIMB'   THEN 8
        END AS met,
        CASE r.technical
            WHEN 'NONE'           THEN 0
            WHEN 'STEEP'          THEN 3
            WHEN 'LADDERS'        THEN 4
            WHEN 'CHAINS'         THEN 5
            WHEN 'SCRAMBLE'       THEN 6
            WHEN 'BEGINNER_CLIMB' THEN 6
            WHEN 'EXPOSED'        THEN 8
            WHEN 'FERRATA_D'      THEN 8
            WHEN 'CLIMB'          THEN 9
        END AS technical_score,
        -- Null when there is no profile row, and null when the profile carries no
        -- weight. A left join, so either case yields a null energy rather than no route.
        p.weight_kg + p.pack_kg AS mass_kg
    FROM "route" r
    CROSS JOIN LATERAL (
        SELECT max(st.train_h) AS train_h
        FROM "route_access" ra
        JOIN "station" st ON st.access_point_id = ra.access_point_id
        WHERE ra.route_id = r.id
    ) s
    LEFT JOIN LATERAL (
        SELECT pr.weight_kg, pr.pack_kg
        FROM "profile" pr
        ORDER BY pr.owner_id
        LIMIT 1
    ) p ON true
),
quotient AS (
    SELECT
        route_id,
        train_h,
        met,
        technical_score,
        (350 * km + 3 * ascent_m) / 1050 AS moving_now_h,
        (5000 * km + 42 * ascent_m) / 21000 AS moving_fit_h,
        (2100 * train_h + 35 * walk_min + 35 * bus_min
            + 350 * km + 3 * ascent_m + 1050) / 1050 AS day_length_h,
        (100 * km + ascent_m) / 100 AS effort_points,
        round(met * mass_kg * (350 * km + 3 * ascent_m) / 1050, -1) AS kcal,
        -- The same day net of resting metabolism. A MET of 1 is sitting still, so the
        -- walk itself costs (met - 1). Route 52 at 130 kg is 6830 gross and 5740 net,
        -- and the difference is the 1100 kcal the day would have cost in an armchair.
        -- Same divide-last discipline: multiply everything, divide once.
        round((met - 1) * mass_kg * (350 * km + 3 * ascent_m) / 1050, -1) AS kcal_net
    FROM input
),
graded AS (
    SELECT
        q.*,
        -- The grade is the index of the highest threshold the effort reaches, so 0 to
        -- 5.99 is 1, 6 to 8.99 is 2, and 52 and above is 10.
        CASE
            WHEN effort_points >= 52 THEN 10
            WHEN effort_points >= 42 THEN 9
            WHEN effort_points >= 34 THEN 8
            WHEN effort_points >= 27 THEN 7
            WHEN effort_points >= 21 THEN 6
            WHEN effort_points >= 16 THEN 5
            WHEN effort_points >= 12 THEN 4
            WHEN effort_points >= 9  THEN 3
            WHEN effort_points >= 6  THEN 2
            ELSE 1
        END AS hiking_difficulty
    FROM quotient q
),
overall AS (
    SELECT g.*, greatest(hiking_difficulty, technical_score) AS overall_difficulty
    FROM graded g
)
SELECT
    route_id,
    train_h,
    met,
    moving_now_h,
    moving_fit_h,
    day_length_h,
    effort_points,
    hiking_difficulty,
    technical_score,
    overall_difficulty,
    CASE
        WHEN overall_difficulty <= 3 THEN 1
        WHEN overall_difficulty <= 5 THEN 2
        WHEN overall_difficulty <= 7 THEN 3
        WHEN overall_difficulty <= 8 THEN 4
        ELSE 5
    END AS stage,
    -- Null rather than the last branch when the day length is unknown, because a route
    -- that reaches no station is not thereby a two-day route.
    CASE
        WHEN day_length_h IS NULL THEN NULL
        WHEN day_length_h <= 13   THEN '1 day'
        WHEN day_length_h <= 15   THEN '1 long day'
        ELSE '2 days'
    END::text AS trip_type,
    kcal,
    -- The plus or minus 25 percent band the spec requires, so the page never computes
    -- one. The energy estimate is gross and a precise figure here would be false.
    round(kcal * 0.75, -1) AS kcal_low,
    round(kcal * 1.25, -1) AS kcal_high,
    -- The page leads with the net figure and keeps the gross one behind it, so the
    -- catalogue stays comparable with the spreadsheet it came from. Both carry a band.
    kcal_net,
    round(kcal_net * 0.75, -1) AS kcal_net_low,
    round(kcal_net * 1.25, -1) AS kcal_net_high
FROM overall;
