import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hasPermission } from '@/server/middleware/auth';
import { ImportService } from '@/server/services/ImportService';

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  if (!hasPermission(session, 'candidate.import')) {
    return NextResponse.json({ success: false, error: 'Forbidden: You do not have permission to import leads.' }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const targetJobId = formData.get('jobId') as string;
    const targetCompanyId = formData.get('companyId') as string;
    const targetLocation = (formData.get('targetLocation') as string) || undefined;

    if (!file || !targetJobId || !targetCompanyId) {
      return NextResponse.json({ success: false, error: 'File, Job ID, and Company ID are required' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await ImportService.commitWorkbook(
      buffer,
      file.name,
      session.userId,
      targetJobId,
      targetCompanyId,
      targetLocation
    );

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    console.error('Import commit error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to commit import' }, { status: 500 });
  }
}
