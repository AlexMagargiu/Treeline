import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Geometry } from './massif.repository';

export interface RouteAccessRow {
  accessPointId: string;
  name: string;
  kind: string;
  role: string;
  mode: string;
  approachMin: number | null;
  altitudeM: number | null;
  note: string | null;
  point: Geometry | null;
}

interface RawRouteAccess {
  access_point_id: string;
  name: string;
  kind: string;
  role: string;
  mode: string;
  approach_min: number | null;
  altitude_m: number | null;
  note: string | null;
  point: string | null;
}

/**
 * The access points of a route, with the point as GeoJSON. access_point.point is a
 * geography column, so this is the second spatial query the API needs and it sits beside
 * the first rather than in a service. One repository per domain: massifs have polygons,
 * access points have points, and neither file grows the other's SQL.
 */
@Injectable()
export class AccessPointRepository {
  async forRoute(db: Prisma.TransactionClient, routeId: string): Promise<RouteAccessRow[]> {
    const rows = await db.$queryRaw<RawRouteAccess[]>`
      SELECT ap.id::text     AS access_point_id,
             ap.name,
             ap.kind::text   AS kind,
             ra.role::text   AS role,
             ra.mode::text   AS mode,
             ra.approach_min,
             ap.altitude_m,
             ra.note,
             ST_AsGeoJSON(ap.point) AS point
      FROM route_access ra
      JOIN access_point ap ON ap.id = ra.access_point_id
      WHERE ra.route_id = ${routeId}::uuid
      -- role is an enum declared start then finish, so this is the order of the day.
      ORDER BY ra.role, ap.name`;

    return rows.map((row) => ({
      accessPointId: row.access_point_id,
      name: row.name,
      kind: row.kind,
      role: row.role,
      mode: row.mode,
      approachMin: row.approach_min,
      altitudeM: row.altitude_m,
      note: row.note,
      point: row.point === null ? null : (JSON.parse(row.point) as Geometry),
    }));
  }
}
