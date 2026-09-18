# Tailor Management System V1 ? Disaster Recovery & Backup Plan

## 1. Objectives & SLA Targets
- **Recovery Point Objective (RPO)**: <= 15 minutes (maximum permissible data loss window in severe disaster).
- **Recovery Time Objective (RTO)**: <= 60 minutes (maximum duration to restore full operational service).

---

## 2. PostgreSQL Automated Backup Strategy

### 2.1 Daily Logical Dump Script (`backup.sh`)
```bash
#!/bin/bash
set -e

BACKUP_DIR="/var/backups/tailor_db"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/tailor_db_${TIMESTAMP}.dump"

mkdir -p ${BACKUP_DIR}

# Execute custom format compressed backup
pg_dump -h localhost -U postgres -d tailor_db -F c -b -v -f ${BACKUP_FILE}

# Encrypt backup archive with GPG
gpg --batch --yes --passphrase "${BACKUP_PASSPHRASE}" -c ${BACKUP_FILE}
rm ${BACKUP_FILE}

# Upload encrypted archive to secure off-site object storage
rclone copy ${BACKUP_FILE}.gpg remote-storage:tailor-backups/daily/

# Purge local backups older than 14 days
find ${BACKUP_DIR} -type f -name "*.dump.gpg" -mtime +14 -delete

echo "[$(date)] Tailor DB Backup completed successfully: ${BACKUP_FILE}.gpg"
```

---

## 3. Database Restoration Procedures

### 3.1 Full Disaster Restoration
1. Stop backend application services:
   ```bash
   pm2 stop tailor-backend
   ```
2. Decrypt backup file:
   ```bash
   gpg --batch --yes --passphrase "${BACKUP_PASSPHRASE}" -d tailor_db_20260920.dump.gpg > tailor_restore.dump
   ```
3. Drop and recreate clean database target:
   ```bash
   dropdb -U postgres --if-exists tailor_db
   createdb -U postgres tailor_db
   ```
4. Restore tables, schemas, and indexes:
   ```bash
   pg_restore -U postgres -d tailor_db -v tailor_restore.dump
   ```
5. Run Prisma migration check to ensure schema compatibility:
   ```bash
   cd /var/www/tailor-backend && npx prisma migrate status
   ```
6. Restart application:
   ```bash
   pm2 start tailor-backend
   ```

---

## 4. Document & Media Storage Backup

Fabric swatches, measurement sketches, and invoice PDFs stored in `./uploads`:
```bash
# Sync local uploads directory to secure cloud bucket hourly
aws s3 sync /var/www/tailor-backend/uploads s3://tailor-atelier-media-backup/uploads/ --delete
```
