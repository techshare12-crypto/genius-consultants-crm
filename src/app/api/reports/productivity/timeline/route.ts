import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/server/middleware/auth';
import { ReportService } from '@/server/services/ReportService';

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const executiveId = searchParams.get('executiveId') || session.userId;
  const date = searchParams.get('date') || undefined;
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;

  try {
    const data = await ReportService.getExecutiveActivityTimeline(
      {
        executiveId,
        date,
        startDate,
        endDate,
      },
      session
    );

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    const status = error.message?.includes('Forbidden') ? 403 : error.message?.includes('not found') ? 404 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
