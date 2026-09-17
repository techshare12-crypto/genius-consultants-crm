import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSessionUser, hasPermission } from '@/server/middleware/auth';
import { prisma } from '@/server/db/prisma';
import { CreateUserSchema, UpdateUserSchema } from '@/server/validators/schemas';
import { AuditService } from '@/server/services/AuditService';

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  if (!hasPermission(session, 'user.view') && !hasPermission(session, 'user.manage')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      status: true,
      presenceStatus: true,
      lastActivityAt: true,
      lastLoginAt: true,
      team: { select: { id: true, name: true } },
      userRoles: {
        select: {
          role: { select: { id: true, name: true } },
        },
      },
      _count: {
        select: {
          assignedApplications: true,
          callLogs: true,
        },
      },
    },
    orderBy: { fullName: 'asc' },
  });

  const formatted = users.map((u) => ({
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    phone: u.phone,
    status: u.status,
    presenceStatus: u.presenceStatus,
    lastActivityAt: u.lastActivityAt,
    lastLoginAt: u.lastLoginAt,
    team: u.team,
    roles: u.userRoles.map((r) => r.role.name),
    assignedCount: u._count.assignedApplications,
    callLogsCount: u._count.callLogs,
  }));

  return NextResponse.json({ success: true, data: formatted });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  if (!hasPermission(session, 'user.manage')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = CreateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const { email, fullName, password, phone, roles, teamId } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return NextResponse.json({ success: false, error: 'Email is already in use.' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: email.toLowerCase().trim(),
          fullName,
          passwordHash,
          phone: phone || null,
          teamId: teamId || null,
          status: 'ACTIVE',
        },
      });

      for (const roleName of roles) {
        const role = await tx.role.findUnique({ where: { name: roleName } });
        if (role) {
          await tx.userRole.create({
            data: { userId: newUser.id, roleId: role.id },
          });
        }
      }

      await AuditService.log(
        {
          userId: session.userId,
          action: 'USER_CREATED',
          entity: 'User',
          entityId: newUser.id,
          newValues: { email, fullName, roles, teamId },
        },
        tx
      );

      return newUser;
    });

    return NextResponse.json({ success: true, data: { id: user.id, email: user.email, fullName: user.fullName } });
  } catch (err: any) {
    console.error('Create user error:', err);
    return NextResponse.json({ success: false, error: 'Failed to create user' }, { status: 500 });
  }
}
