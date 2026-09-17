import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hasPermission } from '@/server/middleware/auth';
import { ReportService } from '@/server/services/ReportService';

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  if (!hasPermission(session, 'reports.operations') && !hasPermission(session, 'reports.recruitment')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const executiveId = searchParams.get('executiveId') || undefined;

  const data = await ReportService.getOperationsOverview({
    startDate,
    endDate,
    executiveId,
  });

  return NextResponse.json({ success: true, data });
}
