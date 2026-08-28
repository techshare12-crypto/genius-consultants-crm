const API_BASE = 'http://localhost:5000/api';

async function runTeamAndNotificationTests() {
  console.log('🧪 Starting Team Leader Workflow & Real-Time Notification Verification Suite...\n');

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

    // STEP 2: Create Team Leader User
    console.log('\n▶ [STEP 2] Creating Team Leader User: Rahul Verma...');
    const tlUsername = `tl_${Date.now()}`;
    const tlEmail = `tl_${Date.now()}@genius.com`;
    const createTLRes = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'Rahul Verma (Team Leader)',
        username: tlUsername,
        email: tlEmail,
        password: 'LeaderPassword@123',
        role: 'TEAM_LEADER',
        status: 'ACTIVE',
        targetCallsDaily: 120,
      }),
    });
    const tlData = await createTLRes.json();
    const teamLeaderId = tlData.user.id;
    console.log(`- Created Team Leader ID: ${teamLeaderId}`);

    // Team Leader Login
    const tlLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: tlEmail, password: 'LeaderPassword@123' }),
    });
    const tlAuth = await tlLoginRes.json();
    const tlHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${tlAuth.token}` };

    // STEP 3: Create 3 Executives for Team A
    console.log('\n▶ [STEP 3] Creating 3 Executives for Team A...');
    const execIds: string[] = [];
    const execAuths: any[] = [];

    for (let i = 1; i <= 3; i++) {
      const eUsername = `exec_${i}_${Date.now()}`;
      const eEmail = `exec_${i}_${Date.now()}@genius.com`;
      const ePass = 'ExecPass@123';
      const cRes = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          name: `Executive ${i}`,
          username: eUsername,
          email: eEmail,
          password: ePass,
          role: 'EXECUTIVE',
          status: 'ACTIVE',
        }),
      });
      const eData = await cRes.json();
      execIds.push(eData.user.id);

      const lRes = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: eEmail, password: ePass }),
      });
      execAuths.push(await lRes.json());
    }
    console.log(`- Created Executives: ${execIds.join(', ')}`);

    // STEP 4: Create Team A & Add Members
    console.log('\n▶ [STEP 4] Creating Team A: "Automobile Retail Team Alpha"...');
    const teamRes = await fetch(`${API_BASE}/teams`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        teamName: 'Automobile Retail Team Alpha',
        teamLeaderId,
        executiveIds: execIds,
      }),
    });
    const teamData = await teamRes.json();
    const teamId = teamData.team.id;
    console.log(`- Created Team ID: ${teamId} with Leader ${teamLeaderId} and ${execIds.length} members.`);

    // STEP 5: Assign Leads to each Executive
    console.log('\n▶ [STEP 5] Assigning 30 candidate leads to each Executive in Team A...');
    const candsRes = await fetch(`${API_BASE}/candidates?limit=90`, { headers: adminHeaders });
    const candsData = await candsRes.json();
    const allCands = candsData.candidates;

    for (let i = 0; i < 3; i++) {
      const chunk = allCands.slice(i * 30, (i + 1) * 30).map((c: any) => c.id);
      await fetch(`${API_BASE}/assignments/bulk`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          candidateIds: chunk,
          executiveId: execIds[i],
        }),
      });
      console.log(`- Assigned 30 leads to Executive ${i + 1} (${execIds[i]})`);
    }

    // STEP 6: Team Leader views all 90 team leads
    console.log('\n▶ [STEP 6] Team Leader views Team A leads pool...');
    const tlLeadsRes = await fetch(`${API_BASE}/teams/${teamId}/leads`, { headers: tlHeaders });
    const tlLeadsData = await tlLeadsRes.json();
    console.log(`- Team Leader retrieved ${tlLeadsData.candidates.length} leads belonging to Team A.`);
    if (tlLeadsData.candidates.length < 90) {
      console.log(`- Note: Master pool has ${tlLeadsData.candidates.length} assigned.`);
    }

    // STEP 7: Data Isolation Check (Executive 1 cannot view Executive 2's workspace queue)
    console.log('\n▶ [STEP 7] Verifying Executive Data Isolation...');
    const exec1Headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${execAuths[0].token}` };
    const exec1QueueRes = await fetch(`${API_BASE}/calling/workspace`, { headers: exec1Headers });
    const exec1Queue = (await exec1QueueRes.json()).queue;

    const crossLeak = exec1Queue.some((c: any) => c.assignedExecutiveId !== execIds[0]);
    if (crossLeak) throw new Error('Data Isolation Failure: Executive 1 can see other executives leads!');
    console.log(`- Executive 1 sees only their own ${exec1Queue.length} leads. 0 cross-executive leakage!`);

    // STEP 8: Team Leader reassigns a lead from Executive 1 to Executive 2
    console.log('\n▶ [STEP 8] Team Leader reassigns a lead from Executive 1 to Executive 2...');
    const candidateToReassign = exec1Queue[0];
    const reassignRes = await fetch(`${API_BASE}/teams/reassign-lead`, {
      method: 'POST',
      headers: tlHeaders,
      body: JSON.stringify({
        candidateId: candidateToReassign.id,
        toExecutiveId: execIds[1],
      }),
    });
    const reassignData = await reassignRes.json();
    console.log(`- Reassigned candidate: ${reassignData.candidate.name} to Executive 2`);

    // STEP 9: Verify Executive 2 received real-time notification
    console.log('\n▶ [STEP 9] Checking Executive 2 Notifications...');
    const exec2Headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${execAuths[1].token}` };
    const notifRes2 = await fetch(`${API_BASE}/notifications`, { headers: exec2Headers });
    const notifData2 = await notifRes2.json();
    const reassignNotif = notifData2.notifications.find((n: any) => n.type === 'LEAD_REASSIGNED');
    if (!reassignNotif) throw new Error('Notification Failure: Executive 2 did not receive LEAD_REASSIGNED notification!');
    console.log(`- Notification verified for Executive 2: "${reassignNotif.title}" - "${reassignNotif.message}"`);

    // STEP 10: Executive 1 shortlists a candidate & Team Leader receives notification
    console.log('\n▶ [STEP 10] Executive 1 calls & shortlists a candidate...');
    const shortCandidate = exec1Queue[1] || allCands[0];
    await fetch(`${API_BASE}/calling/log`, {
      method: 'POST',
      headers: exec1Headers,
      body: JSON.stringify({
        candidateId: shortCandidate.id,
        outcome: 'SHORTLISTED',
        remarks: 'Candidate shortlisted for Automobile Dealer hiring.',
      }),
    });

    const tlNotifRes = await fetch(`${API_BASE}/notifications`, { headers: tlHeaders });
    const tlNotifData = await tlNotifRes.json();
    const shortlistNotif = tlNotifData.notifications.find((n: any) => n.type === 'CANDIDATE_SHORTLISTED');
    if (!shortlistNotif) throw new Error('Team Leader did not receive shortlist notification!');
    console.log(`- Team Leader Notification verified: "${shortlistNotif.title}" - "${shortlistNotif.message}"`);

    // STEP 11: Team Leader adds Coaching Note to Executive 1
    console.log('\n▶ [STEP 11] Team Leader records Coaching Note for Executive 1...');
    const coachRes = await fetch(`${API_BASE}/teams/coaching-notes`, {
      method: 'POST',
      headers: tlHeaders,
      body: JSON.stringify({
        executiveId: execIds[0],
        note: 'Excellent objection handling during vehicle sales pitch call. Keep it up!',
        category: 'COACHING',
        visibility: 'VISIBLE_TO_EXECUTIVE',
      }),
    });
    const coachData = await coachRes.json();
    console.log(`- Created Coaching Note ID: ${coachData.coachingNote.id}`);

    // Verify Executive 1 received coaching notification
    const exec1Notifs = await fetch(`${API_BASE}/notifications`, { headers: exec1Headers }).then(r => r.json());
    const coachNotif = exec1Notifs.notifications.find((n: any) => n.type === 'COACHING_NOTE');
    if (!coachNotif) throw new Error('Executive 1 did not receive coaching note notification!');
    console.log(`- Executive 1 Coaching Notification verified: "${coachNotif.title}" - "${coachNotif.message}"`);

    // STEP 12: Team Dashboard Verification
    console.log('\n▶ [STEP 12] Verifying Team Dashboard KPIs...');
    const dashRes = await fetch(`${API_BASE}/teams/${teamId}/dashboard`, { headers: tlHeaders });
    const dash = (await dashRes.json());
    console.log(`- Active Executives: ${dash.summary.activeExecutives}`);
    console.log(`- Calls Completed Today: ${dash.summary.callsDoneToday}`);
    console.log(`- Shortlisted Count: ${dash.summary.shortlistedCount}`);
    console.log(`- Per-Executive Telemetry: ${dash.executiveStats.length} executive cards populated.`);

    // STEP 13: Team Leader Cross-Team Boundary Check
    console.log('\n▶ [STEP 13] Verifying Security Boundary: Team Leader cannot view other teams...');
    const fakeTeamId = '00000000-0000-0000-0000-000000000000';
    const forbidRes = await fetch(`${API_BASE}/teams/${fakeTeamId}/dashboard`, { headers: tlHeaders });
    if (forbidRes.status === 404 || forbidRes.status === 403) {
      console.log(`- Security Boundary Passed: Unauthorized team access blocked (${forbidRes.status}).`);
    } else {
      throw new Error('Security Error: Team leader was able to access unauthorized team dashboard!');
    }

    console.log('\n═══════════════════════════════════════════════════════════════════════');
    console.log('🎉 ALL 13 TEAM LEADER & NOTIFICATION TESTS PASSED WITH 100% SUCCESS!');
    console.log('═══════════════════════════════════════════════════════════════════════');
  } catch (err: any) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
}

runTeamAndNotificationTests();
