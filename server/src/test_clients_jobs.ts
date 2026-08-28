const API_BASE = 'http://localhost:5000/api';

async function runClientJobScenarioTests() {
  console.log('🧪 Starting End-to-End Corporate Client & Job Order CRM Verification...\n');

  try {
    // 1. Authenticate as Super Admin & Manager
    console.log('▶ [STEP 1] Authenticating Super Admin...');
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@genius.com', password: 'Admin@123' }),
    });
    const authData = await loginRes.json();
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${authData.token}` };
    console.log(`- Authenticated as ${authData.user.name} (${authData.user.role})`);

    // 2. Client A Creation: "Hyundai Mobility India Ltd."
    console.log('\n▶ [STEP 2] Creating Corporate Client A: "Hyundai Mobility India Ltd."...');
    const clientRes = await fetch(`${API_BASE}/clients`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        companyName: 'Hyundai Mobility India Ltd.',
        industry: 'Automobile',
        companyWebsite: 'https://www.hyundai.com/in',
        companyAddress: 'Plot C-11, Sector 29',
        city: 'Gurugram',
        state: 'Haryana',
        contactPersonName: 'Mr. Saurabh Srivastava',
        designation: 'General Manager - HR',
        mobileNumber: '9819900112',
        email: 'saurabh.s@hyundai.co.in',
        recruitmentFeeType: 'PERCENTAGE',
        feeAmountOrPercent: 8.33,
        paymentTerms: '30 Days from Joining',
        replacementPeriodDays: 90,
      }),
    });
    const clientData = await clientRes.json();
    if (!clientData.client?.id) throw new Error(`Client creation failed: ${JSON.stringify(clientData)}`);
    const clientId = clientData.client.id;
    console.log(`- Created Client ID: ${clientId} (${clientData.client.displayClientId}: ${clientData.client.companyName})`);

    // 3. Create Job Order for Client A: "Showroom Sales Executive"
    console.log('\n▶ [STEP 3] Client A creates Job Order: "Showroom Sales Executive"...');
    const jobRes = await fetch(`${API_BASE}/job-orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        clientId,
        jobTitle: 'Showroom Sales Executive',
        department: 'Automobile Retail',
        jobLocation: 'Gurugram / South Delhi',
        numberOfVacancies: 10,
        employmentType: 'FULL_TIME',
        minExperienceYears: 1.0,
        maxExperienceYears: 3.5,
        minSalary: 250000,
        maxSalary: 380000,
        twoWheelerRequired: true,
        drivingLicenseRequired: true,
        fieldSalesRequired: false,
        automobileExpRequired: true,
        priority: 'HIGH',
      }),
    });
    const jobData = await jobRes.json();
    if (!jobData.jobOrder?.id) throw new Error(`Job creation failed: ${JSON.stringify(jobData)}`);
    const jobOrderId = jobData.jobOrder.id;
    console.log(`- Created Job Order ID: ${jobOrderId} (${jobData.jobOrder.displayJobId}: ${jobData.jobOrder.jobTitle})`);

    // 4. Fetch Candidate X from Candidate Master
    console.log('\n▶ [STEP 4] Sourcing Candidate X from Master Database...');
    const candListRes = await fetch(`${API_BASE}/candidates?limit=1`, { headers });
    const candListData = await candListRes.json();
    const candidateX = candListData.candidates[0];
    const candidateXId = candidateX.id;
    console.log(`- Selected Candidate X: ${candidateX.name} (UUID: ${candidateXId}, SL: ${candidateX.displaySlNo})`);

    // Get Executive 1 (Priya Sharma)
    const execsRes = await fetch(`${API_BASE}/auth/executives`, { headers });
    const execsData = await execsRes.json();
    const exec1 = execsData.executives[0];
    console.log(`- Executive 1: ${exec1.name} (ID: ${exec1.id})`);

    // 5. Add Candidate X to Job Order & Assign to Executive 1
    console.log('\n▶ [STEP 5] Adding Candidate X to Job Order & Assigning to Executive 1...');
    const addCandRes = await fetch(`${API_BASE}/job-orders/${jobOrderId}/add-candidates`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        candidateIds: [candidateXId],
        assignedExecutiveId: exec1.id,
      }),
    });
    const addCandData = await addCandRes.json();
    console.log(`- ${addCandData.message}`);

    // Retrieve the application record
    const jobDetailRes = await fetch(`${API_BASE}/job-orders/${jobOrderId}`, { headers });
    const jobDetailData = await jobDetailRes.json();
    const appRecord = jobDetailData.jobOrder.applications.find((a: any) => a.candidateId === candidateXId);
    if (!appRecord) throw new Error('Candidate job application not found!');
    const applicationId = appRecord.id;
    console.log(`- Application Record created (ID: ${applicationId}, Stage: ${appRecord.applicationStage})`);

    // 6. Executive 1 Calls Candidate X (Context: Showroom Sales Executive)
    console.log('\n▶ [STEP 6] Executive 1 calls Candidate X regarding Job Order...');
    const callRes = await fetch(`${API_BASE}/calling/log`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        candidateId: candidateXId,
        jobOrderId,
        outcome: 'SHORTLISTED',
        remarks: 'Candidate interested in Showroom Sales Executive at Hyundai Gurugram. CTC expected ₹3.2L.',
        durationSeconds: 185,
      }),
    });
    const callData = await callRes.json();
    console.log(`- Call logged with outcome: ${callData.callActivity.outcome}`);

    // 7. Update Application Stage: Shortlisted → Form Completed → CV Received
    console.log('\n▶ [STEP 7] Qualifying candidate: Form Completed & CV Received...');
    await fetch(`${API_BASE}/job-orders/applications/${applicationId}/stage`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ applicationStage: 'CV_RECEIVED', stageNotes: 'Registration Form filled and WhatsApp CV received' }),
    });
    console.log('- Application Stage updated to CV_RECEIVED');

    // 8. Submit Candidate X to Client A
    console.log('\n▶ [STEP 8] Submitting Candidate X profile and CV to Client A...');
    const submitRes = await fetch(`${API_BASE}/job-orders/submissions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        applicationId,
        notes: 'Candidate has 2.2 years of retail automobile sales experience and holds valid 2W license.',
        cvFileName: 'Candidate_CV_Hyundai.pdf',
      }),
    });
    const submitData = await submitRes.json();
    console.log(`- Submitted to client ID: ${submitData.submission.id}`);

    // 9. Schedule Interview with Client A
    console.log('\n▶ [STEP 9] Scheduling Interview for Candidate X with Client A...');
    const interviewRes = await fetch(`${API_BASE}/job-orders/interviews`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        applicationId,
        interviewDate: '2026-08-30',
        interviewTime: '15:00',
        roundNumber: 1,
        interviewType: 'IN_PERSON',
        locationOrLink: 'Hyundai Showroom Sector 29 Gurugram',
        interviewerName: 'Mr. Saurabh Srivastava (GM - HR)',
        remarks: 'Face to face interview round',
      }),
    });
    const interviewData = await interviewRes.json();
    console.log(`- Scheduled Interview ID: ${interviewData.interview.id} on ${interviewData.interview.interviewDate}`);

    // 10. Record Selection & Final Placement (Joined)
    console.log('\n▶ [STEP 10] Candidate X is Selected and Joins Hyundai Mobility...');
    const placementRes = await fetch(`${API_BASE}/job-orders/placements`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        applicationId,
        joiningDate: '2026-09-05',
        offeredSalary: 340000,
        finalSalary: 340000,
        placementFee: 28322,
        status: 'JOINED',
        notes: 'Candidate completed onboarding and joined showroom branch.',
      }),
    });
    const placementData = await placementRes.json();
    console.log(`- Placement Recorded ID: ${placementData.placement.id} (Status: ${placementData.placement.status}, Fee: ₹${placementData.placement.placementFee})`);

    // 11. Final Integrity & Relationship Verification Check
    console.log('\n▶ [STEP 11] Verifying all entities are connected to permanent Candidate UUID & Job Order...');
    const finalJobRes = await fetch(`${API_BASE}/job-orders/${jobOrderId}`, { headers });
    const finalJob = (await finalJobRes.json()).jobOrder;

    const finalApp = finalJob.applications.find((a: any) => a.id === applicationId);
    const finalSub = finalJob.submissions.find((s: any) => s.candidateId === candidateXId);
    const finalInt = finalJob.interviews.find((i: any) => i.candidateId === candidateXId);
    const finalPlc = finalJob.placements.find((p: any) => p.candidateId === candidateXId);

    if (!finalApp || finalApp.applicationStage !== 'JOINED') throw new Error('Application stage mismatch!');
    if (!finalSub || finalSub.clientId !== clientId) throw new Error('Submission client mismatch!');
    if (!finalInt || finalInt.jobOrderId !== jobOrderId) throw new Error('Interview job mismatch!');
    if (!finalPlc || finalPlc.status !== 'JOINED') throw new Error('Placement status mismatch!');

    console.log(`- Candidate UUID: ${candidateXId} (${candidateX.name})`);
    console.log(`- Client ID: ${clientId} (${finalJob.client.companyName})`);
    console.log(`- Job Order ID: ${jobOrderId} (${finalJob.jobTitle})`);
    console.log(`- Assigned Executive: ${finalApp.assignedExecutive?.name}`);
    console.log(`- Final Stage: ${finalApp.applicationStage}`);
    console.log(`- Job Order Funnel: Joined = ${finalJob.funnel.joinedCount}, Conversion = ${finalJob.funnel.conversionRates.joiningRate}%`);

    console.log('\n═══════════════════════════════════════════════════════════════════════');
    console.log('🎉 COMPLETE CLIENT & JOB ORDER E2E SCENARIO TEST PASSED WITH 100% SUCCESS!');
    console.log('═══════════════════════════════════════════════════════════════════════');
  } catch (err: any) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
}

runClientJobScenarioTests();
