import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hasPermission } from '@/server/middleware/auth';
import { LogCallSchema } from '@/server/validators/schemas';
import { CallingService } from '@/server/services/CallingService';

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  if (!hasPermission(session, 'calling.log')) {
    return NextResponse.json({ success: false, error: 'Forbidden: You do not have permission to log calls.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = LogCallSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const data = parsed.data;

    const result = await CallingService.logCall({
      applicationId: data.applicationId,
      candidateId: data.candidateId,
      executiveId: session.userId,
      callOutcome: data.callOutcome,
      remarks: data.remarks,
      callbackRequired: data.callbackRequired,
      callbackDateTime: data.callbackDateTime,
      callbackReason: data.callbackReason,
      callbackPriority: data.callbackPriority,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    console.error('Log call error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to log call' }, { status: 500 });
  }
}
