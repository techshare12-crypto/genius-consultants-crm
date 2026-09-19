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
    const csvContent = await ReportService.exportProductivityCSV(
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

    const filename = `executive_productivity_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    const status = error.message?.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
