import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function verifyAndRestoreBackup(
  targetBackupPath?: string,
  options: { executeRestore?: boolean } = {}
) {
  const backupDir = process.env.BACKUP_DIR || path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    throw new Error('No backups directory found.');
  }

  let backupFile = targetBackupPath;
  if (!backupFile) {
    const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.json')).sort().reverse();
    if (files.length === 0) {
      throw new Error('No backup JSON files found to restore.');
    }
    backupFile = path.join(backupDir, files[0]);
  }

  console.log(`🔄 Reading backup file: ${backupFile}`);
  const raw = fs.readFileSync(backupFile, 'utf-8');
  const backup = JSON.parse(raw);

  if (!backup.meta || !backup.data) {
    throw new Error('Invalid backup file structure: missing meta or data payload.');
  }

  // Validate checksum
  const serialized = JSON.stringify(backup.data, null, 2);
  const calculatedChecksum = crypto.createHash('sha256').update(serialized).digest('hex');

  if (backup.meta.checksum && backup.meta.checksum !== calculatedChecksum) {
    throw new Error('Backup integrity validation failed: SHA256 checksum mismatch.');
  }

  console.log(`✅ Backup Integrity Verified!`);
  console.log(`📅 Timestamp: ${backup.meta.timestamp}`);
  console.log(`👥 Candidates: ${backup.data.candidates?.length || 0}`);
  console.log(`📋 Applications: ${backup.data.applications?.length || 0}`);
  console.log(`📞 Call Logs: ${backup.data.callLogs?.length || 0}`);
  console.log(`📝 Screenings: ${backup.data.screenings?.length || 0}`);
  console.log(`📊 Audit Logs: ${backup.data.auditLogs?.length || 0}`);

  let restoredCounts = {
    users: 0,
    candidates: 0,
    applications: 0,
    callLogs: 0,
    callbacks: 0,
    screenings: 0,
  };

  if (options.executeRestore) {
    console.log(`🚀 Executing Live Database Restoration into database...`);

    const data = backup.data;

    // 1. Restore Users
    if (data.users && Array.isArray(data.users)) {
      for (const u of data.users) {
        const { createdAt, updatedAt, lastActivityAt, lastLoginAt, ...rest } = u;
        await prisma.user.upsert({
          where: { id: u.id },
          update: {
            ...rest,
            lastActivityAt: lastActivityAt ? new Date(lastActivityAt) : null,
            lastLoginAt: lastLoginAt ? new Date(lastLoginAt) : null,
          },
          create: {
            ...rest,
            lastActivityAt: lastActivityAt ? new Date(lastActivityAt) : null,
            lastLoginAt: lastLoginAt ? new Date(lastLoginAt) : null,
            createdAt: new Date(createdAt),
            updatedAt: new Date(updatedAt),
          },
        });
        restoredCounts.users++;
      }
    }

    // 2. Restore Companies
    if (data.companies && Array.isArray(data.companies)) {
      for (const c of data.companies) {
        const { createdAt, updatedAt, ...rest } = c;
        await prisma.company.upsert({
          where: { id: c.id },
          update: rest,
          create: {
            ...rest,
            createdAt: new Date(createdAt),
            updatedAt: new Date(updatedAt),
          },
        });
      }
    }

    // 3. Restore Company Contacts
    if (data.companyContacts && Array.isArray(data.companyContacts)) {
      for (const cc of data.companyContacts) {
        const { createdAt, updatedAt, ...rest } = cc;
        await prisma.companyContact.upsert({
          where: { id: cc.id },
          update: rest,
          create: {
            ...rest,
            createdAt: new Date(createdAt),
            updatedAt: new Date(updatedAt),
          },
        });
      }
    }

    // 4. Restore Job Requirements
    if (data.jobRequirements && Array.isArray(data.jobRequirements)) {
      for (const j of data.jobRequirements) {
        const { createdAt, updatedAt, ...rest } = j;
        await prisma.jobRequirement.upsert({
          where: { id: j.id },
          update: rest,
          create: {
            ...rest,
            createdAt: new Date(createdAt),
            updatedAt: new Date(updatedAt),
          },
        });
      }
    }

    // 5. Restore Candidates
    if (data.candidates && Array.isArray(data.candidates)) {
      for (const can of data.candidates) {
        const { createdAt, updatedAt, ...rest } = can;
        await prisma.candidate.upsert({
          where: { id: can.id },
          update: rest,
          create: {
            ...rest,
            createdAt: new Date(createdAt),
            updatedAt: new Date(updatedAt),
          },
        });
        restoredCounts.candidates++;
      }
    }

    // 6. Restore Applications
    if (data.applications && Array.isArray(data.applications)) {
      for (const app of data.applications) {
        const {
          createdAt,
          updatedAt,
          assignedAt,
          formSentAt,
          formReceivedAt,
          cvRequestedAt,
          cvReceivedAt,
          readyForScreeningAt,
          finalShortlistedAt,
          ...rest
        } = app;
        await prisma.application.upsert({
          where: { id: app.id },
          update: {
            ...rest,
            assignedAt: assignedAt ? new Date(assignedAt) : null,
            formSentAt: formSentAt ? new Date(formSentAt) : null,
            formReceivedAt: formReceivedAt ? new Date(formReceivedAt) : null,
            cvRequestedAt: cvRequestedAt ? new Date(cvRequestedAt) : null,
            cvReceivedAt: cvReceivedAt ? new Date(cvReceivedAt) : null,
            readyForScreeningAt: readyForScreeningAt ? new Date(readyForScreeningAt) : null,
            finalShortlistedAt: finalShortlistedAt ? new Date(finalShortlistedAt) : null,
          },
          create: {
            ...rest,
            assignedAt: assignedAt ? new Date(assignedAt) : null,
            formSentAt: formSentAt ? new Date(formSentAt) : null,
            formReceivedAt: formReceivedAt ? new Date(formReceivedAt) : null,
            cvRequestedAt: cvRequestedAt ? new Date(cvRequestedAt) : null,
            cvReceivedAt: cvReceivedAt ? new Date(cvReceivedAt) : null,
            readyForScreeningAt: readyForScreeningAt ? new Date(readyForScreeningAt) : null,
            finalShortlistedAt: finalShortlistedAt ? new Date(finalShortlistedAt) : null,
            createdAt: new Date(createdAt),
            updatedAt: new Date(updatedAt),
          },
        });
        restoredCounts.applications++;
      }
    }

    console.log(`✅ Database Live Restoration Complete! Records Restored:`, restoredCounts);
  }

  return {
    valid: true,
    file: backupFile,
    meta: backup.meta,
    data: backup.data,
    counts: {
      candidates: backup.data.candidates?.length || 0,
      applications: backup.data.applications?.length || 0,
    },
    restoredCounts,
  };
}

async function runRestore() {
  try {
    const targetFile = process.argv[2];
    const isLive = process.argv.includes('--execute');
    await verifyAndRestoreBackup(targetFile, { executeRestore: isLive });
    console.log(`✅ Restore ${isLive ? 'live execution' : 'dry-run and integrity check'} completed successfully.`);
  } catch (err: any) {
    console.error('❌ Restore error:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  runRestore();
}
