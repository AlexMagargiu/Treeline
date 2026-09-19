# Coding prompt: infrastructure

You are implementing section 1 of `docs/phase-1.md` in the Treeline repository. Read
`CLAUDE.md` first, then the "1. Infrastructure" section of `docs/phase-1.md`, then this
file. Work in plan mode, implement the whole prompt, run every gate, and report the output
of each one rather than a claim that it passed.

The repository holds documents and no code. You are creating the first code in it.

## Hard rules for this prompt

**Never touch the server.** No `ssh`, no `scp`, no `rsync`, no `curl` against
`89.167.90.189` or any hostname that resolves to it, not even read-only. The box runs
other people's live services. Everything you build is tested locally under Docker Compose.
Where the deploy needs a command run against the box, you write that command into
`docs/deploy.md` for a human to run. This is rule 6 of `CLAUDE.md` and it has no exception.

**Scope is section 1 only.** No Prisma models, no migrations with content, no auth, no
endpoints beyond the two health checks below, no Tailwind, no shadcn, no map, no tiles.
If something you need is not in this prompt, stop and ask.

**The box is shared.** Treeline runs as its own Compose project named `treeline`, with its
own volumes, its own container names and its own Postgres inside a container. Nothing you
write may read, restart, reconfigure or reference the host's Postgres, `metar-bot` (port
8080), `sports-bot` (port 8082) or anything else on that machine. The only host ports
Treeline binds are 80 and 443, through Caddy.

## What you are building

A pnpm workspace that comes up with `docker compose up -d`, serves a placeholder page over
Caddy, answers two health checks, and ships a deploy that a human runs.

### Layout

Create exactly this. Do not invent extra directories.

```
apps/web/                 Next.js, standalone output
apps/api/                 NestJS; the worker is the same image with a different command
packages/                 .gitkeep only, empty until something is genuinely shared
infra/Caddyfile
infra/backup.sh
prisma/schema.prisma      datasource and generator only, no models
prisma/migrations/        .gitkeep only
docs/deploy.md
.github/workflows/deploy.yml
docker-compose.yml
pnpm-workspace.yaml
package.json
.env.example
.gitignore
```

Spatial repositories will live in `apps/api/src/spatial/*.repository.ts` in a later
prompt. Do not create that directory now.

### Root scripts

`package.json` at the root defines the commands `CLAUDE.md` promises, delegating to the
workspaces: `test`, `test:e2e`, `lint`, `typecheck`, `build`. `test:e2e` may exit 0 with a
message that no end-to-end test exists yet; the first one arrives with the API prompt.

### Services

Seven long-running services plus two that run and exit. Service names are fixed, because
`CLAUDE.md` documents `docker compose exec api sh`.

| Service | Image | Binds | `mem_limit` |
| --- | --- | --- | --- |
| `proxy` | `caddy:2-alpine` | 80, 443 on the host | 64m |
| `web` | built from `apps/web/Dockerfile` | 3000, internal only | 512m |
| `api` | built from `apps/api/Dockerfile` | 3001, internal only | 512m |
| `worker` | the `api` image, different command | none | 384m |
| `db` | `postgis/postgis:17-3.5` | 5432, internal only | 1g |
| `redis` | `redis:7-alpine` | 6379, internal only | 192m |
| `storage` | `minio/minio` | 9000 and 9001, internal only | 256m |
| `backup` | `postgis/postgis:17-3.5`, runs `infra/backup.sh` | none | 64m |
| `migrate` | the `api` image, one shot, `profiles: [deploy]` | none | 512m |

That sums to 2984 MB of steady state, inside the 3 GB the project is allowed on an 8 GB
box that runs live services. The numbers are not suggestions: a runaway in a sister
project OOM'd this machine in June 2026 and degraded a trading bot. Every long-running
service carries a `mem_limit`.

`db`, `redis` and `storage` publish no host ports, in local development as well as on the
box. Reach them with `docker compose exec`.

Give `db` sensible flags for a 1 GB limit: `-c shared_buffers=256MB -c max_connections=50`.
Give `redis` `--maxmemory 128mb --maxmemory-policy noeviction`, because it will hold a job
queue and silently dropping jobs is worse than failing.

### Volumes

