import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hasPermission } from '@/server/middleware/auth';
import { prisma } from '@/server/db/prisma';
import { UpdateUserSchema } from '@/server/validators/schemas';
import { AuditService } from '@/server/services/AuditService';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  if (!hasPermission(session, 'user.view') && !hasPermission(session, 'user.manage')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const { id } = params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      status: true,
      presenceStatus: true,
      createdAt: true,
      lastLoginAt: true,
      teamId: true,
      team: { select: { id: true, name: true } },
      userRoles: {
        select: {
          role: { select: { id: true, name: true, description: true } },
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: {
      ...user,
      roles: user.userRoles.map((r) => r.role.name),
      roleDetails: user.userRoles.map((r) => r.role),
    },
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  if (!hasPermission(session, 'user.manage')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const { id } = params;

  try {
    const body = await req.json();
    const parsed = UpdateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message || 'Invalid update data' }, { status: 400 });
    }

    const { fullName, phone, status, teamId, roles } = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!existingUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const currentRoles = existingUser.userRoles.map((ur) => ur.role.name);

    const updatedUser = await prisma.$transaction(async (tx) => {
      // 1. Update core user fields
      const updated = await tx.user.update({
        where: { id },
        data: {
          ...(fullName !== undefined && { fullName }),
          ...(phone !== undefined && { phone: phone || null }),
          ...(status !== undefined && { status }),
          ...(teamId !== undefined && { teamId: teamId || null }),
        },
      });

      // 2. Reconcile Roles if provided
      if (roles && Array.isArray(roles)) {
        const rolesToAdd = roles.filter((r) => !currentRoles.includes(r));
        const rolesToRemove = currentRoles.filter((r) => !roles.includes(r));

        // Add new roles
        for (const roleName of rolesToAdd) {
          const role = await tx.role.findUnique({ where: { name: roleName } });
          if (role) {
            await tx.userRole.upsert({
              where: {
                userId_roleId: {
                  userId: id,
                  roleId: role.id,
                },
              },
              update: {},
              create: {
                userId: id,
                roleId: role.id,
              },
            });

            await AuditService.log(
              {
                userId: session.userId,
                action: 'USER_ROLE_ASSIGNED',
                entity: 'UserRole',
                entityId: `${id}_${role.id}`,
                newValues: { targetUserId: id, roleName },
              },
              tx
            );
          }
        }

        // Remove unselected roles
        for (const roleName of rolesToRemove) {
          const role = await tx.role.findUnique({ where: { name: roleName } });
          if (role) {
            await tx.userRole.deleteMany({
              where: {
                userId: id,
                roleId: role.id,
              },
            });

            await AuditService.log(
              {
                userId: session.userId,
                action: 'USER_ROLE_REMOVED',
                entity: 'UserRole',
                entityId: `${id}_${role.id}`,
                oldValues: { targetUserId: id, roleName },
              },
              tx
            );
          }
        }
      }

      // 3. Log user update audit
      const statusChanged = status && status !== existingUser.status;
      await AuditService.log(
        {
          userId: session.userId,
          action: statusChanged
            ? status === 'ACTIVE'
              ? 'USER_ACTIVATED'
              : 'USER_DEACTIVATED'
            : 'USER_UPDATED',
          entity: 'User',
          entityId: id,
          oldValues: {
            fullName: existingUser.fullName,
            phone: existingUser.phone,
            status: existingUser.status,
            teamId: existingUser.teamId,
            roles: currentRoles,
          },
          newValues: {
            fullName,
            phone,
            status,
            teamId,
            roles: roles || currentRoles,
          },
        },
        tx
      );

      return updated;
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        status: updatedUser.status,
      },
    });
  } catch (err: any) {
    console.error('Update user error:', err);
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  if (!hasPermission(session, 'user.manage')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const { id } = params;

  try {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Soft deactivation (preserves historical data)
    await prisma.user.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });

    await AuditService.log({
      userId: session.userId,
      action: 'USER_DEACTIVATED',
      entity: 'User',
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: 'INACTIVE' },
    });

    return NextResponse.json({ success: true, message: 'User deactivated successfully' });
  } catch (err: any) {
    console.error('Deactivate user error:', err);
    return NextResponse.json({ success: false, error: 'Failed to deactivate user' }, { status: 500 });
  }
}
