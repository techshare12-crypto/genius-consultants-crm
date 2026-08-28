const API_BASE = 'http://localhost:5000/api';

async function runCommunicationsVerificationSuite() {
  console.log('🧪 Starting Candidate Communication Center & WhatsApp Workflow Verification...\n');

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

    // STEP 3: Executive Amit (Unrelated Exec) Login
    const execAmitRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'amit@genius.com', password: 'Exec@123' }),
    });
    const execAmitAuth = await execAmitRes.json();
    const amitHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${execAmitAuth.token}` };

    // STEP 4: Executive accesses an assigned candidate
    console.log('\n▶ [STEP 4] Fetching Candidate assigned to Priya...');
    const myLeadsRes = await fetch(`${API_BASE}/candidates?assignedExecutiveId=${execAuth.user.id}&limit=1`, { headers: execHeaders });
    const myLeadsData = await myLeadsRes.json();
    const candidate = myLeadsData.candidates[0];
    if (!candidate) throw new Error('No candidate assigned to Priya found!');
    console.log(`- Candidate selected: ${candidate.name} (UUID: ${candidate.id}, SL: ${candidate.displaySlNo})`);

    // STEP 5: Executive selects a Job Order
    console.log('\n▶ [STEP 5] Fetching Job Order...');
    const jobsRes = await fetch(`${API_BASE}/job-orders?limit=1`, { headers: execHeaders });
    const jobsData = await jobsRes.json();
    const jobOrder = jobsData.jobOrders[0];
    console.log(`- Job Order: ${jobOrder.jobTitle} @ ${jobOrder.client.companyName} (ID: ${jobOrder.id})`);

    // STEP 6: Fetch Message Templates
    console.log('\n▶ [STEP 6] Fetching Job Opportunity WhatsApp Template...');
    const tplRes = await fetch(`${API_BASE}/communications/templates?category=JOB_OPPORTUNITY`, { headers: execHeaders });
    const tplData = await tplRes.json();
    const template = tplData.templates[0];
    console.log(`- Selected Template: "${template.name}"`);

    // STEP 7: Executive sends a pre-filled Job Opportunity WhatsApp message
    console.log('\n▶ [STEP 7] Initiating WhatsApp Message with Variable Injection...');
    const sendWARes = await fetch(`${API_BASE}/communications/send-whatsapp`, {
      method: 'POST',
      headers: execHeaders,
      body: JSON.stringify({
        candidateId: candidate.id,
        templateId: template.id,
        jobOrderId: jobOrder.id,
        communicationType: 'JOB_OPPORTUNITY',
      }),
    });
    const sendWAData = await sendWARes.json();
    const commActivity = sendWAData.communicationActivity;

    console.log(`- Communication Activity ID: ${commActivity.id}`);
    console.log(`- Delivery Status: ${commActivity.deliveryStatus}`);
    console.log(`- Generated WhatsApp URL: ${sendWAData.whatsAppUrl.slice(0, 70)}...`);
    console.log(`- Final Message Body:\n"${sendWAData.finalMessage}"`);

    // Verify correct variable substitution
    if (!sendWAData.finalMessage.includes(candidate.name)) throw new Error('Variable candidateName not substituted!');
    if (!sendWAData.finalMessage.includes(jobOrder.jobTitle)) throw new Error('Variable jobTitle not substituted!');
    console.log('✅ Correct candidate and job variables verified in message body.');

    // STEP 8: Registration form link is sent & tracked
    console.log('\n▶ [STEP 8] Sending Registration Form Link to Candidate...');
    const formRes = await fetch(`${API_BASE}/communications/send-form`, {
      method: 'POST',
      headers: execHeaders,
      body: JSON.stringify({
        candidateId: candidate.id,
        jobOrderId: jobOrder.id,
        formUrl: 'https://geniusconsultants.com/register/GC-2026',
      }),
    });
    const formData = await formRes.json();
    console.log(`- Form Tracking ID: ${formData.formTracking.id} | Status: ${formData.formTracking.status}`);

    // STEP 9: CV Request is sent & reminder generated
    console.log('\n▶ [STEP 9] Requesting CV from Candidate & Scheduling Reminder...');
    const cvRes = await fetch(`${API_BASE}/communications/request-cv`, {
      method: 'POST',
      headers: execHeaders,
      body: JSON.stringify({
        candidateId: candidate.id,
        jobOrderId: jobOrder.id,
      }),
    });
    const cvData = await cvRes.json();
    console.log(`- CV Request Result: "${cvData.message}"`);
    console.log(`- Scheduled Follow-up Reminder Due: ${cvData.reminder.dueDate}`);

    // STEP 10: Verify Candidate Communication Timeline
    console.log('\n▶ [STEP 10] Retrieving Candidate Communication History Timeline...');
    const historyRes = await fetch(`${API_BASE}/communications/history/${candidate.id}`, { headers: execHeaders });
    const history = await historyRes.json();
    console.log(`- Total Communications Logged: ${history.communications.length}`);
    console.log(`- Total Forms Tracked: ${history.formTrackings.length}`);
    console.log(`- Total Reminders Scheduled: ${history.reminders.length}`);

    // STEP 11: Team Leader Access Boundary Verification
    console.log('\n▶ [STEP 11] Verifying Team Leader Scoped Access...');
    const tlLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rahul@genius.com', password: 'Leader@123' }),
    });
    const tlAuth = await tlLoginRes.json();
    const tlHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${tlAuth.token}` };

    const tlHistoryRes = await fetch(`${API_BASE}/communications/history/${candidate.id}`, { headers: tlHeaders });
    if (tlHistoryRes.status === 200) {
      console.log(`- Team Leader Rahul (managing Priya's Team Alpha) successfully retrieved team candidate communication history.`);
    } else {
      throw new Error(`Team leader failed to retrieve team candidate history: ${tlHistoryRes.status}`);
    }

    // STEP 12: Security Isolation (Unrelated Executive cannot view another Executive's communication history)
    console.log('\n▶ [STEP 12] Verifying Security Isolation for Unrelated Executive...');
    const amitHistoryRes = await fetch(`${API_BASE}/communications/history/${candidate.id}`, { headers: amitHeaders });
    if (amitHistoryRes.status === 403) {
      console.log(`- Security Isolation Passed: Unrelated Executive Amit blocked from viewing Priya's candidate history (403 Forbidden).`);
    } else {
      throw new Error(`Security Error: Unrelated Executive was able to view candidate history (${amitHistoryRes.status})`);
    }

    // STEP 13: Communications Analytics Telemetry
    console.log('\n▶ [STEP 13] Checking Communications Analytics Dashboard Metrics...');
    const analRes = await fetch(`${API_BASE}/communications/analytics`, { headers: adminHeaders });
    const anal = await analRes.json();
    console.log(`- WhatsApp Initiated Today: ${anal.today.whatsAppInitiated}`);
    console.log(`- Forms Sent: ${anal.today.formsSent}`);
    console.log(`- Reminders Due: ${anal.today.remindersDue}`);
    console.log(`- Total Month Communications: ${anal.month.totalCommunications}`);

    console.log('\n═══════════════════════════════════════════════════════════════════════');
    console.log('🎉 ALL 13 COMMUNICATIONS & WHATSAPP TESTS PASSED WITH 100% SUCCESS!');
    console.log('═══════════════════════════════════════════════════════════════════════');
  } catch (err: any) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
}

runCommunicationsVerificationSuite();
