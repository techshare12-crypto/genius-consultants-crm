import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/server/middleware/auth';
import { prisma } from '@/server/db/prisma';

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ success: false, user: null }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      status: true,
      presenceStatus: true,
      teamId: true,
      lastLoginAt: true,
      team: { select: { id: true, name: true } },
      userRoles: {
        select: {
          role: {
            select: {
              name: true,
              rolePermissions: {
                select: { permission: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!user || user.status !== 'ACTIVE') {
    return NextResponse.json({ success: false, user: null }, { status: 401 });
  }

  const roles = user.userRoles.map((ur) => ur.role.name);
  const permissionsSet = new Set<string>();
  for (const ur of user.userRoles) {
    for (const rp of ur.role.rolePermissions) {
      permissionsSet.add(rp.permission.name);
    }
  }

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      presenceStatus: user.presenceStatus,
      team: user.team,
      roles,
      permissions: Array.from(permissionsSet),
    },
  });
}
