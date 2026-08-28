import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { authenticate, requireRoles, AuthenticatedRequest } from '../middleware/auth';
import { logActivity } from '../services/audit';

const router = Router();

// POST /api/assignments/single - Assign a single candidate to an executive
router.post('/single', authenticate, requireRoles('ADMIN', 'SUPER_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { candidateId, executiveId } = req.body;

    if (!candidateId || !executiveId) {
      return res.status(400).json({ error: 'Candidate ID and Executive ID are required' });
    }

    const [candidate, executive] = await Promise.all([
      prisma.candidate.findUnique({ where: { id: candidateId } }),
      prisma.user.findUnique({ where: { id: executiveId } }),
    ]);

    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
    if (!executive) return res.status(404).json({ error: 'Executive not found' });

    const previousExecutiveId = candidate.assignedExecutiveId;

    // Record immutable LeadAssignment
    await prisma.leadAssignment.create({
      data: {
        id: uuidv4(),
        candidateId,
        assignedById: req.user!.id,
        assignedToId: executiveId,
        previousExecutiveId,
        assignmentMode: 'MANUAL',
      },
    });

    // Update candidate
    const updated = await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        assignedExecutiveId: executiveId,
        leadStage: candidate.leadStage === 'NEW' ? 'ASSIGNED' : candidate.leadStage,
      },
      include: {
        assignedExecutive: { select: { id: true, name: true, email: true } },
      },
    });

    await logActivity({
      userId: req.user!.id,
      candidateId,
      action: 'LEAD_ASSIGNED',
      details: `Assigned candidate ${candidate.name} to ${executive.name}`,
    });

    try {
      const { createAndEmitNotification } = require('../services/socket');
      await createAndEmitNotification({
        userId: executiveId,
        type: 'LEAD_ASSIGNED',
        title: 'New Lead Assigned',
        message: `Lead ${candidate.name} (${candidate.displaySlNo}) has been assigned to you.`,
        entityType: 'CANDIDATE',
        entityId: candidate.id,
      });
    } catch (err) {
      console.error('Notification error:', err);
    }

    return res.json({ success: true, candidate: updated });
  } catch (err: any) {
    console.error('Assign single error:', err);
    return res.status(500).json({ error: 'Failed to assign candidate' });
  }
});

// POST /api/assignments/bulk - Bulk assign multiple candidate IDs to one executive
router.post('/bulk', authenticate, requireRoles('ADMIN', 'SUPER_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { candidateIds, executiveId } = req.body;

    if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0 || !executiveId) {
      return res.status(400).json({ error: 'candidateIds array and executiveId are required' });
    }

    const executive = await prisma.user.findUnique({ where: { id: executiveId } });
    if (!executive) return res.status(404).json({ error: 'Executive not found' });

    const candidates = await prisma.candidate.findMany({
      where: { id: { in: candidateIds }, isDeleted: false },
      select: { id: true, assignedExecutiveId: true, leadStage: true },
    });

    const assignmentRecords = candidates.map(c => ({
      id: uuidv4(),
      candidateId: c.id,
      assignedById: req.user!.id,
      assignedToId: executiveId,
      previousExecutiveId: c.assignedExecutiveId,
      assignmentMode: 'BULK',
    }));

    await prisma.$transaction([
      prisma.leadAssignment.createMany({
        data: assignmentRecords,
      }),
      prisma.candidate.updateMany({
        where: { id: { in: candidateIds } },
        data: {
          assignedExecutiveId: executiveId,
        },
      }),
    ]);

    // Also update stage from NEW to ASSIGNED if needed
    await prisma.candidate.updateMany({
      where: { id: { in: candidateIds }, leadStage: 'NEW' },
      data: { leadStage: 'ASSIGNED' },
    });

    await logActivity({
      userId: req.user!.id,
      action: 'BULK_LEADS_ASSIGNED',
      details: `Bulk assigned ${candidates.length} leads to ${executive.name}`,
    });

    return res.json({
      success: true,
      message: `Successfully assigned ${candidates.length} leads to ${executive.name}`,
      assignedCount: candidates.length,
    });
  } catch (err: any) {
    console.error('Bulk assign error:', err);
    return res.status(500).json({ error: 'Failed to bulk assign leads' });
  }
});

