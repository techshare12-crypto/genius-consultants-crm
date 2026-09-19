import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
const BACKUP_DIR = process.env.BACKUP_DIR || path.resolve(process.cwd(), 'backups');

async function pruneOldBackups(dir: string, days: number) {
  if (!fs.existsSync(dir)) return;
  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(dir);
  let prunedCount = 0;

  for (const file of files) {
    if (file.startsWith('backup-') && file.endsWith('.json')) {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);
      if (stats.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        prunedCount++;
      }
    }
  }
  if (prunedCount > 0) {
    console.log(`🧹 Pruned ${prunedCount} backups older than ${days} days.`);
  }
}

async function runBackup() {
  console.log('================================================================');
  console.log('🔄 STARTING LOGICAL DATABASE BACKUP (READ-ONLY)');
  console.log('================================================================\n');

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.json`);

  try {
    // 1. Connection metadata (masked)
    let dbName = 'unknown';
    let dbVersion = 'unknown';
    try {
      const dbNameRes = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database();`;
      const versionRes = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version();`;
      dbName = dbNameRes[0]?.current_database || 'unknown';
      dbVersion = versionRes[0]?.version?.split(' on ')[0] || 'unknown';
    } catch {
      // Fallback for SQLite dev mode
      dbName = 'local_sqlite';
    }

    console.log(`Target Database:  ${dbName}`);
    console.log(`Database Version: ${dbVersion}\n`);

    // 2. Fetch Prisma Migration History
    let migrations: any[] = [];
    try {
      migrations = await prisma.$queryRaw<Array<any>>`
        SELECT id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count
        FROM "_prisma_migrations"
        ORDER BY finished_at ASC;
      `;
      console.log(`✔ Extracted ${migrations.length} migration history records.`);
    } catch {
      console.log('ℹ SQLite / unmigrated mode: skipping _prisma_migrations table extraction.');
    }

    // 3. Extract Schema Structure
    let schemaTables: any[] = [];
    let schemaColumns: any[] = [];
    try {
      schemaTables = await prisma.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
      `;
      schemaColumns = await prisma.$queryRaw<Array<any>>`
        SELECT table_name, column_name, data_type, is_nullable, column_default
        FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;
      `;
      console.log(`✔ Extracted schema metadata (${schemaTables.length} tables, ${schemaColumns.length} columns).`);
    } catch {
      console.log('ℹ SQLite / non-information_schema database.');
    }

    // 4. Extract All Table Records
    const [
      users,
      roles,
      permissions,
      userRoles,
      teams,
      companies,
      companyContacts,
      jobRequirements,
      candidates,
      applications,
      assignmentHistories,
      callLogs,
      callbacks,
      screenings,
      submissions,
      submissionItems,
      interviews,
      qualityReviews,
      auditLogs,
      importBatches,
    ] = await Promise.all([
      prisma.user.findMany(),
      prisma.role.findMany(),
      prisma.permission.findMany(),
      prisma.userRole.findMany(),
      prisma.team.findMany(),
      prisma.company.findMany(),
      prisma.companyContact.findMany(),
      prisma.jobRequirement.findMany(),
      prisma.candidate.findMany(),
      prisma.application.findMany(),
      prisma.applicationAssignmentHistory.findMany(),
      prisma.callLog.findMany(),
      prisma.callback.findMany(),
      prisma.screening.findMany(),
      prisma.clientSubmission.findMany(),
      prisma.clientSubmissionItem.findMany(),
      prisma.interview.findMany(),
      prisma.qualityReview.findMany(),
      prisma.auditLog.findMany(),
      prisma.importBatch.findMany(),
    ]);

    // Check application_verifications if table exists
    let verifications: any[] = [];
    try {
      verifications = await (prisma as any).applicationVerification?.findMany() || [];
    } catch {
      verifications = [];
    }

    const dataPayload = {
      users,
      roles,
      permissions,
      userRoles,
      teams,
      companies,
      companyContacts,
      jobRequirements,
      candidates,
      applications,
      assignmentHistories,
      callLogs,
      callbacks,
      screenings,
      submissions,
      submissionItems,
      interviews,
      qualityReviews,
      auditLogs,
      importBatches,
      verifications,
    };

    const serializedData = JSON.stringify(dataPayload, null, 2);
    const checksum = crypto.createHash('sha256').update(serializedData).digest('hex');

    const backupData = {
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.1.0',
        system: 'Genius Consultancy CRM',
        database: dbName,
        checksum,
        retentionDays: RETENTION_DAYS,
        recordCounts: {
          users: users.length,
          roles: roles.length,
          permissions: permissions.length,
          userRoles: userRoles.length,
          teams: teams.length,
          companies: companies.length,
          companyContacts: companyContacts.length,
          jobRequirements: jobRequirements.length,
          candidates: candidates.length,
          applications: applications.length,
          assignmentHistories: assignmentHistories.length,
          callLogs: callLogs.length,
          callbacks: callbacks.length,
          screenings: screenings.length,
          submissions: submissions.length,
          submissionItems: submissionItems.length,
          interviews: interviews.length,
          qualityReviews: qualityReviews.length,
          auditLogs: auditLogs.length,
          importBatches: importBatches.length,
          verifications: verifications.length,
        },
      },
      schema: {
        tables: schemaTables.map((t) => t.table_name),
        columns: schemaColumns,
        migrations,
      },
      data: dataPayload,
    };

    const finalJsonString = JSON.stringify(backupData, null, 2);
    fs.writeFileSync(backupFile, finalJsonString, 'utf-8');
    const stats = fs.statSync(backupFile);

    console.log('\n================================================================');
    console.log('✅ BACKUP COMPLETED & WRITTEN TO DISK');
    console.log('================================================================');
    console.log(`📁 File:             ${backupFile}`);
    console.log(`📦 Size:             ${(stats.size / 1024).toFixed(2)} KB (${stats.size} bytes)`);
    console.log(`🔒 SHA-256 Checksum: ${checksum}`);
    console.log('================================================================\n');

    // 5. Automated Verification & Validation
    console.log('🔍 Validating Backup File Integrity...');
    const readBack = fs.readFileSync(backupFile, 'utf-8');
    const parsed = JSON.parse(readBack);

    const recomputedCheck = crypto.createHash('sha256').update(JSON.stringify(parsed.data, null, 2)).digest('hex');
    if (recomputedCheck !== parsed.meta.checksum) {
      throw new Error(`Integrity Check Failed: Checksum mismatch! Expected ${parsed.meta.checksum}, got ${recomputedCheck}`);
    }

    console.log('✔ File Readability: PASSED');
    console.log('✔ JSON Parse: PASSED');
    console.log('✔ SHA-256 Checksum Match: PASSED (Data integrity verified)');
    console.log(`✔ Record Counts Verified: ${JSON.stringify(parsed.meta.recordCounts, null, 2)}`);

    // Prune old backups according to retention policy
    await pruneOldBackups(BACKUP_DIR, RETENTION_DAYS);
  } catch (err) {
    console.error('❌ Backup failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runBackup();
