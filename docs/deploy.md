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

### 4. Log the box in to the GitHub container registry

Create a personal access token at https://github.com/settings/tokens with the single
scope `read:packages`, then:

```sh
ssh -i ~/.ssh/github root@89.167.90.189
echo 'YOUR_TOKEN_HERE' | docker login ghcr.io -u alexmagargiu --password-stdin
```

Prints `Login Succeeded`. Without this, `docker compose pull` fails on every deploy with
`denied`.

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
