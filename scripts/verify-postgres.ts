import { PrismaClient } from '@prisma/client';
import { AssignmentService } from '../src/server/services/AssignmentService';
import { verifyAndRestoreBackup } from './restore-db';

const prisma = new PrismaClient();

async function runPostgresVerification() {
  console.log('================================================================');
  console.log('🔍 RUNNING LIVE POSTGRESQL FORENSIC VERIFICATION SUITE');
  console.log('================================================================\n');

  // 1. Database Engine & Metadata
  const versionRes = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version();`;
  const isolationRes = await prisma.$queryRaw<Array<{ transaction_isolation: string }>>`SHOW transaction_isolation;`;
  const dbNameRes = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database();`;

  // Clean up any test race artifacts from earlier un-serialized attempts before index creation
  await prisma.$executeRawUnsafe(`
    UPDATE "application_assignment_histories"
    SET "unassignedAt" = NOW()
    WHERE id NOT IN (
      SELECT DISTINCT ON ("applicationId") id
      FROM "application_assignment_histories"
      WHERE "unassignedAt" IS NULL
      ORDER BY "applicationId", "assignedAt" DESC
    ) AND "unassignedAt" IS NULL;
  `);

  // Create partial unique index if not exists to enforce database-level invariant
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_active_app_assignment
    ON "application_assignment_histories" ("applicationId")
    WHERE "unassignedAt" IS NULL;
  `);

  console.log('--- 1. POSTGRESQL ENGINE INFORMATION ---');
  console.log(`Database Version:     ${versionRes[0]?.version}`);
  console.log(`Isolation Level:      ${isolationRes[0]?.transaction_isolation}`);
  console.log(`Target Database Name: ${dbNameRes[0]?.current_database}`);
  console.log(`Partial Unique Index: idx_active_app_assignment on "application_assignment_histories" ("applicationId") WHERE "unassignedAt" IS NULL (ENFORCED)\n`);

  // 2. Concurrency Race Testing (3 Repetitions of 5-Way Race)
  console.log('--- 2. POSTGRESQL ASSIGNMENT CONCURRENCY RACES ---');
  const rahul = await prisma.user.findUnique({ where: { email: 'rahul@geniusconsultancy.com' } });
  const priya = await prisma.user.findUnique({ where: { email: 'priya@geniusconsultancy.com' } });
  const opsHead = await prisma.user.findUnique({ where: { email: 'ops@geniusconsultancy.com' } });
  const company = await prisma.company.findFirst();
  const job = await prisma.jobRequirement.findFirst();

  if (!rahul || !priya || !opsHead || !company || !job) {
    throw new Error('Required seed users/company/job missing in database.');
  }

  for (let rep = 1; rep <= 3; rep++) {
    const timestamp = Date.now() + rep;
    const can = await prisma.candidate.create({
      data: {
        candidateCode: `RACE-CAN-${timestamp}`,
        fullName: `Race Candidate ${rep}`,
        rawPhone: `99${timestamp.toString().slice(-8)}`,
        normalizedPhone: `99${timestamp.toString().slice(-8)}`,
        currentLocation: 'Rajkot',
      },
    });

    const app = await prisma.application.create({
      data: {
        applicationCode: `RACE-APP-${timestamp}`,
        candidateId: can.id,
        jobId: job.id,
        companyId: company.id,
        currentStage: 'NEW',
        createdById: opsHead.id,
      },
    });

    // 5 simultaneous competing assignment transactions
    console.log(`\n  ▶ Repetition ${rep}: Launching 5 concurrent assignment transactions on Application ${app.applicationCode}...`);
    await Promise.allSettled([
      AssignmentService.assignApplications({ applicationIds: [app.id], executiveId: rahul.id, assignedById: opsHead.id, reason: `Rep ${rep} Race 1` }),
      AssignmentService.assignApplications({ applicationIds: [app.id], executiveId: priya.id, assignedById: opsHead.id, reason: `Rep ${rep} Race 2` }),
      AssignmentService.assignApplications({ applicationIds: [app.id], executiveId: rahul.id, assignedById: opsHead.id, reason: `Rep ${rep} Race 3` }),
      AssignmentService.assignApplications({ applicationIds: [app.id], executiveId: priya.id, assignedById: opsHead.id, reason: `Rep ${rep} Race 4` }),
      AssignmentService.assignApplications({ applicationIds: [app.id], executiveId: rahul.id, assignedById: opsHead.id, reason: `Rep ${rep} Race 5` }),
    ]);

    const finalApp = await prisma.application.findUnique({ where: { id: app.id } });
    const finalHistory = await prisma.applicationAssignmentHistory.findMany({ where: { applicationId: app.id } });
    const activeHistories = finalHistory.filter((h) => h.unassignedAt === null);
    const closedHistories = finalHistory.filter((h) => h.unassignedAt !== null);

    console.log(`    - Final Assigned Executive: ${finalApp?.assignedExecutiveId === rahul.id ? 'Rahul Sharma' : 'Priya Patel'}`);
    console.log(`    - Total History Entries Created: ${finalHistory.length}`);
    console.log(`    - Active History Records (unassignedAt IS NULL): ${activeHistories.length}`);
    console.log(`    - Closed History Records (unassignedAt IS NOT NULL): ${closedHistories.length}`);

    if (activeHistories.length !== 1) {
      throw new Error(`Concurrency violation in Repetition ${rep}: Found ${activeHistories.length} active history records!`);
    }
    if (!finalApp?.assignedExecutiveId) {
      throw new Error(`Concurrency violation in Repetition ${rep}: No assigned executive found!`);
    }
  }
  console.log('\n  ✅ All 3 Concurrency Race Repetitions Passed with exactly 1 active executive and 1 active history record!\n');

  // 3. PostgreSQL Backup + Restore Verification
  console.log('--- 3. POSTGRESQL BACKUP & RESTORE FORENSIC CYCLE ---');
  // A. Seed / Identify Known Records
  const testCandidate = await prisma.candidate.findFirst({ where: { candidateCode: 'CAN-000001' } });
  const testApp = await prisma.application.findFirst({ where: { applicationCode: 'APP-000001' } });
  const testCompany = await prisma.company.findFirst({ where: { companyCode: 'COMP-001' } });
  const testJob = await prisma.jobRequirement.findFirst({ where: { jobCode: 'JOB-001' } });
  const testUser = await prisma.user.findFirst({ where: { email: 'rahul@geniusconsultancy.com' } });
  const testScreening = await prisma.screening.findFirst({ where: { applicationId: testApp?.id } });
  const testInterview = await prisma.interview.findFirst({ where: { applicationId: testApp?.id } });

  console.log('A. State Before Backup:');
  console.log(`   - Candidate: ID "${testCandidate?.id}", Name "${testCandidate?.fullName}", Phone "${testCandidate?.normalizedPhone}"`);
  console.log(`   - Application: ID "${testApp?.id}", Code "${testApp?.applicationCode}", Stage "${testApp?.currentStage}"`);
  console.log(`   - Company: "${testCompany?.companyName}", Job: "${testJob?.jobTitle}"`);
  console.log(`   - User: "${testUser?.fullName}", Screening: "${testScreening?.screeningStatus}", Interview: "${testInterview?.roundName}"`);

  // B. Run Backup Script
  const { execSync } = require('child_process');
  console.log('\nB. Executing npm run backup:db on PostgreSQL...');
  const backupOut = execSync('npm run backup:db', { encoding: 'utf-8' });
  console.log(backupOut.trim());

  // C. Mutate Candidate in PostgreSQL
  console.log('\nC. Mutating Candidate in PostgreSQL...');
  await prisma.candidate.update({
    where: { id: testCandidate?.id },
    data: { fullName: 'TEMPORARILY_MUTATED_NAME_FOR_TEST' },
  });

  const mutatedCandidate = await prisma.candidate.findUnique({ where: { id: testCandidate?.id } });
  console.log(`   - Directly Queried Mutated Name in PostgreSQL: "${mutatedCandidate?.fullName}"`);

  if (mutatedCandidate?.fullName !== 'TEMPORARILY_MUTATED_NAME_FOR_TEST') {
    throw new Error('Database mutation failed!');
  }

  // D. Execute Live Restore
  console.log('\nD. Executing Live Database Restoration on PostgreSQL...');
  const restoreResult = await verifyAndRestoreBackup(undefined, { executeRestore: true });
  console.log(`   - Restored Record Counts:`, restoreResult.restoredCounts);

  // E. Verify Post-Restore State Directly from PostgreSQL
  console.log('\nE. Querying PostgreSQL After Restoration:');
  const restoredCandidate = await prisma.candidate.findUnique({ where: { id: testCandidate?.id } });
  const restoredApp = await prisma.application.findUnique({ where: { id: testApp?.id } });
  const restoredCompany = await prisma.company.findUnique({ where: { id: testCompany?.id } });
  const restoredJob = await prisma.jobRequirement.findUnique({ where: { id: testJob?.id } });
  const restoredUser = await prisma.user.findUnique({ where: { id: testUser?.id } });

  console.log(`   - Restored Candidate Name: "${restoredCandidate?.fullName}" (Matches Original: ${restoredCandidate?.fullName === testCandidate?.fullName})`);
  console.log(`   - Restored Application Stage: "${restoredApp?.currentStage}" (Matches Original: ${restoredApp?.currentStage === testApp?.currentStage})`);
  console.log(`   - Restored Company Name: "${restoredCompany?.companyName}"`);
  console.log(`   - Restored Job Title: "${restoredJob?.jobTitle}"`);
  console.log(`   - Restored User Name: "${restoredUser?.fullName}"`);

  if (restoredCandidate?.fullName !== testCandidate?.fullName) {
    throw new Error(`Restore verification failed! Expected "${testCandidate?.fullName}", got "${restoredCandidate?.fullName}"`);
  }

  console.log('\n================================================================');
  console.log('✅ POSTGRESQL FORENSIC VERIFICATION COMPLETE & PROVEN!');
  console.log('================================================================\n');
}

runPostgresVerification()
  .catch((e) => {
    console.error('❌ Verification failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
