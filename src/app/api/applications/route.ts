import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hasPermission } from '@/server/middleware/auth';
import { prisma } from '@/server/db/prisma';
import { AuditService } from '@/server/services/AuditService';

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const stage = searchParams.get('stage');
  const jobId = searchParams.get('jobId');
  const companyId = searchParams.get('companyId');
  const executiveId = searchParams.get('executiveId');
  const unassigned = searchParams.get('unassigned') === 'true';
  const search = searchParams.get('search')?.trim();

  const skip = (page - 1) * limit;
  const where: any = {};

  // Executive Data Isolation
  if (!hasPermission(session, 'application.view_all')) {
    where.assignedExecutiveId = session.userId;
  } else if (executiveId) {
    where.assignedExecutiveId = executiveId;
  }

  if (unassigned) {
    where.assignedExecutiveId = null;
  }

  if (stage) {
    if (stage.includes(',')) {
      where.currentStage = { in: stage.split(',') };
    } else {
      where.currentStage = stage;
    }
  }

  if (jobId) where.jobId = jobId;
  if (companyId) where.companyId = companyId;

  if (search) {
    where.OR = [
      { applicationCode: { contains: search } },
      { candidate: { fullName: { contains: search } } },
      { candidate: { normalizedPhone: { contains: search } } },
    ];
  }

  const [total, applications] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.findMany({
      where,
      skip,
      take: limit,
      include: {
        candidate: true,
        job: { select: { id: true, jobTitle: true, vacancies: true, location: true, company: { select: { id: true, companyName: true } } } },
        company: { select: { id: true, companyName: true } },
        assignedExecutive: { select: { id: true, fullName: true, email: true } },
        assignedBy: { select: { id: true, fullName: true } },
        _count: {
          select: {
            callLogs: true,
            callbacks: true,
            screenings: true,
            interviews: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: applications,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { candidateId, jobId, companyId, notes } = body;

    if (!candidateId || !jobId || !companyId) {
      return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
    }

    const totalApps = await prisma.application.count();
    const applicationCode = `APP-${String(totalApps + 1).padStart(6, '0')}`;

    const app = await prisma.application.create({
      data: {
        applicationCode,
        candidateId,
        jobId,
        companyId,
        currentStage: 'NEW',
        notes: notes || null,
        createdById: session.userId,
      },
      include: {
        candidate: true,
        job: true,
        company: true,
      },
    });

    await AuditService.log({
      userId: session.userId,
      action: 'APPLICATION_CREATED',
      entity: 'Application',
      entityId: app.id,
      newValues: { applicationCode, candidateId, jobId, companyId },
    });

    return NextResponse.json({ success: true, data: app });
  } catch (err: any) {
    console.error('Create application error:', err);
    return NextResponse.json({ success: false, error: 'Failed to create application' }, { status: 500 });
  }
}
