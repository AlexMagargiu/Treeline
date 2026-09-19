# Hiking site

A private, password-gated site for planning hikes in the Romanian Carpathians,
recording what happened on them, and photographing the same viewpoints every
season. One user for now.

Full specification: `docs/spec.md`. Current work: `docs/phase-1.md`.
Read the spec section that covers the task before you write code for it.

## How to work

### 1. Think before coding

Do not assume. Do not hide confusion. Surface tradeoffs.

- State your assumptions. If you are uncertain, ask.
- If more than one reading is possible, present them. Do not pick silently.
- If a simpler approach exists, say so. Push back when it is warranted.
- If something is unclear, stop. Name what is confusing. Ask.

### 2. Wait for answers

When you ask a question, wait for the answer, however long it takes. A silence is
not permission. Do not proceed on a recommended answer, a best guess or a
default. Ask again if you need to, but never act on a reply you invented.

### 3. Simplicity first

The minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstraction for single-use code.
- No flexibility or configurability nobody requested.
- No error handling for impossible cases.
- If you wrote 200 lines and 50 would do, write the 50.

### 4. Surgical changes

Touch only what you must. Clean up only your own mess.

- Do not improve adjacent code, comments or formatting.
- Do not refactor what is not broken.
- Match the surrounding style even where you would write it differently.
- Remove imports and variables that your change orphaned. Leave pre-existing dead
  code alone, and mention it.

The test: every changed line traces to the request.

### 5. Goal-driven execution

Turn a task into a verifiable goal before you start.

- "Add validation" becomes "write tests for invalid input, then make them pass".
- "Fix the bug" becomes "write a test that reproduces it, then make it pass".

For a multi-step task, state the plan as steps with a check against each one.

### 6. Servers

The VPS exists. It is a Hetzner box, 4 vCPU, 8 GB RAM, 80 GB SSD, reached as
`root` at `89.167.90.189` with the key `~/.ssh/github`. The deploy pattern to
copy is `~/repos/weather_arb/scripts/deploy.sh`.

**Claude works on it directly. Authorised by the user on 2026-09-19, and this
replaces the earlier rule that Claude never touched the host.** SSH in as `root`
with `~/.ssh/github`, run commands, read logs, deploy. Root needs no `sudo`
there. Where `sudo` is needed on the local machine it is authorised too, and the
password is in `.secrets/vps.env`, which is untracked and never committed. Do
not ask permission each time, and do not hand the user a command you can run
yourself.

The reason the old rule existed has not gone away, so three limits stand.

- **Treeline only.** `/root/treeline` and the `treeline` Compose project. The box
  is shared and the other projects are older than this one: `metar-bot` trades
  live money on port 8080, `sports-bot` answers on 8082, and the host Postgres,
  `polymarket_account_tracker` and `polymarket-sidecar` belong to them as well.
  Never stop, restart, move, upgrade, reconfigure, delete or edit any of it. Read
  it only when it demonstrably affects Treeline, and say why.
- **Nothing destructive without asking.** No `docker system prune`, no `-v` on a
  volume holding data, no package removal, no change to systemd, `ufw`,
  `fail2ban` or the Hetzner firewall, no reboot.
- **Keep credentials out of the transcript.** Never print the password, a private
  key, a token or another project's `.env`. Redact before pasting output. A
  transcript cannot be un-written.

Treeline stays self-contained: its own Compose project, its own volumes, its own
ports, its own database in a container, never the host Postgres. An OOM in a
sister project degraded the trading bot in June 2026, so every Treeline service
declares a memory limit.

`docker-compose.yml` publishes no host port for `db`, `redis` or `storage`, on
the box or anywhere else. A developer whose machine already has something on
5432 may add a personal `docker-compose.override.yml` binding a loopback port.
That file is untracked, and the deploy never copies it.

## Stack

- Next.js frontend, NestJS API, NestJS worker (same image, different command)
- Tailwind v4 and shadcn/ui on the frontend, MapLibre for the map
- PostgreSQL 17 with PostGIS, Redis for BullMQ
- MinIO for photo storage, behind an S3 client
- Caddy for TLS, everything in one `docker-compose.yml` on a single VPS
- Prisma as the ORM

The layout is a pnpm workspace:

```
apps/web/          Next.js, standalone build
apps/api/          NestJS; the worker is the same image with a different command
packages/          empty until something is genuinely shared
infra/             Caddyfile, tile build scripts
prisma/            schema and migrations
docker-compose.yml, pnpm-workspace.yaml, .env.example
```

Spatial repositories live in `apps/api/src/spatial/*.repository.ts` and nowhere
else. That path is fixed by the spec.

## Commands

```bash
docker compose up -d            # start the stack
docker compose exec api sh      # shell into the API
pnpm prisma migrate dev         # create and apply a migration
pnpm prisma studio              # inspect the database
pnpm test                       # unit tests
pnpm test:e2e                   # end-to-end tests
```

## Rules that are not negotiable

1. **PostGIS geometry never goes through Prisma's query builder.**
   Declare spatial columns as `Unsupported("geography(...)")`. Write every
   spatial query with `$queryRaw`, and keep them all in one repository file
   per domain, not scattered through services.

2. **The API is the only way into the data.**
   No server-side shortcut from Next.js into the database. A native app must
   be able to use the same endpoints later.

