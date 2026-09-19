import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** A GeoJSON geometry, parsed out of ST_AsGeoJSON. Never handed on as a string. */
export interface Geometry {
  type: string;
  coordinates: unknown;
}

export interface MassifRow {
  id: string;
  name: string;
  source: string | null;
  licence: string | null;
  routesKnown: number;
  routesWalked: number;
  lastVisitedAt: string | null;
  geometry: Geometry | null;
}

interface RawMassif {
  id: string;
  name: string;
  source: string | null;
  licence: string | null;
  routes_known: number;
  routes_walked: number;
  last_visited_at: Date | null;
  geometry: string | null;
}

/**
 * Prisma cannot read a geography column, so every spatial read is $queryRaw returning
 * GeoJSON through ST_AsGeoJSON, and they all live under src/spatial. This is the first
 * one the API needed.
 */
@Injectable()
export class MassifRepository {
  async list(db: Prisma.TransactionClient): Promise<MassifRow[]> {
    const rows = await db.$queryRaw<RawMassif[]>`
      SELECT m.id::text AS id,
             m.name,
             m.source::text   AS source,
             m.licence::text  AS licence,
             (SELECT count(*)::int FROM route r WHERE r.massif_id = m.id) AS routes_known,
             -- visit arrives in phase 4. The country map switches between three measures
             -- and two of them are zero until it does, so they are constants here rather
             -- than in TypeScript: the shape of the row is the shape of the response, and
             -- the day visit exists these two lines become the query that reads it.
             0::int              AS routes_walked,
             NULL::timestamptz   AS last_visited_at,
             ST_AsGeoJSON(m.area) AS geometry
      FROM massif m
      ORDER BY routes_known DESC, m.name`;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      source: row.source,
      licence: row.licence,
      routesKnown: row.routes_known,
      routesWalked: row.routes_walked,
      lastVisitedAt: row.last_visited_at?.toISOString() ?? null,
      // A massif whose polygon is null has no geometry, not the string "null".
      geometry: row.geometry === null ? null : (JSON.parse(row.geometry) as Geometry),
    }));
  }
}