// POST /api/assignments/auto-distribute - Automatically distribute leads equally among active executives
router.post('/auto-distribute', authenticate, requireRoles('ADMIN', 'SUPER_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      candidateIds, // Optional: if provided, distribute these; otherwise distribute all unassigned leads
      executiveIds, // Array of executive user IDs to distribute across
      maxLeadsPerExecutive, // Optional ceiling
    } = req.body;

    // Get target executives
    let targetExecutives: any[] = [];
    if (executiveIds && Array.isArray(executiveIds) && executiveIds.length > 0) {
      targetExecutives = await prisma.user.findMany({
        where: { id: { in: executiveIds }, status: 'ACTIVE' },
      });
    } else {
      // Default to all active executives
      targetExecutives = await prisma.user.findMany({
        where: { role: 'EXECUTIVE', status: 'ACTIVE' },
      });
    }

    if (targetExecutives.length === 0) {
      return res.status(400).json({ error: 'No active executives available for distribution' });
    }

    // Get candidates to distribute
    let candidatesToDistribute: any[] = [];
    if (candidateIds && Array.isArray(candidateIds) && candidateIds.length > 0) {
      candidatesToDistribute = await prisma.candidate.findMany({
        where: { id: { in: candidateIds }, isDeleted: false },
        select: { id: true, assignedExecutiveId: true, leadStage: true },
      });
    } else {
      // Find all unassigned leads
      candidatesToDistribute = await prisma.candidate.findMany({
        where: { assignedExecutiveId: null, isDeleted: false },
        select: { id: true, assignedExecutiveId: true, leadStage: true },
        orderBy: [{ leadPriorityScore: 'desc' }, { createdAt: 'desc' }],
      });
    }

    if (candidatesToDistribute.length === 0) {
      return res.status(400).json({ error: 'No unassigned candidates found for distribution' });
    }

    // Equal round-robin distribution
    const distributionSummary: Record<string, { executiveName: string; count: number }> = {};
    for (const exec of targetExecutives) {
      distributionSummary[exec.id] = { executiveName: exec.name, count: 0 };
    }

    const assignmentsToCreate: any[] = [];
    const updatesByExecutive: Record<string, string[]> = {};
    for (const exec of targetExecutives) {
      updatesByExecutive[exec.id] = [];
    }

    let execIndex = 0;
    for (const candidate of candidatesToDistribute) {
      const exec = targetExecutives[execIndex % targetExecutives.length];
      
      // If max per exec reached, skip
      if (maxLeadsPerExecutive && distributionSummary[exec.id].count >= maxLeadsPerExecutive) {
        execIndex++;
        continue;
      }

      assignmentsToCreate.push({
        id: uuidv4(),
        candidateId: candidate.id,
        assignedById: req.user!.id,
        assignedToId: exec.id,
        previousExecutiveId: candidate.assignedExecutiveId,
        assignmentMode: 'AUTO_EQUAL',
      });

      updatesByExecutive[exec.id].push(candidate.id);
      distributionSummary[exec.id].count++;
      execIndex++;
    }

    // Execute bulk updates in transaction
    const updatePromises: any[] = [
      prisma.leadAssignment.createMany({ data: assignmentsToCreate }),
    ];

    for (const [execId, ids] of Object.entries(updatesByExecutive)) {
      if (ids.length > 0) {
        updatePromises.push(
          prisma.candidate.updateMany({
            where: { id: { in: ids } },
            data: { assignedExecutiveId: execId },
          })
        );
        updatePromises.push(
          prisma.candidate.updateMany({
            where: { id: { in: ids }, leadStage: 'NEW' },
            data: { leadStage: 'ASSIGNED' },
          })
        );
      }
    }

    await prisma.$transaction(updatePromises);

    await logActivity({
      userId: req.user!.id,
      action: 'AUTO_DISTRIBUTE_LEADS',
      details: `Distributed ${assignmentsToCreate.length} leads equally among ${targetExecutives.length} executives`,
    });

    return res.json({
      success: true,
      totalDistributed: assignmentsToCreate.length,
      distribution: Object.values(distributionSummary),
    });
  } catch (err: any) {
    console.error('Auto distribute error:', err);
    return res.status(500).json({ error: 'Failed to distribute leads' });
  }
});

// GET /api/assignments/history - List assignment history
router.get('/history', authenticate, requireRoles('ADMIN', 'SUPER_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { candidateId, executiveId } = req.query;
    const where: any = {};

    if (candidateId) where.candidateId = candidateId as string;
    if (executiveId) where.assignedToId = executiveId as string;

    const history = await prisma.leadAssignment.findMany({
      where,
      orderBy: { assignedAt: 'desc' },
      take: 100,
      include: {
        candidate: { select: { id: true, displaySlNo: true, name: true, primaryPhone: true } },
        assignedBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });

    return res.json({ history });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch assignment history' });
  }
});

export default router;
