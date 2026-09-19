import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSessionUser, hasPermission } from '@/server/middleware/auth';
import { prisma } from '@/server/db/prisma';
import { ResetPasswordSchema } from '@/server/validators/schemas';
import { AuditService } from '@/server/services/AuditService';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  if (!hasPermission(session, 'user.manage')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const { id } = params;

  try {
    const body = await req.json();
    const parsed = ResetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid password',
      }, { status: 400 });
    }

    const { password } = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, fullName: true },
    });

    if (!existingUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { passwordHash },
      });

      await AuditService.log(
        {
          userId: session.userId,
          action: 'USER_PASSWORD_RESET',
          entity: 'User',
          entityId: id,
          newValues: { targetUserId: id, targetEmail: existingUser.email },
        },
        tx
      );
    });

    return NextResponse.json({
      success: true,
      message: `Password reset successfully for ${existingUser.fullName || existingUser.email}`,
    });
  } catch (err: any) {
    console.error('Reset password error:', err);
    return NextResponse.json({ success: false, error: 'Failed to reset password' }, { status: 500 });
  }
}