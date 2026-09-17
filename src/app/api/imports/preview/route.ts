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

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parseResult = ImportService.parseWorkbookBuffer(buffer, file.name);

    return NextResponse.json({ success: true, data: parseResult });
  } catch (err: any) {
    console.error('Import preview error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to parse workbook' }, { status: 500 });
  }
}
