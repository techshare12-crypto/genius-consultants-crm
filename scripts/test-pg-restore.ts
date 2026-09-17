import { PrismaClient } from '@prisma/client';
import { verifyAndRestoreBackup } from './restore-db';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

async function run() {
  console.log('--- TESTING POSTGRESQL BACKUP & RESTORE ---');

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
  console.log('✅ POSTGRESQL RESTORE = PROVEN!');
  console.log('================================================================\n');

  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