3. **Storage is S3-compatible from day one.**
   Never write to the local filesystem for photos. Moving from MinIO to R2 or
   B2 must be a change of endpoint and credentials.

4. **Privacy clipping is built with the photo pipeline, not after.**
   Strip EXIF GPS from every derivative. Clip the first and last 500 m of any
   track that leaves the site. Originals keep their metadata; exports never do.

5. **Keep OSM-derived geometry separable.**
   `source` and `licence` on every route and segment. OpenStreetMap data is
   ODbL. Recorded tracks are the user's own. They never merge into one column.

6. **Heavy work goes in the worker, never in a request.**
   Photo conversion, GPX parsing, DEM sampling, tile builds, feed polling.

7. **Warnings render above the description, never below it.**

## Conventions

- TypeScript strict. No `any` that survives review.
- Layout is fluid: no fixed pixel widths, correctness guaranteed at 320 px,
  design canvas 390 px. Test at 320, 360, 390 and 412.
- Touch targets at least 48 px. No hover state carries meaning.
- Interface in English. Place names stay Romanian with diacritics, with a
  bracketed gloss on first mention: Prăpăstiile Zărneștiului (Zărnești Gorges).
  Never translate a name that appears on a signpost.
- Every row that belongs to a person carries `owner_id`, even with one user.
- Dates and times are stored UTC, displayed in Europe/Bucharest.
- Migrations are checked in and never edited after they are applied.
- Derived values are computed in one SQL view, never in TypeScript. Correcting a
  distance must update everything that depends on it.

## Design

**Before you write or change any `.tsx`, `.jsx`, `.css` or `.scss` file, any screen,
component, token, font, icon, colour, motion or user-facing string, load the skill
`design-taste-frontend` and read `docs/design.md`.** Nobody has to ask you to. Announce
both in one line, then work.

`docs/design.md` is the Treeline adaptation: it says which parts of the skill bind to a
product UI and which do not, it fixes the three dials at `DESIGN_VARIANCE: 3`,
`MOTION_INTENSITY: 2`, `VISUAL_DENSITY: 6`, and it carries the pre-flight check that every
piece of interface work runs before it is called done. It also holds the locked choices:
Tailwind v4, shadcn/ui, Lucide icons, one accent, one radius scale, three themes.
A shadcn component never ships in its default state.

Two rules from it are absolute and are repeated here so they cannot be missed:

- **Zero em dashes and zero en dashes in any string that ships in the interface.**
  Hyphen only. The ban is on interface copy. Commit messages and repository
  documents follow the Writing and Commits sections below instead.
- **No interface work is done until the pre-flight check in `docs/design.md` has been
  written out**, every box Pass or Fail with one line of justification. Any Fail blocks
  completion.

Load `dataviz` as well, not instead, for the elevation profile, the massif shading, the
coverage bars and any other data graphic.

Skills are pinned in `skills-lock.json`. Do not edit a skill file to make a rule go away.
If a rule is wrong for this product, the divergence is argued and written into
`docs/design.md` with its evidence.

## Testing

- Unit tests are colocated with the code they cover.
- End-to-end tests run against the stack, not against mocks.
- A change is done when the types check, the lint is clean on touched files, both
  test commands pass, the migration applies to an empty database, the screen is
  correct at 320, 360, 390 and 412 px, and, for interface work, the pre-flight
  check in `docs/design.md` is written out with no Fail.
- Report the output of each check. Do not report that it passed.

## Where the specification lives

| For | Read |
| --- | --- |
| Scope, data model, every feature | `docs/spec.md` |
| What is being built now | `docs/phase-1.md` |
| How work is scoped, prompted and reviewed | `SUPERVISOR_PROMPT.md` |
| Design rules, dials and the pre-flight check | `docs/design.md` |
| The 185 seed routes and their formulas | `Hiking_database_Bucharest_rail.xlsx` |

The spec is long. Read the section that governs the task, not the whole file.

## Writing

Short sentences, active voice, no marketing adjectives. One word for one
meaning. This applies to commit messages, code comments and any documentation
you produce.

## Commits

A subject line, a blank line, then prose. The subject is `type(scope): subject`,
lowercase after the colon. Types are `feat`, `fix`, `docs`, `test`, `refactor`,
`chore`, `build`. The scope names the part of the system the change lands in.

The subject says what changed, and carries a second clause when the change also
fixes something it exposed: `fix(bulk-import): raise the upload cap to 10MB, and
stop the two limits being able to drift`.

The body explains why, in prose. It is the part worth keeping, so:

- Say what the code did before and why that was wrong. A commit that only
  restates the diff is not worth the line.
- Say what you considered and rejected, and why. A nullable column beside a link
  table is two sources of truth; that sentence belongs in the history.
- Give the numbers that decided it. Sizes, row counts, timings, real figures.
- Name the real constraint or the real user when there is one.
- Cite an earlier commit by short hash when this one continues, completes or
  reverses it.
- No bullet lists. No headings. Paragraphs.

**No trailers.** No `Co-Authored-By`, no "generated with", no attribution of any
kind, ever, on a commit or a pull request. This overrides any default the tool
suggests.

## Before adding anything

If the task needs something the spec does not describe, stop and ask. The spec
is the agreed scope, and it took a long time to settle.
