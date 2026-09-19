import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/server/middleware/auth';
import { ReportService } from '@/server/services/ReportService';

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const datePreset = (searchParams.get('datePreset') as any) || undefined;
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const startTime = searchParams.get('startTime') || undefined;
  const endTime = searchParams.get('endTime') || undefined;
  const executiveId = searchParams.get('executiveId') || undefined;
  const teamId = searchParams.get('teamId') || undefined;
  const jobId = searchParams.get('jobId') || undefined;

  try {
    const data = await ReportService.getExecutiveProductivityAnalytics(
      {
        datePreset,
        startDate,
        endDate,
        startTime,
        endTime,
        executiveId,
        teamId,
        jobId,
      },
      session
    );

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    const status = error.message?.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
