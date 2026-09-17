import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hasPermission } from '@/server/middleware/auth';
import { AddToFinalShortlistSchema } from '@/server/validators/schemas';
import { ScreeningService } from '@/server/services/ScreeningService';

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  if (!hasPermission(session, 'shortlist.finalize')) {
    return NextResponse.json({ success: false, error: 'Forbidden: You do not have permission to finalize shortlists.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = AddToFinalShortlistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const { applicationIds, jobId, remarks } = parsed.data;

    const result = await ScreeningService.addToFinalShortlist({
      applicationIds,
      jobId,
      userId: session.userId,
      remarks,
    });

    return NextResponse.json({
      success: true,
      count: result.count,
      message: `Successfully moved ${result.count} candidate(s) to Final Shortlist.`,
    });
  } catch (err: any) {
    console.error('Final shortlist error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to add to final shortlist' }, { status: 500 });
  }
}
