import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hasPermission } from '@/server/middleware/auth';
import { prisma } from '@/server/db/prisma';
import { EvaluateScreeningSchema } from '@/server/validators/schemas';
import { ScreeningService } from '@/server/services/ScreeningService';

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  if (!hasPermission(session, 'screening.view')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');
  const stage = searchParams.get('stage') || 'SCREENING_PENDING';

  const where: any = {};
  if (jobId) where.jobId = jobId;

  if (stage === 'QUEUE') {
    where.currentStage = {
      in: ['SHORTLISTED', 'FORM_PENDING', 'FORM_RECEIVED', 'CV_PENDING', 'CV_RECEIVED', 'SCREENING_PENDING', 'SCREENING_IN_PROGRESS', 'SCREENING_HOLD'],
    };
  } else if (stage) {
    where.currentStage = stage;
  }

  const applications = await prisma.application.findMany({
    where,
    include: {
      candidate: true,
      job: {
        select: {
          id: true,
          jobCode: true,
          jobTitle: true,
          location: true,
          companyId: true,
          company: { select: { id: true, companyName: true, city: true } },
        },
      },
      assignedExecutive: { select: { id: true, fullName: true } },
      finalShortlistedBy: { select: { id: true, fullName: true } },
      screenings: {
        include: { screener: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: applications });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  if (!hasPermission(session, 'screening.evaluate')) {
    return NextResponse.json({ success: false, error: 'Forbidden: You do not have permission to evaluate screening.' }, { status: 403 });
  }

  try {
    const body = await req.json();

    // Handle document status update
    if (body.type === 'DOCUMENT_UPDATE') {
      const result = await ScreeningService.updateDocumentStatus(
        body.applicationId,
        session.userId,
        {
          formStatus: body.formStatus,
          cvStatus: body.cvStatus,
        }
      );
      return NextResponse.json({ success: true, data: result });
    }

    // Handle screening evaluation
    const parsed = EvaluateScreeningSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const data = parsed.data;
    const result = await ScreeningService.evaluateScreening({
      applicationId: data.applicationId,
      screenerId: session.userId,
      screeningStatus: data.screeningStatus,
      remarks: data.remarks,
      holdFollowupDate: data.holdFollowupDate,
      nextAction: data.nextAction,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    console.error('Screening evaluate error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to evaluate screening' }, { status: 500 });
  }
}
