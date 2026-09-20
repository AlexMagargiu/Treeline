# Phase 1 — a catalogue you can plan from

Spec sections that cover this phase: Purpose and scope, Access, Architecture and
hosting, Clients and platforms, Data model, The trail network as a graph (read
it, do not build it yet), Route catalogue and map, Classification and seasonal
difficulty, Access modes, Navigation and screens.

## Goal

Open the site on a phone, see Romania with the massifs shaded, tap Bucegi, filter
the trails, open one, and read everything known about it for the season you are
in. No visits, no photographs, no tracking. Just a catalogue worth planning from.

## Done when

- [ ] The site answers on HTTPS at a real hostname, behind the password gate.
- [ ] 185 routes, their stations and their massifs are in the database.
- [ ] The country map shades massifs and the counts are correct.
- [ ] The six filter chips work, the drawer works, a saved set survives a reload.
- [ ] A trail page shows the current season's difficulty first.
- [ ] Everything above works at 320 px with no sideways scrolling.
- [ ] `docker compose up -d` on a clean VPS reproduces all of it.

## Not in this phase

Segments and nodes (phase 2), visits, sessions, photographs, gear, tracking,
trips, warnings feeds, PDF output. Do not build toward them either; read the
spec for them so today's schema does not block them.

---

## 1. Infrastructure

- [x] `docker-compose.yml` with web, api, worker, db (postgis/postgis:17),
      redis, minio, caddy. Postgres and Redis publish no host ports. MinIO comes
      from quay.io, because Docker Hub no longer carries the image.
- [x] `.env.example` checked in, `.env` never.
- [x] Caddyfile: one hostname from `{$TREELINE_HOST}`, `/api/*` to the API,
      everything else to Next.js, automatic TLS.
- [x] Named volumes for `db`, `minio` and `caddy_data`. `tiles` is declared and
      mounted by nothing until section 4 needs it.
- [x] GitHub Actions: build both images, push to ghcr.io, pull and `up -d` over
      SSH, migrations as a one-shot container first. **Written, never run.** It
      needs `VPS_HOST`, `VPS_USER` and `VPS_SSH_KEY` set on the repository, which
      is the user's to do. The box logs in to ghcr.io with the run's own token,
      so there is no personal access token to create.
- [x] VPS hardening, satisfied on 2026-09-19 and read off the box rather than
      assumed. Root is key-only (`permitrootlogin without-password`), so no
      password reaches it. Ports 22, 80 and 443 are controlled by the Hetzner
      Cloud firewall, from outside the machine, which is why `ufw` stays
      inactive. `unattended-upgrades` is installed and enabled.
      `fail2ban` is deliberately not installed: the box is shared with live
      services, and a box-wide IP ban is a risk to them, not a protection for
      Treeline. Revisit if the host ever stops being shared.
- [ ] Nightly `pg_dump` to a second location. **Half done.** The `backup` service
      dumps nightly at 03:00 UTC to its own volume and prunes after 14 days. It is
      not a backup until the documented `rsync` pulls those files to another
      machine, because today they sit on the disk they protect.

Docker itself was installed on the box on 2026-09-19, 29.8.1 with Compose v5.5.1,
the same versions the stack was tested against locally.

**Check:** destroy the stack, `docker compose up -d`, and the site returns. Passes
locally. It has never been run on the box, because nothing is deployed yet.

## 2. Database and seed

- [x] Enable PostGIS in the first migration, by hand.
- [x] Prisma schema for this phase only:
      `massif`, `access_point`, `station`, `parking`, `route`, `route_access`,
      `route_category`, `route_season`, `edit_log`, `profile`, `saved_filter`.
- [x] Spatial columns as `Unsupported("geography(...)")`, GiST index on each.
- [x] `owner_id` on `profile` and `saved_filter` now, defaulted to a seed user.
- [x] Seed script: 15 massifs, 31 stations, 185 routes, 370 access rows and 740
      season rows, idempotent. The four season rows per route take their numbers
      from `route_derived` rather than recomputing them.
- [x] Massif polygons. Five come from OpenStreetMap protected-area boundaries,
      ten are drawn by hand, and `massif.source` and `licence` keep the two
      separable. OpenStreetMap has no mountain range polygons for Romania, which
      is why only five are real. The ten drawn ones are the rows to correct first.
- [x] `route.geom_simple` stays null. Nothing in phase 1 requires it.

Also landed here, beyond the original list: the derived view `route_derived`,
which every figure on a trail page reads, proved against all 185 spreadsheet rows
for equality rather than a tolerance; `profile.weight_kg` and `pack_kg`, without
which the energy figure has no body mass; and `station.train_h`, without which
the view cannot compute the journey at all.

**Check:** `select count(*) from route` returns 185, and every route resolves a
massif and at least one access point. Both pass, with zero orphans.

## 3. API

- [x] Auth: `POST /auth/login` compares against an argon2id hash in the
      environment, issues a bearer token, sets an httpOnly cookie for 30 days,
      unsigned by the decision recorded in `docs/spec.md`. Rate limit to 5
      attempts per IP per 15 minutes, counted in Redis.
