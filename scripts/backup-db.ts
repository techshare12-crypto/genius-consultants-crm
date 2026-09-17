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
  console.log('🔄 Starting Database Backup for Genius Consultancy CRM...');

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.json`);

  try {
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

    const serialized = JSON.stringify(
      {
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
      },
      null,
      2
    );

    const checksum = crypto.createHash('sha256').update(serialized).digest('hex');

    const backupData = {
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        system: 'Genius Consultancy CRM',
        checksum,
        retentionDays: RETENTION_DAYS,
        recordCounts: {
          candidates: candidates.length,
          applications: applications.length,
          callLogs: callLogs.length,
          callbacks: callbacks.length,
          auditLogs: auditLogs.length,
        },
      },
      data: JSON.parse(serialized),
    };

    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf-8');
    const stats = fs.statSync(backupFile);

    console.log('✅ Logical Database Backup Successful!');
    console.log(`📁 File: ${backupFile}`);
    console.log(`📦 Size: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`🔒 SHA256 Checksum: ${checksum}`);
    console.log(`👥 Candidates: ${candidates.length}, 📋 Applications: ${applications.length}, 📞 Call Logs: ${callLogs.length}`);

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
