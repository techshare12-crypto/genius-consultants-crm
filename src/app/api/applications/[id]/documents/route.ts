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
    hasPermission(session, 'application.manage') ||
    hasPermission(session, 'screening.evaluate');

  const isAssignedExecutive = app.assignedExecutiveId === session.userId;

  if (!isManager && !isAssignedExecutive) {
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: You can only update document status for applications currently assigned to you.',
      },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const action = body.action;

    let updates: {
      formStatus?: 'PENDING' | 'SENT' | 'RECEIVED';
      cvStatus?: 'CV_REQUIRED' | 'CV_REQUESTED' | 'CV_RECEIVED' | 'VERIFIED';
    } = {};

    if (action === 'FORM_SENT') {
      updates = { formStatus: 'SENT' };
    } else if (action === 'FORM_RECEIVED') {
      updates = { formStatus: 'RECEIVED' };
    } else if (action === 'CV_REQUESTED') {
      updates = { cvStatus: 'CV_REQUESTED' };
    } else if (action === 'CV_RECEIVED') {
      updates = { cvStatus: 'CV_RECEIVED' };
    } else {
      if (body.formStatus) updates.formStatus = body.formStatus;
      if (body.cvStatus) updates.cvStatus = body.cvStatus;
    }

    const result = await ScreeningService.updateDocumentStatus(applicationId, session.userId, updates);

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Document status updated successfully.',
    });
  } catch (err: any) {
    console.error('Document update error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to update document status' }, { status: 500 });
  }
}
