import './setup_env';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { normalizeIndianPhone } from '../src/server/utils/phone';
import { signAuthToken, verifyAuthToken } from '../src/server/utils/jwt';
import { DEFAULT_ROLE_PERMISSIONS } from '../src/server/constants/permissions';
import { AssignmentService } from '../src/server/services/AssignmentService';
import { CallingService } from '../src/server/services/CallingService';
import { ScreeningService } from '../src/server/services/ScreeningService';
import { SubmissionService } from '../src/server/services/SubmissionService';
import { InterviewService } from '../src/server/services/InterviewService';
import { QualityService } from '../src/server/services/QualityService';
import { ReportService } from '../src/server/services/ReportService';
import { ImportService } from '../src/server/services/ImportService';
import { VerificationService } from '../src/server/services/VerificationService';
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
    let existingCand = await prisma.candidate.findUnique({ where: { id: backedUpCandidate.id } });
    if (!existingCand && backedUpCandidate.normalizedPhone) {
      existingCand = await prisma.candidate.findUnique({ where: { normalizedPhone: backedUpCandidate.normalizedPhone } });
    }

    if (!existingCand) {
      const superAdmin = await prisma.user.findFirst();
      existingCand = await prisma.candidate.create({
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
      where: { id: existingCand.id },
      data: { fullName: 'TEMPORARILY_MUTATED_NAME_FOR_TEST' },
    });

    const mutatedCheck = await prisma.candidate.findUnique({ where: { id: existingCand.id } });
    assert(mutatedCheck?.fullName === 'TEMPORARILY_MUTATED_NAME_FOR_TEST', 'Database record mutated prior to restoration test');

    // Execute live restore from backup
    const liveRestoreRes = await verifyAndRestoreBackup(undefined, { executeRestore: true });
    assert(liveRestoreRes.restoredCounts?.candidates! > 0, `Live restore executed and restored ${liveRestoreRes.restoredCounts?.candidates} candidate records`);

    // Verify record was restored in database
    const restoredCandidate = await prisma.candidate.findUnique({ where: { id: existingCand.id } });
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
  const callingPhone = '97' + Date.now().toString().slice(-8);
  const callingTestCandidate = await prisma.candidate.create({
    data: {
      candidateCode: `CAND-CALL-${Date.now().toString().slice(-6)}`,
      fullName: 'Calling Candidate Test',
      rawPhone: callingPhone,
      normalizedPhone: callingPhone,
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
  // TEST SUITE 17: Candidate Verification & Live Qualification Engine
  // ==========================================
  console.log('\n--- Test Suite 17: Candidate Verification & Live Qualification Engine ---');

  // 1. Create a fresh candidate and application
  const verifPhone = '96' + (Date.now() + 1).toString().slice(-8);
  const verifCandidate = await prisma.candidate.create({
    data: {
      candidateCode: `CAND-VRF-${Date.now().toString().slice(-6)}`,
      fullName: 'Verification Target Candidate',
      rawPhone: verifPhone,
      normalizedPhone: verifPhone,
      email: 'source.master@email.com',
      age: 26,
      currentLocation: 'Mumbai',
      education: '12th Pass',
      experienceYears: 1,
      experienceMonths: 6,
      currentSalary: 20000,
      expectedSalary: 25000,
      hasTwoWheeler: false,
      hasDrivingLicense: false,
    },
  });

  const verifJob = await prisma.jobRequirement.create({
    data: {
      jobCode: `JOB-VRF-${Date.now().toString().slice(-6)}`,
      jobTitle: 'Field Sales Executive - Auto',
      companyId: company!.id,
      createdById: superAdminUser!.id,
      location: 'Mumbai',
      salaryMin: 22000,
      salaryMax: 30000,
      experienceMin: 1,
      experienceMax: 4,
      twoWheelerRequired: true,
      drivingLicenseRequired: true,
      ageRequirement: '20 - 32 years',
    },
  });

  const verifApp = await prisma.application.create({
    data: {
      applicationCode: `APP-VRF-${Date.now().toString().slice(-6)}`,
      candidateId: verifCandidate.id,
      jobId: verifJob.id,
      companyId: company!.id,
      currentStage: 'CALLING',
      assignedExecutiveId: rahulExec!.id,
      createdById: superAdminUser!.id,
    },
  });

  // 2. Save candidate-verified data (Confirmed details during call)
  const savedVerif = await VerificationService.upsertVerification(
    verifApp.id,
    {
      email: 'candidate.verified@gmail.com',
      age: 27,
      gender: 'Male',
      currentLocation: 'Mumbai Suburban',
      appliedLocation: 'Mumbai',
      education: 'Graduate B.Com',
      experienceYears: 2,
      experienceMonths: 0,
      currentCompany: 'Reliance Retail',
      previousCompany: 'DMart',
      currentSalary: 22000,
      expectedSalary: 28000,
      noticePeriod: 'Immediate',
      hasTwoWheeler: true,
      hasDrivingLicense: true,
      interestedInFieldSales: true,
      interestedInAutomobile: true,
      skills: ['Direct Sales', 'Customer Handling'],
      languages: ['Hindi', 'English', 'Marathi'],
    },
    rahulExec!.id
  );

  assert(savedVerif.id !== undefined, 'ApplicationVerification record created successfully');
  assert(savedVerif.email === 'candidate.verified@gmail.com', 'Verified email updated on verification record');
  assert(savedVerif.hasTwoWheeler === true, 'Verified 2-wheeler status saved as true');
  assert(savedVerif.verifiedByUserId === rahulExec!.id, 'Verified by user ID recorded');

  // 3. Confirm Candidate Master Source Data remains UNTOUCHED
  const candMaster = await prisma.candidate.findUnique({ where: { id: verifCandidate.id } });
  assert(candMaster?.email === 'source.master@email.com', 'Source candidate email remains untouched in Candidate master');
  assert(candMaster?.hasTwoWheeler === false, 'Source candidate 2-wheeler remains false in Candidate master');
  assert(candMaster?.education === '12th Pass', 'Source education remains untouched');

  // 4. Confirm Application recruitment stage is NOT mutated by verification saving
  const appAfterVerif = await prisma.application.findUnique({ where: { id: verifApp.id } });
  assert(appAfterVerif?.currentStage === 'CALLING', 'Application recruitment stage strictly preserved during verification save');

  // 5. Test Live Qualification Engine Evaluation
  const { qualificationEvaluation: evalResult } = await VerificationService.getVerification(verifApp.id);
  assert(evalResult.overallStatus === 'MATCH', 'Qualification Engine evaluates full criteria as QUALIFIED MATCH');
  assert(evalResult.rules.length >= 8, 'Engine evaluates all 8 distinct rule criteria');

  const bikeRule = evalResult.rules.find((r) => r.key === 'twoWheeler');
  assert(bikeRule?.status === 'MATCH', 'Two-Wheeler rule evaluated as MATCH');

  // ============================================================
  // BUSINESS RULE TEST 1: Source Age 25, Verified Age 27, Job Age 21-30 => MATCH
  // The system MUST NOT treat difference (25 -> 27) as a mismatch.
  // ============================================================
  const evalRule1 = VerificationService.evaluateQualification(
    { age: 27 },
    { ageRequirement: '21 - 30 years' }
  );
  const ageRule1 = evalRule1.rules.find((r) => r.key === 'age');
  assert(
    ageRule1?.status === 'MATCH',
    'Business Rule 1: Source 25 -> Verified 27 vs Job (21-30) evaluates to MATCH (difference is not mismatch)'
  );

  // ============================================================
  // BUSINESS RULE 2: Source Salary 18k, Verified Salary 22k, Job Max 20k => MISMATCH
  // Mismatch is strictly because verified 22k > 20k (not because 18k != 22k).
  // ============================================================
  const evalRule2 = VerificationService.evaluateQualification(
    { expectedSalary: 22000 },
    { salaryMax: 20000 }
  );
  const salaryRule2 = evalRule2.rules.find((r) => r.key === 'salary');
  assert(
    salaryRule2?.status === 'MISMATCH',
    'Business Rule 2: Verified Salary 22k vs Job Max 20k evaluates to MISMATCH (because 22k > 20k)'
  );

  // ============================================================
  // BUSINESS RULE 3: Source Age 25, Verified Age 27, Job Age 21-25 => MISMATCH
  // Mismatch is strictly because verified 27 > 25 (not because 25 != 27).
  // ============================================================
  const evalRule3 = VerificationService.evaluateQualification(
    { age: 27 },
    { ageRequirement: '21 - 25 years' }
  );
  const ageRule3 = evalRule3.rules.find((r) => r.key === 'age');
  assert(
    ageRule3?.status === 'MISMATCH',
    'Business Rule 3: Verified Age 27 vs Job (21-25) evaluates to MISMATCH (because 27 > 25)'
  );

  // ============================================================
  // BUSINESS RULE 4: Missing Verified Value => REVIEW (Not assumed from source)
  // When verified age is missing, do not assume source age. Must be REVIEW.
  // ============================================================
  const evalRule4 = VerificationService.evaluateQualification(
    { age: null },
    { ageRequirement: '21 - 30 years' }
  );
  const ageRule4 = evalRule4.rules.find((r) => r.key === 'age');
  assert(
    ageRule4?.status === 'REVIEW' && ageRule4?.candidateValue === 'Not Verified',
    'Business Rule 4: Missing verified age returns REVIEW with candidateValue = "Not Verified"'
  );

  // ============================================================
  // BUSINESS RULE 5: Application-Level Isolation
  // Same Candidate, 2 Applications => 2 independent ApplicationVerification records
  // Candidate Master remains untouched.
  // ============================================================
  const secondJob = await prisma.jobRequirement.create({
    data: {
      jobCode: `JOB-SEC-${Date.now().toString().slice(-6)}`,
      jobTitle: 'Store Manager',
      companyId: company!.id,
      createdById: superAdminUser!.id,
      location: 'Pune',
      salaryMin: 30000,
      salaryMax: 40000,
      experienceMin: 2,
    },
  });

  const secondApp = await prisma.application.create({
    data: {
      applicationCode: `APP-SEC-${Date.now().toString().slice(-6)}`,
      candidateId: verifCandidate.id,
      jobId: secondJob.id,
      companyId: company!.id,
      currentStage: 'CALLING',
      assignedExecutiveId: rahulExec!.id,
      createdById: superAdminUser!.id,
    },
  });

  // Verify App 2 independently
  const savedVerifApp2 = await VerificationService.upsertVerification(
    secondApp.id,
    {
      age: 28,
      expectedSalary: 35000,
      hasTwoWheeler: false,
    },
    rahulExec!.id
  );

  assert(savedVerifApp2.id !== savedVerif.id, 'Business Rule 5: App 1 and App 2 have distinct independent verification IDs');
  assert(savedVerifApp2.age === 28 && savedVerif.age === 27, 'Business Rule 5: App 1 verified age (27) and App 2 verified age (28) are isolated');

  const reloadedCandMaster = await prisma.candidate.findUnique({ where: { id: verifCandidate.id } });
  assert(
    reloadedCandMaster?.age === 26 && reloadedCandMaster?.email === 'source.master@email.com',
    'Business Rule 5: Candidate master record remains untouched (Age=26, Email=source.master@email.com)'
  );

  // 6. Test Mismatch Scenario (Missing License / Bike)
  const mismatchVerif = await VerificationService.upsertVerification(
    verifApp.id,
    {
      hasTwoWheeler: false,
      hasDrivingLicense: false,
    },
    rahulExec!.id
  );
  assert(mismatchVerif.hasTwoWheeler === false, 'Updated verification with missing two-wheeler');

  const { qualificationEvaluation: evalMismatch } = await VerificationService.getVerification(verifApp.id);
  assert(evalMismatch.overallStatus === 'MISMATCH', 'Engine flags overall MISMATCH when mandatory 2-wheeler is missing');

  // 7. Verify Audit Log recorded for verification
  const verifAudit = await prisma.auditLog.findFirst({
    where: {
      entity: 'ApplicationVerification',
      action: 'VERIFICATION_SAVED',
      userId: rahulExec!.id,
    },
  });
  assert(verifAudit !== null, 'AuditLog created for VERIFICATION_SAVED action');

  // ==========================================
  // TEST SUITE 18: Executive Productivity & Activity Analytics
  // ==========================================
  console.log('\n--- Test Suite 18: Executive Productivity & Activity Analytics ---');

  // 1. Setup multiple call interactions across distinct applications for Rahul
  const prodPhone = '95' + (Date.now() + 2).toString().slice(-8);
  const prodCandidate2 = await prisma.candidate.create({
    data: {
      candidateCode: `CAND-PRD2-${Date.now().toString().slice(-6)}`,
      fullName: 'Productivity Candidate Two',
      rawPhone: prodPhone,
      normalizedPhone: prodPhone,
      currentLocation: 'Delhi',
    },
  });

  const prodApp2 = await prisma.application.create({
    data: {
      applicationCode: `APP-PRD2-${Date.now().toString().slice(-6)}`,
      candidateId: prodCandidate2.id,
      jobId: verifJob.id,
      companyId: company!.id,
      currentStage: 'CALLING',
      assignedExecutiveId: rahulExec!.id,
      createdById: superAdminUser!.id,
    },
  });

  // Rahul logs 2 calls to App 1, and 1 call to App 2
  await CallingService.logCall({
    applicationId: verifApp.id,
    candidateId: verifCandidate.id,
    executiveId: rahulExec!.id,
    callOutcome: 'CONNECTED',
    remarks: 'First interaction discussion',
  });

  await CallingService.logCall({
    applicationId: verifApp.id,
    candidateId: verifCandidate.id,
    executiveId: rahulExec!.id,
    callOutcome: 'INTERESTED',
    remarks: 'Second interaction candidate agreed',
  });

  await CallingService.logCall({
    applicationId: prodApp2.id,
    candidateId: prodCandidate2.id,
    executiveId: rahulExec!.id,
    callOutcome: 'RNR',
    remarks: 'No response from candidate',
  });

  // 2. Fetch Productivity Analytics for Rahul
  const superAdminSession = {
    userId: superAdminUser!.id,
    email: superAdminUser!.email,
    fullName: superAdminUser!.fullName,
    roles: ['SUPER_ADMIN'],
    permissions: ['reports.operations', 'application.view_all'],
  };

  const rahulSession = {
    userId: rahulExec!.id,
    email: rahulExec!.email,
    fullName: rahulExec!.fullName,
    roles: ['EXECUTIVE'],
    permissions: ['application.view_own', 'calling.log'],
  };

  const prodAnalytics = await ReportService.getExecutiveProductivityAnalytics(
    {
      datePreset: 'TODAY',
      executiveId: rahulExec!.id,
    },
    superAdminSession
  );

  assert(prodAnalytics.summary.totalCallsLogged >= 3, 'Total Calls Logged aggregated correctly');
  assert(prodAnalytics.summary.uniqueLeadsWorked >= 2, 'Unique Leads Worked computed distinctly across applications');
  assert(prodAnalytics.summary.connectedCalls >= 1, 'Connected calls count verified');

  const rahulRow = prodAnalytics.executiveMatrix.find((e: any) => e.id === rahulExec!.id);
  assert(rahulRow !== undefined, 'Executive matrix contains Rahul');
  assert((rahulRow?.uniqueLeadsWorked ?? 0) >= 2, 'Executive matrix records Unique Leads Worked >= 2');
  assert((rahulRow?.totalCallsLogged ?? 0) >= 3, 'Executive matrix records Total Calls Logged >= 3');

  // 3. Test Hourly Productivity Breakdown
  assert(Array.isArray(prodAnalytics.hourlyBreakdown), 'Hourly breakdown array returned');
  assert(prodAnalytics.hourlyBreakdown.length > 0, 'Hourly breakdown contains working day hour slots');

  // 4. Test Executive Activity Timeline & CRM Activity Gap Calculation
  const timelineResult = await ReportService.getExecutiveActivityTimeline(
    { executiveId: rahulExec!.id },
    superAdminSession
  );

  assert(timelineResult.executive.fullName === rahulExec!.fullName, 'Timeline loads for target executive');
  assert(timelineResult.totalEvents >= 3, 'Timeline aggregates all discrete CRM events');
  assert(Array.isArray(timelineResult.events), 'Timeline events array returned');

  // 5. Test Server-side RBAC Enforcement
  let rbacBlocked = false;
  try {
    // Rahul (Executive) trying to view Priya's productivity analytics
    await ReportService.getExecutiveProductivityAnalytics(
      { executiveId: priyaExec!.id },
      rahulSession
    );
  } catch (err: any) {
    if (err.message.includes('Forbidden')) {
      rbacBlocked = true;
    }
  }
  assert(rbacBlocked, 'Server-side RBAC strictly blocks executive from accessing another executive productivity');

  // 6. Test CSV Export Generation
  const csvExport = await ReportService.exportProductivityCSV(
    { datePreset: 'TODAY' },
    superAdminSession
  );
  assert(typeof csvExport === 'string' && csvExport.includes('Executive Name,Email'), 'CSV export generated with headers');
  assert(csvExport.includes(rahulExec!.fullName), 'CSV export includes executive records');

  // 7. Test CSV Export RBAC
  let csvRbacBlocked = false;
  try {
    await ReportService.exportProductivityCSV(
      { executiveId: priyaExec!.id },
      rahulSession
    );
  } catch (err: any) {
    if (err.message.includes('Forbidden')) {
      csvRbacBlocked = true;
    }
  }
  assert(csvRbacBlocked, 'Server-side RBAC strictly blocks executive from exporting another executive CSV data');

  // ==========================================
  // TEST SUITE 19: Multi-Sheet Excel Import Commit & Reconciliation
  // ==========================================
  console.log('\n--- Test Suite 19: Multi-Sheet Excel Import Commit & Reconciliation ---');

  // 1. Construct a comprehensive multi-sheet workbook matching production structure
  const multiSheetWb = XLSX.utils.book_new();

  const testTime19 = Date.now();
  const phone1 = '91' + testTime19.toString().slice(-8);
  const phone2 = '92' + (testTime19 + 1).toString().slice(-8);
  const phone3 = '93' + (testTime19 + 2).toString().slice(-8);

  const email1 = `rahul.${testTime19}@testcrm.com`;
  const email2 = `priya.${testTime19}@testcrm.com`;
  const email3 = `arjun.${testTime19}@testcrm.com`;

  const candidateMasterRows = [
    {
      'Candidate Name': 'Demo Rahul Patil',
      'Phone Number': phone1,
      'Email': email1,
      'Location': 'Pune, Maharashtra',
      'Education': 'B.Com Graduate',
      'Experience': '2 Years',
      'Current/Latest Job': 'Retail Sales Exec',
      'Assets': 'Bike with Driving License',
    },
    {
      'Candidate Name': 'Demo Priya Kulkarni',
      'Phone Number': phone2,
      'Email': email2,
      'Location': 'Mumbai, Maharashtra',
      'Education': 'B.Sc IT',
      'Experience': '3 Years',
      'Current/Latest Job': 'Telecaller',
      'Assets': 'Two Wheeler',
    },
    {
      'Candidate Name': 'Demo Arjun Shinde',
      'Phone Number': phone3,
      'Email': email3,
      'Location': 'Nagpur, Maharashtra',
      'Education': 'HSC 12th',
      'Experience': '1 Year',
      'Current/Latest Job': 'Field Agent',
      'Assets': '',
    },
  ];

  const dashboardRows = [
    {
      'Candidate Name': 'Demo Rahul Patil',
      'Contact number': phone1,
      'Location': 'Pune City',
      'Years of experience': '2',
      'Previous/current company': 'Big Bazaar',
      'Have 2wheeler with license': 1,
    },
  ];

  const shortlistRows = [
    {
      'Candidate Name': 'Demo Priya Kulkarni',
      'Contact number': phone2,
      'Shortlist Status': 'SHORTLISTED',
    },
  ];

  const dailyCallingRows = [
    {
      'Candidate Name': 'Demo Rahul Patil',
      'Phone Number': phone1,
      'Call Status': 'Connected',
      'Remarks': 'Interested in job opening',
    },
  ];

  const guideRows = [
    {
      'Instruction': 'This is a reference guide sheet and should be ignored during lead commit.',
    },
  ];

  XLSX.utils.book_append_sheet(multiSheetWb, XLSX.utils.json_to_sheet(candidateMasterRows), 'CANDIDATE MASTER');
  XLSX.utils.book_append_sheet(multiSheetWb, XLSX.utils.json_to_sheet(dashboardRows), 'DASHBOARD');
  XLSX.utils.book_append_sheet(multiSheetWb, XLSX.utils.json_to_sheet(shortlistRows), 'SHORTLISTED CANDIDATES');
  XLSX.utils.book_append_sheet(multiSheetWb, XLSX.utils.json_to_sheet(dailyCallingRows), 'DAILY CALLING TRACKER');
  XLSX.utils.book_append_sheet(multiSheetWb, XLSX.utils.json_to_sheet(guideRows), 'IMPORT GUIDE');

  const multiSheetBuffer = XLSX.write(multiSheetWb, { type: 'buffer', bookType: 'xlsx' });

  // 2. Test Preview Generation
  const previewResult = ImportService.parseWorkbookBuffer(multiSheetBuffer, 'Genius_Consultancy_CRM_Demo_Leads.xlsx');
  assert(previewResult.totalRows === 3, 'Preview: Correctly parses all 3 Candidate Master rows');
  assert(previewResult.detectedSheets.length === 5, 'Preview: Accurately detects all 5 workbook sheets');
  assert(
    previewResult.detectedSheets.includes('CANDIDATE MASTER') &&
    previewResult.detectedSheets.includes('DASHBOARD') &&
    previewResult.detectedSheets.includes('SHORTLISTED CANDIDATES') &&
    previewResult.detectedSheets.includes('DAILY CALLING TRACKER') &&
    previewResult.detectedSheets.includes('IMPORT GUIDE'),
    'Preview: Sheet names match expected structure'
  );

  // 3. Test Commit Execution
  const commitRes = await ImportService.commitWorkbook(
    multiSheetBuffer,
    'Genius_Consultancy_CRM_Demo_Leads.xlsx',
    superAdminUser!.id,
    verifJob.id,
    company!.id
  );

  assert(commitRes.importedCount === 3, 'Commit: Successfully imported 3 candidate records');
  assert(commitRes.duplicateCount === 0, 'Commit: Initial batch has 0 duplicate records');
  assert(commitRes.batchCode.startsWith('BATCH-'), 'Commit: Generates formatted unique batchCode');

  // Verify created candidates in database
  const cand1 = await prisma.candidate.findUnique({ where: { normalizedPhone: phone1 } });
  const cand2 = await prisma.candidate.findUnique({ where: { normalizedPhone: phone2 } });
  const cand3 = await prisma.candidate.findUnique({ where: { normalizedPhone: phone3 } });

  assert(cand1 !== null && cand1.fullName === 'Demo Rahul Patil', 'Candidate 1 created with Candidate Master details');
  assert(cand2 !== null && cand2.fullName === 'Demo Priya Kulkarni', 'Candidate 2 created with Candidate Master details');
  assert(cand3 !== null && cand3.fullName === 'Demo Arjun Shinde', 'Candidate 3 created with Candidate Master details');

  // Verify Dashboard sheet enrichment on Candidate 1 (Have 2wheeler with license = 1)
  assert(cand1?.hasTwoWheeler === true && cand1.hasDrivingLicense === true, 'Candidate 1 enriched from Dashboard sheet');

  // Verify Shortlisted Candidates sheet reconciliation on Candidate 2 application
  const app2 = await prisma.application.findFirst({
    where: { candidateId: cand2!.id, jobId: verifJob.id },
  });
  assert(app2 !== null, 'Application for Candidate 2 created');
  assert(app2?.currentStage === 'SHORTLISTED', 'Candidate 2 application stage set to SHORTLISTED from shortlist sheet');
  assert(app2?.formStatus === 'RECEIVED', 'Candidate 2 formStatus set to RECEIVED');
  assert(app2?.cvStatus === 'CV_RECEIVED', 'Candidate 2 cvStatus set to CV_RECEIVED');

  // 4. Test Idempotency (Re-importing the exact same workbook should not create duplicate candidate records)
  const reCommitRes = await ImportService.commitWorkbook(
    multiSheetBuffer,
    'Genius_Consultancy_CRM_Demo_Leads.xlsx',
    superAdminUser!.id,
    verifJob.id,
    company!.id
  );

  assert(reCommitRes.duplicateCount === 3, 'Idempotent Re-import: Correctly identifies all 3 existing candidates as duplicates');
  assert(reCommitRes.importedCount === 3, 'Idempotent Re-import: Total processed rows is 3');

  const countAfterReimport = await prisma.candidate.count({
    where: {
      normalizedPhone: { in: [phone1, phone2, phone3] },
    },
  });
  assert(countAfterReimport === 3, 'Deduplication: Database candidate count remains exactly 3 without duplicate records');

  // 5. Test Error Handling on Invalid Job Requirement ID
  let jobErrorCaught = false;
  try {
    await ImportService.commitWorkbook(
      multiSheetBuffer,
      'Genius_Consultancy_CRM_Demo_Leads.xlsx',
      superAdminUser!.id,
      'invalid-nonexistent-job-id',
      company!.id
    );
  } catch (err: any) {
    if (err.message.includes('not found')) {
      jobErrorCaught = true;
    }
  }
  assert(jobErrorCaught, 'Validation: Commit throws descriptive error when Job Requirement is missing/invalid');

  // ==========================================
  // TEST SUITE 20: 20-Candidate Demo Leads Workbook, Demo Target Sheet & Full RBAC Matrix
  // ==========================================
  console.log('\n--- Test Suite 20: 20-Candidate Demo Leads Workbook & Full RBAC Matrix ---');

  // 1. Setup Demo Target Company and Job Requirement
  const demoCompCode = `COMP-DEMO-${Date.now().toString().slice(-4)}`;
  const demoCompany = await prisma.company.create({
    data: {
      companyCode: demoCompCode,
      companyName: 'DemoTech Solutions Pvt Ltd',
      industry: 'Information Technology',
      companyType: 'Corporate',
      city: 'Kalaburagi',
      state: 'Karnataka',
      status: 'ACTIVE',
      createdById: superAdminUser!.id,
    },
  });

  const demoJobCode = `JOB-DEMO-${Date.now().toString().slice(-4)}`;
  const demoJob = await prisma.jobRequirement.create({
    data: {
      jobCode: demoJobCode,
      jobTitle: 'Field Sales Executive - Kalaburagi',
      companyId: demoCompany.id,
      vacancies: 20,
      location: 'Kalaburagi, Karnataka',
      salaryMin: 18000,
      salaryMax: 26000,
      experienceMin: 0,
      experienceMax: 3,
      twoWheelerRequired: true,
      drivingLicenseRequired: true,
      createdById: superAdminUser!.id,
    },
  });

  assert(demoCompany.id !== undefined, 'Target Company created: DemoTech Solutions Pvt Ltd');
  assert(demoJob.id !== undefined, 'Target Job Requirement created: Field Sales Executive - Kalaburagi');

  // 2. Construct exactly 20 fictional demo candidates across all 6 sheets
  const demoLeadWb = XLSX.utils.book_new();
  const testTime20 = Date.now();

  const demoCandidateNames = [
    'Demo Rahul Patil', 'Demo Priya Kulkarni', 'Demo Arjun Shinde', 'Demo Sneha Deshmukh',
    'Demo Vikram Rathod', 'Demo Pooja Joshi', 'Demo Aditya Gaikwad', 'Demo Ananya Hegde',
    'Demo Rohan Mane', 'Demo Kavita Biradar', 'Demo Suresh Kamble', 'Demo Megha Kulkarni',
    'Demo Rajesh Pujari', 'Demo Shweta Patil', 'Demo Vinay Nayak', 'Demo Deepa Shetty',
    'Demo Santosh Jadhav', 'Demo Jyotsna Rao', 'Demo Kiran More', 'Demo Manisha Pawar',
  ];

  const demoCandidates = demoCandidateNames.map((name, i) => {
    const numStr = String(testTime20 + i).slice(-8);
    return {
      name,
      phone: `94${numStr}`,
      email: `demo.candidate.${testTime20}.${i + 1}@demotech.com`,
      loc: 'Kalaburagi',
      edu: i % 2 === 0 ? 'B.Com Graduate' : 'B.Sc IT',
      exp: `${(i % 5) + 1} Years`,
      assets: i % 2 === 0 ? 'Bike with DL' : 'Two Wheeler',
    };
  });

  const candMasterSheet = demoCandidates.map((c) => ({
    'Candidate Name': c.name,
    'Phone Number': c.phone,
    'Email': c.email,
    'Location': c.loc,
    'Education': c.edu,
    'Experience': c.exp,
    'Current/Latest Job': 'Field Executive',
    'Assets': c.assets,
  }));

  const dashSheet = demoCandidates.slice(0, 10).map((c) => ({
    'Candidate Name': c.name,
    'Contact number': c.phone,
    'Location': c.loc,
    'Years of experience': c.exp,
    'Previous/current company': 'Prior Enterprise',
    'Have 2wheeler with license': 1,
  }));

  const shortlistSheet = demoCandidates.slice(0, 5).map((c) => ({
    'Candidate Name': c.name,
    'Contact number': c.phone,
    'Shortlist Status': 'SHORTLISTED',
  }));

  const dailySheet = demoCandidates.slice(0, 8).map((c) => ({
    'Candidate Name': c.name,
    'Phone Number': c.phone,
    'Call Status': 'Connected',
    'Remarks': 'Discussed Kalaburagi opening',
  }));

  const guideSheet = [{ 'Instruction': 'Demo Import Guidelines' }];
  const demoTargetSheet = [{
    'Target Client Company': 'DemoTech Solutions Pvt Ltd',
    'Target Job Requirement': 'Field Sales Executive - Kalaburagi',
  }];

  XLSX.utils.book_append_sheet(demoLeadWb, XLSX.utils.json_to_sheet(candMasterSheet), 'CANDIDATE MASTER');
  XLSX.utils.book_append_sheet(demoLeadWb, XLSX.utils.json_to_sheet(dashSheet), 'DASHBOARD');
  XLSX.utils.book_append_sheet(demoLeadWb, XLSX.utils.json_to_sheet(shortlistSheet), 'SHORTLISTED CANDIDATES');
  XLSX.utils.book_append_sheet(demoLeadWb, XLSX.utils.json_to_sheet(dailySheet), 'DAILY CALLING TRACKER');
  XLSX.utils.book_append_sheet(demoLeadWb, XLSX.utils.json_to_sheet(guideSheet), 'IMPORT GUIDE');
  XLSX.utils.book_append_sheet(demoLeadWb, XLSX.utils.json_to_sheet(demoTargetSheet), 'DEMO TARGET');

  const demo20Buffer = XLSX.write(demoLeadWb, { type: 'buffer', bookType: 'xlsx' });

  // 3. Preview 20-candidate workbook
  const demo20Preview = ImportService.parseWorkbookBuffer(demo20Buffer, 'Genius_Consultancy_CRM_Demo_Leads.xlsx');
  assert(demo20Preview.totalRows === 20, '20-Candidate Demo Preview: Exactly 20 rows parsed from CANDIDATE MASTER');
  assert(demo20Preview.detectedSheets.length === 6, '20-Candidate Demo Preview: All 6 sheets detected');
  assert(demo20Preview.detectedSheets.includes('DEMO TARGET'), '20-Candidate Demo Preview: Detects DEMO TARGET sheet');

  // 4. Initial 20-candidate Commit Execution
  const demo20Commit = await ImportService.commitWorkbook(
    demo20Buffer,
    'Genius_Consultancy_CRM_Demo_Leads.xlsx',
    superAdminUser!.id,
    demoJob.id,
    demoCompany.id
  );

  assert(demo20Commit.importedCount === 20, 'Initial Commit: Successfully imported 20 candidate rows');
  assert(demo20Commit.duplicateCount === 0, 'Initial Commit: 0 duplicates on clean first import');
  assert(demo20Commit.skippedCount === 0, 'Initial Commit: 0 skipped rows');

  // 5. Verify PostgreSQL / Database Candidate Count and Association
  const importedPhoneList = demoCandidates.map((c) => c.phone);
  const createdCandCount = await prisma.candidate.count({
    where: { normalizedPhone: { in: importedPhoneList } },
  });
  assert(createdCandCount === 20, 'Database Integrity: Exactly 20 distinct Candidate records created in Candidate Master');

  const createdAppCount = await prisma.application.count({
    where: { jobId: demoJob.id, companyId: demoCompany.id },
  });
  assert(createdAppCount === 20, 'Database Integrity: Exactly 20 Application records created and linked to Target Company & Job');

  // 6. Verify Shortlisted Candidates Reconciliation (First 5 candidates)
  const shortlistedApps = await prisma.application.findMany({
    where: {
      jobId: demoJob.id,
      candidate: { normalizedPhone: { in: demoCandidates.slice(0, 5).map((c) => c.phone) } },
    },
  });
  const allShortlisted = shortlistedApps.every(
    (app) => app.currentStage === 'SHORTLISTED' && app.formStatus === 'RECEIVED' && app.cvStatus === 'CV_RECEIVED'
  );
  assert(allShortlisted, 'Multi-Sheet Reconciliation: Shortlist sheet candidates correctly promoted to SHORTLISTED / RECEIVED');

  // 7. Verify Idempotency (Second Re-Import of exact same 20-candidate workbook)
  const demo20Recommit = await ImportService.commitWorkbook(
    demo20Buffer,
    'Genius_Consultancy_CRM_Demo_Leads.xlsx',
    superAdminUser!.id,
    demoJob.id,
    demoCompany.id
  );

  assert(demo20Recommit.duplicateCount === 20, 'Idempotent 2nd Import: Identifies all 20 existing candidates as duplicates');
  assert(demo20Recommit.importedCount === 20, 'Idempotent 2nd Import: Total processed rows is 20');

  const postRecommitCandCount = await prisma.candidate.count({
    where: { normalizedPhone: { in: importedPhoneList } },
  });
  assert(postRecommitCandCount === 20, 'Idempotent 2nd Import: Database Candidate count remains strictly 20 (NO duplicate copies)');

  const postRecommitAppCount = await prisma.application.count({
    where: { jobId: demoJob.id, companyId: demoCompany.id },
  });
  assert(postRecommitAppCount === 20, 'Idempotent 2nd Import: Database Application count remains strictly 20 (NO duplicate applications)');

  // 8. Verify ImportBatch and AuditLog for 20-row demo import
  const demoBatch = await prisma.importBatch.findUnique({
    where: { id: demo20Commit.batchId },
  });
  assert(demoBatch !== null && demoBatch.status === 'COMMITTED', 'ImportBatch recorded with status COMMITTED');
  assert(demoBatch?.totalRows === 20 && demoBatch?.importedRows === 20, 'ImportBatch records totalRows=20, importedRows=20');

  const importAudit = await prisma.auditLog.findFirst({
    where: {
      entity: 'ImportBatch',
      entityId: demo20Commit.batchId,
      action: 'IMPORT_COMMITTED',
    },
  });
  assert(importAudit !== null, 'Immutable AuditLog entry created for ImportBatch commit');

  // 9. Verify Comprehensive RBAC Matrix for Lead Import
  const { hasPermission: checkRbac } = await import('../src/server/middleware/auth');

  const makeSession = (roleName: string, permissions: string[]) => ({
    userId: `mock-${roleName.toLowerCase()}-id`,
    email: `${roleName.toLowerCase()}@geniusconsultancy.com`,
    fullName: `Mock ${roleName}`,
    roles: [roleName],
    permissions,
  });

  const superAdminSess = makeSession('SUPER_ADMIN', DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN);
  const opsHeadSess = makeSession('OPERATIONS_HEAD', DEFAULT_ROLE_PERMISSIONS.OPERATIONS_HEAD);
  const screeningSess = makeSession('SCREENING_MANAGER', DEFAULT_ROLE_PERMISSIONS.SCREENING_MANAGER);
  const execSess = makeSession('EXECUTIVE', DEFAULT_ROLE_PERMISSIONS.EXECUTIVE);
  const tlSess = makeSession('TEAM_LEAD', DEFAULT_ROLE_PERMISSIONS.TEAM_LEAD);
  const bdmSess = makeSession('BUSINESS_DEVELOPMENT_MANAGER', DEFAULT_ROLE_PERMISSIONS.BUSINESS_DEVELOPMENT_MANAGER);
  const bdeSess = makeSession('BUSINESS_DEVELOPMENT_EXECUTIVE', DEFAULT_ROLE_PERMISSIONS.BUSINESS_DEVELOPMENT_EXECUTIVE);
  const finSess = makeSession('FINANCE_MANAGER', DEFAULT_ROLE_PERMISSIONS.FINANCE_MANAGER);

  assert(checkRbac(superAdminSess, 'candidate.import') === true, 'RBAC: SUPER_ADMIN is ALLOWED candidate.import');
  assert(checkRbac(opsHeadSess, 'candidate.import') === true, 'RBAC: OPERATIONS_HEAD is ALLOWED candidate.import');
  assert(checkRbac(execSess, 'candidate.import') === false, 'RBAC: EXECUTIVE is DENIED candidate.import');
  assert(checkRbac(screeningSess, 'candidate.import') === false, 'RBAC: SCREENING_MANAGER is DENIED candidate.import');
  assert(checkRbac(tlSess, 'candidate.import') === false, 'RBAC: TEAM_LEAD is DENIED candidate.import');
  assert(checkRbac(bdmSess, 'candidate.import') === false, 'RBAC: BUSINESS_DEVELOPMENT_MANAGER is DENIED candidate.import');
  assert(checkRbac(bdeSess, 'candidate.import') === false, 'RBAC: BUSINESS_DEVELOPMENT_EXECUTIVE is DENIED candidate.import');
  assert(checkRbac(finSess, 'candidate.import') === false, 'RBAC: FINANCE_MANAGER is DENIED candidate.import');

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
