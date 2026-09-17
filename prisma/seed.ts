/**
 * ============================================================================
 * ⚠️ DEVELOPMENT & TEST SEED SCRIPT ONLY
 * ============================================================================
 * DO NOT USE THIS SCRIPT FOR PRODUCTION DEPLOYMENTS!
 *
 * Reasons:
 * 1. Overwrites user passwords with default development credentials ('Password@123').
 * 2. Injects demo candidates (CAN-000001 through CAN-000008) and sample companies.
 *
 * For Production Bootstrapping of a clean database, use:
 *   npm run bootstrap:production
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, SYSTEM_ROLES } from '../src/server/constants/permissions';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Genius Consultancy CRM database (DEVELOPMENT / TEST ONLY)...');

  // 1. Seed Permissions
  console.log('1. Creating system permissions...');
  for (const [key, permName] of Object.entries(PERMISSIONS)) {
    const module = permName.split('.')[0];
    await prisma.permission.upsert({
      where: { name: permName },
      update: {},
      create: {
        name: permName,
        module: module.toUpperCase(),
        description: `Allows ${permName} action`,
      },
    });
  }

  // 2. Seed Roles & Assign Permissions
  console.log('2. Creating system roles and assigning permission matrix...');
  for (const [roleKey, roleName] of Object.entries(SYSTEM_ROLES)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: {
        name: roleName,
        description: `${roleName.replace(/_/g, ' ')} Role`,
        isSystem: true,
      },
    });

    // Assign permissions for role
    const assignedPerms = DEFAULT_ROLE_PERMISSIONS[roleName as keyof typeof DEFAULT_ROLE_PERMISSIONS] || [];
    for (const permName of assignedPerms) {
      const perm = await prisma.permission.findUnique({ where: { name: permName } });
      if (perm) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: perm.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: perm.id,
          },
        });
      }
    }
  }

  // 3. Create Teams
  console.log('3. Creating default teams...');
  const teamAlpha = await prisma.team.upsert({
    where: { name: 'Team Alpha' },
    update: {},
    create: { name: 'Team Alpha' },
  });

  const teamBeta = await prisma.team.upsert({
    where: { name: 'Team Beta' },
    update: {},
    create: { name: 'Team Beta' },
  });

  // 4. Create Key Organization Users
  console.log('4. Creating organization users with multi-role assignments...');
  const passwordHash = await bcrypt.hash('Password@123', 10);

  // Super Admin: Manjunath / Mj
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@geniusconsultancy.com' },
    update: { passwordHash, status: 'ACTIVE', presenceStatus: 'ACTIVE' },
    create: {
      email: 'admin@geniusconsultancy.com',
      fullName: 'Manjunath (Mj)',
      passwordHash,
      phone: '9876543210',
      status: 'ACTIVE',
      presenceStatus: 'ACTIVE',
    },
  });

  // Operations Head
  const opsHead = await prisma.user.upsert({
    where: { email: 'ops@geniusconsultancy.com' },
    update: { passwordHash, status: 'ACTIVE', presenceStatus: 'ACTIVE' },
    create: {
      email: 'ops@geniusconsultancy.com',
      fullName: 'Operations Head',
      passwordHash,
      phone: '9876543211',
      status: 'ACTIVE',
      presenceStatus: 'ACTIVE',
    },
  });

  // Screening Manager & Executive: Jyoti Khandelwal (Multi-Role)
  const jyoti = await prisma.user.upsert({
    where: { email: 'jyoti@geniusconsultancy.com' },
    update: { passwordHash, status: 'ACTIVE', presenceStatus: 'ACTIVE', teamId: teamAlpha.id },
    create: {
      email: 'jyoti@geniusconsultancy.com',
      fullName: 'Jyoti Khandelwal',
      passwordHash,
      phone: '9876543212',
      status: 'ACTIVE',
      presenceStatus: 'ACTIVE',
      teamId: teamAlpha.id,
    },
  });

  // BD Manager & Finance Manager: Sibi C (Multi-Role)
  const sibi = await prisma.user.upsert({
    where: { email: 'sibi@geniusconsultancy.com' },
    update: { passwordHash, status: 'ACTIVE', presenceStatus: 'ACTIVE' },
    create: {
      email: 'sibi@geniusconsultancy.com',
      fullName: 'Sibi C',
      passwordHash,
      phone: '9876543213',
      status: 'ACTIVE',
      presenceStatus: 'ACTIVE',
    },
  });

  // Executive: Rahul Sharma
  const rahul = await prisma.user.upsert({
    where: { email: 'rahul@geniusconsultancy.com' },
    update: { passwordHash, status: 'ACTIVE', presenceStatus: 'CALLING_ACTIVITY', teamId: teamAlpha.id },
    create: {
      email: 'rahul@geniusconsultancy.com',
      fullName: 'Rahul Sharma',
      passwordHash,
      phone: '9876543214',
      status: 'ACTIVE',
      presenceStatus: 'CALLING_ACTIVITY',
      teamId: teamAlpha.id,
    },
  });

  // Executive: Priya Patel
  const priya = await prisma.user.upsert({
    where: { email: 'priya@geniusconsultancy.com' },
    update: { passwordHash, status: 'ACTIVE', presenceStatus: 'ACTIVE', teamId: teamBeta.id },
    create: {
      email: 'priya@geniusconsultancy.com',
      fullName: 'Priya Patel',
      passwordHash,
      phone: '9876543215',
      status: 'ACTIVE',
      presenceStatus: 'ACTIVE',
      teamId: teamBeta.id,
    },
  });

  // Assign Roles to Users
  const roles = await prisma.role.findMany();
  const getRoleId = (name: string) => roles.find((r) => r.name === name)?.id!;

  // Super Admin -> SUPER_ADMIN
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: superAdmin.id, roleId: getRoleId('SUPER_ADMIN') } },
    update: {},
    create: { userId: superAdmin.id, roleId: getRoleId('SUPER_ADMIN') },
  });

  // Ops Head -> OPERATIONS_HEAD
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: opsHead.id, roleId: getRoleId('OPERATIONS_HEAD') } },
    update: {},
    create: { userId: opsHead.id, roleId: getRoleId('OPERATIONS_HEAD') },
  });

  // Jyoti -> SCREENING_MANAGER + EXECUTIVE (Multi-Role)
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: jyoti.id, roleId: getRoleId('SCREENING_MANAGER') } },
    update: {},
    create: { userId: jyoti.id, roleId: getRoleId('SCREENING_MANAGER') },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: jyoti.id, roleId: getRoleId('EXECUTIVE') } },
    update: {},
    create: { userId: jyoti.id, roleId: getRoleId('EXECUTIVE') },
  });

  // Sibi -> BUSINESS_DEVELOPMENT_MANAGER + FINANCE_MANAGER (Multi-Role)
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: sibi.id, roleId: getRoleId('BUSINESS_DEVELOPMENT_MANAGER') } },
    update: {},
    create: { userId: sibi.id, roleId: getRoleId('BUSINESS_DEVELOPMENT_MANAGER') },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: sibi.id, roleId: getRoleId('FINANCE_MANAGER') } },
    update: {},
    create: { userId: sibi.id, roleId: getRoleId('FINANCE_MANAGER') },
  });

  // Rahul & Priya -> EXECUTIVE
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: rahul.id, roleId: getRoleId('EXECUTIVE') } },
    update: {},
    create: { userId: rahul.id, roleId: getRoleId('EXECUTIVE') },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: priya.id, roleId: getRoleId('EXECUTIVE') } },
    update: {},
    create: { userId: priya.id, roleId: getRoleId('EXECUTIVE') },
  });

  // 5. Create Companies & Contacts
  console.log('5. Creating sample companies and job requirements...');
  const tvsCompany = await prisma.company.upsert({
    where: { companyCode: 'COMP-001' },
    update: {},
    create: {
      companyCode: 'COMP-001',
      companyName: 'TVS Motor Company',
      industry: 'Automobile',
      companyType: 'Enterprise',
      city: 'Rajkot',
      state: 'Gujarat',
      status: 'ACTIVE',
      createdById: sibi.id,
      contacts: {
        create: [
          {
            contactName: 'Kishore Joshi',
            designation: 'HR Regional Head',
            phone: '9825012345',
            email: 'kishore.joshi@tvsmotor.com',
            isPrimary: true,
          },
        ],
      },
    },
  });

  const heroCompany = await prisma.company.upsert({
    where: { companyCode: 'COMP-002' },
    update: {},
    create: {
      companyCode: 'COMP-002',
      companyName: 'Hero FinCorp',
      industry: 'Financial Services / Banking',
      companyType: 'Corporate',
      city: 'Surat',
      state: 'Gujarat',
      status: 'ACTIVE',
      createdById: sibi.id,
      contacts: {
        create: [
          {
            contactName: 'Anil Desai',
            designation: 'Talent Acquisition Manager',
            phone: '9879012345',
            email: 'anil.desai@herofincorp.com',
            isPrimary: true,
          },
        ],
      },
    },
  });

  // 6. Job Requirements
  const tvsJob = await prisma.jobRequirement.upsert({
    where: { jobCode: 'JOB-001' },
    update: {},
    create: {
      jobCode: 'JOB-001',
      companyId: tvsCompany.id,
      jobTitle: 'Field Sales Executive - Rajkot',
      department: 'Sales & Dealership',
      vacancies: 30,
      location: 'Rajkot, Gujarat',
      salaryMin: 18000,
      salaryMax: 25000,
      salaryText: '18,000 - 25,000 + Fuel Allowance',
      experienceMin: 0,
      experienceMax: 4,
      educationRequirement: 'Graduate (Any stream)',
      twoWheelerRequired: true,
      drivingLicenseRequired: true,
      skillsRequired: JSON.stringify(['Counter Sales', 'Direct Sales', 'Cold Calling', 'Gujarati', 'Hindi']),
      jobStatus: 'OPEN',
      createdById: sibi.id,
    },
  });

  const heroJob = await prisma.jobRequirement.upsert({
    where: { jobCode: 'JOB-002' },
    update: {},
    create: {
      jobCode: 'JOB-002',
      companyId: heroCompany.id,
      jobTitle: 'Loan Officer / Field Sales - Surat',
      department: 'Retail Lending',
      vacancies: 15,
      location: 'Surat, Gujarat',
      salaryMin: 20000,
      salaryMax: 28000,
      salaryText: '20,000 - 28,000 + Incentives',
      experienceMin: 1,
      experienceMax: 5,
      educationRequirement: 'Graduate (B.Com/BBA preferred)',
      twoWheelerRequired: true,
      drivingLicenseRequired: true,
      skillsRequired: JSON.stringify(['Field Sales', 'Customer Verification', 'Documentation', 'Hindi', 'Gujarati']),
      jobStatus: 'OPEN',
      createdById: sibi.id,
    },
  });

  // 7. Seed Sample Candidates
  console.log('7. Creating candidates and applications across workflow stages...');
  const sampleCandidatesData = [
    {
      code: 'CAN-000001',
      name: 'Samir Bloch',
      phone: '9558555612',
      location: 'Rajkot, Gujarat',
      education: 'Graduate (B.Com)',
      expYears: 6,
      currentJob: 'Sales Executive at Policybazaar in Field Sales',
      hasBike: true,
      hasLicense: true,
      stage: 'INTERVIEW_SCHEDULED',
    },
    {
      code: 'CAN-000002',
      name: 'Tushar Gohil',
      phone: '9730412126',
      location: 'Rajkot, Gujarat',
      education: 'Graduate (B.B.A)',
      expYears: 0,
      currentJob: 'Fresher in Field Sales',
      hasBike: true,
      hasLicense: false,
      stage: 'CALLING',
    },
    {
      code: 'CAN-000003',
      name: 'Nakum Jay',
      phone: '8200046310',
      location: 'Rajkot, Gujarat',
      education: 'Graduate',
      expYears: 1,
      currentJob: 'Graphic Designer at Think Design',
      hasBike: true,
      hasLicense: true,
      stage: 'SHORTLISTED',
    },
    {
      code: 'CAN-000004',
      name: 'Bhavin Vasani',
      phone: '7096865165',
      location: 'Jasdan, Rajkot',
      education: 'Graduate (B.A. Sociology)',
      expYears: 0,
      currentJob: 'Fresher in Field Sales',
      hasBike: true,
      hasLicense: true,
      stage: 'SCREENING_PENDING',
    },
    {
      code: 'CAN-000005',
      name: 'Aadarsh Tiwari',
      phone: '7990831884',
      location: 'Rajkot, Gujarat',
      education: 'Graduate (B.Com)',
      expYears: 4,
      currentJob: 'Marketing Executive at Jet cargo',
      hasBike: true,
      hasLicense: true,
      stage: 'FINAL_SHORTLIST',
    },
    {
      code: 'CAN-000006',
      name: 'Vishal Sanchaniya',
      phone: '9773015653',
      location: 'Rajkot, Gujarat',
      education: 'Graduate (B.Com)',
      expYears: 1,
      currentJob: 'Sales Executive at Axis Bank',
      hasBike: true,
      hasLicense: true,
      stage: 'SENT_TO_CLIENT',
    },
    {
      code: 'CAN-000007',
      name: 'Krunalsinh Rana',
      phone: '9725677769',
      location: 'Rajkot, Gujarat',
      education: 'Graduate (B.Com)',
      expYears: 2,
      currentJob: 'Field Officer',
      hasBike: true,
      hasLicense: true,
      stage: 'SELECTED',
    },
    {
      code: 'CAN-000008',
      name: 'Manoj Kumar Solanki',
      phone: '9106017792',
      location: 'Rajkot, Gujarat',
      education: 'Graduate (B.A)',
      expYears: 3,
      currentJob: 'Sales Associate',
      hasBike: true,
      hasLicense: true,
      stage: 'JOINED',
    },
  ];

  let appIndex = 1;
  for (const cData of sampleCandidatesData) {
    const candidate = await prisma.candidate.upsert({
      where: { candidateCode: cData.code },
      update: {},
      create: {
        candidateCode: cData.code,
        fullName: cData.name,
        rawPhone: cData.phone,
        normalizedPhone: cData.phone,
        currentLocation: cData.location,
        education: cData.education,
        experienceYears: cData.expYears,
        currentJob: cData.currentJob,
        hasTwoWheeler: cData.hasBike,
        hasDrivingLicense: cData.hasLicense,
        skills: JSON.stringify(['Sales', 'Communication', 'Gujarati', 'Hindi']),
        languages: JSON.stringify(['Gujarati', 'Hindi']),
      },
    });

    const appCode = `APP-${String(appIndex++).padStart(6, '0')}`;
    const app = await prisma.application.upsert({
      where: { applicationCode: appCode },
      update: {},
      create: {
        applicationCode: appCode,
        candidateId: candidate.id,
        jobId: tvsJob.id,
        companyId: tvsCompany.id,
        assignedExecutiveId: rahul.id,
        assignedTeamId: teamAlpha.id,
        assignedById: opsHead.id,
        assignedAt: new Date(),
        currentStage: cData.stage as any,
        formStatus: ['SHORTLISTED', 'SCREENING_PENDING', 'FINAL_SHORTLIST', 'SENT_TO_CLIENT', 'INTERVIEW_SCHEDULED', 'SELECTED', 'JOINED'].includes(cData.stage) ? 'RECEIVED' : 'PENDING',
        cvStatus: ['SHORTLISTED', 'SCREENING_PENDING', 'FINAL_SHORTLIST', 'SENT_TO_CLIENT', 'INTERVIEW_SCHEDULED', 'SELECTED', 'JOINED'].includes(cData.stage) ? 'CV_RECEIVED' : 'CV_REQUIRED',
        formReceivedAt: new Date(),
        cvReceivedAt: new Date(),
        readyForScreeningAt: new Date(),
        createdById: opsHead.id,
      },
    });

    // Record initial assignment history
    await prisma.applicationAssignmentHistory.create({
      data: {
        applicationId: app.id,
        candidateId: candidate.id,
        executiveId: rahul.id,
        teamId: teamAlpha.id,
        assignedById: opsHead.id,
        assignedAt: new Date(),
        assignmentMode: 'INITIAL_SEED',
      },
    });

    // Create sample call logs for candidate
    await prisma.callLog.create({
      data: {
        applicationId: app.id,
        candidateId: candidate.id,
        executiveId: rahul.id,
        callOutcome: cData.stage === 'CALLING' ? 'CALLBACK' : 'SHORTLISTED',
        remarks: cData.stage === 'CALLING' ? 'Candidate requested callback in afternoon' : 'Candidate shortlisted for TVS Field Sales role',
        callbackRequired: cData.stage === 'CALLING',
        callbackDateTime: cData.stage === 'CALLING' ? new Date(Date.now() + 2 * 3600 * 1000) : null,
      },
    });

    // If calling stage, create callback
    if (cData.stage === 'CALLING') {
      await prisma.callback.create({
        data: {
          applicationId: app.id,
          candidateId: candidate.id,
          executiveId: rahul.id,
          scheduledAt: new Date(Date.now() + 2 * 3600 * 1000),
          reason: 'Discuss job timing and petrol allowance',
          priority: 'HIGH',
          status: 'PENDING',
        },
      });
    }

    // If screening or later, add screening record
    if (['FINAL_SHORTLIST', 'SENT_TO_CLIENT', 'INTERVIEW_SCHEDULED', 'SELECTED', 'JOINED'].includes(cData.stage)) {
      await prisma.screening.create({
        data: {
          applicationId: app.id,
          screenerId: jyoti.id,
          screeningStatus: 'PASS',
          remarks: 'Candidate has 2-wheeler, DL, and positive energy for field sales.',
          nextAction: 'Added to final shortlist pool',
        },
      });
    }

    // If interview or later, add interview record
    if (['INTERVIEW_SCHEDULED', 'SELECTED', 'JOINED'].includes(cData.stage)) {
      await prisma.interview.create({
        data: {
          applicationId: app.id,
          roundNumber: 1,
          roundName: 'Client Face-to-Face Interview',
          scheduledAt: new Date(Date.now() + 24 * 3600 * 1000),
          mode: 'OFFLINE',
          location: 'TVS Showroom, Gondal Road, Rajkot',
          status: cData.stage === 'INTERVIEW_SCHEDULED' ? 'SCHEDULED' : 'COMPLETED',
          outcome: ['SELECTED', 'JOINED'].includes(cData.stage) ? 'SELECTED' : 'PENDING',
          feedback: 'Candidate performed well in aptitude and dealer coordination test',
          updatedById: opsHead.id,
        },
      });
    }

    // If executive Rahul, add quality review for candidate 1
    if (cData.code === 'CAN-000001') {
      await prisma.qualityReview.create({
        data: {
          applicationId: app.id,
          executiveId: rahul.id,
          reviewerId: opsHead.id,
          rating: 4,
          communicationScore: 4,
          jobExplanationScore: 5,
          processAdherenceScore: 4,
          remarks: 'Excellent call handling and prompt WhatsApp form sharing.',
        },
      });
    }
  }

  // 8. Create Sample Client Submission
  console.log('8. Creating sample client submission...');
  const finalShortlistApps = await prisma.application.findMany({
    where: { currentStage: { in: ['FINAL_SHORTLIST', 'SENT_TO_CLIENT', 'INTERVIEW_SCHEDULED', 'SELECTED', 'JOINED'] } },
    take: 3,
  });

  if (finalShortlistApps.length > 0) {
    const submission = await prisma.clientSubmission.create({
      data: {
        submissionCode: 'SUB-000001',
        companyId: tvsCompany.id,
        jobId: tvsJob.id,
        submittedById: jyoti.id,
        submissionMethod: 'WHATSAPP_MANUAL',
        remarks: 'Shortlisted candidates batch 1 sent to HR Kishore Joshi',
        items: {
          create: finalShortlistApps.map((a) => ({
            applicationId: a.id,
            candidateId: a.candidateId,
            clientFeedback: 'Profiles acknowledged by client HR',
          })),
        },
      },
    });
  }

  console.log('✅ Database seeded successfully!');
  console.log('====================================================');
  console.log('Default Credentials:');
  console.log('Super Admin: admin@geniusconsultancy.com / Password@123');
  console.log('Ops Head:    ops@geniusconsultancy.com   / Password@123');
  console.log('Screening:   jyoti@geniusconsultancy.com / Password@123');
  console.log('BD Manager:  sibi@geniusconsultancy.com  / Password@123');
  console.log('Executive:   rahul@geniusconsultancy.com / Password@123');
  console.log('====================================================');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
