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

    const defaultUser = await prisma.user.findFirst();
    const defaultCandidate = await prisma.candidate.findFirst();
    const defaultJob = await prisma.jobRequirement.findFirst();
    const defaultCompany = await prisma.company.findFirst();
    const userIdMap = new Map<string, string>();
    const companyIdMap = new Map<string, string>();
    const jobIdMap = new Map<string, string>();
    const candidateIdMap = new Map<string, string>();

    const resolveUserId = (id?: string | null) => {
      if (!id) return defaultUser?.id || '';
      return userIdMap.get(id) || id;
    };

    // 1. Restore Users
    if (data.users && Array.isArray(data.users)) {
      for (const u of data.users) {
        const { createdAt, updatedAt, lastActivityAt, lastLoginAt, ...rest } = u;
        const existingByEmail = await prisma.user.findUnique({ where: { email: u.email } });
        if (existingByEmail) {
          userIdMap.set(u.id, existingByEmail.id);
          await prisma.user.update({
            where: { id: existingByEmail.id },
            data: {
              fullName: rest.fullName,
              phone: rest.phone,
              passwordHash: rest.passwordHash,
              status: rest.status,
              lastActivityAt: lastActivityAt ? new Date(lastActivityAt) : null,
              lastLoginAt: lastLoginAt ? new Date(lastLoginAt) : null,
            },
          });
        } else {
          const created = await prisma.user.create({
            data: {
              ...rest,
              lastActivityAt: lastActivityAt ? new Date(lastActivityAt) : null,
              lastLoginAt: lastLoginAt ? new Date(lastLoginAt) : null,
              createdAt: new Date(createdAt),
              updatedAt: new Date(updatedAt),
            },
          });
          userIdMap.set(u.id, created.id);
        }
        restoredCounts.users++;
      }
    }

    // 2. Restore Companies
    if (data.companies && Array.isArray(data.companies)) {
      for (const c of data.companies) {
        const { createdAt, updatedAt, createdById, ...rest } = c;
        const validCreatedById = resolveUserId(createdById);
        const existingByCode = await prisma.company.findUnique({ where: { companyCode: c.companyCode } });
        if (existingByCode) {
          companyIdMap.set(c.id, existingByCode.id);
          await prisma.company.update({
            where: { id: existingByCode.id },
            data: { ...rest, createdById: validCreatedById },
          });
        } else {
          const upserted = await prisma.company.upsert({
            where: { id: c.id },
            update: { ...rest, createdById: validCreatedById },
            create: {
              ...rest,
              createdById: validCreatedById,
              createdAt: new Date(createdAt),
              updatedAt: new Date(updatedAt),
            },
          });
          companyIdMap.set(c.id, upserted.id);
        }
      }
    }

    // 3. Restore Company Contacts
    if (data.companyContacts && Array.isArray(data.companyContacts)) {
      for (const cc of data.companyContacts) {
        const { createdAt, updatedAt, companyId, ...rest } = cc;
        const validCompanyId = companyIdMap.get(companyId) || companyId;
        const validCompany = await prisma.company.findUnique({ where: { id: validCompanyId } });
        if (validCompany) {
          await prisma.companyContact.upsert({
            where: { id: cc.id },
            update: { ...rest, companyId: validCompany.id },
            create: {
              ...rest,
              companyId: validCompany.id,
              createdAt: new Date(createdAt),
              updatedAt: new Date(updatedAt),
            },
          });
        }
      }
    }

    // 4. Restore Job Requirements
    if (data.jobRequirements && Array.isArray(data.jobRequirements)) {
      for (const j of data.jobRequirements) {
        const { createdAt, updatedAt, createdById, companyId, id, ...rest } = j;
        const validCreatedById = resolveUserId(createdById);
        const validCompanyId = companyIdMap.get(companyId) || companyId;
        const jobData = {
          ...rest,
          companyId: validCompanyId,
          skillsRequired: Array.isArray(rest.skillsRequired) ? JSON.stringify(rest.skillsRequired) : (rest.skillsRequired || '[]'),
          salaryMin: rest.salaryMin != null ? Number(rest.salaryMin) : null,
          salaryMax: rest.salaryMax != null ? Number(rest.salaryMax) : null,
          vacancies: rest.vacancies != null ? Number(rest.vacancies) : 1,
          experienceMin: rest.experienceMin != null ? Number(rest.experienceMin) : 0,
          experienceMax: rest.experienceMax != null ? Number(rest.experienceMax) : null,
          createdById: validCreatedById,
        };
        const existingByCode = await prisma.jobRequirement.findUnique({ where: { jobCode: j.jobCode } });
        if (existingByCode) {
          jobIdMap.set(j.id, existingByCode.id);
          await prisma.jobRequirement.update({
            where: { id: existingByCode.id },
            data: jobData,
          });
        } else {
          const upserted = await prisma.jobRequirement.upsert({
            where: { id: j.id },
            update: jobData,
            create: {
              ...jobData,
              id: j.id,
              createdAt: new Date(createdAt),
              updatedAt: new Date(updatedAt),
            },
          });
          jobIdMap.set(j.id, upserted.id);
        }
      }
    }

    // 5. Restore Candidates
    if (data.candidates && Array.isArray(data.candidates)) {
      for (const can of data.candidates) {
        const { createdAt, updatedAt, createdById, id, ...rest } = can;
        const candData = {
          ...rest,
          skills: Array.isArray(rest.skills) ? JSON.stringify(rest.skills) : (rest.skills || '[]'),
          languages: Array.isArray(rest.languages) ? JSON.stringify(rest.languages) : (rest.languages || '[]'),
          currentSalary: rest.currentSalary != null ? Number(rest.currentSalary) : null,
          expectedSalary: rest.expectedSalary != null ? Number(rest.expectedSalary) : null,
          age: rest.age != null ? Number(rest.age) : null,
          experienceYears: rest.experienceYears != null ? Number(rest.experienceYears) : 0,
          experienceMonths: rest.experienceMonths != null ? Number(rest.experienceMonths) : 0,
        };
        const existingByPhone = can.normalizedPhone
          ? await prisma.candidate.findUnique({ where: { normalizedPhone: can.normalizedPhone } })
          : null;
        if (existingByPhone) {
          candidateIdMap.set(can.id, existingByPhone.id);
          await prisma.candidate.update({
            where: { id: existingByPhone.id },
            data: candData,
          });
        } else {
          const upserted = await prisma.candidate.upsert({
            where: { id: can.id },
            update: candData,
            create: {
              ...candData,
              id: can.id,
              createdAt: new Date(createdAt),
              updatedAt: new Date(updatedAt),
            },
          });
          candidateIdMap.set(can.id, upserted.id);
        }
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
          createdById,
          assignedExecutiveId,
          assignedById,
          finalShortlistedById,
          candidateId,
          jobId,
          companyId,
          assignedTeamId,
          ...rest
        } = app;

        const validCandidateId = candidateIdMap.get(candidateId) || candidateId || defaultCandidate?.id;
        const validJobId = jobIdMap.get(jobId) || jobId || defaultJob?.id;
        const validCompanyId = companyIdMap.get(companyId) || companyId || defaultCompany?.id;

        if (!validCandidateId || !validJobId || !validCompanyId) {
          continue;
        }

        const validCreatedById = resolveUserId(createdById);
        const validExecutiveId = assignedExecutiveId ? resolveUserId(assignedExecutiveId) : null;
        const validAssignedById = assignedById ? resolveUserId(assignedById) : null;
        const validShortlistedById = finalShortlistedById ? resolveUserId(finalShortlistedById) : null;

        const appData = {
          ...rest,
          candidateId: validCandidateId,
          jobId: validJobId,
          companyId: validCompanyId,
          assignedTeamId: null, // SQLite safe or verified
          createdById: validCreatedById,
          assignedExecutiveId: validExecutiveId,
          assignedById: validAssignedById,
          finalShortlistedById: validShortlistedById,
          assignedAt: assignedAt ? new Date(assignedAt) : null,
          formSentAt: formSentAt ? new Date(formSentAt) : null,
          formReceivedAt: formReceivedAt ? new Date(formReceivedAt) : null,
          cvRequestedAt: cvRequestedAt ? new Date(cvRequestedAt) : null,
          cvReceivedAt: cvReceivedAt ? new Date(cvReceivedAt) : null,
          readyForScreeningAt: readyForScreeningAt ? new Date(readyForScreeningAt) : null,
          finalShortlistedAt: finalShortlistedAt ? new Date(finalShortlistedAt) : null,
        };

        const existingByCode = await prisma.application.findUnique({ where: { applicationCode: app.applicationCode } });
        if (existingByCode) {
          await prisma.application.update({
            where: { id: existingByCode.id },
            data: appData,
          });
        } else {
          await prisma.application.upsert({
            where: { id: app.id },
            update: appData,
            create: {
              ...appData,
              id: app.id,
              createdAt: new Date(createdAt),
              updatedAt: new Date(updatedAt),
            },
          });
        }
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
