import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hasPermission } from '@/server/middleware/auth';
import { SaveVerificationSchema } from '@/server/validators/schemas';
import { VerificationService } from '@/server/services/VerificationService';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { id } = params;

  try {
    const result = await VerificationService.getVerification(id);
    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    console.error('Fetch verification error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to fetch verification' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  if (!hasPermission(session, 'calling.log') && !hasPermission(session, 'candidate.edit') && !hasPermission(session, 'screening.evaluate')) {
    return NextResponse.json({ success: false, error: 'Forbidden: Insufficient permissions to update verification' }, { status: 403 });
  }

  const { id } = params;

  try {
    const body = await req.json();
    const parsed = SaveVerificationSchema.safeParse({ ...body, applicationId: id });
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid verification payload',
      }, { status: 400 });
    }

    const result = await VerificationService.upsertVerification(id, parsed.data, session.userId);
    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    console.error('Save verification error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to save verification' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return POST(req, { params });
}
