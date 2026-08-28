import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { authenticate, AuthenticatedRequest, requirePermission, requireRoles } from '../middleware/auth';
import { logActivity } from '../services/audit';
import { createAndEmitNotification } from '../services/socket';

const router = Router();

// GET /api/teams - List Teams (Filtered by role)
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const isSuperOrAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
    const isLeader = user.role === 'TEAM_LEADER';

    const where: any = { status: 'ACTIVE' };
    if (isLeader && !isSuperOrAdmin) {
      where.teamLeaderId = user.id;
    } else if (user.role === 'EXECUTIVE') {
      where.memberships = { some: { userId: user.id, status: 'ACTIVE' } };
    }

    const teams = await prisma.team.findMany({
      where,
      include: {
        teamLeader: { select: { id: true, name: true, email: true, phone: true } },
        memberships: {
          where: { status: 'ACTIVE' },
          include: {
            user: { select: { id: true, name: true, email: true, phone: true, targetCallsDaily: true } },
          },
        },
      },
      orderBy: { teamName: 'asc' },
    });

    const sanitized = teams.map((t) => ({
      id: t.id,
      teamName: t.teamName,
      status: t.status,
      createdAt: t.createdAt,
      teamLeader: t.teamLeader,
      memberCount: t.memberships.length,
      members: t.memberships.map((m) => m.user),
    }));

    return res.json({ teams: sanitized });
  } catch (err: any) {
    console.error('Fetch teams error:', err);
    return res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// GET /api/teams/:id/dashboard - Team Leader Dedicated Dashboard Telemetry
router.get('/:id/dashboard', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = req.user!;
    const isSuperOrAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';

    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        teamLeader: { select: { id: true, name: true, email: true } },
        memberships: {
          where: { status: 'ACTIVE' },
          include: {
            user: { select: { id: true, name: true, email: true, phone: true, targetCallsDaily: true, targetShortlistDaily: true } },
          },
        },
      },
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const t = team as any;

    // Authorization Boundary Check
    if (!isSuperOrAdmin && t.teamLeaderId !== user.id) {
      return res.status(403).json({ error: 'Access denied: You are not authorized to view this team dashboard' });
    }

    const memberUserIds = (t.memberships || []).map((m: any) => m.userId);
    const todayStr = new Date().toISOString().slice(0, 10);

    // Fetch team candidates, activities today, callbacks, shortlists
    const [teamCandidates, activitiesToday, callbacks, shortlists] = await Promise.all([
      prisma.candidate.findMany({
        where: { assignedExecutiveId: { in: memberUserIds }, isDeleted: false },
        select: { id: true, assignedExecutiveId: true, leadStage: true },
      }),
      prisma.callActivity.findMany({
        where: { executiveId: { in: memberUserIds }, callDate: todayStr },
        select: { id: true, executiveId: true, outcome: true, durationSeconds: true },
      }),
      prisma.callback.findMany({
        where: { executiveId: { in: memberUserIds }, status: 'PENDING' },
        select: { id: true, executiveId: true, callbackDate: true, priority: true },
      }),
      prisma.shortlistRecord.findMany({
        where: { shortlistedById: { in: memberUserIds } },
        select: { id: true, shortlistedById: true, shortlistStatus: true },
      }),
    ]);

    const totalLeadsAssigned = teamCandidates.length;
    const callsDoneToday = activitiesToday.length;
    const pendingCallbacks = callbacks.length;
    const overdueCallbacks = callbacks.filter((c) => c.callbackDate < todayStr).length;
    const dueTodayCallbacks = callbacks.filter((c) => c.callbackDate === todayStr).length;
    const shortlistedCount = shortlists.length;
    const confirmedCount = activitiesToday.filter((a) => a.outcome === 'CONFIRMED' || a.outcome === 'SHORTLISTED').length;

    // Per-Executive Breakdown
    const executiveStats = (t.memberships || []).map((m: any) => {
      const exec = m.user;
      const execLeads = teamCandidates.filter((c) => c.assignedExecutiveId === exec.id);
      const execCalls = activitiesToday.filter((a) => a.executiveId === exec.id);
      const execCallbacks = callbacks.filter((c) => c.executiveId === exec.id);
      const execShortlists = shortlists.filter((s) => s.shortlistedById === exec.id);

      const target = exec.targetCallsDaily || 100;
      const completionRate = target > 0 ? parseFloat(((execCalls.length / target) * 100).toFixed(1)) : 0;
      const conversionRate = execCalls.length > 0 ? parseFloat(((execShortlists.length / execCalls.length) * 100).toFixed(1)) : 0;

      return {
        executive: exec,
        assignedLeadsCount: execLeads.length,
        callsDoneToday: execCalls.length,
        pendingCallbacksCount: execCallbacks.length,
        overdueCallbacksCount: execCallbacks.filter((c) => c.callbackDate < todayStr).length,
        shortlistedCount: execShortlists.length,
        targetCallsDaily: target,
        completionRate,
        conversionRate,
      };
    });

    return res.json({
      team: {
        id: t.id,
        teamName: t.teamName,
        teamLeader: t.teamLeader,
        memberCount: (t.memberships || []).length,
      },
      summary: {
        activeExecutives: (t.memberships || []).length,
        totalLeadsAssigned,
        callsDoneToday,
        pendingCallbacks,
        dueTodayCallbacks,
        overdueCallbacks,
        shortlistedCount,
        confirmedCount,
      },
      executiveStats,
    });
  } catch (err: any) {
    console.error('Team dashboard error:', err);
    return res.status(500).json({ error: 'Failed to fetch team dashboard data' });
  }
});

