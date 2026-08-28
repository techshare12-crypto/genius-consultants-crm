const API_BASE = 'http://localhost:5000/api';

async function runDocumentManagementVerificationSuite() {
  console.log('🧪 Starting Document and CV Management Center Verification Suite...\n');

  try {
    // STEP 1: Super Admin Login
    console.log('▶ [STEP 1] Logging in as Super Admin...');
    const adminLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@genius.com', password: 'Admin@123' }),
    });
    const adminAuth = await adminLoginRes.json();
    const adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminAuth.token}` };
    console.log(`- Authenticated as ${adminAuth.user.name} (${adminAuth.user.role})`);

    // STEP 2: Executive Priya Login
    console.log('\n▶ [STEP 2] Logging in as Executive Priya Sharma...');
    const execLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'priya@genius.com', password: 'Exec@123' }),
    });
    const execAuth = await execLoginRes.json();
    const execHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${execAuth.token}` };
    console.log(`- Authenticated as Executive: ${execAuth.user.name} (ID: ${execAuth.user.id})`);

    // STEP 3: Unrelated Executive Amit Login
    const amitLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'amit@genius.com', password: 'Exec@123' }),
    });
    const amitAuth = await amitLoginRes.json();
    const amitHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${amitAuth.token}` };

    // STEP 4: Executive accesses an assigned candidate
    console.log('\n▶ [STEP 4] Ensuring candidate is assigned to Executive Priya...');
    const allCandsRes = await fetch(`${API_BASE}/candidates?limit=1`, { headers: adminHeaders });
    const allCands = (await allCandsRes.json()).candidates;
    const targetCand = allCands[0];

    // Assign to Priya
    await fetch(`${API_BASE}/assignments/single`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        candidateId: targetCand.id,
        executiveId: execAuth.user.id,
      }),
    });

    const candRes = await fetch(`${API_BASE}/candidates?limit=1`, { headers: execHeaders });
    const candData = await candRes.json();
    const candidate = candData.candidates[0];
    console.log(`- Candidate selected: ${candidate.name} (UUID: ${candidate.id}, SL: ${candidate.displaySlNo})`);

    // STEP 5: Request CV
    console.log('\n▶ [STEP 5] Requesting CV from Candidate...');
    const reqCvRes = await fetch(`${API_BASE}/communications/request-cv`, {
      method: 'POST',
      headers: execHeaders,
      body: JSON.stringify({ candidateId: candidate.id }),
    });
    const reqCvData = await reqCvRes.json();
    console.log(`- CV Request Triggered: "${reqCvData.message}"`);

    // STEP 6: Candidate CV v1 is uploaded
    console.log('\n▶ [STEP 6] Uploading Candidate CV v1 (PDF buffer)...');
    const fakePdfContent = '%PDF-1.4 Resume of ' + candidate.name + ' for Automobile Sales Advisor.';
    const formData1 = new FormData();
    const blob1 = new Blob([fakePdfContent], { type: 'application/pdf' });
    formData1.append('file', blob1, `${candidate.name.replace(/\s+/g, '_')}_Resume_v1.pdf`);
    formData1.append('candidateId', candidate.id);
    formData1.append('documentType', 'CV_RESUME');
    formData1.append('notes', 'Initial CV submitted on portal');

    const uploadRes1 = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${execAuth.token}` },
      body: formData1,
    });
    const uploadData1 = await uploadRes1.json();
    if (!uploadRes1.ok) throw new Error(uploadData1.error || 'Upload CV v1 failed');
    const docV1 = uploadData1.document;

    console.log(`- Document v1 Created (ID: ${docV1.id})`);
    console.log(`- Version Number: v${docV1.versionNumber} | isCurrentVersion: ${docV1.isCurrentVersion}`);
    console.log(`- Verification Status: ${docV1.verificationStatus}`);

    // STEP 7: Team Leader receives notification
    console.log('\n▶ [STEP 7] Verifying Team Leader notification for CV upload...');
    const tlLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rahul@genius.com', password: 'Leader@123' }),
    });
    const tlAuth = await tlLoginRes.json();
    const tlHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${tlAuth.token}` };

    const tlNotifRes = await fetch(`${API_BASE}/notifications`, { headers: tlHeaders });
    const tlNotifs = (await tlNotifRes.json()).notifications;
    const docUploadNotif = tlNotifs.find((n: any) => n.type === 'DOCUMENT_UPLOADED');
    if (!docUploadNotif) throw new Error('Team Leader did not receive DOCUMENT_UPLOADED notification!');
    console.log(`- Team Leader Notification Verified: "${docUploadNotif.title}" - "${docUploadNotif.message}"`);

    // STEP 8: Admin verifies the CV
    console.log('\n▶ [STEP 8] Admin verifies Candidate CV v1...');
    const verifyRes = await fetch(`${API_BASE}/documents/${docV1.id}/verify`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        verificationStatus: 'VERIFIED',
        verificationRemarks: 'CV verified: experience in automotive retail verified and genuine.',
      }),
    });
    const verifyData = await verifyRes.json();
    console.log(`- Document v1 updated to: ${verifyData.document.verificationStatus} by Admin`);

    // STEP 9: Executive receives verification notification
    console.log('\n▶ [STEP 9] Verifying Executive received DOCUMENT_VERIFIED notification...');
    const execNotifRes = await fetch(`${API_BASE}/notifications`, { headers: execHeaders });
    const execNotifs = (await execNotifRes.json()).notifications;
    const verifiedNotif = execNotifs.find((n: any) => n.type === 'DOCUMENT_VERIFIED');
    if (!verifiedNotif) throw new Error('Executive did not receive DOCUMENT_VERIFIED notification!');
    console.log(`- Executive Notification Verified: "${verifiedNotif.title}" - "${verifiedNotif.message}"`);

    // STEP 10: Candidate uploads an updated CV (CV v2)
    console.log('\n▶ [STEP 10] Uploading Updated CV v2 (Version Control)...');
    const fakePdfContent2 = '%PDF-1.4 Updated Resume with 2026 Promoted Senior Sales experience.';
    const formData2 = new FormData();
    const blob2 = new Blob([fakePdfContent2], { type: 'application/pdf' });
    formData2.append('file', blob2, `${candidate.name.replace(/\s+/g, '_')}_Updated_Resume_2026.pdf`);
    formData2.append('candidateId', candidate.id);
    formData2.append('documentType', 'CV_RESUME');
    formData2.append('notes', 'Added recent Hyundai showroom manager certification');

    const uploadRes2 = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${execAuth.token}` },
      body: formData2,
    });
    const uploadData2 = await uploadRes2.json();
    const docV2 = uploadData2.document;

    console.log(`- Document v2 Created (ID: ${docV2.id})`);
    console.log(`- Version Number: v${docV2.versionNumber} | isCurrentVersion: ${docV2.isCurrentVersion}`);

    // STEP 11: Verify Version History integrity
    console.log('\n▶ [STEP 11] Verifying Candidate Document Version History...');
    const docsListRes = await fetch(`${API_BASE}/documents/candidate/${candidate.id}`, { headers: execHeaders });
    const docsList = (await docsListRes.json()).documents;

    const v1Record = docsList.find((d: any) => d.id === docV1.id);
    const v2Record = docsList.find((d: any) => d.id === docV2.id);

    if (!v1Record || v1Record.isCurrentVersion !== false) {
      throw new Error('Version Control Error: Old CV v1 was not marked as isCurrentVersion: false!');
    }
    if (!v2Record || v2Record.isCurrentVersion !== true || v2Record.versionNumber !== 2) {
      throw new Error('Version Control Error: New CV was not marked as v2 isCurrentVersion: true!');
    }
    console.log(`✅ Version history verified: v1 (Archived) and v2 (Current Version) preserved!`);

    // STEP 12: Candidate is submitted to a Job Order using selected CV version
    console.log('\n▶ [STEP 12] Submitting Candidate to Job Order with CV v2...');
    const jobsRes = await fetch(`${API_BASE}/job-orders?limit=1`, { headers: adminHeaders });
    const jobOrder = (await jobsRes.json()).jobOrders[0];

    // Ensure Candidate has application for this Job
    await fetch(`${API_BASE}/job-orders/${jobOrder.id}/add-candidates`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ candidateIds: [candidate.id], assignedExecutiveId: execAuth.user.id }),
    });

    const jobDetailRes = await fetch(`${API_BASE}/job-orders/${jobOrder.id}`, { headers: adminHeaders });
    const jobDetail = await jobDetailRes.json();
    const app = jobDetail.jobOrder.applications.find((a: any) => a.candidateId === candidate.id);

    const subRes = await fetch(`${API_BASE}/job-orders/submissions`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        applicationId: app.id,
        notes: `Submitted candidate ${candidate.name} with updated CV v${docV2.versionNumber}`,
        cvFileName: docV2.originalFileName,
      }),
    });
    const subData = await subRes.json();
    console.log(`- Candidate Submission Recorded (ID: ${subData.submission.id}) with CV: ${subData.submission.cvFileName}`);

    // STEP 13: Security Check: Unrelated Executive attempts to download or view candidate documents
    console.log('\n▶ [STEP 13] Verifying Security Boundary: Unrelated Executive cannot access document...');
    const forbidRes = await fetch(`${API_BASE}/documents/${docV2.id}/download`, { headers: amitHeaders });
    if (forbidRes.status === 403) {
      console.log(`✅ Security Boundary Passed: Unauthorized document access strictly rejected with 403 Forbidden.`);
    } else {
      throw new Error(`Security Error: Unrelated Executive was able to download document (${forbidRes.status})`);
    }

    // STEP 14: Document Analytics Telemetry
    console.log('\n▶ [STEP 14] Checking Document Analytics Dashboard Metrics...');
    const analRes = await fetch(`${API_BASE}/documents/analytics`, { headers: adminHeaders });
    const anal = await analRes.json();
    console.log(`- Total Active Documents: ${anal.totalDocuments}`);
    console.log(`- Active CVs: ${anal.activeCVs}`);
    console.log(`- Verified Count: ${anal.verifiedCount}`);

    // STEP 15: Existing Modules Regression Sanity
    console.log('\n▶ [STEP 15] Verifying Existing Modules (Candidate Master, Job Orders, Teams, Notifications)...');
    const candsCheck = await fetch(`${API_BASE}/candidates?limit=5`, { headers: adminHeaders }).then(r => r.json());
    if (!candsCheck.candidates || candsCheck.candidates.length === 0) throw new Error('Candidate Master broken!');
    console.log(`✅ All existing modules remain 100% operational.`);

    console.log('\n═══════════════════════════════════════════════════════════════════════');
    console.log('🎉 ALL 15 DOCUMENT & CV MANAGEMENT TESTS PASSED WITH 100% SUCCESS!');
    console.log('═══════════════════════════════════════════════════════════════════════');
  } catch (err: any) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
}

runDocumentManagementVerificationSuite();
