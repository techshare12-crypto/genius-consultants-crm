import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hasPermission } from '@/server/middleware/auth';
import { UpdateInterviewOutcomeSchema } from '@/server/validators/schemas';
import { InterviewService } from '@/server/services/InterviewService';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  if (!hasPermission(session, 'interview.manage')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = UpdateInterviewOutcomeSchema.safeParse({ interviewId: params.id, ...body });
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const result = await InterviewService.updateInterviewOutcome({
      ...parsed.data,
      userId: session.userId,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    console.error('Update interview outcome error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to update interview outcome' }, { status: 500 });
  }
}
