import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hasPermission } from '@/server/middleware/auth';
import { prisma } from '@/server/db/prisma';
import { getStartAndEndOfDayIST } from '@/server/utils/date';

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status'); // PENDING, COMPLETED, CANCELLED
  const filterType = searchParams.get('type'); // TODAY, OVERDUE, UPCOMING, ALL
  const executiveId = searchParams.get('executiveId');

  const where: any = {};

  // Executive Data Isolation: Normal executive only sees their assigned callbacks
  if (!hasPermission(session, 'callback.manage_all')) {
    where.executiveId = session.userId;
  } else if (executiveId) {
    where.executiveId = executiveId;
  }

  if (status) where.status = status;

  const now = new Date();
  const { start: todayStart, end: todayEnd } = getStartAndEndOfDayIST();

  if (filterType === 'TODAY') {
    where.status = 'PENDING';
    where.scheduledAt = { gte: todayStart, lte: todayEnd };
  } else if (filterType === 'OVERDUE') {
    where.status = 'PENDING';
    where.scheduledAt = { lt: todayStart };
  } else if (filterType === 'UPCOMING') {
    where.status = 'PENDING';
    where.scheduledAt = { gt: todayEnd };
  }

  const callbacks = await prisma.callback.findMany({
    where,
    include: {
      candidate: { select: { id: true, fullName: true, normalizedPhone: true, currentLocation: true } },
      application: {
        select: {
          id: true,
          applicationCode: true,
          currentStage: true,
          job: { select: { id: true, jobTitle: true, company: { select: { companyName: true } } } },
        },
      },
      executive: { select: { id: true, fullName: true } },
    },
    orderBy: { scheduledAt: 'asc' },
  });

  // Calculate dynamic status indicators (Today, Overdue, Upcoming)
  const formatted = callbacks.map((cb) => {
    const isOverdue = cb.status === 'PENDING' && new Date(cb.scheduledAt) < now;
    return {
      ...cb,
      isOverdue,
      displayCategory: isOverdue ? 'OVERDUE' : new Date(cb.scheduledAt) <= todayEnd ? 'TODAY' : 'UPCOMING',
    };
  });

  return NextResponse.json({ success: true, data: formatted });
}
