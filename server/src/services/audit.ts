import prisma from '../prisma/client';

export async function logActivity(params: {
  userId?: string | null;
  candidateId?: string | null;
  action: string;
  details?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  ipAddress?: string | null;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        userId: params.userId || null,
        candidateId: params.candidateId || null,
        action: params.action,
        details: params.details || null,
        oldValue: params.oldValue ? String(params.oldValue) : null,
        newValue: params.newValue ? String(params.newValue) : null,
        ipAddress: params.ipAddress || null,
      },
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
