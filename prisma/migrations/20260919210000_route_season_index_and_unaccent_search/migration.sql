-- The catalogue query joins one route_season row per route, chosen by season, and then
-- filters and sorts on overall. That pair is what this index serves. It is the only
-- index the filter query needs that the schema did not already carry.
CREATE INDEX "route_season_season_overall_idx" ON "route_season" ("season", "overall");

-- Free text search over route names has to match with and without diacritics, in both
-- directions: zarnesti finds Zarnesti and Zărnești finds it too. Nobody types s-comma and
-- t-comma on a phone in the rain.
--
-- Both extensions are created by hand here, the same way PostGIS was, because an
-- extension Prisma believes it owns is an extension it will try to drop.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent(text) reads a search dictionary by name at run time, so Postgres marks it
-- STABLE and refuses to build an index on it. Naming the dictionary as a regdictionary
-- constant removes the lookup, and the wrapper is then honestly immutable. This is the
-- documented way round it, not a trick: the value only changes if somebody edits the
-- unaccent rules file, which would also invalidate the index.
CREATE FUNCTION treeline_unaccent(text) RETURNS text
    AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$
    LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

-- The search is LIKE '%needle%', which has a leading wildcard, so no btree index can
-- serve it however the expression is written. A trigram GIN index is the only kind that
-- can. At 185 rows the planner will still choose a sequential scan, and should; the index
-- exists because the statement is written against it and the catalogue grows.
CREATE INDEX "route_name_ro_unaccent_trgm_idx" ON "route"
    USING gin (treeline_unaccent(lower("name_ro")) gin_trgm_ops);
CREATE INDEX "route_name_en_unaccent_trgm_idx" ON "route"
    USING gin (treeline_unaccent(lower("name_en")) gin_trgm_ops);
