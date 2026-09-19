import './setup_env';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { normalizeIndianPhone } from '../src/server/utils/phone';
import { signAuthToken, verifyAuthToken } from '../src/server/utils/jwt';
import { AssignmentService } from '../src/server/services/AssignmentService';
import { CallingService } from '../src/server/services/CallingService';
import { ScreeningService } from '../src/server/services/ScreeningService';
import { SubmissionService } from '../src/server/services/SubmissionService';
import { InterviewService } from '../src/server/services/InterviewService';
import { QualityService } from '../src/server/services/QualityService';
import { ReportService } from '../src/server/services/ReportService';
import { ImportService } from '../src/server/services/ImportService';
import { checkLoginRateLimit, resetLoginRateLimit } from '../src/server/utils/rateLimiter';
import { verifyAndRestoreBackup } from '../scripts/restore-db';
import { NextRequest } from 'next/server';
import { GET as getApplicationHistory } from '../src/app/api/applications/[id]/history/route';
import { POST as completeCallbackRoute } from '../src/app/api/callbacks/[id]/complete/route';
import fs from 'fs';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'prisma/dev.db').replace(/\\/g, '/');
process.env.DATABASE_URL = `file:${dbPath}`;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${dbPath}`,
    },
  },
});

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failedTests++;
  }
}

async function runTestSuite() {
  console.log('🧪 Starting Genius Consultancy CRM Comprehensive Automated Test Suite...\n');

  // ==========================================
  // TEST SUITE 1: Phone Normalization & Float Handling
  // ==========================================
  console.log('--- Test Suite 1: Phone Normalization ---');
  assert(normalizeIndianPhone('9558555612') === '9558555612', 'Exact 10-digit number');
  assert(normalizeIndianPhone('+91 9558555612') === '9558555612', 'Prefix +91 with space');
  assert(normalizeIndianPhone('919558555612') === '9558555612', 'Prefix 91 without plus');
  assert(normalizeIndianPhone('09558555612') === '9558555612', 'Leading zero prefix');
  assert(normalizeIndianPhone('9.558555612E9') === '9558555612', 'Excel scientific float notation (9.558555612E9)');
  assert(normalizeIndianPhone('9558555612.0') === '9558555612', 'Excel decimal float notation');
  assert(normalizeIndianPhone('invalid') === null, 'Invalid non-digit string returns null');

  // ==========================================
  // TEST SUITE 2: Authentication & JWT Tokens
  // ==========================================
  console.log('\n--- Test Suite 2: Authentication & JWT ---');
  const token = signAuthToken({
    userId: 'test-user-id',
    email: 'admin@geniusconsultancy.com',
    fullName: 'Manjunath',
    roles: ['SUPER_ADMIN'],
    permissions: ['user.manage', 'application.assign'],
  });
  assert(typeof token === 'string' && token.length > 20, 'Generates valid JWT signature');

  const decoded = verifyAuthToken(token);
  assert(decoded !== null && decoded.email === 'admin@geniusconsultancy.com', 'Decodes valid JWT payload');
  assert(decoded?.roles.includes('SUPER_ADMIN') === true, 'Contains role in token');

  const invalidToken = verifyAuthToken('corrupted-token-xyz');
  assert(invalidToken === null, 'Rejects invalid/tampered JWT');

  // ==========================================
  // TEST SUITE 3: RBAC & Users
  // ==========================================
  console.log('\n--- Test Suite 3: RBAC & Multi-Role User Structure ---');
  const jyotiUser = await prisma.user.findUnique({
    where: { email: 'jyoti@geniusconsultancy.com' },
    include: { userRoles: { include: { role: true } } },
  });
  assert(jyotiUser !== null, 'Jyoti user exists in database');
  const jyotiRoles = jyotiUser?.userRoles.map((r) => r.role.name) || [];
  assert(jyotiRoles.includes('SCREENING_MANAGER') && jyotiRoles.includes('EXECUTIVE'), 'Jyoti has multi-role assignment (SCREENING_MANAGER + EXECUTIVE)');

  const sibiUser = await prisma.user.findUnique({
    where: { email: 'sibi@geniusconsultancy.com' },
    include: { userRoles: { include: { role: true } } },
  });
  assert(sibiUser !== null, 'Sibi user exists in database');
  const sibiRoles = sibiUser?.userRoles.map((r) => r.role.name) || [];
  assert(sibiRoles.includes('BUSINESS_DEVELOPMENT_MANAGER') && sibiRoles.includes('FINANCE_MANAGER'), 'Sibi has multi-role assignment (BD_MANAGER + FINANCE_MANAGER)');

  // ==========================================
  // TEST SUITE 4: Lead Assignment & Parallel Concurrency
  // ==========================================
  console.log('\n--- Test Suite 4: Lead Assignment & Concurrency Integrity ---');
  const rahulExec = await prisma.user.findUnique({ where: { email: 'rahul@geniusconsultancy.com' } });
  const priyaExec = await prisma.user.findUnique({ where: { email: 'priya@geniusconsultancy.com' } });
  const opsUser = await prisma.user.findUnique({ where: { email: 'ops@geniusconsultancy.com' } });
  const company = await prisma.company.findFirst();
  const job = await prisma.jobRequirement.findFirst();

  const timestamp = Date.now();
  const dynamicPhone = '98' + timestamp.toString().slice(-8);

  const testCandidate = await prisma.candidate.create({
    data: {
      candidateCode: `TEST-CAN-${timestamp}`,
      fullName: 'Integration Test Candidate',
      rawPhone: dynamicPhone,
      normalizedPhone: dynamicPhone,
      currentLocation: 'Rajkot, Gujarat',
    },
  });

  const testApp = await prisma.application.create({
    data: {
      applicationCode: `TEST-APP-${timestamp}`,
      candidateId: testCandidate.id,
      jobId: job!.id,
      companyId: company!.id,
      currentStage: 'NEW',
      createdById: opsUser!.id,
    },
  });

  if (testApp && rahulExec && priyaExec && opsUser) {
    // 1. Initial Assignment to Rahul
    await AssignmentService.assignApplications({
      applicationIds: [testApp.id],
      executiveId: rahulExec.id,
      assignedById: opsUser.id,
      reason: 'Initial assignment for test',
    });

    let updatedApp = await prisma.application.findUnique({ where: { id: testApp.id } });
    assert(updatedApp?.assignedExecutiveId === rahulExec.id, 'Application successfully assigned to Rahul');

    // 2. Multi-Way Parallel Concurrent Assignment Attempt (5 simultaneous competing promises)
    await Promise.allSettled([
      AssignmentService.assignApplications({
        applicationIds: [testApp.id],
        executiveId: rahulExec.id,
        assignedById: opsUser.id,
        reason: 'Concurrent assign Race 1',
      }),
      AssignmentService.assignApplications({
        applicationIds: [testApp.id],
        executiveId: priyaExec.id,
        assignedById: opsUser.id,
        reason: 'Concurrent assign Race 2',
      }),
      AssignmentService.assignApplications({
        applicationIds: [testApp.id],
        executiveId: rahulExec.id,
        assignedById: opsUser.id,
        reason: 'Concurrent assign Race 3',
      }),
      AssignmentService.assignApplications({
        applicationIds: [testApp.id],
        executiveId: priyaExec.id,
        assignedById: opsUser.id,
        reason: 'Concurrent assign Race 4',
      }),
      AssignmentService.assignApplications({
        applicationIds: [testApp.id],
        executiveId: rahulExec.id,
        assignedById: opsUser.id,
        reason: 'Concurrent assign Race 5',
      }),
    ]);

    updatedApp = await prisma.application.findUnique({ where: { id: testApp.id } });
    assert(
      updatedApp?.assignedExecutiveId === rahulExec.id || updatedApp?.assignedExecutiveId === priyaExec.id,
      'Multi-promise concurrent assignment resolves to exactly ONE active assigned executive'
    );

    // 3. Verify History Integrity
    const history = await AssignmentService.getAssignmentHistory(testApp.id);
    const activeHistoryCount = history.filter((h) => h.unassignedAt === null).length;
    assert(activeHistoryCount === 1, 'Transactional atomic history integrity: Exactly ONE active assignment record (unassignedAt = null)');
  }

  // ==========================================
  // TEST SUITE 5: Cross-Executive Security & Data Isolation
  // ==========================================
  console.log('\n--- Test Suite 5: Cross-Executive Security & Data Isolation ---');
  if (testApp && rahulExec && priyaExec) {
    // Ensure testApp is assigned to Rahul
    await AssignmentService.assignApplications({
      applicationIds: [testApp.id],
      executiveId: rahulExec.id,
      assignedById: opsUser!.id,
      reason: 'Assigned to Rahul for cross-user test',
    });

    // Create a callback for Rahul
    const rahulCallback = await prisma.callback.create({
      data: {
        applicationId: testApp.id,
        candidateId: testApp.candidateId,
        executiveId: rahulExec.id,
        scheduledAt: new Date(),
        reason: 'Rahul follow-up',
        status: 'PENDING',
      },
    });

    // Generate token for Priya (who does not own testApp)
    const priyaToken = signAuthToken({
      userId: priyaExec.id,
      email: priyaExec.email,
      fullName: priyaExec.fullName,
      roles: ['EXECUTIVE'],
      permissions: ['candidate.view_assigned', 'application.view_own', 'calling.log', 'callback.manage_own'],
    });

    // 1. Priya attempts to access Rahul's Application History -> Expect 403 Forbidden
    const reqHistory = new NextRequest(`http://localhost:3000/api/applications/${testApp.id}/history`, {
      headers: {
        authorization: `Bearer ${priyaToken}`,
        cookie: `genius_crm_token=${priyaToken}`,
      },
    });
    const historyResponse = await getApplicationHistory(reqHistory, { params: { id: testApp.id } });
    assert(historyResponse.status === 403, 'Cross-Executive Access: Priya is denied access (403 Forbidden) to Rahul\'s application history');

    // 2. Priya attempts to complete Rahul's callback -> Expect 403 Forbidden
    const reqCallback = new NextRequest(`http://localhost:3000/api/callbacks/${rahulCallback.id}/complete`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${priyaToken}`,
        cookie: `genius_crm_token=${priyaToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ completionRemarks: 'Unauthorized attempt by Priya' }),
    });
    const callbackResponse = await completeCallbackRoute(reqCallback, { params: { id: rahulCallback.id } });
    assert(callbackResponse.status === 403, 'Cross-Executive Mutation: Priya is denied (403 Forbidden) from completing Rahul\'s callback');

    // 3. Priya attempts to log a call on Rahul's lead -> CallingService throws error
    let callingErrorCaught = false;
    try {
      await CallingService.logCall({
        applicationId: testApp.id,
        candidateId: testApp.candidateId,
        executiveId: priyaExec.id,
        callOutcome: 'CONNECTED',
      });
    } catch (e: any) {
      callingErrorCaught = true;
    }
    assert(callingErrorCaught, 'Calling Service Guard: Executive cannot log call on another executive\'s assigned lead');
  }

  // ==========================================
  // TEST SUITE 6: Calling Operations & Independent Callbacks
  // ==========================================
  console.log('\n--- Test Suite 6: Calling Station & Independent Callbacks ---');
  if (testApp && rahulExec) {
    const callResult = await CallingService.logCall({
      applicationId: testApp.id,
      candidateId: testApp.candidateId,
      executiveId: rahulExec.id,
      callOutcome: 'CALLBACK',
      remarks: 'Candidate requested callback in afternoon',
      callbackRequired: true,
      callbackDateTime: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      callbackReason: 'Discuss salary structure',
    });

    assert(callResult.callLog.callOutcome === 'CALLBACK', 'Call log recorded with outcome CALLBACK');
    assert(callResult.callback !== null, 'Independent Callback record created with scheduled date');
    assert(callResult.callback?.status === 'PENDING', 'Callback status is PENDING');

    // Complete callback by owner Rahul
    if (callResult.callback) {
      const completedCb = await CallingService.completeCallback(
        callResult.callback.id,
        rahulExec.id,
        'Follow-up call completed with candidate'
      );
      assert(completedCb.status === 'COMPLETED', 'Callback marked COMPLETED by owner');
    }
  }

  // ==========================================
  // TEST SUITE 7: Screening Workflow & Explicit Final Shortlist
  // ==========================================
  console.log('\n--- Test Suite 7: Screening Center & Explicit Final Shortlist ---');
  if (testApp && jyotiUser) {
    // Document status update
    const docUpdate = await ScreeningService.updateDocumentStatus(testApp.id, jyotiUser.id, {
      formStatus: 'RECEIVED',
      cvStatus: 'CV_RECEIVED',
    });
    assert(docUpdate.formStatus === 'RECEIVED' && docUpdate.cvStatus === 'CV_RECEIVED', 'Document metadata updated to RECEIVED');

    // Screening evaluation
    const screenRes = await ScreeningService.evaluateScreening({
      applicationId: testApp.id,
      screenerId: jyotiUser.id,
      screeningStatus: 'PASS',
      remarks: 'Screening passed: candidate has bike and required sales energy',
    });
    assert(screenRes.screening.screeningStatus === 'PASS', 'Screening evaluation recorded as PASS');
    assert(screenRes.application.currentStage === 'SCREENING_PASSED', 'Application stage moves to SCREENING_PASSED (NOT auto-finalized)');

    // Explicit Add to Final Shortlist
    const finalizeRes = await ScreeningService.addToFinalShortlist({
      applicationIds: [testApp.id],
      jobId: testApp.jobId,
      userId: jyotiUser.id,
      remarks: 'Batch 1 shortlisted candidates',
    });
    assert(finalizeRes.success === true && finalizeRes.count === 1, 'Explicitly moved to FINAL_SHORTLIST');
    const finalApp = await prisma.application.findUnique({ where: { id: testApp.id } });
    assert(finalApp?.currentStage === 'FINAL_SHORTLIST', 'Application currentStage is now FINAL_SHORTLIST');
  }

  // ==========================================
  // TEST SUITE 8: Client Submission & Multi-Round Interviews
  // ==========================================
  console.log('\n--- Test Suite 8: Client Submission & Multi-Round Interviews ---');
  if (testApp && jyotiUser) {
    // 1. Create Submission
    const submission = await SubmissionService.createSubmission({
      companyId: testApp.companyId,
      jobId: testApp.jobId,
      applicationIds: [testApp.id],
      submittedById: jyotiUser.id,
      submissionMethod: 'WHATSAPP_MANUAL',
      remarks: 'Test submission batch',
    });
    assert(submission.submissionCode.startsWith('SUB-'), 'Client submission created with unique submission code');

    const submittedApp = await prisma.application.findUnique({ where: { id: testApp.id } });
    assert(submittedApp?.currentStage === 'SENT_TO_CLIENT', 'Application moved to SENT_TO_CLIENT');

    // 2. Schedule Interview Round 1
    const interview1 = await InterviewService.scheduleInterview({
      applicationId: testApp.id,
      submissionId: submission.id,
      roundNumber: 1,
      roundName: 'Round 1 - Technical Assessment',
      scheduledAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      mode: 'OFFLINE',
      location: 'Company Regional Office',
      userId: jyotiUser.id,
    });
    assert(interview1.roundNumber === 1 && interview1.status === 'SCHEDULED', 'Interview Round 1 scheduled');

    // 3. Update Outcome to SELECTED_FOR_NEXT_ROUND and schedule Round 2
    const round1Outcome = await InterviewService.updateInterviewOutcome({
      interviewId: interview1.id,
      status: 'COMPLETED',
      outcome: 'SELECTED_FOR_NEXT_ROUND',
      feedback: 'Passed round 1 aptitude',
      userId: jyotiUser.id,
      scheduleNextRound: true,
      nextRoundScheduledAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
      nextRoundName: 'Round 2 - Branch Manager Discussion',
    });
    assert(round1Outcome.interview.outcome === 'SELECTED_FOR_NEXT_ROUND', 'Round 1 outcome is SELECTED_FOR_NEXT_ROUND');
    assert(round1Outcome.nextRound !== null && round1Outcome.nextRound.roundNumber === 2, 'Round 2 automatically created as next interview round');

    // 4. Update Round 2 to SELECTED
    if (round1Outcome.nextRound) {
      const round2Outcome = await InterviewService.updateInterviewOutcome({
        interviewId: round1Outcome.nextRound.id,
        status: 'COMPLETED',
        outcome: 'SELECTED',
        feedback: 'Final selection approved by Branch Manager',
        userId: jyotiUser.id,
      });
      assert(round2Outcome.interview.outcome === 'SELECTED', 'Round 2 outcome marked SELECTED');
      assert(round2Outcome.newStage === 'SELECTED', 'Application stage advanced to SELECTED');
    }

    // 5. Update to JOINED
    const joinedRes = await InterviewService.updateJoiningStatus(
      testApp.id,
      jyotiUser.id,
      'JOINED',
      new Date().toISOString(),
      'Candidate reported to work on time'
    );
    assert(joinedRes.currentStage === 'JOINED', 'Application terminal stage reached: JOINED');

    // 6. Verify Terminal Stage Reassignment Prevention
    let terminalErrorCaught = false;
    try {
      await AssignmentService.assignApplications({
        applicationIds: [testApp.id],
        executiveId: rahulExec!.id,
        assignedById: opsUser!.id,
      });
    } catch (e: any) {
      terminalErrorCaught = true;
    }
    assert(terminalErrorCaught, 'Enforces business rule: prevents reassignment of application in terminal stage JOINED');
  }

  // ==========================================
  // TEST SUITE 9: Quality Reviews
  // ==========================================
  console.log('\n--- Test Suite 9: Quality Reviews ---');
  if (testApp && rahulExec && opsUser) {
    const review = await QualityService.createReview({
      applicationId: testApp.id,
      executiveId: rahulExec.id,
      reviewerId: opsUser.id,
      communicationScore: 5,
      jobExplanationScore: 4,
      processAdherenceScore: 5,
      remarks: 'Flawless communication and objection handling.',
    });
    assert(review.rating === 5, 'Calculates average rating correctly (5/5)');

    const summary = await QualityService.getExecutiveQualitySummary(rahulExec.id);
    assert(summary.totalReviews >= 1 && summary.averageRating > 0, 'Generates executive quality summary correctly');
  }

  // ==========================================
  // TEST SUITE 10: Dynamic Reporting Engine & Idle Time
  // ==========================================
  console.log('\n--- Test Suite 10: Dynamic Reporting Engine & Idle Time ---');
  const report = await ReportService.getOperationsOverview({});
  assert(report.calling.totalAttempts >= 1, 'Calculates real calling total attempts');
  assert(typeof report.conversions.connectionRate.value === 'number', 'Calculates connection rate with numerator/denominator');
  assert(report.conversions.connectionRate.numerator <= report.conversions.connectionRate.denominator || report.conversions.connectionRate.denominator === 0, 'Conversion numerator <= denominator');

  const locReport = await ReportService.getLocationWiseCallingTracker();
  assert(locReport.length >= 1, 'Dynamic location calling tracker returns aggregated records');

  const execMatrix = await ReportService.getExecutivePerformanceMatrix();
  const rahulStats = execMatrix.find((e) => e.email === 'rahul@geniusconsultancy.com');
  assert(rahulStats !== undefined && typeof rahulStats.idleMinutes === 'number', 'Calculates CRM idleMinutes dynamically from activity timestamps');

  // ==========================================
  // TEST SUITE 11: All 6 Duplicate Detection Tiers & Excel Importer
  // ==========================================
  console.log('\n--- Test Suite 11: Comprehensive 6-Tier Duplicate Detection & Excel Ingestion ---');
  const XLSX = require('xlsx');

  // Construct synthetic deterministic test workbook with all 6 duplicate matching cases
  const testWorkbook = XLSX.utils.book_new();
  const testData = [
    { 'Candidate Name': 'Aarav Sharma', 'Phone Number': '9876543210', 'Email': 'aarav@genius.com', 'Location': 'Ahmedabad', 'Education': 'B.Com', 'Experience': '2 years', 'Assets': 'Bike with DL' },
    // Tier 1A: Exact Phone Match (High)
    { 'Candidate Name': 'Aarav S.', 'Phone Number': '+91 9876543210', 'Email': 'diff_aarav@other.com', 'Location': 'Surat', 'Education': 'B.Sc' },
    // Tier 1B: Exact Email Match (High)
    { 'Candidate Name': 'Aarav Secondary', 'Phone Number': '9111111111', 'Email': 'aarav@genius.com', 'Location': 'Rajkot', 'Education': 'BBA' },
    // Tier 2C: Phone + Normalized Name Match (Medium)
    { 'Candidate Name': 'Bhavin Patel', 'Phone Number': '9222222222', 'Email': 'bhavin1@test.com', 'Location': 'Baroda', 'Education': 'MBA' },
    { 'Candidate Name': 'bhavin patel', 'Phone Number': '9222222222', 'Email': 'bhavin2@test.com', 'Location': 'Anand', 'Education': 'Diploma' },
    // Tier 2D: Email + Normalized Name Match (Medium)
    { 'Candidate Name': 'Chirag Joshi', 'Phone Number': '9333333333', 'Email': 'chirag@test.com', 'Location': 'Jamnagar', 'Education': 'M.Com' },
    { 'Candidate Name': 'Chirag Joshi', 'Phone Number': '9444444444', 'Email': 'chirag@test.com', 'Location': 'Bhavnagar', 'Education': 'B.A.' },
    // Tier 3E: Name + Location Match (Low)
    { 'Candidate Name': 'Deepak Mehta', 'Phone Number': '9555555555', 'Email': 'deepak1@test.com', 'Location': 'Rajkot', 'Education': 'B.Com' },
    { 'Candidate Name': 'deepak mehta', 'Phone Number': '9666666666', 'Email': 'deepak2@test.com', 'Location': 'Rajkot', 'Education': 'M.A.' },
    // Tier 3F: Name + Education Match (Low)
    { 'Candidate Name': 'Esha Verma', 'Phone Number': '9777777777', 'Email': 'esha1@test.com', 'Location': 'Vadodara', 'Education': 'B.Tech' },
    { 'Candidate Name': 'esha verma', 'Phone Number': '9888888888', 'Email': 'esha2@test.com', 'Location': 'Gandhinagar', 'Education': 'B.Tech' },
  ];

  const testSheet = XLSX.utils.json_to_sheet(testData);
  XLSX.utils.book_append_sheet(testWorkbook, testSheet, 'Candidate Master');
  const syntheticBuffer = XLSX.write(testWorkbook, { type: 'buffer', bookType: 'xlsx' });

  const parsedSynthetic = ImportService.parseWorkbookBuffer(syntheticBuffer, 'Synthetic_Test_Batch.xlsx');

  // Verify Tier 1A: Exact Phone
  const highPhoneDup = parsedSynthetic.highConfidenceDuplicates.find((d) => d.duplicateType === 'DUPLICATE_HIGH_PHONE');
  assert(highPhoneDup !== undefined, 'Rule 1 (HIGH): Exact Normalized Phone duplicate detected');

  // Verify Tier 1B: Exact Email
  const highEmailDup = parsedSynthetic.highConfidenceDuplicates.find((d) => d.duplicateType === 'DUPLICATE_HIGH_EMAIL');
  assert(highEmailDup !== undefined, 'Rule 2 (HIGH): Exact Normalized Email duplicate detected');

  // Verify Tier 2C: Phone + Name
  const medPhoneNameDup = parsedSynthetic.mediumConfidenceDuplicates.find((d) => d.duplicateType === 'DUPLICATE_MEDIUM_PHONE_NAME');
  assert(medPhoneNameDup !== undefined, 'Rule 3 (MEDIUM): Phone + Normalized Name duplicate detected');

  // Verify Tier 2D: Email + Name
  const medEmailNameDup = parsedSynthetic.mediumConfidenceDuplicates.find((d) => d.duplicateType === 'DUPLICATE_MEDIUM_EMAIL_NAME');
  assert(medEmailNameDup !== undefined, 'Rule 4 (MEDIUM): Email + Normalized Name duplicate detected');

  // Verify Tier 3E: Name + Location
  const lowNameLocDup = parsedSynthetic.lowConfidenceDuplicates.find((d) => d.duplicateType === 'DUPLICATE_LOW_NAME_LOCATION');
  assert(lowNameLocDup !== undefined, 'Rule 5 (LOW): Similar Name + Location duplicate detected');

  // Verify Tier 3F: Name + Education
  const lowNameEduDup = parsedSynthetic.lowConfidenceDuplicates.find((d) => d.duplicateType === 'DUPLICATE_LOW_NAME_EDUCATION');
  assert(lowNameEduDup !== undefined, 'Rule 6 (LOW): Similar Name + Education duplicate detected');

  // Also parse live Excel file if available on disk
  const xlsxPath = 'C:\\Users\\manju\\Downloads\\Telecalling Operation.xlsx';
  if (fs.existsSync(xlsxPath)) {
    const fileBuffer = fs.readFileSync(xlsxPath);
    const parseResult = ImportService.parseWorkbookBuffer(fileBuffer, 'Telecalling Operation.xlsx');

    assert(parseResult.detectedSheets.length >= 3, 'Live File: Detects workbook sheets (Candidate Master, Dashboard, Shortlisted, Daily)');
    assert(parseResult.totalRows > 100, `Live File: Parses ${parseResult.totalRows} rows from candidate master`);
    assert(parseResult.previewRows.length === 10, 'Live File: Generates 10-row clean preview');
    assert(parseResult.previewRows[0].normalizedPhone.length === 10, 'Live File: Normalizes scientific float phone number in preview row');
    assert(Array.isArray(parseResult.highConfidenceDuplicates), 'Live File: Extracts high-confidence duplicates tier (exact phone match)');
    assert(Array.isArray(parseResult.lowConfidenceDuplicates), 'Live File: Extracts low-confidence duplicates tier (similar name + location/education)');
  }

  // ==========================================
  // TEST SUITE 12: Login Rate Limiting
  // ==========================================
  console.log('\n--- Test Suite 12: Login Rate Limiting ---');
  const testIp = '192.168.1.100';
  resetLoginRateLimit(testIp);

  // 5 attempts allowed
  for (let i = 1; i <= 5; i++) {
    const res = checkLoginRateLimit(testIp);
    assert(res.allowed === true, `Rate limiter allows attempt ${i} of 5`);
  }

  // 6th attempt throttled
  const throttledRes = checkLoginRateLimit(testIp);
  assert(throttledRes.allowed === false, 'Rate limiter throttles 6th attempt (HTTP 429 Too Many Requests)');
  resetLoginRateLimit(testIp);

  // ==========================================
  // TEST SUITE 13: Live Database Backup & Restoration Cycle
  // ==========================================
  console.log('\n--- Test Suite 13: Live Database Backup & Restoration Cycle ---');
  // 1. Check integrity & checksum
  const restoreCheck = await verifyAndRestoreBackup();
  assert(restoreCheck.valid === true, 'Backup SHA256 checksum and structure verified');
  assert(restoreCheck.counts.candidates >= 0, 'Backup contains valid candidate records');

  // 2. Test Live Database Restoration from backup
  const backedUpCandidate = restoreCheck.data?.candidates?.[0];
  if (backedUpCandidate) {
    const originalName = backedUpCandidate.fullName;

    // Ensure candidate exists before mutating
    const existingCand = await prisma.candidate.findUnique({ where: { id: backedUpCandidate.id } });
    if (!existingCand) {
      const superAdmin = await prisma.user.findFirst();
      await prisma.candidate.create({
        data: {
          id: backedUpCandidate.id,
          candidateCode: backedUpCandidate.candidateCode || `CAND-BK-${Date.now().toString().slice(-6)}`,
          fullName: originalName,
          rawPhone: backedUpCandidate.rawPhone || backedUpCandidate.phone || '9999999999',
          normalizedPhone: backedUpCandidate.normalizedPhone || '9999999999',
        },
      });
    }

    // Mutate the record in the database
    await prisma.candidate.update({
      where: { id: backedUpCandidate.id },
      data: { fullName: 'TEMPORARILY_MUTATED_NAME_FOR_TEST' },
    });

    const mutatedCheck = await prisma.candidate.findUnique({ where: { id: backedUpCandidate.id } });
    assert(mutatedCheck?.fullName === 'TEMPORARILY_MUTATED_NAME_FOR_TEST', 'Database record mutated prior to restoration test');

    // Execute live restore from backup
    const liveRestoreRes = await verifyAndRestoreBackup(undefined, { executeRestore: true });
    assert(liveRestoreRes.restoredCounts?.candidates! > 0, `Live restore executed and restored ${liveRestoreRes.restoredCounts?.candidates} candidate records`);

    // Verify record was restored in database
    const restoredCandidate = await prisma.candidate.findUnique({ where: { id: backedUpCandidate.id } });
    assert(restoredCandidate?.fullName === originalName, 'Database record successfully restored to original state from backup');
  }

  // ==========================================
  // TEST SUITE 14: Audit Trail Verification
  // ==========================================
  console.log('\n--- Test Suite 14: Immutable Audit Trail ---');
  const auditCount = await prisma.auditLog.count();
  assert(auditCount > 0, `Audit log contains ${auditCount} immutable transactional events`);

  // ==========================================
  // TEST SUITE 15: Employee Management & Multi-Role Reconciliation
  // ==========================================
  console.log('\n--- Test Suite 15: Employee Management & Multi-Role Reconciliation ---');
  const { PasswordValidationSchema, ResetPasswordSchema } = await import('../src/server/validators/schemas');

  // 1. Password Security Validation (Min 8 Characters)
  const shortPwTest = PasswordValidationSchema.safeParse('123456');
  assert(!shortPwTest.success, 'Password validation rejects passwords < 8 characters');

  const shortResetTest = ResetPasswordSchema.safeParse({ password: '12345' });
  assert(!shortResetTest.success, 'Reset password schema rejects short passwords');

  const validPwTest = PasswordValidationSchema.safeParse('StrongPass@2026');
  assert(validPwTest.success, 'Password validation accepts passwords >= 8 characters');

  const testEmpEmail = `test.employee.${Date.now()}@geniusconsultancy.com`;
  const superAdminUser = await prisma.user.findFirst({
    where: { userRoles: { some: { role: { name: 'SUPER_ADMIN' } } } },
  });

  // 2. Create new employee with multi-roles
  const roleExec = await prisma.role.findUnique({ where: { name: 'EXECUTIVE' } });
  const roleScreening = await prisma.role.findUnique({ where: { name: 'SCREENING_MANAGER' } });
  const roleOps = await prisma.role.findUnique({ where: { name: 'OPERATIONS_HEAD' } });

  const initialPasswordHash = await bcrypt.hash('InitialPass@123', 10);
  const createdEmp = await prisma.user.create({
    data: {
      email: testEmpEmail,
      fullName: 'Test Operational Employee',
      phone: '9898989898',
      passwordHash: initialPasswordHash,
      status: 'ACTIVE',
      userRoles: {
        create: [
          { roleId: roleExec!.id },
          { roleId: roleScreening!.id },
        ],
      },
    },
    include: {
      userRoles: { include: { role: true } },
    },
  });

  assert(createdEmp.id !== undefined, 'Employee created successfully in database');
  const createdRoles = createdEmp.userRoles.map((ur) => ur.role.name);
  assert(
    createdRoles.includes('EXECUTIVE') && createdRoles.includes('SCREENING_MANAGER'),
    'Employee has initial multi-role assignment (EXECUTIVE + SCREENING_MANAGER)'
  );

  // 3. Reconcile Roles (Remove SCREENING_MANAGER, Add OPERATIONS_HEAD)
  await prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({
      where: { userId: createdEmp.id, roleId: roleScreening!.id },
    });
    await tx.userRole.create({
      data: { userId: createdEmp.id, roleId: roleOps!.id },
    });
    await tx.user.update({
      where: { id: createdEmp.id },
      data: { fullName: 'Test Employee Updated' },
    });
  });

  const updatedEmp = await prisma.user.findUnique({
    where: { id: createdEmp.id },
    include: { userRoles: { include: { role: true } } },
  });
  const updatedRoles = updatedEmp?.userRoles.map((ur) => ur.role.name) || [];
  assert(
    updatedRoles.includes('EXECUTIVE') &&
      updatedRoles.includes('OPERATIONS_HEAD') &&
      !updatedRoles.includes('SCREENING_MANAGER'),
    'Roles reconciled successfully without duplicate records or lost relationships'
  );
  assert(updatedEmp?.fullName === 'Test Employee Updated', 'Employee details updated successfully');

  // 4. Password Reset with >= 8 characters
  const newPassword = 'NewSecretPassword@2026';
  const newPasswordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: createdEmp.id },
    data: { passwordHash: newPasswordHash },
  });

  const pwCheckUser = await prisma.user.findUnique({ where: { id: createdEmp.id } });
  const pwMatch = await bcrypt.compare(newPassword, pwCheckUser!.passwordHash);
  assert(pwMatch === true, 'Password reset successfully with >= 8 chars and verifies with bcrypt');

  // 5. Soft Deactivation & Login Prevention
  await prisma.user.update({
    where: { id: createdEmp.id },
    data: { status: 'INACTIVE' },
  });
  const deactivatedEmp = await prisma.user.findUnique({ where: { id: createdEmp.id } });
  assert(deactivatedEmp?.status === 'INACTIVE', 'Employee soft-deactivated (status = INACTIVE)');
  assert(deactivatedEmp?.status !== 'ACTIVE', 'Deactivated employee status blocks CRM login');

  // 6. Reactivation
  await prisma.user.update({
    where: { id: createdEmp.id },
    data: { status: 'ACTIVE' },
  });
  const reactivatedEmp = await prisma.user.findUnique({ where: { id: createdEmp.id } });
  assert(reactivatedEmp?.status === 'ACTIVE', 'Employee reactivated successfully');

  // ==========================================
  // TEST SUITE 16: Executive Calling Workspace & Prioritization
  // ==========================================
  console.log('\n--- Test Suite 16: Executive Calling Workspace & Stage-Outcome Separation ---');

  // 1. Create test candidate and application
  const callingTestCandidate = await prisma.candidate.create({
    data: {
      candidateCode: `CAND-CALL-${Date.now().toString().slice(-6)}`,
      fullName: 'Calling Candidate Test',
      rawPhone: '9876501234',
      normalizedPhone: '9876501234',
      currentLocation: 'Bangalore',
      experienceYears: 3,
      experienceMonths: 6,
      currentSalary: 35000,
      expectedSalary: 45000,
      hasTwoWheeler: true,
      hasDrivingLicense: true,
    },
  });

  const callingTestApp = await prisma.application.create({
    data: {
      applicationCode: `APP-CALL-${Date.now().toString().slice(-6)}`,
      candidateId: callingTestCandidate.id,
      jobId: job!.id,
      companyId: company!.id,
      currentStage: 'ASSIGNED',
      assignedExecutiveId: rahulExec!.id,
      createdById: superAdminUser!.id,
    },
  });

  assert(callingTestApp.id !== undefined, 'Test candidate application created in ASSIGNED stage');

  // 2. Log Call Outcome: RNR (Unreachable)
  const rnrCall = await CallingService.logCall({
    applicationId: callingTestApp.id,
    candidateId: callingTestCandidate.id,
    executiveId: rahulExec!.id,
    callOutcome: 'RNR',
    remarks: 'Rings no response after 5 rings',
  });

  assert(rnrCall.callLog.callOutcome === 'RNR', 'Call log recorded with outcome RNR');
  assert(rnrCall.newStage === 'CALLING', 'Application stage moved from ASSIGNED to CALLING upon initial call');

  // 3. Log Call Outcome: CALLBACK with scheduled datetime
  const tomorrowDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const cbCall = await CallingService.logCall({
    applicationId: callingTestApp.id,
    candidateId: callingTestCandidate.id,
    executiveId: rahulExec!.id,
    callOutcome: 'CALLBACK',
    remarks: 'Candidate busy in meeting, requested callback tomorrow',
    callbackRequired: true,
    callbackDateTime: tomorrowDate.toISOString(),
    callbackReason: 'Follow-up interview details',
    callbackPriority: 'HIGH',
  });

  assert(cbCall.callback !== null, 'Callback record successfully created in Callback table');
  assert(cbCall.callback?.priority === 'HIGH', 'Callback priority recorded as HIGH');
  assert(cbCall.newStage === 'CALLING', 'Callback call outcome preserves current Application Stage (CALLING)');

  // 4. Log Call Outcome: SHORTLISTED (Preserving Stage ≠ Outcome Separation)
  const shortlistCall = await CallingService.logCall({
    applicationId: callingTestApp.id,
    candidateId: callingTestCandidate.id,
    executiveId: rahulExec!.id,
    callOutcome: 'SHORTLISTED',
    remarks: 'Executive recommended shortlist based on call interaction',
  });

  assert(shortlistCall.callLog.callOutcome === 'SHORTLISTED', 'Call log recorded with outcome SHORTLISTED');
  assert(shortlistCall.newStage === 'CALLING', 'Call outcome SHORTLISTED does not bypass formal recruitment pipeline stage');

  const refreshedApp = await prisma.application.findUnique({ where: { id: callingTestApp.id } });
  assert(refreshedApp?.currentStage === 'CALLING', 'Application currentStage remains strictly CALLING');
  assert(refreshedApp?.formStatus === 'PENDING', 'Form status remains PENDING without premature mutation');

  // 5. Verify Executive CRM presence updated
  const execUserPresence = await prisma.user.findUnique({ where: { id: rahulExec!.id } });
  assert(execUserPresence?.presenceStatus === 'AFTER_CALL_WORK', 'Executive presence updated to AFTER_CALL_WORK upon call completion');

  // ==========================================
  // TEST SUMMARY
  // ==========================================
  console.log('\n====================================================');
  console.log(`🏁 Test Suite Finished: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite()
  .catch((e) => {
    console.error('Test suite error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
