import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hasPermission } from '@/server/middleware/auth';
import { AssignLeadSchema } from '@/server/validators/schemas';
import { AssignmentService } from '@/server/services/AssignmentService';

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  // Strictly enforce application.assign permission (Operations Head / Super Admin only)
  if (!hasPermission(session, 'application.assign')) {
    return NextResponse.json({ success: false, error: 'Forbidden: You do not have permission to assign leads.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = AssignLeadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const { applicationIds, executiveId, teamId, reason } = parsed.data;

    const result = await AssignmentService.assignApplications({
      applicationIds,
      executiveId,
      teamId,
      assignedById: session.userId,
      reason,
    });

    return NextResponse.json({ success: true, count: result.count, message: `Successfully assigned ${result.count} application(s).` });
  } catch (err: any) {
    console.error('Lead assignment error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to assign applications' }, { status: 500 });
  }
}