Named, and declared in the Compose file: `db_data`, `minio_data`, `caddy_data`,
`caddy_config`, `tiles`, `backups`. `tiles` exists now and stays empty until section 4,
because it grows to tens of gigabytes and moving it later means downtime.

### Caddy

`infra/Caddyfile`, one site block:

- The site address is `{$TREELINE_HOST}`, read from the environment. Never hard-code a
  hostname. Locally it is `localhost`, where Caddy issues its own certificate; on the box
  it is `89-167-90-189.sslip.io`.
- `handle /api/*` proxies to `api:3001` **without** stripping the prefix.
- `handle` everything else proxies to `web:3000`.
- Compression on, and a `header` block setting `X-Content-Type-Options: nosniff` and
  `Referrer-Policy: strict-origin-when-cross-origin`. Nothing more; the security headers a
  page actually needs arrive with the frontend prompt.

### The API

NestJS, TypeScript strict. `app.setGlobalPrefix('api')`, so an endpoint written as
`/auth/login` in `docs/phase-1.md` is served at `/api/auth/login` and the same path works
with and without Caddy in front. Later prompts depend on this, so do not change it.

One endpoint: `GET /api/health` returns `{ "status": "ok" }` with status 200. One
colocated unit test covers it.

`apps/api/src/worker.ts` is the worker entry point. It boots a Nest application context,
logs that it started, and stays alive. It consumes nothing yet; BullMQ arrives with the
photo and GPX work in a later phase. Keep it under twenty lines.

### The web app

Next.js with `output: 'standalone'`, TypeScript strict, the App Router.

- `app/health/route.ts` returns 200 with the body `ok`. The middleware in the frontend
  prompt will exempt this path, so it must exist now.
- `app/page.tsx` is a placeholder and nothing more. See "Design" below for exactly how
  little it may be.
- Do not install Tailwind, shadcn/ui, Lucide or any font. The frontend prompt installs the
  design stack once the accent colour and the type pair are decided, and those two
  decisions are open. Installing them now means guessing them.

### Prisma

`prisma/schema.prisma` holds a `datasource db` on `env("DATABASE_URL")` with provider
`postgresql`, the `postgresqlExtensions` preview feature, and a `generator client`. No
models. `prisma/migrations/` holds only a `.gitkeep`, so that `prisma migrate deploy` in
the `migrate` service finds an empty directory and exits 0 instead of failing. The schema
and the first migration, including enabling PostGIS by hand, belong to the next prompt.

### Backups

`infra/backup.sh`, run by the `backup` service: wait until 03:00 UTC, `pg_dump -Fc` the
database to `/backups/treeline-YYYY-MM-DD.dump`, delete dumps older than
`BACKUP_RETENTION_DAYS`, log one line per run, loop. No cron daemon, no extra image.

A dump on the same disk as the database it protects is not a backup, so `docs/deploy.md`
carries the `rsync` command that pulls `/root/treeline/backups` down to the user's own
machine, and says plainly that the backup is not real until that command runs on a
schedule the user controls.

### Deploy

`.github/workflows/deploy.yml`, triggered on push to `main` and by `workflow_dispatch`:

1. Build `apps/web` and `apps/api` with `docker/build-push-action`, build context the
   repository root, and push to `ghcr.io/alexmagargiu/treeline-web` and
   `ghcr.io/alexmagargiu/treeline-api`, tagged with both the commit SHA and `latest`.
2. Copy only `docker-compose.yml` and `infra/Caddyfile` to `/root/treeline/` on the host.
   Nothing else, and nothing outside that directory.
3. Over SSH, in `/root/treeline`: `docker compose -p treeline pull`, then
   `docker compose -p treeline --profile deploy run --rm migrate`, then
   `docker compose -p treeline up -d`. Migrations run before the API starts, which is why
   `migrate` is a one-shot service and not an entrypoint.

