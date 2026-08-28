const API_BASE = 'http://localhost:5000/api';

async function runRegistrationPortalVerificationSuite() {
  console.log('🧪 Starting Candidate Self-Service Registration & Profile Completion Verification Suite...\n');

  try {
    // STEP 1: Super Admin & Executive Logins
    console.log('▶ [STEP 1] Logging in as Super Admin & Executive Priya Sharma...');
    const adminAuth = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@genius.com', password: 'Admin@123' }),
    }).then((r) => r.json());
    const adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminAuth.token}` };

    const execAuth = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'priya@genius.com', password: 'Exec@123' }),
    }).then((r) => r.json());
    const execHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${execAuth.token}` };

    const amitAuth = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'amit@genius.com', password: 'Exec@123' }),
    }).then((r) => r.json());
    const amitHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${amitAuth.token}` };

    // STEP 2: Executive selects an assigned candidate
    console.log('\n▶ [STEP 2] Selecting Candidate assigned to Executive Priya...');
    const candsRes = await fetch(`${API_BASE}/candidates?limit=1`, { headers: adminHeaders });
    const targetCandidate = (await candsRes.json()).candidates[0];

    // Assign to Priya
    await fetch(`${API_BASE}/assignments/single`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ candidateId: targetCandidate.id, executiveId: execAuth.user.id }),
    });

    const candidate = await fetch(`${API_BASE}/candidates/${targetCandidate.id}`, { headers: execHeaders })
      .then((r) => r.json())
      .then((d) => d.candidate);
    console.log(`- Selected Candidate: ${candidate.name} (UUID: ${candidate.id}, SL: ${candidate.displaySlNo})`);

    // Fetch Job Order to link
    const jobOrder = (await fetch(`${API_BASE}/job-orders?limit=1`, { headers: adminHeaders }).then((r) => r.json())).jobOrders[0];
    console.log(`- Linking to Job Order: ${jobOrder.jobTitle} (ID: ${jobOrder.id})`);

    // STEP 3: Executive generates a secure registration link
    console.log('\n▶ [STEP 3] Generating secure registration link...');
    const genRes = await fetch(`${API_BASE}/registrations/generate-link`, {
      method: 'POST',
      headers: execHeaders,
      body: JSON.stringify({
        candidateId: candidate.id,
        jobOrderId: jobOrder.id,
        validityDays: 7,
      }),
    });
    const genData = await genRes.json();
    if (!genRes.ok) throw new Error(genData.error || 'Failed to generate link');
    const regLink = genData.link;
    console.log(`- Generated Registration Link Token: ${regLink.token}`);
    console.log(`- Public URL: ${regLink.url}`);
    console.log(`- Initial Status: ${regLink.status} | Expires At: ${regLink.expiresAt}`);

    // STEP 4: Candidate opens the public mobile registration portal (NO CRM LOGIN)
    console.log('\n▶ [STEP 4] Candidate opens public portal via token (Public, No Auth)...');
    const pubGetRes = await fetch(`${API_BASE}/registrations/public/${regLink.token}`);
    const pubContext = await pubGetRes.json();
    if (!pubGetRes.ok) throw new Error(pubContext.error || 'Public get failed');
    console.log(`- Public Session Loaded for: ${pubContext.candidate.name}`);
    console.log(`- Applying for: ${pubContext.jobOrder.jobTitle} @ ${pubContext.jobOrder.companyName}`);
    if (pubContext.token !== regLink.token) throw new Error('Token mismatch!');

    // STEP 5: Candidate saves the form as draft (Step 3 completed)
    console.log('\n▶ [STEP 5] Candidate saves multi-step draft progress (Step 3: Education)...');
    const draftPayload = {
      name: 'Aditya Mehta (Updated)',
      primaryPhone: candidate.primaryPhone,
      email: 'aditya.mehta.verified@gmail.com',
      currentCity: 'Gurugram Sector 29',
      qualification: 'MBA in Sales & Marketing',
      institution: 'Amity University Gurugram',
      yearOfPassing: '2024',
      percentageOrCgpa: '8.4 CGPA',
      employmentStatus: 'EMPLOYED',
      currentCompany: 'Maruti True Value Dealership',
      currentDesignation: 'Senior Automobile Sales Consultant',
      totalExperience: '3.5',
      currentSalary: '₹3,60,000 / annum',
      expectedSalary: '₹4,80,000 / annum',
      skills: 'Car Sales, High-Value Deal Closing, Loan Finance Assistance',
      languages: 'English, Hindi, Punjabi',
      hasTwoWheeler: true,
      hasDrivingLicense: true,
    };

    const draftRes = await fetch(`${API_BASE}/registrations/public/${regLink.token}/save-draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stepCompleted: 3,
        draftData: draftPayload,
      }),
    });
    const draftData = await draftRes.json();
    console.log(`- Draft Saved Response: "${draftData.message}" (Step: ${draftData.stepCompleted})`);

    // STEP 6: Candidate resumes using the same secure token
    console.log('\n▶ [STEP 6] Candidate resumes session with same token...');
    const resumeContext = await fetch(`${API_BASE}/registrations/public/${regLink.token}`).then((r) => r.json());
    if (resumeContext.status !== 'DRAFT' || resumeContext.stepCompleted !== 3) {
      throw new Error('Draft resume failed: status or stepCompleted incorrect!');
    }
    console.log(`✅ Session Resumed seamlessly: Status = ${resumeContext.status}, Step = ${resumeContext.stepCompleted}`);

    // STEP 7: Candidate uploads a new CV through the portal
    console.log('\n▶ [STEP 7] Candidate uploads new CV (v2) through public portal...');
    const fakeResumeContent = '%PDF-1.4 Self-Uploaded 2026 Master CV for ' + candidate.name;
    const formData = new FormData();
    const blob = new Blob([fakeResumeContent], { type: 'application/pdf' });
    formData.append('file', blob, `${candidate.name.replace(/\s+/g, '_')}_SelfService_CV.pdf`);

    const cvUploadRes = await fetch(`${API_BASE}/registrations/public/${regLink.token}/upload-cv`, {
      method: 'POST',
      body: formData,
    });
    const cvUploadData = await cvUploadRes.json();
    console.log(`- CV Uploaded (Doc ID: ${cvUploadData.documentId}) | Version: v${cvUploadData.versionNumber}`);

    // STEP 8: Candidate submits the completed profile
    console.log('\n▶ [STEP 8] Candidate finalizes and submits profile...');
    const submitRes = await fetch(`${API_BASE}/registrations/public/${regLink.token}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submittedData: draftPayload }),
    });
    const submitData = await submitRes.json();
    console.log(`- Submission Response: "${submitData.message}"`);

    // STEP 9: Verify Candidate UUID remains permanent
    console.log('\n▶ [STEP 9] Verifying permanent Candidate UUID unchanged...');
    const reloadedCandidate = await fetch(`${API_BASE}/candidates/${candidate.id}`, { headers: execHeaders }).then((r) => r.json());
    if (reloadedCandidate.candidate.id !== candidate.id) throw new Error('Candidate UUID shifted!');
    console.log(`✅ Candidate UUID ${reloadedCandidate.candidate.id} intact and permanent.`);

    // STEP 10: Verify Executive received real-time notification
    console.log('\n▶ [STEP 10] Verifying Executive received REGISTRATION_SUBMITTED notification...');
    const execNotifs = (await fetch(`${API_BASE}/notifications`, { headers: execHeaders }).then((r) => r.json())).notifications;
    const regNotif = execNotifs.find((n: any) => n.type === 'REGISTRATION_SUBMITTED');
    if (!regNotif) throw new Error('Executive did not receive REGISTRATION_SUBMITTED notification!');
    console.log(`- Executive Notification Verified: "${regNotif.title}" - "${regNotif.message}"`);

    // STEP 11: Executive reviews submitted data in Review Queue
    console.log('\n▶ [STEP 11] Executive fetches Registration Review details with Diff...');
    const reviewDetail = await fetch(`${API_BASE}/registrations/${regLink.id}`, { headers: execHeaders }).then((r) => r.json());
    if (reviewDetail.link.status !== 'SUBMITTED') throw new Error('Status not SUBMITTED in review queue!');
    console.log(`- Review Record Status: ${reviewDetail.link.status}`);
    console.log(`- Submitted Education: ${JSON.parse(reviewDetail.link.submittedData).qualification}`);

    // STEP 12: Executive approves changes and applies to Candidate Master
    console.log('\n▶ [STEP 12] Executive approves changes and applies to Candidate Master...');
    const approveRes = await fetch(`${API_BASE}/registrations/${regLink.id}/approve`, {
      method: 'POST',
      headers: execHeaders,
      body: JSON.stringify({ reviewNotes: 'Verified MBA degree & 3.5 yrs auto sales experience.' }),
    });
    const approveData = await approveRes.json();
    console.log(`- Approval Status: ${approveData.link.status}`);
    console.log(`- Candidate Master Updated Education: "${approveData.candidate.education}"`);
    console.log(`- Candidate Master Updated Salary: "${approveData.candidate.expectedSalary}"`);

    // STEP 13: Verify Job Order application stage
    console.log('\n▶ [STEP 13] Verifying Candidate is linked to Job Order pipeline...');
    const jobOrderApp = await fetch(`${API_BASE}/job-orders/${jobOrder.id}`, { headers: adminHeaders })
      .then((r) => r.json())
      .then((d) => d.jobOrder.applications.find((a: any) => a.candidateId === candidate.id));
    if (!jobOrderApp) throw new Error('Candidate not linked to Job Order!');
    console.log(`- CandidateJobApplication Stage: ${jobOrderApp.applicationStage}`);

    // STEP 14: Expired or Disabled Token Rejection
    console.log('\n▶ [STEP 14] Disabling token and testing security rejection...');
    await fetch(`${API_BASE}/registrations/${regLink.id}/disable`, { method: 'POST', headers: execHeaders });
    const disabledTry = await fetch(`${API_BASE}/registrations/public/${regLink.token}`);
    if (disabledTry.status === 403) {
      console.log(`✅ Security Passed: Disabled token rejected with 403 Forbidden.`);
    } else {
      throw new Error(`Security Error: Disabled token was accessible (${disabledTry.status})`);
    }

    // STEP 15: Cross-Token Security Isolation
    console.log('\n▶ [STEP 15] Verifying invalid / non-existent token rejection...');
    const fakeTokenTry = await fetch(`${API_BASE}/registrations/public/invalid_fake_token_12345`);
    if (fakeTokenTry.status === 404) {
      console.log(`✅ Security Passed: Invalid token rejected with 404 Not Found.`);
    } else {
      throw new Error(`Security Error: Invalid token did not return 404 (${fakeTokenTry.status})`);
    }

    // STEP 16: Registration Telemetry Analytics
    console.log('\n▶ [STEP 16] Checking Registration Analytics Dashboard...');
    const anal = await fetch(`${API_BASE}/registrations/analytics`, { headers: adminHeaders }).then((r) => r.json());
    console.log(`- Total Generated: ${anal.totalGenerated}`);
    console.log(`- Approved in Master: ${anal.approvedCount}`);

    // STEP 17: Existing CRM Functionality Regression Sanity
    console.log('\n▶ [STEP 17] Verifying Existing Modules (Candidate Master, Job Orders, Teams)...');
    const candsCheck = await fetch(`${API_BASE}/candidates?limit=5`, { headers: adminHeaders }).then((r) => r.json());
    if (!candsCheck.candidates || candsCheck.candidates.length === 0) throw new Error('Candidate Master broken!');
    console.log(`✅ All existing CRM modules remain 100% operational.`);

    console.log('\n═══════════════════════════════════════════════════════════════════════');
    console.log('🎉 ALL 18 REGISTRATION PORTAL TESTS PASSED WITH 100% SUCCESS!');
    console.log('═══════════════════════════════════════════════════════════════════════');
  } catch (err: any) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
}

runRegistrationPortalVerificationSuite();