// GET /api/teams/:id/leads - Team Leads (Strict server-side team boundary check)
router.get('/:id/leads', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = req.user!;
    const isSuperOrAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';

    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        memberships: { where: { status: 'ACTIVE' }, select: { userId: true } },
      },
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const t = team as any;

    if (!isSuperOrAdmin && t.teamLeaderId !== user.id) {
      return res.status(403).json({ error: 'Access denied: You cannot view leads for another team' });
    }

    const memberUserIds = (t.memberships || []).map((m: any) => m.userId);

    const candidates = await prisma.candidate.findMany({
      where: {
        assignedExecutiveId: { in: memberUserIds },
        isDeleted: false,
      },
      include: {
        assignedExecutive: { select: { id: true, name: true, email: true } },
        callActivities: { take: 1, orderBy: { createdAt: 'desc' } },
        callbacks: { where: { status: 'PENDING' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    return res.json({ candidates });
  } catch (err: any) {
    console.error('Team leads error:', err);
    return res.status(500).json({ error: 'Failed to fetch team leads' });
  }
});

// POST /api/teams - Create Team (Admin/Super Admin only)
router.post('/', authenticate, requireRoles('SUPER_ADMIN', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { teamName, teamLeaderId, executiveIds = [] } = req.body;

    if (!teamName || !teamLeaderId) {
      return res.status(400).json({ error: 'Team Name and Team Leader ID are required' });
    }

    const leader = await prisma.user.findUnique({ where: { id: teamLeaderId } });
    if (!leader) {
      return res.status(404).json({ error: 'Selected Team Leader user not found' });
    }

    // Ensure role is TEAM_LEADER if not already Admin/SuperAdmin
    if (leader.role === 'EXECUTIVE') {
      await prisma.user.update({
        where: { id: teamLeaderId },
        data: { role: 'TEAM_LEADER' },
      });
    }

    const newTeam = await prisma.team.create({
      data: {
        id: uuidv4(),
        teamName: teamName.trim(),
        teamLeaderId,
        createdById: req.user!.id,
        status: 'ACTIVE',
      },
    });

    // Add member executives
    if (Array.isArray(executiveIds) && executiveIds.length > 0) {
      for (const execId of executiveIds) {
        await prisma.teamMembership.create({
          data: {
            id: uuidv4(),
            teamId: newTeam.id,
            userId: execId,
            status: 'ACTIVE',
          },
        });
      }
    }

    await logActivity({
      userId: req.user!.id,
      action: 'TEAM_CREATED',
      details: `Created new team: ${newTeam.teamName} with Team Leader ${leader.name}`,
    });

    return res.status(201).json({ team: newTeam });
  } catch (err: any) {
    console.error('Create team error:', err);
    return res.status(500).json({ error: 'Failed to create team' });
  }
});

// POST /api/teams/:id/members - Add Executive to Team
router.post('/:id/members', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { userId } = req.body;
    const user = req.user!;
    const isSuperOrAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';

    const team = await prisma.team.findUnique({ where: { id } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    if (!isSuperOrAdmin && team.teamLeaderId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const exec = await prisma.user.findUnique({ where: { id: userId as string } });
    if (!exec) return res.status(404).json({ error: 'Executive not found' });

    // Upsert membership
    const membership = await prisma.teamMembership.upsert({
      where: { teamId_userId: { teamId: id, userId: userId as string } },
      create: {
        id: uuidv4(),
        teamId: id,
        userId,
        status: 'ACTIVE',
      },
      update: {
        status: 'ACTIVE',
        leftAt: null,
      },
    });

    // Notify executive
    await createAndEmitNotification({
      userId,
      type: 'SYSTEM',
      title: 'Added to Team',
      message: `You have been added to ${team.teamName} by Team Leader.`,
      entityType: 'TEAM',
      entityId: team.id,
    });

    await logActivity({
      userId: req.user!.id,
      action: 'EXECUTIVE_ADDED_TO_TEAM',
      details: `Added ${exec.name} to ${team.teamName}`,
    });

    return res.json({ membership });
  } catch (err: any) {
    console.error('Add member error:', err);
    return res.status(500).json({ error: 'Failed to add member to team' });
  }
});

// POST /api/teams/reassign-lead - Team Leader reassigns lead within own team
router.post('/reassign-lead', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { candidateId, toExecutiveId } = req.body;
    const user = req.user!;
    const isSuperOrAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';

    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    const prevExecId = candidate.assignedExecutiveId;

    // Boundary check for Team Leader
    if (!isSuperOrAdmin && user.role === 'TEAM_LEADER') {
      const myTeam = await prisma.team.findFirst({
        where: { teamLeaderId: user.id, status: 'ACTIVE' },
        include: { memberships: { where: { status: 'ACTIVE' } } },
      });

      if (!myTeam) return res.status(403).json({ error: 'No active team managed by you' });

      const memberIds = myTeam.memberships.map((m) => m.userId);
      if (!memberIds.includes(toExecutiveId)) {
        return res.status(403).json({ error: 'Target executive does not belong to your team' });
      }
    }

    const toExec = await prisma.user.findUnique({ where: { id: toExecutiveId } });
    if (!toExec) return res.status(404).json({ error: 'Target executive not found' });

    // Update candidate
    const updated = await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        assignedExecutiveId: toExecutiveId,
        leadStage: candidate.leadStage === 'NEW' ? 'ASSIGNED' : candidate.leadStage,
      },
    });

    // Record Lead Assignment Log
    await prisma.leadAssignment.create({
      data: {
        id: uuidv4(),
        candidateId,
        assignedById: user.id,
        assignedToId: toExecutiveId,
        previousExecutiveId: prevExecId,
        assignmentMode: 'REASSIGN_TEAM',
      },
    });

    // Real-Time Notification to recipient Executive
    await createAndEmitNotification({
      userId: toExecutiveId,
      type: 'LEAD_REASSIGNED',
      title: 'Lead Reassigned to You',
      message: `Lead ${candidate.name} (${candidate.displaySlNo}) has been reassigned to you.`,
      entityType: 'CANDIDATE',
      entityId: candidate.id,
    });

    await logActivity({
      userId: user.id,
      candidateId,
      action: 'LEAD_REASSIGNED_BY_LEADER',
      details: `Reassigned candidate ${candidate.name} to ${toExec.name}`,
    });

    return res.json({ candidate: updated });
  } catch (err: any) {
    console.error('Reassign lead error:', err);
    return res.status(500).json({ error: 'Failed to reassign lead' });
  }
});

