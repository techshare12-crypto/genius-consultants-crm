import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hasPermission } from '@/server/middleware/auth';
import { prisma } from '@/server/db/prisma';
import { CompleteCallbackSchema } from '@/server/validators/schemas';
import { CallingService } from '@/server/services/CallingService';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const cb = await prisma.callback.findUnique({ where: { id: params.id } });
    if (!cb) return NextResponse.json({ success: false, error: 'Callback not found' }, { status: 404 });

    if (!hasPermission(session, 'callback.manage_all') && cb.executiveId !== session.userId) {
      return NextResponse.json({ success: false, error: 'Forbidden: You cannot complete another executive\'s callback' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = CompleteCallbackSchema.safeParse({ callbackId: params.id, ...body });
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const result = await CallingService.completeCallback(
      params.id,
      session.userId,
      parsed.data.completionRemarks
    );

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    console.error('Complete callback error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to complete callback' }, { status: 500 });
  }
}
