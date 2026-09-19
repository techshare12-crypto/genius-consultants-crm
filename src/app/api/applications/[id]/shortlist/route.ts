import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hasPermission, hasRole } from '@/server/middleware/auth';
import { prisma } from '@/server/db/prisma';
import { ScreeningService } from '@/server/services/ScreeningService';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const applicationId = params.id;
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { candidate: true, job: true },
  });

  if (!app) {
    return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 });
  }

  // Authorization: Managerial roles OR the actively assigned executive
  const isManager =
    hasRole(session, ['SUPER_ADMIN', 'OPERATIONS_HEAD', 'SCREENING_MANAGER']) ||
    hasPermission(session, 'application.manage');

  const isAssignedExecutive = app.assignedExecutiveId === session.userId;

  if (!isManager && !isAssignedExecutive) {
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: You can only shortlist applications currently assigned to you.',
      },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const notes = body.notes;

    const result = await ScreeningService.shortlistApplication(applicationId, session.userId, notes);

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Candidate application shortlisted successfully.',
    });
  } catch (err: any) {
    console.error('Shortlist application error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to shortlist application' }, { status: 500 });
  }
}