Secrets used: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`. The registry push uses the built-in
`GITHUB_TOKEN`. The box needs its own `docker login ghcr.io` with a personal access token
carrying `read:packages`, which is a human step and belongs in `docs/deploy.md`.

Set `image:` on `web`, `api`, `worker` and `migrate` to the ghcr tags alongside `build:`,
so the same file builds locally and pulls on the box.

### Out of scope, and say so in your report

`docs/phase-1.md` section 1 lists "VPS hardening: SSH keys only, firewall open on 22, 80,
443, fail2ban, unattended security upgrades". **Do not build it and do not write commands
for it.** On that box `ufw` is inactive deliberately and the Hetzner Cloud firewall is the
control. Enabling a host firewall or `fail2ban` under running third-party services is a
change to those services, not to Treeline. The supervisor has left it out until the user
decides. Ports 80 and 443 are already open in the Hetzner console.

### `docs/deploy.md`

Every command a human runs against the box, in order, each with one line saying what it
does and what it should print: installing Docker if it is missing, `docker login ghcr.io`,
creating `/root/treeline`, writing `.env` there, the first `up -d`, checking the
certificate, pulling the backups, and rolling back to the previous SHA tag. Written for a
person who is not in this session.

## Design (mandatory, do this before you write any markup)

This prompt creates one `.tsx` file, so the design rules apply in full. They are pasted
here because you have no memory of the session that wrote this prompt.

---

**Design (mandatory, do this before you write any markup)**

1. Load the skill `design-taste-frontend`, then read `docs/design.md`. Announce both in one
   line.
2. The dials for this product are fixed: `DESIGN_VARIANCE: 3`, `MOTION_INTENSITY: 2`,
   `VISUAL_DENSITY: 6`. Do not re-derive them and do not override them.
3. Section 2 of `docs/design.md` says which parts of the skill bind here. The landing page
   rules do not. The anti slop rules, the accessibility rules and the em dash ban do.
4. Zero em dashes and zero en dashes in any string that ships in the interface. Hyphen
   only. Your commit message follows the Commits section of `CLAUDE.md` instead.
5. Respect the locked choices in section 6 of `docs/design.md`. If your screen needs a
   decision that is still open in section 7, stop and ask. Do not pick one.
6. Before you report done, run the Treeline pre-flight check in section 9 of
   `docs/design.md` and write out every box with Pass or Fail and one line of
   justification. Any Fail blocks completion.

---

**The screen budget for this prompt is deliberately almost nothing.** `app/page.tsx` is a
single semantic `<main>` with one heading that says the stack is running, and no second
element. No colours, no tokens, no icons, no font, no component library, no motion, no
image. The reason is in point 5 above: the accent colour and the type pair are open
decisions in section 7 of `docs/design.md`, and a placeholder that invents them is a
placeholder somebody has to unpick. Run the pre-flight check against that one page anyway
and write it out. Boxes that cannot apply to a page with no design in it are marked Pass
with the reason "no design surface in this prompt", not skipped.

## Verification, in this order

Report the output of each, not a claim.

1. `pnpm typecheck`. TypeScript strict, zero errors, no surviving `any`.
2. `pnpm lint`. Zero issues in the files you created.
3. `pnpm test`. The health controller test passes.
4. `pnpm test:e2e`. Exits 0 with its "no end-to-end test yet" message.
5. `docker compose up -d` from a clean state, then `docker compose ps`: all seven
   long-running services healthy or running, `backup` included.
6. `curl -k https://localhost/api/health` returns `{"status":"ok"}`.
7. `curl -k https://localhost/health` returns `ok`.
8. `docker compose exec db psql -U treeline -d treeline -c 'select 1'` works, and
   `docker port` shows no host port on `db`, `redis` or `storage`.
9. `docker stats --no-stream` after the stack settles: the total is under 3 GB.
10. `docker compose down` then `docker compose up -d` and the site returns. This is the
    check `docs/phase-1.md` states for section 1.
11. The placeholder page at 320, 360, 390 and 412 px with no sideways scrolling.
12. The design pre-flight check from section 9 of `docs/design.md`, written out, every box
    Pass or Fail with one line.

## Manual steps for the user

Write these at the end of your report, as numbered steps with the expected result of each:
what to run locally to see the stack come up, what to open in a browser, and which
commands from `docs/deploy.md` to run against the box for the first deploy. You do not run
the last group.

## Ask, do not guess

Stop and ask the supervisor if any of these comes up:

- Docker or the Compose plugin turns out to be absent from the box, or its version is
  old enough to change the Compose file.
- Anything already binds 80 or 443 on the box.
- A gate cannot pass without adding a dependency this prompt does not name.
- The design pre-flight produces a Fail you cannot fix inside the screen budget above.