- [x] `GET /massifs` with per-massif counts: routes known, routes walked (zero
      for now), last visited (null for now). Geometry as parsed GeoJSON.
- [x] `GET /routes` taking every filter phase 1 can answer, plus sort and
      pagination. One parameterised statement. Nine drawer filters from the spec
      are deliberately absent, because each needs a table that does not exist
      yet: water, shelter, camping, protected area, rock, forest, my rating, last
      visited, warnings.
- [x] `GET /routes/:id` returning the route, its categories, all four season
      rows, and its access points with approach times.
- [x] `PATCH /routes/:id` writing to `edit_log` on every field change, in one
      transaction, and returning the route so the moved derived values are
      visible in the same response.
- [x] `GET /saved-filters`, `POST /saved-filters`, `DELETE /saved-filters/:id`.
- [x] Derived values computed in one SQL view, never in TypeScript. Shipped in
      `300946d` and proved against all 185 spreadsheet rows.

**Two known gaps, both out of scope here and both easy to forget.**

`route_season.overall` is a stored number the seed wrote, while
`route_derived.overall_difficulty` is computed live. Correcting a route's
distance moves the derived value and leaves the season row behind, so a trail
page can show two different difficulties, and `maxDifficulty` filters on the
stale one. Whichever prompt makes season rows editable has to close this.

`route_category` is empty, so the category filter matches nothing. The parameter
works; there is no data. Categories arrive with the OpenStreetMap import in
phase 2, or with a hand pass before it.

**Check:** the filter endpoint returns the same counts the map shows.

## 4. Tiles

- [x] Romania extract of the Protomaps basemap as PMTiles, served from Caddy with
      range requests. 643 MB at z0-14, from `pmtiles extract` against the
      published build rather than a Planetiler run.
- [x] Contours for Bucegi at a 20 m interval, from the Copernicus 30 m DEM.
      7.8 MB, z10-14, elevations 420 m to 2500 m.
- [x] Terrain-RGB for Bucegi, hillshade rendered by MapLibre in the browser.
      14.1 MB, z8-12, Mapbox encoding, not Terrarium.
- [x] `infra/tiles/build.sh` rebuilds all three, takes a massif as an argument,
      skips what exists, and runs every tool in a pinned container so nothing is
      installed on the host and nothing is built on the shared box.

`infra/tiles/README.md` carries the layer names, the encoding, the zoom ranges,
the URLs and the two attribution strings the map screen owes: OpenStreetMap is
ODbL and the Copernicus DEM has its own credit line.

**Check:** the map loads over 3G-speed throttling without blocking first paint.
Not yet run, because there is no map. Measured instead: a first view of Romania
at z5 costs 274 KB, and Omu at z14 with all three sources costs 398 KB. Range
requests are served correctly, 206 with a correct `Content-Range` on all three
files, and compression is excluded from `/tiles/*` so a byte range stays a byte
range.

## 5. Frontend

- [x] Next.js with middleware guarding every route but `/login`, `/health`, the
      offline page, the manifest, the service worker and the icons.
- [x] PWA: manifest, installable, offline shell. No offline data yet, and the
      worker refuses to cache anything under `/api/`, because a stale route is a
      lie about a mountain.
- [ ] Country map: MapLibre, massifs shaded, switchable between share of
      network walked, routes walked, and time since last visit.
      **Empty state matters:** with no visits, every massif reads "never
      visited". Shade by routes known instead, and say so in the legend.
- [ ] Bottom sheet over the map, three rest positions: massif summary, trail
      list, trail. The map never unmounts.
- [ ] Filters: six chips always visible, the rest in a drawer, state in the URL,
      saved sets above the chips.
- [ ] Trail page: current season first, the other three behind a toggle,
      categories, access points with approach times and the return problem when
      the mode is car, and an edit affordance on every field.
- [ ] Do not request location on launch. Ask when a "near me" action needs it.

**Check:** a filter set is shareable as a URL and restores exactly.

## 6. Quality floor

- [ ] 320, 360, 390 and 412 px all correct. No fixed pixel widths anywhere.
- [ ] Dark mode, and a high-contrast mode for direct sun.
- [ ] Visible keyboard focus, `prefers-reduced-motion` respected.
- [ ] Touch targets at least 48 px.
- [ ] One end-to-end test: log in, filter, open a trail, read the season row.

---

## Gotchas

**Prisma and PostGIS.** Prisma cannot read a geography column. Every spatial
read is `$queryRaw` returning GeoJSON via `ST_AsGeoJSON`. Keep them in
`src/spatial/*.repository.ts` and nowhere else.

**The filter query.** Twenty optional filters assembled by a query builder
produces unreadable SQL and bad plans. Write one parameterised statement with
`(:param IS NULL OR column = :param)` clauses and read the plan once it is done.

**Massif shading at launch.** Everything is zero. Decide the empty state before
you build the legend, or the first screen you ever see is discouraging.

**Seasons.** Four rows per route from day one, even when all four hold the same
number. Retro-fitting the fourth row later means touching every query that
filters on difficulty.

**Do not model segments yet, but do not fight them.** Keep route geometry in one
column and out of the API contract's shape. In phase 2 a route becomes an
ordered list of segments, and the endpoints above should not have to change.
