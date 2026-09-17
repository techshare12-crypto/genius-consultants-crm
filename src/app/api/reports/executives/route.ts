import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hasPermission } from '@/server/middleware/auth';
import { ReportService } from '@/server/services/ReportService';

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  if (!hasPermission(session, 'reports.operations')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const data = await ReportService.getExecutivePerformanceMatrix();
  return NextResponse.json({ success: true, data });
}
