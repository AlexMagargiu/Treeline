-- PostGIS first, by hand. Every geography column below depends on it, and the extension
-- is never managed by Prisma: one it believes it owns is one it will try to drop.
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateEnum
CREATE TYPE "access_point_kind" AS ENUM ('station', 'parking', 'bus_stop', 'trailhead');

-- CreateEnum
CREATE TYPE "access_role" AS ENUM ('start', 'finish');

-- CreateEnum
CREATE TYPE "access_mode" AS ENUM ('train', 'car', 'bus', 'mixed');

-- CreateEnum
CREATE TYPE "terrain" AS ENUM ('FLAT', 'ROAD', 'FOREST', 'TRAIL', 'ROCKY', 'SCREE', 'LADDERS', 'CHAINS', 'EXPOSED', 'FERRATA', 'CLIMB');

-- CreateEnum
CREATE TYPE "technical" AS ENUM ('NONE', 'STEEP', 'LADDERS', 'CHAINS', 'SCRAMBLE', 'BEGINNER_CLIMB', 'EXPOSED', 'FERRATA_D', 'CLIMB');

-- CreateEnum
CREATE TYPE "route_category_name" AS ENUM ('walking', 'wood_trail', 'hiking', 'scramble', 'via_ferrata', 'mountaineering', 'bouldering', 'ski_touring', 'snowshoe', 'cave_approach');

-- CreateEnum
CREATE TYPE "season" AS ENUM ('spring', 'summer', 'autumn', 'winter');

-- CreateEnum
CREATE TYPE "season_status" AS ENUM ('normal', 'harder', 'dangerous', 'closed');

-- CreateEnum
CREATE TYPE "confidence" AS ENUM ('high', 'medium', 'verify');

-- CreateEnum
CREATE TYPE "geometry_source" AS ENUM ('osm', 'own');

-- CreateEnum
CREATE TYPE "licence" AS ENUM ('odbl', 'own');

-- CreateTable
CREATE TABLE "massif" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "area" geography(Polygon, 4326),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "massif_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_point" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kind" "access_point_kind" NOT NULL,
    "name" TEXT NOT NULL,
    "point" geography(Point, 4326) NOT NULL,
    "altitude_m" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_point_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "station" (
    "access_point_id" UUID NOT NULL,
    "train_h" DECIMAL(4,2) NOT NULL,
    "changes" INTEGER NOT NULL,
    "line" TEXT,
    "note" TEXT,

    CONSTRAINT "station_pkey" PRIMARY KEY ("access_point_id")
);

-- CreateTable
CREATE TABLE "parking" (
    "access_point_id" UUID NOT NULL,
    "surface" TEXT,
    "capacity" INTEGER,
    "fee" TEXT,
    "winter_access" BOOLEAN,
    "high_clearance" BOOLEAN,
    "theft_risk" TEXT,
    "last_verified_on" DATE,

    CONSTRAINT "parking_pkey" PRIMARY KEY ("access_point_id")
);

-- CreateTable
CREATE TABLE "route" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "massif_id" UUID NOT NULL,
    "name_ro" TEXT NOT NULL,
    "name_en" TEXT,
    "km" DECIMAL(5,2) NOT NULL,
    "ascent_m" INTEGER NOT NULL,
    "terrain" "terrain" NOT NULL,
    "technical" "technical" NOT NULL,
    "quiet" INTEGER NOT NULL,
    "confidence" "confidence" NOT NULL,
    "season_window" TEXT NOT NULL,
    "walk_min" INTEGER NOT NULL DEFAULT 0,
    "bus_min" INTEGER NOT NULL DEFAULT 0,
    "shape" TEXT,
    "notes" TEXT,
    "historic_source" TEXT,
    "historic_status" TEXT,
    "source" "geometry_source" NOT NULL,
    "licence" "licence" NOT NULL,
    "geom_simple" geography(LineString, 4326),
    "seed_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_access" (
    "route_id" UUID NOT NULL,
    "access_point_id" UUID NOT NULL,
    "role" "access_role" NOT NULL,
    "mode" "access_mode" NOT NULL,
    "approach_min" INTEGER,
    "note" TEXT,

    CONSTRAINT "route_access_pkey" PRIMARY KEY ("route_id","access_point_id","role")
);

