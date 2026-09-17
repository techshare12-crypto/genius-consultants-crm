import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/server/utils/jwt';
import { getSessionUser } from '@/server/middleware/auth';
import { prisma } from '@/server/db/prisma';
import { AuditService } from '@/server/services/AuditService';

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (user) {
    await prisma.user.update({
      where: { id: user.userId },
      data: { presenceStatus: 'OFFLINE', lastActivityAt: new Date() },
    });

    await AuditService.log({
      userId: user.userId,
      action: 'USER_LOGOUT',
      entity: 'User',
      entityId: user.userId,
    });
  }

  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}
