import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hasPermission } from '@/server/middleware/auth';
import { CreateQualityReviewSchema } from '@/server/validators/schemas';
import { QualityService } from '@/server/services/QualityService';

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const executiveId = searchParams.get('executiveId') || session.userId;

  const result = await QualityService.getExecutiveQualitySummary(executiveId);
  return NextResponse.json({ success: true, data: result });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  if (!hasPermission(session, 'quality.review')) {
    return NextResponse.json({ success: false, error: 'Forbidden: You do not have permission to submit quality reviews.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = CreateQualityReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const review = await QualityService.createReview({
      ...parsed.data,
      reviewerId: session.userId,
    });

    return NextResponse.json({ success: true, data: review });
  } catch (err: any) {
    console.error('Create quality review error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to create quality review' }, { status: 500 });
  }
}