-- CreateTable
CREATE TABLE "route_category" (
    "route_id" UUID NOT NULL,
    "category" "route_category_name" NOT NULL,
    "is_primary" BOOLEAN NOT NULL,
    "set_by" TEXT NOT NULL,
    "set_on" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "route_category_pkey" PRIMARY KEY ("route_id","category")
);

-- CreateTable
CREATE TABLE "route_season" (
    "route_id" UUID NOT NULL,
    "season" "season" NOT NULL,
    "hiking_difficulty" INTEGER NOT NULL,
    "technical_grade" INTEGER NOT NULL,
    "overall" INTEGER NOT NULL,
    "required_gear" TEXT[],
    "daylight_note" TEXT,
    "status" "season_status" NOT NULL,
    "note" TEXT,
    "set_by" TEXT NOT NULL,
    "set_on" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "route_season_pkey" PRIMARY KEY ("route_id","season")
);

-- CreateTable
CREATE TABLE "edit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "table_name" TEXT NOT NULL,
    "row_id" UUID NOT NULL,
    "field" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "by" TEXT NOT NULL,

    CONSTRAINT "edit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile" (
    "owner_id" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
    "dob" DATE,
    "height_cm" INTEGER,
    "home_point" geography(Point, 4326),
    "home_clip_m" INTEGER NOT NULL DEFAULT 500,
    "preferred_access_mode" "access_mode",
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_pkey" PRIMARY KEY ("owner_id")
);

-- CreateTable
CREATE TABLE "saved_filter" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_filter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "massif_name_key" ON "massif"("name");

-- CreateIndex
CREATE UNIQUE INDEX "route_seed_id_key" ON "route"("seed_id");

-- CreateIndex
CREATE INDEX "route_massif_id_idx" ON "route"("massif_id");

-- CreateIndex
CREATE INDEX "route_terrain_idx" ON "route"("terrain");

-- CreateIndex
CREATE INDEX "route_technical_idx" ON "route"("technical");

-- CreateIndex
CREATE INDEX "route_quiet_idx" ON "route"("quiet");

-- CreateIndex
CREATE INDEX "route_access_route_id_idx" ON "route_access"("route_id");

-- CreateIndex
CREATE INDEX "route_season_route_id_idx" ON "route_season"("route_id");

-- CreateIndex
CREATE INDEX "edit_log_table_name_row_id_idx" ON "edit_log"("table_name", "row_id");

-- CreateIndex
CREATE UNIQUE INDEX "saved_filter_owner_id_name_key" ON "saved_filter"("owner_id", "name");

-- AddForeignKey
ALTER TABLE "station" ADD CONSTRAINT "station_access_point_id_fkey" FOREIGN KEY ("access_point_id") REFERENCES "access_point"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking" ADD CONSTRAINT "parking_access_point_id_fkey" FOREIGN KEY ("access_point_id") REFERENCES "access_point"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route" ADD CONSTRAINT "route_massif_id_fkey" FOREIGN KEY ("massif_id") REFERENCES "massif"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_access" ADD CONSTRAINT "route_access_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_access" ADD CONSTRAINT "route_access_access_point_id_fkey" FOREIGN KEY ("access_point_id") REFERENCES "access_point"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_category" ADD CONSTRAINT "route_category_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_season" ADD CONSTRAINT "route_season_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- GiST on every geography column, by hand, because Prisma cannot index a column it
-- cannot read.
CREATE INDEX "massif_area_idx" ON "massif" USING GIST ("area");
CREATE INDEX "access_point_point_idx" ON "access_point" USING GIST ("point");
CREATE INDEX "route_geom_simple_idx" ON "route" USING GIST ("geom_simple");
CREATE INDEX "profile_home_point_idx" ON "profile" USING GIST ("home_point");

-- At most one primary category per route. Prisma cannot express a partial index.
CREATE UNIQUE INDEX "route_category_one_primary" ON "route_category" ("route_id") WHERE "is_primary";
