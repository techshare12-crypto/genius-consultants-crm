import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspect() {
  const version = await prisma.$queryRaw<any[]>`SELECT version();`;
  const db = await prisma.$queryRaw<any[]>`SELECT current_database();`;
  const schema = await prisma.$queryRaw<any[]>`SELECT current_schema();`;
  const isolation = await prisma.$queryRaw<any[]>`SHOW transaction_isolation;`;
  const inet = await prisma.$queryRaw<any[]>`SELECT inet_server_addr(), inet_server_port();`;

  console.log('=== 1. DATABASE IDENTITY ===');
  console.log('Version:', version[0]?.version);
  console.log('Database:', db[0]?.current_database);
  console.log('Schema:', schema[0]?.current_schema);
  console.log('Isolation:', isolation[0]?.transaction_isolation);
  console.log('Server Port:', inet[0]?.inet_server_port);

  console.log('\n=== 2. INDEXES IN CATALOG (application_assignment_histories) ===');
  const indexes = await prisma.$queryRaw<any[]>`
    SELECT indexname, tablename, indexdef
    FROM pg_indexes
    WHERE tablename = 'application_assignment_histories';
  `;
  console.log(JSON.stringify(indexes, null, 2));

  console.log('\n=== 3. RACE APPLICATIONS IN DATABASE ===');
  const raceApps = await prisma.application.findMany({
    where: { applicationCode: { startsWith: 'RACE-APP' } },
    include: { assignmentHistories: { orderBy: { assignedAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  for (const app of raceApps) {
    console.log(`\nApplication ID: ${app.id} | Code: ${app.applicationCode}`);
    console.log(`  - assignedExecutiveId: ${app.assignedExecutiveId}`);
    console.log(`  - currentStage: ${app.currentStage}`);
    console.log(`  - Total Histories: ${app.assignmentHistories.length}`);
    const active = app.assignmentHistories.filter((h) => h.unassignedAt === null);
    const closed = app.assignmentHistories.filter((h) => h.unassignedAt !== null);
    console.log(`  - Active Histories (unassignedAt IS NULL): ${active.length}`);
    console.log(`  - Closed Histories (unassignedAt IS NOT NULL): ${closed.length}`);
    for (const h of app.assignmentHistories) {
      console.log(`      * Hist ID: ${h.id} | Exec: ${h.executiveId} | Assigned: ${h.assignedAt.toISOString()} | Unassigned: ${h.unassignedAt ? h.unassignedAt.toISOString() : 'NULL'} | Reason: ${h.reason}`);
    }
  }

  console.log('\n=== 4. TOTAL ACTIVE ASSIGNMENTS CHECK ACROSS WHOLE DB ===');
  const allActiveHistories = await prisma.applicationAssignmentHistory.findMany({
    where: { unassignedAt: null },
  });
  console.log(`Total active history records across whole database: ${allActiveHistories.length}`);

  const activeByApp = new Map<string, number>();
  for (const h of allActiveHistories) {
    activeByApp.set(h.applicationId, (activeByApp.get(h.applicationId) || 0) + 1);
  }
  let maxActivePerApp = 0;
  for (const [appId, count] of activeByApp.entries()) {
    if (count > maxActivePerApp) maxActivePerApp = count;
  }
  console.log(`Maximum active assignment histories per application in DB: ${maxActivePerApp}`);

  await prisma.$disconnect();
}

inspect().catch(console.error);
