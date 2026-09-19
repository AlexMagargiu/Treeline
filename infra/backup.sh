#!/bin/sh
# Nightly pg_dump at 03:00 UTC. Run by the backup service, which has no cron daemon.
# A dump on the same disk as the database is not a backup. See docs/deploy.md for the
# rsync that pulls these off the box.
set -eu

export PGPASSWORD="$POSTGRES_PASSWORD"

while true; do
	now=$(date -u +%s)
	next=$(date -u -d 'today 03:00' +%s)
	[ "$next" -le "$now" ] && next=$(date -u -d 'tomorrow 03:00' +%s)
	sleep $((next - now))

	file="/backups/treeline-$(date -u +%F).dump"
	if pg_dump -h db -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "$file"; then
		find /backups -name 'treeline-*.dump' -mtime "+$BACKUP_RETENTION_DAYS" -delete
		echo "$(date -u +%FT%TZ) backup ok $file $(stat -c %s "$file") bytes"
	else
		echo "$(date -u +%FT%TZ) backup failed"
	fi
done
