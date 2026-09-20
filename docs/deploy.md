# Deploying Treeline

Every command here is run by a person, on their own machine or on the VPS. Nothing in
this file is run by an agent.

The box is `89.167.90.189`, reached as `root` with the key `~/.ssh/github`.

**The box is shared.** `metar-bot` trades live money on port 8080, `sports-bot` answers on
8082, and a Postgres on the host, `polymarket_account_tracker` and `polymarket-sidecar`
belong to those projects. None of it is Treeline's. Do not stop, restart, move, upgrade or
reconfigure any of it. Treeline is its own Compose project, with its own volumes, its own
Postgres inside a container, and the only host ports it binds are 80 and 443.

VPS hardening is deliberately not in this file. `ufw` is inactive on that box on purpose
and the Hetzner Cloud firewall is the control. Ports 80 and 443 are already open there.
Turning on a host firewall or fail2ban underneath running third-party services changes
those services, not Treeline.

---

## Part 1: first deploy, once

### 1. Check whether Docker is already there

```sh
ssh -i ~/.ssh/github root@89.167.90.189 'docker --version && docker compose version'
```

Prints a Docker version and a Compose v2 version or later. If either is missing, install
it with the next step. If Compose prints v1 (`docker-compose` with a hyphen), stop and say
so, because this Compose file needs v2.

### 2. Install Docker, only if step 1 showed it missing

```sh
ssh -i ~/.ssh/github root@89.167.90.189 'curl -fsSL https://get.docker.com | sh'
```

Ends with a Docker version line. The other projects on the box already use Docker, so this
step is almost certainly unnecessary.

### 3. Check nothing else holds 80 or 443

```sh
ssh -i ~/.ssh/github root@89.167.90.189 'ss -ltnp "sport = :80 or sport = :443"'
```

Prints nothing, or prints only Treeline's own `proxy`. If anything else is listening,
stop and say what it is. Do not kill it.

### 4. Nothing to do: the registry login happens inside the deploy

There is no personal access token to create and none to store. The deploy job logs the box
in to `ghcr.io` with the workflow run's own `GITHUB_TOKEN`, pulls, and logs out again, so
the credential lives for the length of the job and cannot be reused afterwards.

A long-lived `read:packages` token in `/root/.docker/config.json` would be a second
permanent credential on a machine shared with other projects, and nothing would ever
rotate it.

### 5. Create the project directory

```sh
mkdir -p /root/treeline
```

Prints nothing. This is the only directory on the box that Treeline writes to.

### 6. Write the environment file

On the box, at `/root/treeline/.env`. Copy `.env.example` from the repository and fill it
in. Use real passwords, not the placeholders.

```sh
cat > /root/treeline/.env <<'EOF'
TREELINE_HOST=89-167-90-189.sslip.io
IMAGE_TAG=latest
POSTGRES_USER=treeline
POSTGRES_PASSWORD=<a long random string>
POSTGRES_DB=treeline
REDIS_URL=redis://redis:6379
SEED_OWNER_ID=00000000-0000-0000-0000-000000000001
TREELINE_PASSWORD_HASH='<the hash from step 6a>'   # the single quotes matter, see 6a
SESSION_COOKIE_NAME=treeline_session
SESSION_TTL_DAYS=30
LOGIN_MAX_ATTEMPTS=5
LOGIN_WINDOW_MINUTES=15
MINIO_ROOT_USER=treeline
MINIO_ROOT_PASSWORD=<a different long random string>
S3_ENDPOINT=http://storage:9000
S3_BUCKET=treeline-photos
BACKUP_RETENTION_DAYS=14
EOF
chmod 600 /root/treeline/.env
```

Prints nothing. `TREELINE_HOST` must be a name that resolves to the box, because Caddy
asks Let's Encrypt for a certificate for it. `89-167-90-189.sslip.io` resolves to
`89.167.90.189` without any DNS of your own.

There is no `DATABASE_URL` here. `api`, `worker` and `migrate` build their own connection
string from `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB`, so the password is
written once. The `DATABASE_URL` in `.env.example` is the host's view of a local database
and nothing on the box reads it. Keep the password free of characters a URL reserves.

There is no `REDIS_URL_HOST` here either, for the same reason: it is the host's view of
Redis, used by the end-to-end suite on a development machine, and nothing on the box
reads it.

### 6a. Generate the password hash

One shared password protects the whole site. The site stores an argon2id hash of it and
never the password itself. Generate the hash on your own machine, in the repository:

```sh
node -e 'require("@node-rs/argon2").hash(process.argv[1]).then(console.log)' 'your password'
```

Prints one line beginning `$argon2id$v=19$m=19456,t=2,p=1$`. Paste that line into
`TREELINE_PASSWORD_HASH` in `/root/treeline/.env`, and keep the password itself in a
password manager. The hash is safe to put in a file with mode 600; the password is not
safe anywhere.

Three things to watch, and the first one will lock you out of your own site if you miss
it. **Wrap the hash in single quotes inside `.env`.** The hash contains `$` and Compose
interpolates `$` in `.env` values, so an unquoted hash is read as the variables
`$argon2id`, `$v`, `$m` and the salt, each substituted with an empty string. Measured on
2026-09-20:

```
unquoted:      warning: The "argon2id" variable is not set. Defaulting to a blank string.
               warning: The "m" variable is not set. Defaulting to a blank string.
single quoted: HASH=$argon2id$v=19$m=19456,t=2,p=1$...   (the container gets it intact)
```

