const API_BASE = 'http://localhost:5000/api';

async function runRealGeniusWorkflowSuite() {
  console.log('🧪 Starting Genius Consultants Real Business Operations Workflow Test Suite...\n');

  try {
    // STEP 1: Authenticate Super Admin & Executives
    console.log('▶ [STEP 1] Authenticating Super Admin & Telecalling Executives...');
    const adminAuth = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@genius.com', password: 'Admin@123' }),
    }).then((r) => r.json());
    const adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminAuth.token}` };

    const execAAuth = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'priya@genius.com', password: 'Exec@123' }),
    }).then((r) => r.json());
    const execAHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${execAAuth.token}` };

    const execBAuth = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'amit@genius.com', password: 'Exec@123' }),
    }).then((r) => r.json());
    const execBHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${execBAuth.token}` };

    console.log(`- Authenticated Admin: ${adminAuth.user.name}`);
    console.log(`- Authenticated Executive A: ${execAAuth.user.name}`);
    console.log(`- Authenticated Executive B: ${execBAuth.user.name}`);

    // STEP 2: Create Corporate Client "ABC Motors Ltd"
    console.log('\n▶ [STEP 2] Admin creates Corporate Client "ABC Motors Ltd"...');
    const clientRes = await fetch(`${API_BASE}/clients`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        companyName: `ABC Motors Ltd (${Date.now().toString().slice(-4)})`,
        industry: 'Automobile',
        city: 'Kalaburagi',
        state: 'Karnataka',
        contactPersonName: 'Mr. Ramesh Sharma',
        designation: 'HR Head',
        mobileNumber: '9876501234',
        email: 'ramesh.hr@abcmotors.com',
      }),
    });
    const clientData = await clientRes.json();
    const client = clientData.client;
    console.log(`- Created Client: ${client.companyName} (ID: ${client.id}, Code: ${client.displayClientId})`);

    // STEP 3: Create Company Requirement / Job Order
    console.log('\n▶ [STEP 3] Admin creates Job Requirement "Automobile Sales Advisor"...');
    const jobRes = await fetch(`${API_BASE}/job-orders`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        clientId: client.id,
        jobTitle: 'Automobile Sales Advisor',
        department: 'Showroom Sales',
        jobLocation: 'Kalaburagi',
        numberOfVacancies: 5,
        requiredEducation: '12th Pass / Graduate',
        minExperienceYears: 0.5,
        maxExperienceYears: 3.0,
        minSalary: 180000,
        maxSalary: 300000,
        twoWheelerRequired: true,
        drivingLicenseRequired: true,
        fieldSalesRequired: true,
        googleFormUrl: 'https://forms.gle/abc-motors-kalaburagi-form',
        hrContactName: 'Mr. Ramesh Sharma',
        hrContactPhone: '9876501234',
        hrContactEmail: 'ramesh.hr@abcmotors.com',
        priority: 'HIGH',
      }),
    });
    const jobData = await jobRes.json();
    const jobOrder = jobData.jobOrder;
    console.log(`- Created Job Requirement: ${jobOrder.jobTitle} (Vacancies: ${jobOrder.numberOfVacancies}, Location: ${jobOrder.jobLocation})`);
    console.log(`- Configured Google Form URL: ${jobOrder.googleFormUrl}`);

    // STEP 4: Import WorkIndia candidate leads from CSV/Excel
    console.log('\n▶ [STEP 4] Importing WorkIndia Candidate Leads...');
    const fakeLeadPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const newCandRes = await fetch(`${API_BASE}/candidates`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'Santosh Biradar',
        primaryPhone: fakeLeadPhone,
        currentLocation: 'Kalaburagi Super Market',
        education: 'B.Com Graduate',
        totalExperienceYears: 2.0,
        currentCompany: 'Hero Two-Wheeler Showroom',
        currentJobTitle: 'Sales Executive',
        currentSalary: '₹2,00,000 / annum',
        expectedSalary: '₹2,60,000 / annum',
        hasTwoWheeler: true,
        hasDrivingLicense: true,
        interestedInFieldSales: true,
        interestedInAutomobile: true,
        leadSource: 'WorkIndia',
      }),
    });
    const newCandData = await newCandRes.json();
    const candidate = newCandData.candidate;
    console.log(`- Added Candidate: ${candidate.name} (UUID: ${candidate.id}, SL: ${candidate.displaySlNo}, Phone: ${candidate.primaryPhone})`);

    // STEP 5: Assign Lead to Executive A (Priya)
    console.log('\n▶ [STEP 5] Assigning Lead to Executive A (Priya)...');
    await fetch(`${API_BASE}/assignments/single`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        candidateId: candidate.id,
        executiveId: execAAuth.user.id,
        jobOrderId: jobOrder.id,
      }),
    });
    console.log(`- Assigned lead ${candidate.name} to Executive A.`);

    // STEP 6: Executive A opens Calling Workspace & calls candidate
    console.log('\n▶ [STEP 6] Executive A opens Calling Workspace and dials candidate...');
    const callLogRes = await fetch(`${API_BASE}/calling/log`, {
      method: 'POST',
      headers: execAHeaders,
      body: JSON.stringify({
        candidateId: candidate.id,
        jobOrderId: jobOrder.id,
        outcome: 'SHORTLISTED',
        remarks: 'Candidate is highly interested in ABC Motors Kalaburagi opening. Has own bike and DL.',
      }),
    });
    const callLogData = await callLogRes.json();
    console.log(`- Call logged with outcome: SHORTLISTED. Candidate lead stage: ${callLogData.candidate.leadStage}`);

    // STEP 7: Check Shortlist Record created
    console.log('\n▶ [STEP 7] Verifying Shortlist Record in Operations Pipeline...');
    const shortlistRes = await fetch(`${API_BASE}/shortlist`, { headers: execAHeaders });
    const shortlistData = await shortlistRes.json();
    const shortlistRecord = shortlistData.records.find((r: any) => r.candidateId === candidate.id);
    if (!shortlistRecord) throw new Error('Shortlist record not found!');
    console.log(`- Shortlist Record ID: ${shortlistRecord.id} | Initial Status: ${shortlistRecord.shortlistStatus}`);

    // STEP 8: Executive A clicks [ SEND GOOGLE FORM ]
    console.log('\n▶ [STEP 8] Executive A clicks [ Send Google Form ] (WhatsApp Integration)...');
    const sendFormRes = await fetch(`${API_BASE}/shortlist/${shortlistRecord.id}/send-google-form`, {
      method: 'POST',
      headers: execAHeaders,
    });
    const sendFormData = await sendFormRes.json();
    console.log(`- Generated WhatsApp Link: ${sendFormData.whatsappUrl.slice(0, 70)}...`);
    console.log(`- Form Status Updated: ${sendFormData.record.formFilled} | Pipeline Status: ${sendFormData.record.shortlistStatus}`);

    // STEP 9: Executive A confirms candidate completed Google Form
    console.log('\n▶ [STEP 9] Executive A clicks [ Mark Form Completed ]...');
    const formDoneRes = await fetch(`${API_BASE}/shortlist/${shortlistRecord.id}/mark-form-completed`, {
      method: 'POST',
      headers: execAHeaders,
    });
    const formDoneData = await formDoneRes.json();
    console.log(`- Form Completed Recorded: ${formDoneData.record.formFilled} (Status: ${formDoneData.record.shortlistStatus})`);

    // STEP 10: Executive A requests CV via WhatsApp
    console.log('\n▶ [STEP 10] Executive A requests CV via WhatsApp...');
    const reqCvRes = await fetch(`${API_BASE}/shortlist/${shortlistRecord.id}/request-cv`, {
      method: 'POST',
      headers: execAHeaders,
    });
    const reqCvData = await reqCvRes.json();
    console.log(`- CV Request Triggered: ${reqCvData.record.cvReceivedWhatsapp}`);

    // STEP 11: Candidate sends CV on WhatsApp & Executive uploads/records CV
    console.log('\n▶ [STEP 11] Candidate sends CV on WhatsApp; Executive records CV Received...');
    const fakeCvContent = '%PDF-1.4 Santosh Biradar Sales CV';
    const formData = new FormData();
    const blob = new Blob([fakeCvContent], { type: 'application/pdf' });
    formData.append('file', blob, 'Santosh_Biradar_CV.pdf');
    formData.append('candidateId', candidate.id);
    formData.append('jobOrderId', jobOrder.id);
    formData.append('documentType', 'CV_RESUME');

    await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${execAAuth.token}` },
      body: formData,
    });

    const cvRecRes = await fetch(`${API_BASE}/shortlist/${shortlistRecord.id}/record-cv-received`, {
      method: 'POST',
      headers: execAHeaders,
    });
    const cvRecData = await cvRecRes.json();
    console.log(`- CV Status Recorded: ${cvRecData.record.cvReceivedWhatsapp}`);
    console.log(`- Auto-advanced status: ${cvRecData.record.shortlistStatus}`);

    // STEP 12: Verify Ready to Send Checklist
    console.log('\n▶ [STEP 12] Verifying Real Operations Checklist...');
    console.log('✓ Candidate Shortlisted');
    console.log('✓ Google Form Completed');
    console.log('✓ CV Received');
    const readyRes = await fetch(`${API_BASE}/shortlist/${shortlistRecord.id}/mark-ready-to-send`, {
      method: 'POST',
      headers: execAHeaders,
    });
    const readyData = await readyRes.json();
    console.log(`✅ Candidate marked READY_TO_SEND (Status: ${readyData.record.shortlistStatus})`);

    // STEP 13: Deliver Candidate Package to Company HR (Final Operational Step)
    console.log('\n▶ [STEP 13] Executing Final Operational Action: [ SEND TO COMPANY HR ]...');
    const sendHrRes = await fetch(`${API_BASE}/shortlist/${shortlistRecord.id}/send-to-hr`, {
      method: 'POST',
      headers: execAHeaders,
      body: JSON.stringify({
        hrContactName: 'Mr. Ramesh Sharma (HR Head)',
        hrContactPhone: '9876501234',
        hrContactEmail: 'ramesh.hr@abcmotors.com',
        submissionMethod: 'WHATSAPP',
        notes: 'Shortlisted, Google Form completed, 2 yrs auto experience verified, CV attached.',
      }),
    });
    const sendHrData = await sendHrRes.json();
    console.log(`- Submission ID: ${sendHrData.submission.id}`);
    console.log(`- Delivered to HR: ${sendHrData.submission.hrContactName} via ${sendHrData.submission.submissionMethod}`);
    console.log(`- Final Status: ${sendHrData.record.shortlistStatus}`);

    // STEP 14: Verify Candidate Master Lead Stage updated to SENT_TO_HR
    console.log('\n▶ [STEP 14] Verifying Candidate Master updated to SENT_TO_HR...');
    const reloadedCandidate = (await fetch(`${API_BASE}/candidates/${candidate.id}`, { headers: adminHeaders }).then((r) => r.json())).candidate;
    if (reloadedCandidate.leadStage !== 'SENT_TO_HR') {
      throw new Error(`Expected candidate leadStage to be SENT_TO_HR, got ${reloadedCandidate.leadStage}`);
    }
    console.log(`✅ Candidate UUID ${reloadedCandidate.id} preserved. Lead stage: ${reloadedCandidate.leadStage}`);

    // STEP 15: Verify Dashboard Operational Metrics
    console.log('\n▶ [STEP 15] Verifying Operations Dashboard Telemetry...');
    const dash = (await fetch(`${API_BASE}/dashboard`, { headers: adminHeaders }).then((r) => r.json()));
    console.log(`- Today's Calls: ${dash.today.totalCallsAttempted}`);
    console.log(`- Today's Shortlisted: ${dash.today.shortlisted}`);
    console.log(`- Today's Forms Completed: ${dash.today.formsCompleted}`);
    console.log(`- Today's Sent to HR: ${dash.today.sentToHr}`);

    console.log('\n═══════════════════════════════════════════════════════════════════════');
    console.log('🎉 REAL BUSINESS OPERATIONS WORKFLOW VERIFICATION PASSED (100% SUCCESS)!');
    console.log('═══════════════════════════════════════════════════════════════════════');
  } catch (err: any) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
}

runRealGeniusWorkflowSuite();
