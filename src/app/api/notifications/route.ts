import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/server/middleware/auth';
import { prisma } from '@/server/db/prisma';

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const notifications = await prisma.notification.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  const unreadCount = await prisma.notification.count({
    where: { userId: session.userId, isRead: false },
  });

  return NextResponse.json({ success: true, data: notifications, unreadCount });
}
