-- Provenance on the two tables that hold geometry from outside the project.
--
-- Rule 5 of CLAUDE.md: OpenStreetMap geometry is ODbL and must stay separable from the
-- project's own work. Five of the fifteen massif polygons come from OSM relations and ten
-- are drawn by hand; thirty of the thirty-one station points come from OSM and one is
-- approximate. Until now neither table could say which was which, so the two would have
-- merged into one column the moment anybody exported them.
--
-- Nullable, because a massif drawn by hand later may have neither until somebody says so.
-- The GeometrySource enum admits only osm and own. The fixtures write "drawn" where they
-- mean the project's own work, so the seed maps drawn to own and the note column carries
-- the detail: which relation a polygon came from, how far it was simplified, or that a
-- coordinate is a guess. access_point already has a note column and needs no second one.
ALTER TABLE "massif"       ADD COLUMN "source" "geometry_source", ADD COLUMN "licence" "licence", ADD COLUMN "note" text;
ALTER TABLE "access_point" ADD COLUMN "source" "geometry_source", ADD COLUMN "licence" "licence";
