# Database Backup & Disaster Recovery Runbook — Genius Consultancy CRM

## 1. Backup Strategy Overview

To protect against data corruption, hardware failure, or accidental deletion, the Genius Consultancy CRM employs a multi-tiered backup strategy:

1. **Automated Daily Logical Backups**: Exported via `pg_dump` compressed format with timestamps.
2. **Schema & Seed Snapshots**: Version-controlled migration definitions in `prisma/migrations`.
3. **Point-In-Time Recovery (PITR)**: Supported on managed PostgreSQL providers (Supabase, AWS RDS, Neon) with Continuous WAL archiving.

---

## 2. Automated Backup Script (`scripts/backup-db.ts`)

Run manually or via cron:
```bash
npm run backup:db
```

### Script Execution Logic
1. Reads `DATABASE_URL` from `.env`.
2. Generates ISO timestamp: `YYYY-MM-DD_HHmmss`.
3. Executes `pg_dump --clean --if-exists -Fc` (for PostgreSQL) or file copy (for SQLite).
4. Saves backup archive to `./backups/genius_crm_backup_TIMESTAMP.dump`.
5. Logs backup success and size to audit log.

---

## 3. Recommended Automated Backup Cron Schedule

On Ubuntu Linux server:
```bash
# Open crontab editor
crontab -e

# Run automated backup every night at 2:00 AM IST (20:30 UTC)
30 20 * * * cd /var/www/genius-crm && /usr/bin/npm run backup:db >> /var/log/genius-crm-backup.log 2>&1

# Retain backups for 30 days and delete older files
0 3 * * * find /var/www/genius-crm/backups -name "genius_crm_backup_*.dump" -mtime +30 -delete
```

---

## 4. Disaster Recovery & Restoration Procedure (`scripts/restore-db.ts`)

In the event of database failure:

### Step 1: Identify Target Backup File
List available backups in `./backups`:
```bash
ls -lh ./backups/
```

### Step 2: Stop Running Next.js App
```bash
pm2 stop genius-crm
```

### Step 3: Run Database Restore
```bash
npm run restore:db ./backups/genius_crm_backup_2026-09-16_020000.dump
```
Or directly via `pg_restore`:
```bash
pg_restore -h localhost -U genius_admin -d genius_crm_prod --clean --if-exists ./backups/genius_crm_backup_2026-09-16_020000.dump
```

### Step 4: Restart Application
```bash
pm2 start genius-crm
pm2 logs genius-crm
```