// POST /api/teams/coaching-notes - Add coaching note
router.post('/coaching-notes', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { executiveId, note, category = 'PERFORMANCE', visibility = 'VISIBLE_TO_EXECUTIVE' } = req.body;
    const user = req.user!;

    if (!executiveId || !note) {
      return res.status(400).json({ error: 'Executive ID and Note text are required' });
    }

    const coachingNote = await prisma.coachingNote.create({
      data: {
        id: uuidv4(),
        executiveId,
        teamLeaderId: user.id,
        note: note.trim(),
        category,
        visibility,
      },
      include: {
        teamLeader: { select: { id: true, name: true } },
        executive: { select: { id: true, name: true } },
      },
    });

    if (visibility === 'VISIBLE_TO_EXECUTIVE') {
      await createAndEmitNotification({
        userId: executiveId,
        type: 'COACHING_NOTE',
        title: 'New Coaching Note from Team Leader',
        message: `Your Team Leader left a note: "${note.slice(0, 60)}..."`,
        entityType: 'COACHING_NOTE',
        entityId: coachingNote.id,
      });
    }

    await logActivity({
      userId: user.id,
      action: 'COACHING_NOTE_ADDED',
      details: `Added coaching note for ${coachingNote.executive.name}: [${category}]`,
    });

    return res.status(201).json({ coachingNote });
  } catch (err: any) {
    console.error('Coaching note error:', err);
    return res.status(500).json({ error: 'Failed to add coaching note' });
  }
});

// GET /api/teams/coaching-notes/:executiveId - Get coaching notes for an executive
router.get('/coaching-notes/:executiveId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { executiveId } = req.params;
    const user = req.user!;

    const where: any = { executiveId };
    if (user.role === 'EXECUTIVE' && user.id === executiveId) {
      where.visibility = 'VISIBLE_TO_EXECUTIVE';
    }

    const notes = await prisma.coachingNote.findMany({
      where,
      include: {
        teamLeader: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ notes });
  } catch (err: any) {
    console.error('Fetch coaching notes error:', err);
    return res.status(500).json({ error: 'Failed to fetch coaching notes' });
  }
});

export default router;
