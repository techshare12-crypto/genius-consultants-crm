import { Router, Response } from 'express';
import prisma from '../prisma/client';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { logActivity } from '../services/audit';

const router = Router();

// GET /api/callbacks - List callbacks categorized by status & tab
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tab = 'TODAY', executiveId } = req.query;
    const today = new Date().toISOString().slice(0, 10);

    const where: any = {};

    // Role check: Executive only views their own callbacks
    if (req.user!.role === 'EXECUTIVE') {
      where.executiveId = req.user!.id;
    } else if (executiveId && executiveId !== 'ALL') {
      where.executiveId = executiveId as string;
    }

    if (tab === 'TODAY') {
      where.callbackDate = today;
      where.status = 'PENDING';
    } else if (tab === 'UPCOMING') {
      where.callbackDate = { gt: today };
      where.status = 'PENDING';
    } else if (tab === 'OVERDUE') {
      where.callbackDate = { lt: today };
      where.status = 'PENDING';
    } else if (tab === 'COMPLETED') {
      where.status = { in: ['COMPLETED', 'CANCELLED'] };
    }

    const callbacks = await prisma.callback.findMany({
      where,
      orderBy: [
        { priority: 'asc' }, // HIGH, MEDIUM, LOW
        { callbackDate: 'asc' },
        { callbackTime: 'asc' },
      ],
      include: {
        candidate: {
          select: {
            id: true,
            displaySlNo: true,
            name: true,
            primaryPhone: true,
            currentLocation: true,
            education: true,
            totalExperienceYears: true,
            leadStage: true,
            assignedExecutive: {
              select: { id: true, name: true },
            },
          },
        },
        executive: {
          select: { id: true, name: true, email: true },
        },
        callActivity: {
          select: { outcome: true, remarks: true, callDate: true, callTime: true },
        },
      },
    });

    // Also get quick counts for tab badges
    const baseWhere = req.user!.role === 'EXECUTIVE' ? { executiveId: req.user!.id } : (executiveId && executiveId !== 'ALL' ? { executiveId: executiveId as string } : {});
    const [todayCount, upcomingCount, overdueCount, completedCount] = await Promise.all([
      prisma.callback.count({ where: { ...baseWhere, callbackDate: today, status: 'PENDING' } }),
      prisma.callback.count({ where: { ...baseWhere, callbackDate: { gt: today }, status: 'PENDING' } }),
      prisma.callback.count({ where: { ...baseWhere, callbackDate: { lt: today }, status: 'PENDING' } }),
      prisma.callback.count({ where: { ...baseWhere, status: { in: ['COMPLETED', 'CANCELLED'] } } }),
    ]);

    return res.json({
      callbacks,
      counts: {
        today: todayCount,
        upcoming: upcomingCount,
        overdue: overdueCount,
        completed: completedCount,
      },
    });
  } catch (err: any) {
    console.error('Fetch callbacks error:', err);
    return res.status(500).json({ error: 'Failed to fetch callbacks' });
  }
});

// PUT /api/callbacks/:id/status - Update callback status (Complete, Reschedule, Cancel)
router.put('/:id/status', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status, callbackDate, callbackTime, cancelReason, priority } = req.body;

    const existing = await prisma.callback.findUnique({
      where: { id },
      include: { candidate: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Callback not found' });
    }

    if (req.user!.role === 'EXECUTIVE' && existing.executiveId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied: Callback does not belong to you' });
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (callbackDate) updateData.callbackDate = callbackDate;
    if (callbackTime) updateData.callbackTime = callbackTime;
    if (cancelReason !== undefined) updateData.cancelReason = cancelReason;
    if (priority) updateData.priority = priority;

    const updated = await prisma.callback.update({
      where: { id },
      data: updateData,
    });

    await logActivity({
      userId: req.user!.id,
      candidateId: existing.candidateId,
      action: 'CALLBACK_UPDATED',
      details: `Callback updated to ${status || 'updated'} (Date: ${updateData.callbackDate || existing.callbackDate})`,
    });

    return res.json({ callback: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update callback' });
  }
});

export default router;
