import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hasPermission } from '@/server/middleware/auth';
import { prisma } from '@/server/db/prisma';
import { ScheduleInterviewSchema } from '@/server/validators/schemas';
import { InterviewService } from '@/server/services/InterviewService';

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const outcome = searchParams.get('outcome');

  const where: any = {};
  if (status) where.status = status;
  if (outcome) where.outcome = outcome;

  const interviews = await prisma.interview.findMany({
    where,
    include: {
      application: {
        include: {
          candidate: true,
          job: { select: { id: true, jobTitle: true, company: { select: { id: true, companyName: true } } } },
          assignedExecutive: { select: { id: true, fullName: true } },
        },
      },
      updatedBy: { select: { id: true, fullName: true } },
    },
    orderBy: { scheduledAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: interviews });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  if (!hasPermission(session, 'interview.manage')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = ScheduleInterviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const data = parsed.data;
    const interview = await InterviewService.scheduleInterview({
      applicationId: data.applicationId,
      submissionId: data.submissionId,
      roundNumber: data.roundNumber,
      roundName: data.roundName,
      scheduledAt: data.scheduledAt,
      mode: data.mode,
      location: data.location,
      notes: data.notes,
      userId: session.userId,
    });

    return NextResponse.json({ success: true, data: interview });
  } catch (err: any) {
    console.error('Schedule interview error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to schedule interview' }, { status: 500 });
  }
}
