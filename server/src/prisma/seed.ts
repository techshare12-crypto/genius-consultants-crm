import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { updateDailySummary } from '../routes/calling';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed for Genius Consultants Telecalling Portal, Clients, Teams & Communication Center...');

  // 1. Clean existing tables in proper relational dependency order
  await prisma.communicationReminder.deleteMany();
  await prisma.candidateFormTracking.deleteMany();
  await prisma.communicationActivity.deleteMany();
  await prisma.messageTemplate.deleteMany();
  await prisma.coachingNote.deleteMany();
  await prisma.teamMembership.deleteMany();
  await prisma.team.deleteMany();

  await prisma.placement.deleteMany();
  await prisma.interview.deleteMany();
  await prisma.candidateSubmission.deleteMany();
  await prisma.candidateJobApplication.deleteMany();
  await prisma.jobOrder.deleteMany();
  await prisma.client.deleteMany();

  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.callback.deleteMany();
  await prisma.callActivity.deleteMany();
  await prisma.shortlistRecord.deleteMany();
  await prisma.leadAssignment.deleteMany();
  await prisma.dailyCallingSummary.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();

  // 2. Define System Permissions
  const permissionsData = [
    // LEADS
    { code: 'view_all_leads', name: 'View All Leads', category: 'LEADS', description: 'Can view all master candidates across entire organization' },
    { code: 'add_leads', name: 'Add Candidate Lead', category: 'LEADS', description: 'Can add single candidate leads to database' },
    { code: 'edit_leads', name: 'Edit Candidate Data', category: 'LEADS', description: 'Can edit candidate basic, professional, and salary details' },
    { code: 'delete_leads', name: 'Delete Candidates', category: 'LEADS', description: 'Can soft delete or restore candidate records' },
    { code: 'import_leads', name: 'Bulk Import Leads', category: 'LEADS', description: 'Can upload and process Excel/CSV lead batches' },
    { code: 'export_leads', name: 'Export Candidate Data', category: 'LEADS', description: 'Can download candidate datasets in Excel or CSV' },
    { code: 'assign_leads', name: 'Assign Leads to Executives', category: 'LEADS', description: 'Can manually or auto-distribute leads to telecallers' },
    { code: 'reassign_leads', name: 'Reassign Existing Leads', category: 'LEADS', description: 'Can reassign leads from one executive to another' },
    
    // CALLS & COMMUNICATIONS
    { code: 'view_all_call_records', name: 'View All Call History', category: 'CALLS', description: 'Can view full calling activities and timeline across all executives' },
    { code: 'manage_communications', name: 'Manage Communication Center', category: 'COMMUNICATIONS', description: 'Can create and edit message templates, view all candidate timelines' },
    { code: 'send_whatsapp', name: 'Send WhatsApp Messages', category: 'COMMUNICATIONS', description: 'Can initiate WhatsApp communication with assigned candidates' },

    // TEAMS
    { code: 'manage_teams', name: 'Manage Teams & Structure', category: 'TEAMS', description: 'Can create teams, assign team leaders, and modify team members' },
    { code: 'view_team_dashboard', name: 'View Team Leader Dashboard', category: 'TEAMS', description: 'Can view team velocity, overdue callbacks, and coaching' },

    // CLIENTS & JOBS
    { code: 'manage_clients', name: 'Manage Corporate Clients', category: 'CLIENTS', description: 'Can create, edit, and manage corporate client profiles' },
    { code: 'manage_job_orders', name: 'Manage Job Orders & Vacancies', category: 'JOBS', description: 'Can create job orders, set salary/eligibility, and close vacancies' },
    { code: 'source_candidates_to_jobs', name: 'Source Candidates to Jobs', category: 'JOBS', description: 'Can add candidates from Candidate Master into Job Order pipelines' },
    { code: 'submit_to_client', name: 'Submit Candidates to Client', category: 'JOBS', description: 'Can track CV submissions to corporate clients' },
    { code: 'schedule_interviews', name: 'Manage Client Interviews', category: 'JOBS', description: 'Can schedule interviews, record outcomes, and track selections' },
    { code: 'record_placements', name: 'Record Placements & Joinings', category: 'JOBS', description: 'Can record candidate joining dates, salaries, and placement fees' },

    // USER MANAGEMENT
    { code: 'manage_users', name: 'Manage Users', category: 'USER_MANAGEMENT', description: 'Can view user management module' },
    { code: 'create_admin', name: 'Create Admin Accounts', category: 'USER_MANAGEMENT', description: 'Can create new Admin/Manager accounts (Super Admin only)' },
    { code: 'create_executive', name: 'Create Executive Accounts', category: 'USER_MANAGEMENT', description: 'Can create new Telecalling Executive accounts' },
    { code: 'edit_users', name: 'Edit Users', category: 'USER_MANAGEMENT', description: 'Can update user profiles, phones, and targets' },
    { code: 'deactivate_users', name: 'Deactivate / Reactivate Users', category: 'USER_MANAGEMENT', description: 'Can deactivate user accounts or reactivate them' },
    { code: 'reset_passwords', name: 'Reset User Passwords', category: 'USER_MANAGEMENT', description: 'Can reset passwords for executives or admins' },
    { code: 'manage_roles_permissions', name: 'Manage Roles & Permissions', category: 'USER_MANAGEMENT', description: 'Can create custom roles and modify permission matrix' },
    
    // REPORTS & SYSTEM
    { code: 'view_reports', name: 'View & Download Reports', category: 'REPORTS', description: 'Can view and download performance and calling reports' },
    { code: 'manage_settings', name: 'Manage System Settings', category: 'SYSTEM', description: 'Can access system level configurations and audit logs' },
  ];

  const createdPermissions = new Map<string, any>();
  for (const p of permissionsData) {
    const perm = await prisma.permission.create({
      data: {
        id: uuidv4(),
        ...p,
      },
    });
    createdPermissions.set(p.code, perm);
  }
  console.log(`✅ Seeded ${permissionsData.length} dynamic system permissions`);

  // 3. Define System Roles
  const superAdminRole = await prisma.role.create({
    data: {
      id: uuidv4(),
      name: 'Super Admin / Owner',
      code: 'SUPER_ADMIN',
      description: 'Complete unrestricted administrative access across the entire portal',
      isSystem: true,
    },
  });

  const adminRole = await prisma.role.create({
    data: {
      id: uuidv4(),
      name: 'Admin / Operations Manager',
      code: 'ADMIN',
      description: 'Operations management, client & vacancy creation, lead distribution, and reports',
      isSystem: true,
    },
  });

  const teamLeaderRole = await prisma.role.create({
    data: {
      id: uuidv4(),
      name: 'Team Leader / Supervisor',
      code: 'TEAM_LEADER',
      description: 'Manages telecalling team, monitors live calls, reassigns team leads, and logs coaching',
      isSystem: true,
    },
  });

  const executiveRole = await prisma.role.create({
    data: {
      id: uuidv4(),
      name: 'Telecalling Executive',
      code: 'EXECUTIVE',
      description: 'High-velocity telecaller workspace for assigned job leads, outcomes, and shortlisting',
      isSystem: true,
    },
  });

  // Assign ALL permissions to Super Admin
  for (const perm of createdPermissions.values()) {
    await prisma.rolePermission.create({
      data: {
        id: uuidv4(),
        roleId: superAdminRole.id,
        permissionId: perm.id,
      },
    });
  }

  // Assign Admin permissions
  const adminAllowedCodes = [
    'view_all_leads', 'add_leads', 'edit_leads', 'import_leads', 'export_leads',
    'assign_leads', 'reassign_leads', 'view_all_call_records', 'manage_users',
    'create_executive', 'edit_users', 'deactivate_users', 'reset_passwords',
    'manage_clients', 'manage_job_orders', 'source_candidates_to_jobs', 'submit_to_client',
    'schedule_interviews', 'record_placements', 'view_reports', 'manage_teams',
    'view_team_dashboard', 'manage_communications', 'send_whatsapp'
  ];
  for (const code of adminAllowedCodes) {
    const perm = createdPermissions.get(code);
    if (perm) {
      await prisma.rolePermission.create({
        data: {
          id: uuidv4(),
          roleId: adminRole.id,
          permissionId: perm.id,
        },
      });
    }
  }

  // Assign Team Leader permissions
  const tlAllowedCodes = [
    'view_all_call_records', 'reassign_leads', 'view_team_dashboard',
    'manage_communications', 'send_whatsapp', 'view_reports'
  ];
  for (const code of tlAllowedCodes) {
    const perm = createdPermissions.get(code);
    if (perm) {
      await prisma.rolePermission.create({
        data: {
          id: uuidv4(),
          roleId: teamLeaderRole.id,
          permissionId: perm.id,
        },
      });
    }
  }

  // 4. Create Users
  const passwordHashAdmin = await bcrypt.hash('Admin@123', 10);
  const passwordHashManager = await bcrypt.hash('Manager@123', 10);
  const passwordHashLeader = await bcrypt.hash('Leader@123', 10);
  const passwordHashExec = await bcrypt.hash('Exec@123', 10);

  const superAdmin = await prisma.user.create({
    data: {
      id: uuidv4(),
      name: 'Dr. Vikash Sengupta',
      username: 'vikash_owner',
      email: 'admin@genius.com',
      passwordHash: passwordHashAdmin,
      role: 'SUPER_ADMIN',
      roleId: superAdminRole.id,
      phone: '9830012345',
      status: 'ACTIVE',
      joiningDate: new Date('2024-01-15'),
      lastLoginAt: new Date(),
      targetCallsDaily: 150,
      targetShortlistDaily: 15,
    },
  });

  const manager = await prisma.user.create({
    data: {
      id: uuidv4(),
      name: 'Rohan Deshmukh',
      username: 'rohan_manager',
      email: 'manager@genius.com',
      passwordHash: passwordHashManager,
      role: 'ADMIN',
      roleId: adminRole.id,
      phone: '9820054321',
      status: 'ACTIVE',
      joiningDate: new Date('2024-06-01'),
      lastLoginAt: new Date(),
      targetCallsDaily: 120,
      targetShortlistDaily: 12,
    },
  });

  const teamLeaderRahul = await prisma.user.create({
    data: {
      id: uuidv4(),
      name: 'Rahul Verma',
      username: 'rahul_verma',
      email: 'rahul@genius.com',
      passwordHash: passwordHashLeader,
      role: 'TEAM_LEADER',
      roleId: teamLeaderRole.id,
      phone: '9822233445',
      status: 'ACTIVE',
      joiningDate: new Date('2025-01-10'),
      lastLoginAt: new Date(),
      targetCallsDaily: 110,
      targetShortlistDaily: 12,
    },
  });

  const execPriya = await prisma.user.create({
    data: {
      id: uuidv4(),
      name: 'Priya Sharma',
      username: 'priya_sharma',
      email: 'priya@genius.com',
      passwordHash: passwordHashExec,
      role: 'EXECUTIVE',
      roleId: executiveRole.id,
      phone: '9811122334',
      status: 'ACTIVE',
      joiningDate: new Date('2025-02-10'),
      lastLoginAt: new Date(),
      targetCallsDaily: 100,
      targetShortlistDaily: 10,
    },
  });

  const execAmit = await prisma.user.create({
    data: {
      id: uuidv4(),
      name: 'Amit Patel',
      username: 'amit_patel',
      email: 'amit@genius.com',
      passwordHash: passwordHashExec,
      role: 'EXECUTIVE',
      roleId: executiveRole.id,
      phone: '9833344556',
      status: 'ACTIVE',
      joiningDate: new Date('2025-04-15'),
      lastLoginAt: new Date(),
      targetCallsDaily: 100,
      targetShortlistDaily: 10,
    },
  });

  const execSneha = await prisma.user.create({
    data: {
      id: uuidv4(),
      name: 'Sneha Roy',
      username: 'sneha_roy',
      email: 'sneha@genius.com',
      passwordHash: passwordHashExec,
      role: 'EXECUTIVE',
      roleId: executiveRole.id,
      phone: '9844455667',
      status: 'ACTIVE',
      joiningDate: new Date('2025-05-20'),
      lastLoginAt: new Date(),
      targetCallsDaily: 90,
      targetShortlistDaily: 8,
    },
  });

  const executives = [execPriya, execAmit, execSneha];

  // 5. Seed Team
  const teamAlpha = await prisma.team.create({
    data: {
      id: uuidv4(),
      teamName: 'Automobile & Retail Team Alpha',
      teamLeaderId: teamLeaderRahul.id,
      createdById: superAdmin.id,
      status: 'ACTIVE',
    },
  });

  for (const exec of executives) {
    await prisma.teamMembership.create({
      data: {
        id: uuidv4(),
        teamId: teamAlpha.id,
        userId: exec.id,
        status: 'ACTIVE',
      },
    });
  }
  console.log(`✅ Seeded Team Alpha with Team Leader Rahul Verma and ${executives.length} Executives`);

  // 6. Seed WhatsApp Message Templates
  const templatesData = [
    {
      name: 'General Introduction & Greeting',
      category: 'GENERAL_INTRO',
      subject: 'Opportunity from Genius Consultants',
      bodyText: 'Hello {{candidateName}}, greetings from Genius Consultants! We reviewed your profile for exciting sales and management career opportunities. Are you currently exploring job openings in {{jobLocation}}?',
      variables: 'candidateName, jobLocation',
    },
    {
      name: 'Job Opportunity Details Pitch',
      category: 'JOB_OPPORTUNITY',
      subject: 'New Job Opening: {{jobTitle}}',
      bodyText: 'Dear {{candidateName}}, we have an urgent opening for *{{jobTitle}}* at *{{companyName}}* in *{{jobLocation}}*. Salary offer is *{{salary}}* + attractive incentives. Please let us know your interest to schedule an interview round. Best regards, {{executiveName}} (Genius Consultants).',
      variables: 'candidateName, jobTitle, companyName, jobLocation, salary, executiveName',
    },
    {
      name: 'Candidate Registration Form Link',
      category: 'REGISTRATION_FORM',
      subject: 'Candidate Registration & Profile Submission',
      bodyText: 'Hi {{candidateName}}, thank you for speaking with us regarding {{jobTitle}} at {{companyName}}. Please complete your candidate registration form here: {{registrationFormLink}} so we can submit your profile to the hiring team. Thanks, {{executiveName}}.',
      variables: 'candidateName, jobTitle, companyName, registrationFormLink, executiveName',
    },
    {
      name: 'Request Updated CV / Resume',
      category: 'CV_REQUEST',
      subject: 'Request for Updated Resume / CV',
      bodyText: 'Dear {{candidateName}}, please send your updated PDF / Word resume here on WhatsApp for *{{jobTitle}}* at *{{companyName}}*. We will review and fast-track your client submission. Thank you!',
      variables: 'candidateName, jobTitle, companyName',
    },
    {
      name: 'Scheduled Callback Reminder',
      category: 'CALLBACK_REMINDER',
      subject: 'Callback Reminder: {{companyName}}',
      bodyText: 'Hi {{candidateName}}, this is {{executiveName}} from Genius Consultants. As discussed, I am following up regarding the {{jobTitle}} opportunity. Please let me know when you are free for a quick 2-minute call.',
      variables: 'candidateName, executiveName, jobTitle',
    },
    {
      name: 'Interview Schedule Invitation',
      category: 'INTERVIEW_INVITATION',
      subject: 'Interview Scheduled for {{jobTitle}}',
      bodyText: 'Dear {{candidateName}}, congratulations! Your interview for *{{jobTitle}}* at *{{companyName}}* has been scheduled for *{{interviewDate}} at {{interviewTime}}*. Please carry your updated resume and ID proof. Location: {{jobLocation}}. Contact person: {{companyName}} HR.',
      variables: 'candidateName, jobTitle, companyName, interviewDate, interviewTime, jobLocation',
    },
    {
      name: 'Interview Reminder (1 Day Before)',
      category: 'INTERVIEW_REMINDER',
      subject: 'Reminder: Interview Tomorrow for {{jobTitle}}',
      bodyText: 'Reminder: Dear {{candidateName}}, your interview with *{{companyName}}* is tomorrow *{{interviewDate}} at {{interviewTime}}*. Please reach 15 minutes prior. Best of luck from Genius Consultants!',
      variables: 'candidateName, companyName, interviewDate, interviewTime, jobTitle',
    },
    {
      name: 'Selection & Offer Released',
      category: 'SELECTION_UPDATE',
      subject: 'Congratulations on Your Selection!',
      bodyText: 'Hearty Congratulations {{candidateName}}! You have been selected for *{{jobTitle}}* at *{{companyName}}* with offered salary *{{salary}}*. Our onboarding team will share the offer letter shortly.',
      variables: 'candidateName, jobTitle, companyName, salary',
    },
    {
      name: 'Joining Date & Onboarding Instructions',
      category: 'JOINING_REMINDER',
      subject: 'Joining Details for {{companyName}}',
      bodyText: 'Dear {{candidateName}}, as confirmed, your official date of joining at *{{companyName}}* is *{{interviewDate}}*. Please report to {{jobLocation}} by 9:30 AM with original documents.',
      variables: 'candidateName, companyName, interviewDate, jobLocation',
    },
  ];

  for (const t of templatesData) {
    await prisma.messageTemplate.create({
      data: {
        id: uuidv4(),
        name: t.name,
        category: t.category,
        subject: t.subject,
        bodyText: t.bodyText,
        variables: t.variables,
        isActive: true,
        createdById: superAdmin.id,
      },
    });
  }
  console.log(`✅ Seeded ${templatesData.length} WhatsApp Message Templates`);

  // 7. Seed Corporate Clients & Job Orders
  const clientMaruti = await prisma.client.create({
    data: {
      id: uuidv4(),
      displayClientId: 'GC-CLI-001',
      companyName: 'Maruti Suzuki Arena Dealerships Ltd.',
      industry: 'Automobile',
      companyWebsite: 'https://www.marutisuzuki.com',
      companyAddress: 'Plot 1, Nelson Mandela Road, Vasant Kunj',
      city: 'New Delhi',
      state: 'Delhi NCR',
      contactPersonName: 'Mr. Arvind Saxena',
      designation: 'Head of Dealer HR & Manpower',
      mobileNumber: '9810011223',
      whatsappNumber: '9810011223',
      email: 'arvind.saxena@marutiarena.com',
      recruitmentFeeType: 'PERCENTAGE',
      feeAmountOrPercent: 8.33,
      paymentTerms: '30 Days from Date of Joining',
      replacementPeriodDays: 90,
      status: 'ACTIVE',
      createdById: superAdmin.id,
    },
  });

  const clientICICI = await prisma.client.create({
    data: {
      id: uuidv4(),
      displayClientId: 'GC-CLI-002',
      companyName: 'ICICI Securities & Direct',
      industry: 'BFSI',
      companyWebsite: 'https://www.icicidirect.com',
      companyAddress: 'ICICI Towers, Bandra Kurla Complex',
      city: 'Mumbai',
      state: 'Maharashtra',
      contactPersonName: 'Mr. Rajesh Menon',
      designation: 'VP - Retail Sales Recruitment',
      mobileNumber: '9820033445',
      whatsappNumber: '9820033445',
      email: 'rajesh.menon@icicisecurities.com',
      recruitmentFeeType: 'PERCENTAGE',
      feeAmountOrPercent: 8.33,
      paymentTerms: '45 Days from Date of Joining',
      replacementPeriodDays: 90,
      status: 'ACTIVE',
      createdById: manager.id,
    },
  });

  const jobMarutiSales = await prisma.jobOrder.create({
    data: {
      id: uuidv4(),
      displayJobId: 'GC-JOB-001',
      clientId: clientMaruti.id,
      jobTitle: 'Showroom Sales Advisor (Automobile)',
      department: 'Retail Sales',
      clientContactPerson: 'Mr. Arvind Saxena',
      jobLocation: 'New Delhi / Noida / Gurugram',
      numberOfVacancies: 15,
      employmentType: 'FULL_TIME',
      jobDescription: 'Handling walk-in automobile customers, explaining vehicle models, arranging test drives, closing retail bookings, and managing customer delivery experience.',
      requiredSkills: 'Automobile Retail Sales, Customer Relationship, Negotiation',
      requiredEducation: 'Graduate (Any Discipline) / Diploma',
      minExperienceYears: 1.0,
      maxExperienceYears: 4.0,
      minSalary: 240000,
      maxSalary: 360000,
      salaryType: 'ANNUAL_CTC',
      incentives: 'Attractive vehicle delivery incentives (₹2000 - ₹5000 per car sold)',
      twoWheelerRequired: true,
      drivingLicenseRequired: true,
      fieldSalesRequired: false,
      automobileExpRequired: true,
      priority: 'HIGH',
      assignedManagerId: manager.id,
      targetCandidates: 60,
      status: 'OPEN',
    },
  });

  // 8. Seed Candidates
  const firstNames = [
    'Aarav', 'Vihaan', 'Aditya', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan', 'Shaurya', 'Atharva',
    'Ananya', 'Diya', 'Gauri', 'Isha', 'Kavya', 'Khushi', 'Myra', 'Navya', 'Pari', 'Prisha',
    'Rohan', 'Kunal', 'Deepak', 'Suresh', 'Manish', 'Vikram', 'Pooja', 'Neha', 'Ritu', 'Anjali'
  ];

  const lastNames = [
    'Sharma', 'Verma', 'Gupta', 'Patel', 'Singh', 'Kumar', 'Mishra', 'Yadav', 'Joshi', 'Mehta'
  ];

  const candidatesData: any[] = [];
  const basePhone = 9871000000;

  for (let i = 1; i <= 60; i++) {
    const fn = firstNames[(i - 1) % firstNames.length];
    const ln = lastNames[(i * 3) % lastNames.length];
    const name = `${fn} ${ln}`;
    const primaryPhone = String(basePhone + i);
    const assignedExec = executives[i % executives.length];
    const displaySlNo = `GC-2026-${String(i).padStart(5, '0')}`;

    candidatesData.push({
      id: uuidv4(),
      displaySlNo,
      assignedExecutiveId: assignedExec.id,
      leadOwnerId: manager.id,
      leadStage: i <= 15 ? 'SHORTLISTED' : (i <= 30 ? 'CONTACTED' : 'NEW'),
      leadPriorityScore: 40 + (i % 55),
      dataQualityScore: 90,
      name,
      primaryPhone,
      whatsappNumber: primaryPhone,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@example.com`,
      age: 22 + (i % 10),
      gender: i % 3 === 0 ? 'Female' : 'Male',
      currentLocation: 'New Delhi',
      nativeLocation: 'Delhi NCR',
      education: 'Graduate (B.Com)',
      totalExperienceYears: (i % 5) * 0.8 + 1.0,
      currentJobTitle: 'Sales Executive',
      currentCompany: 'Tata Motors',
      currentSalary: '₹22,000 / month',
      expectedSalary: '₹28,000 / month',
      hasTwoWheeler: true,
      hasDrivingLicense: true,
      interestedInFieldSales: true,
      interestedInAutomobile: true,
      leadSource: 'Naukri.com',
    });
  }

  await prisma.candidate.createMany({ data: candidatesData });
  console.log(`✅ Seeded ${candidatesData.length} Candidates`);

  // 9. Seed Communications, Form Trackings, Applications
  const insertedCandidates = await prisma.candidate.findMany();
  for (let i = 0; i < insertedCandidates.length; i++) {
    const c = insertedCandidates[i];
    const execId = c.assignedExecutiveId || execPriya.id;

    // Attach to job order
    const app = await prisma.candidateJobApplication.create({
      data: {
        id: uuidv4(),
        candidateId: c.id,
        jobOrderId: jobMarutiSales.id,
        assignedExecutiveId: execId,
        addedById: manager.id,
        applicationStage: i < 15 ? 'SHORTLISTED' : 'ASSIGNED',
      },
    });

    // Communication Activity
    if (i < 20) {
      await prisma.communicationActivity.create({
        data: {
          id: uuidv4(),
          candidateId: c.id,
          userId: execId,
          jobOrderId: jobMarutiSales.id,
          clientId: clientMaruti.id,
          channel: 'WHATSAPP',
          communicationType: 'JOB_OPPORTUNITY',
          messageContent: `Dear ${c.name}, exciting opening for Showroom Sales Advisor at Maruti Suzuki Arena!`,
          recipientPhone: c.primaryPhone,
          deliveryStatus: 'INITIATED',
        },
      });

      // Form tracking
      await prisma.candidateFormTracking.create({
        data: {
          id: uuidv4(),
          candidateId: c.id,
          jobOrderId: jobMarutiSales.id,
          formUrl: 'https://geniusconsultants.com/register/GC-2026',
          sentById: execId,
          status: i < 10 ? 'COMPLETED' : 'SENT',
          completedDate: i < 10 ? new Date() : null,
        },
      });
    }
  }

  console.log('✅ Seeded Communication Activities and Registration Form Trackings');

  // 10. Generate Daily Summaries
  const todayStr = '2026-08-28';
  for (const exec of executives) {
    await updateDailySummary(todayStr, exec.id);
  }

  console.log('🎉 Full Database Seeding with Communication Center Completed Successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
