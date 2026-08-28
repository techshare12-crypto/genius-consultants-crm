import { Router, Response } from 'express';
import prisma from '../prisma/client';
import { authenticate, requireRoles, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/activity-logs - List audit activity logs
router.get('/', authenticate, requireRoles('ADMIN', 'SUPER_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { candidateId, userId, action, page = '1', limit = '50' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const take = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * take;

    const where: any = {};
    if (candidateId) where.candidateId = candidateId as string;
    if (userId) where.userId = userId as string;
    if (action && action !== 'ALL') where.action = action as string;

    const [total, logs] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          candidate: { select: { id: true, displaySlNo: true, name: true, primaryPhone: true } },
        },
      }),
    ]);

    return res.json({
      logs,
      pagination: {
        page: pageNum,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

export default router;