The API then compares every password against a mangled hash and nobody can log in, with
nothing in the logs that names the cause. The quoted heredoc above protects the value from
the shell; the single quotes protect it from Compose. You need both.

Second, it is never echoed into a terminal you keep. And changing the hash logs nobody out: sessions live in Redis
and last thirty days. To end every session at once, `docker compose exec redis redis-cli
--scan --pattern 'session:*' | xargs -r docker compose exec -T redis redis-cli del`.

### 7. Push to main, and let the workflow run

The workflow needs three repository secrets set at
https://github.com/alexmagargiu/treeline/settings/secrets/actions:

| Secret | Value |
| --- | --- |
| `VPS_HOST` | `89.167.90.189` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | the full private key from `~/.ssh/github` |

The registry push uses the built-in `GITHUB_TOKEN` and needs no secret.

A push to `main` then builds both images, copies `docker-compose.yml`, `infra/Caddyfile`
and `infra/backup.sh` to `/root/treeline/`, and runs the deploy. The Actions run goes
green.

### 8. Bring the stack up by hand the first time, if you prefer

```sh
cd /root/treeline
docker compose -p treeline pull
docker compose -p treeline --profile deploy run --rm migrate
docker compose -p treeline up -d
```

`pull` prints one line per image. `migrate` prints `No migration found in
prisma/migrations` and exits 0, because the migrations directory is still empty. `up -d`
prints a `Started` line for each of the eight services.

### 9. Check the services

```sh
docker compose -p treeline ps
```

Eight services, all `running`, and `web`, `api`, `db`, `redis` and `storage` marked
`(healthy)`.

### 10. Check the certificate

```sh
curl -sI https://89-167-90-189.sslip.io/api/health | head -1
curl -s https://89-167-90-189.sslip.io/api/health
```

The first prints `HTTP/2 200`, with no `-k`, which is the proof that Let's Encrypt issued
a real certificate. The second prints `{"status":"ok"}`.

If the certificate did not issue, read why:

```sh
docker compose -p treeline logs proxy | tail -40
```

### 11. Check Treeline's memory footprint

```sh
docker stats --no-stream $(docker compose -p treeline ps -q)
```

The MEM USAGE column totals well under 3 GiB. The box has 8 GB and runs live services
that are not ours.

---

## Part 2: the backup, which is not finished until you do this

The `backup` service dumps the database to the `backups` volume at 03:00 UTC every night
and deletes dumps older than `BACKUP_RETENTION_DAYS`.

**A dump on the same disk as the database it protects is not a backup.** If that disk
fails, both are gone. The backup is not real until the command below runs on a schedule
you control, on a machine that is not the VPS.

### Pull the dumps down

The dumps live in a Docker volume, so copy them out to a plain directory first:

```sh
ssh -i ~/.ssh/github root@89.167.90.189 \
  'docker run --rm -v treeline_backups:/backups -v /root/treeline/backups:/out alpine cp -au /backups/. /out/'
```

Then, from your own machine:

```sh
rsync -avz --delete -e 'ssh -i ~/.ssh/github' \
  root@89.167.90.189:/root/treeline/backups/ ~/backups/treeline/
```

Prints a file list and a transfer summary. Put both commands in a cron job or a systemd
timer on your own machine, daily, after 03:00 UTC. Until you do, there is no backup.

Check a dump is real before trusting it:

```sh
pg_restore --list ~/backups/treeline/treeline-$(date -u +%F).dump | head
```

Prints a table of contents. An error here means the dump is broken.

### Read the backup log

```sh
docker compose -p treeline logs backup | tail -5
```

One line per night: `2026-09-20T03:00:01Z backup ok /backups/treeline-2026-09-20.dump
41234 bytes`.

---

## Part 3: rolling back

Every build pushes both a `latest` tag and a commit SHA tag. To go back to a known good
commit, point `IMAGE_TAG` at its SHA and bring the stack up again.

```sh
cd /root/treeline
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<the full 40 character commit sha>/' .env
docker compose -p treeline pull
docker compose -p treeline up -d
```

`pull` prints one line per image, `up -d` prints `Recreated` for `web`, `api` and
`worker`. Check with:

```sh
docker compose -p treeline ps --format '{{.Service}} {{.Image}}'
```

The SHA you chose appears on `web`, `api` and `worker`.

A rollback does not undo a migration. If the bad deploy migrated the database, restore
from a dump instead:

```sh
docker compose -p treeline exec -T db pg_restore -U treeline -d treeline --clean --if-exists < ~/backups/treeline/<the dump>.dump
```

To go back to the current build, set `IMAGE_TAG=latest` and repeat the pull and the
`up -d`.

---

## Part 4: everyday commands

```sh
docker compose -p treeline logs -f api      # follow the API log
docker compose -p treeline exec api sh      # a shell in the API container
docker compose -p treeline exec db psql -U treeline -d treeline
docker compose -p treeline restart api      # restart one Treeline service only
docker compose -p treeline down             # stop Treeline, keep its volumes
```

`down` without `-v` keeps every volume. **Never pass `-v`** unless you intend to destroy
the database, the photographs and the tiles.

None of these touch `metar-bot`, `sports-bot`, the host Postgres or anything else on the
box, because every one of them is scoped to the `treeline` project.
