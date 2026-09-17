import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/server/middleware/auth';
import { prisma } from '@/server/db/prisma';

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const { presenceStatus } = await req.json();
    if (!['ONLINE', 'ACTIVE', 'CALLING_ACTIVITY', 'AFTER_CALL_WORK', 'IDLE', 'BREAK', 'OFFLINE'].includes(presenceStatus)) {
      return NextResponse.json({ success: false, error: 'Invalid presence status' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.userId },
      data: {
        presenceStatus: presenceStatus as any,
        lastActivityAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, presenceStatus });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: 'Failed to update presence' }, { status: 500 });
  }
}
