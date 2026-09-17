import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, SYSTEM_ROLES } from '../src/server/constants/permissions';

const prisma = new PrismaClient();

function validatePasswordStrength(password: string, userLabel: string): void {
  if (!password || password.length < 8) {
    throw new Error(`Password validation failed for ${userLabel}: Must be at least 8 characters long.`);
  }
}

function generateSecureRandomPassword(): string {
  return crypto.randomBytes(12).toString('base64url') + 'A1!';
}

async function runProductionBootstrap() {
  console.log('================================================================================');
  console.log('🚀 GENIUS CONSULTANCY CRM — PRODUCTION DATABASE BOOTSTRAP');
  console.log('================================================================================');

  // 1. Staging / Accidental Execution Protection Guard
  const isConfirmed = process.env.BOOTSTRAP_PRODUCTION_CONFIRM === 'true';
  if (!isConfirmed) {
    console.error('❌ ABORTED: Missing confirmation guard.');
    console.error('To authorize bootstrapping an empty production database, set:');
    console.error('   BOOTSTRAP_PRODUCTION_CONFIRM=true');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('❌ ABORTED: DATABASE_URL environment variable is not defined.');
    process.exit(1);
  }

  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
    console.error('❌ ABORTED: AUTH_SECRET must be defined with at least 32 characters of entropy.');
    process.exit(1);
  }

  // 2. Initial Admin Password Guard (Critical Security Requirement)
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error('❌ ABORTED: INITIAL_ADMIN_PASSWORD environment variable is required.');
    console.error('You must specify a secure initial password for the SUPER_ADMIN account:');
    console.error('   INITIAL_ADMIN_PASSWORD="<StrongPasswordHere>"');
    process.exit(1);
  }

  try {
    validatePasswordStrength(adminPassword, 'SUPER_ADMIN');
  } catch (err: any) {
    console.error(`❌ ABORTED: ${err.message}`);
    process.exit(1);
  }

  // 3. Operational Data Safety Guard (Must be completely clean database)
  console.log('\n🔍 Phase 1: Checking for existing operational data...');
  const [
    candidateCount,
    applicationCount,
    callLogCount,
    callbackCount,
    screeningCount,
    submissionCount,
    submissionItemCount,
    interviewCount,
    qualityReviewCount,
  ] = await Promise.all([
    prisma.candidate.count(),
    prisma.application.count(),
    prisma.callLog.count(),
    prisma.callback.count(),
    prisma.screening.count(),
    prisma.clientSubmission.count(),
    prisma.clientSubmissionItem.count(),
    prisma.interview.count(),
    prisma.qualityReview.count(),
  ]);

  const totalOperationalRecords =
    candidateCount +
    applicationCount +
    callLogCount +
    callbackCount +
    screeningCount +
    submissionCount +
    submissionItemCount +
    interviewCount +
    qualityReviewCount;

  if (totalOperationalRecords > 0) {
    console.error('\n❌ Production bootstrap refused: database contains operational data.');
    console.error(`Found: ${candidateCount} candidates, ${applicationCount} applications, ${callLogCount} calls, etc.`);
    console.error('This script is strictly intended for brand-new empty production databases.');
    process.exit(1);
  }

  console.log('✅ Database is clean. Zero operational records detected.');

  // 4. Provisioning Credentials for Operational Users
  const generatedCredentials: Record<string, string> = {};

  const getUserPassword = (envKey: string, userLabel: string): string => {
    const fromEnv = process.env[envKey] || process.env.INITIAL_USER_PASSWORD;
    if (fromEnv) {
      validatePasswordStrength(fromEnv, userLabel);
      return fromEnv;
    }
    const generated = generateSecureRandomPassword();
    generatedCredentials[userLabel] = generated;
    return generated;
  };

  const opsPassword = getUserPassword('INITIAL_OPS_PASSWORD', 'Operations Head');
  const jyotiPassword = getUserPassword('INITIAL_JYOTI_PASSWORD', 'Jyoti Khandelwal');
  const sibiPassword = getUserPassword('INITIAL_SIBI_PASSWORD', 'Sibi C');
  const rahulPassword = getUserPassword('INITIAL_RAHUL_PASSWORD', 'Rahul Sharma');
  const priyaPassword = getUserPassword('INITIAL_PRIYA_PASSWORD', 'Priya Patel');

  // 5. Transactional Execution
  console.log('\n⚙️ Phase 2: Executing Transactional RBAC & Personnel Bootstrap...');

  await prisma.$transaction(
    async (tx) => {
      // Step A: Seed Permissions (30 Granular System Permissions)
      console.log('   -> Creating / Verifying system permissions...');
      for (const [, permName] of Object.entries(PERMISSIONS)) {
        const module = permName.split('.')[0];
        await tx.permission.upsert({
          where: { name: permName },
          update: {},
          create: {
            name: permName,
            module: module.toUpperCase(),
            description: `Allows ${permName} action`,
          },
        });
      }

      // Step B: Seed System Roles (8 System Roles) & Permission Matrix (91 Mappings)
      console.log('   -> Creating / Verifying system roles and permission matrix...');
      for (const [, roleName] of Object.entries(SYSTEM_ROLES)) {
        const role = await tx.role.upsert({
          where: { name: roleName },
          update: {},
          create: {
            name: roleName,
            description: `${roleName.replace(/_/g, ' ')} Role`,
            isSystem: true,
          },
        });

        const assignedPerms = DEFAULT_ROLE_PERMISSIONS[roleName as keyof typeof DEFAULT_ROLE_PERMISSIONS] || [];
        for (const permName of assignedPerms) {
          const perm = await tx.permission.findUnique({ where: { name: permName } });
          if (perm) {
            await tx.rolePermission.upsert({
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

      // Step C: Seed Operational Teams (2 Teams)
      console.log('   -> Creating / Verifying default teams...');
      const teamAlpha = await tx.team.upsert({
        where: { name: 'Team Alpha' },
        update: {},
        create: { name: 'Team Alpha' },
      });

      const teamBeta = await tx.team.upsert({
        where: { name: 'Team Beta' },
        update: {},
        create: { name: 'Team Beta' },
      });

      // Step D: Create Personnel (Preserving Existing Passwords if Already Present)
      console.log('   -> Provisioning 6 core personnel accounts...');

      const personnelConfigs = [
        {
          email: 'admin@geniusconsultancy.com',
          fullName: 'Manjunath (Mj)',
          phone: '9876543210',
          password: adminPassword,
          teamId: null,
          roles: ['SUPER_ADMIN'],
        },
        {
          email: 'ops@geniusconsultancy.com',
          fullName: 'Operations Head',
          phone: '9876543211',
          password: opsPassword,
          teamId: null,
          roles: ['OPERATIONS_HEAD'],
        },
        {
          email: 'jyoti@geniusconsultancy.com',
          fullName: 'Jyoti Khandelwal',
          phone: '9876543212',
          password: jyotiPassword,
          teamId: teamAlpha.id,
          roles: ['SCREENING_MANAGER', 'EXECUTIVE'],
        },
        {
          email: 'sibi@geniusconsultancy.com',
          fullName: 'Sibi C',
          phone: '9876543213',
          password: sibiPassword,
          teamId: null,
          roles: ['BUSINESS_DEVELOPMENT_MANAGER', 'FINANCE_MANAGER'],
        },
        {
          email: 'rahul@geniusconsultancy.com',
          fullName: 'Rahul Sharma',
          phone: '9876543214',
          password: rahulPassword,
          teamId: teamAlpha.id,
          roles: ['EXECUTIVE'],
        },
        {
          email: 'priya@geniusconsultancy.com',
          fullName: 'Priya Patel',
          phone: '9876543215',
          password: priyaPassword,
          teamId: teamBeta.id,
          roles: ['EXECUTIVE'],
        },
      ];

      const allRoles = await tx.role.findMany();
      const getRoleId = (name: string) => {
        const found = allRoles.find((r) => r.name === name);
        if (!found) throw new Error(`Role ${name} not found in database.`);
        return found.id;
      };

      for (const p of personnelConfigs) {
        const existingUser = await tx.user.findUnique({
          where: { email: p.email },
        });

        let userId: string;

        if (existingUser) {
          console.log(`      ℹ️  User ${p.email} already exists; preserving existing password hash.`);
          userId = existingUser.id;
        } else {
          const passwordHash = await bcrypt.hash(p.password, 10);
          const newUser = await tx.user.create({
            data: {
              email: p.email,
              fullName: p.fullName,
              phone: p.phone,
              passwordHash,
              status: 'ACTIVE',
              presenceStatus: 'OFFLINE',
              teamId: p.teamId,
            },
          });
          userId = newUser.id;
          console.log(`      ✨ Created user: ${p.fullName} (${p.email})`);
        }

        // Assign User Roles
        for (const roleName of p.roles) {
          const roleId = getRoleId(roleName);
          await tx.userRole.upsert({
            where: {
              userId_roleId: {
                userId,
                roleId,
              },
            },
            update: {},
            create: {
              userId,
              roleId,
            },
          });
        }
      }
    },
    { timeout: 60000 }
  );

  console.log('\n================================================================================');
  console.log('✅ PRODUCTION BOOTSTRAP COMPLETE');
  console.log('================================================================================');
  console.log('System Configuration Initialized:');
  console.log('   - 8 System Roles');
  console.log('   - 30 System Permissions');
  console.log('   - 91 Role-Permission Mappings');
  console.log('   - 2 Operational Teams (Team Alpha, Team Beta)');
  console.log('   - 6 Operational Users');
  console.log('   - 8 User-Role Mappings');
  console.log('   - 0 Operational / Demo / Test Records');

  if (Object.keys(generatedCredentials).length > 0) {
    console.log('\n🔑 IMPORTANT: Generated One-Time Initial Credentials for Personnel:');
    console.log('--------------------------------------------------------------------------------');
    for (const [userLabel, tempPass] of Object.entries(generatedCredentials)) {
      console.log(`   ${userLabel.padEnd(25)}: ${tempPass}`);
    }
    console.log('--------------------------------------------------------------------------------');
    console.log('⚠️  Instruct all personnel to log in and change their passwords immediately.');
  }

  console.log('\nProduction Database is ready for live operations.');
}

runProductionBootstrap()
  .catch((err) => {
    console.error('\n❌ Bootstrap Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
