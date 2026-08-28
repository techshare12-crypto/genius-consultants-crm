import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { logActivity } from '../services/audit';
import { calculateLeadPriorityScore } from '../utils/priority';

const router = Router();

// GET /api/calling/workspace - Get smart prioritized work queue for telecalling executive
router.get('/workspace', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const executiveId = req.user!.role === 'EXECUTIVE' ? req.user!.id : (req.query.executiveId as string || req.user!.id);
    const today = new Date().toISOString().slice(0, 10);

    // Fetch assigned candidates not soft-deleted
    const candidates = await prisma.candidate.findMany({
      where: {
        isDeleted: false,
        assignedExecutiveId: executiveId,
      },
      include: {
        callActivities: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        callbacks: {
          where: { status: 'PENDING' },
          orderBy: { callbackDate: 'asc' },
        },
        shortlistRecord: true,
      },
      orderBy: [
        { leadPriorityScore: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    // Categorize for smart queue:
    // 1. Overdue Callbacks
    // 2. Today's Callbacks
    // 3. Fresh uncalled leads (0 attempts)
    // 4. In-progress / follow-up leads
    const overdueCallbacks: any[] = [];
    const todayCallbacks: any[] = [];
    const freshLeads: any[] = [];
    const followups: any[] = [];

    for (const c of candidates) {
      const pendingCallback = c.callbacks.find(cb => cb.status === 'PENDING');
      if (pendingCallback) {
        if (pendingCallback.callbackDate < today) {
          overdueCallbacks.push(c);
        } else if (pendingCallback.callbackDate === today) {
          todayCallbacks.push(c);
        } else {
          followups.push(c);
        }
      } else if (c.callActivities.length === 0) {
        freshLeads.push(c);
      } else {
        followups.push(c);
      }
    }

    return res.json({
      summary: {
        totalAssigned: candidates.length,
        overdueCount: overdueCallbacks.length,
        todayCallbackCount: todayCallbacks.length,
        freshCount: freshLeads.length,
        followupCount: followups.length,
      },
      queue: [...overdueCallbacks, ...todayCallbacks, ...freshLeads, ...followups],
      sections: {
        overdueCallbacks,
        todayCallbacks,
        freshLeads,
        followups,
      },
    });
  } catch (err: any) {
    console.error('Workspace queue error:', err);
    return res.status(500).json({ error: 'Failed to load calling workspace queue' });
  }
});

// POST /api/calling/log - Log a call attempt with immutable history
router.post('/log', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      candidateId,
      outcome, // 'CONFIRMED', 'SHORTLISTED', 'NOT_INTERESTED', 'RNR', 'BUSY', 'CALL_BACK', 'WRONG_NUMBER', 'SWITCHED_OFF', 'NUMBER_INVALID', 'ALREADY_EMPLOYED', 'NOT_ELIGIBLE', 'DUPLICATE', 'OTHER'
      remarks,
      durationSeconds = 0,
      callbackDate, // YYYY-MM-DD (optional or mandatory if CALL_BACK / BUSY)
      callbackTime, // HH:mm
      callbackPriority = 'MEDIUM',
      // Optional inline updates on candidate info during call
      updateCandidateDetails,
    } = req.body;

    if (!candidateId || !outcome) {
      return res.status(400).json({ error: 'Candidate ID and Call Outcome are required' });
    }

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        callActivities: true,
        shortlistRecord: true,
      },
    });

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Role check: Executive can only call assigned candidate
    if (req.user!.role === 'EXECUTIVE' && candidate.assignedExecutiveId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied: Candidate is not assigned to you' });
    }

    const now = new Date();
    const callDate = now.toISOString().slice(0, 10);
    const callTime = now.toTimeString().slice(0, 8);
    const callActivityId = uuidv4();

    // 1. Create immutable Call Activity record
    const callActivity = await prisma.callActivity.create({
      data: {
        id: callActivityId,
        candidateId,
        executiveId: req.user!.id,
        callDate,
        callTime,
        outcome,
        remarks: remarks ? remarks.trim() : null,
        durationSeconds: Number(durationSeconds) || 0,
      },
    });

    // 2. Map Call Outcome to Lead Stage
    let newLeadStage = candidate.leadStage;
    if (outcome === 'SHORTLISTED') newLeadStage = 'SHORTLISTED';
    else if (outcome === 'CONFIRMED') newLeadStage = 'CONFIRMED';
    else if (outcome === 'NOT_INTERESTED') newLeadStage = 'NOT_INTERESTED';
    else if (outcome === 'NUMBER_INVALID' || outcome === 'WRONG_NUMBER') newLeadStage = 'INVALID';
    else if (outcome === 'RNR' || outcome === 'SWITCHED_OFF') newLeadStage = 'RNR';
    else if (outcome === 'CALL_BACK' || outcome === 'BUSY') newLeadStage = 'CALLING_IN_PROGRESS';
    else if (newLeadStage === 'NEW' || newLeadStage === 'ASSIGNED') newLeadStage = 'CONTACTED';

    // 3. Handle Callbacks if scheduled
    let createdCallback = null;
    if ((outcome === 'CALL_BACK' || outcome === 'BUSY' || callbackDate) && callbackDate) {
      // Mark any prior pending callbacks for this candidate as rescheduled
      await prisma.callback.updateMany({
        where: {
          candidateId,
          status: 'PENDING',
        },
        data: {
          status: 'RESCHEDULED',
          cancelReason: `Rescheduled by new call on ${callDate}`,
        },
      });

      createdCallback = await prisma.callback.create({
        data: {
          id: uuidv4(),
          candidateId,
          executiveId: req.user!.id,
          callActivityId: callActivity.id,
          callbackDate,
          callbackTime: callbackTime || '11:00',
          priority: callbackPriority,
          status: 'PENDING',
        },
      });
    } else {
      // If call connected successfully or reached final status, mark pending callbacks completed
      if (['CONFIRMED', 'SHORTLISTED', 'NOT_INTERESTED', 'NUMBER_INVALID'].includes(outcome)) {
        await prisma.callback.updateMany({
          where: {
            candidateId,
            status: 'PENDING',
          },
          data: {
            status: 'COMPLETED',
          },
        });
      }
    }

    // 4. If outcome is SHORTLISTED, automatically create or link shortlist record
    if (outcome === 'SHORTLISTED') {
      const existingShortlist = await prisma.shortlistRecord.findUnique({
        where: { candidateId },
      });

      if (!existingShortlist) {
        await prisma.shortlistRecord.create({
          data: {
            id: uuidv4(),
            candidateId,
            shortlistedById: req.user!.id,
            shortlistStatus: 'NEWLY_SHORTLISTED',
            formFilled: 'PENDING',
            cvReceivedWhatsapp: 'PENDING',
            remarks: remarks || 'Shortlisted during call',
          },
        });
      }

      // Real-time notifications for Team Leader & Admins
      try {
        const { notifyTeamLeaderOfExecutive, notifyUsersByRole } = require('../services/socket');
        await notifyTeamLeaderOfExecutive(req.user!.id, {
          type: 'CANDIDATE_SHORTLISTED',
          title: 'Candidate Shortlisted',
          message: `${req.user!.name} shortlisted candidate ${candidate.name}.`,
          entityType: 'CANDIDATE',
          entityId: candidate.id,
        });
        await notifyUsersByRole(['SUPER_ADMIN', 'ADMIN'], {
          type: 'CANDIDATE_SHORTLISTED',
          title: 'Candidate Shortlisted',
          message: `${req.user!.name} shortlisted candidate ${candidate.name} (${candidate.displaySlNo}).`,
          entityType: 'CANDIDATE',
          entityId: candidate.id,
        });
      } catch (notifErr) {
        console.error('Shortlist notification error:', notifErr);
      }
    }

    // 5. Update candidate basic/professional info if provided during the call
    const candidateUpdates: any = {
      leadStage: newLeadStage,
    };

    if (updateCandidateDetails) {
      if (updateCandidateDetails.education !== undefined) candidateUpdates.education = updateCandidateDetails.education;
      if (updateCandidateDetails.totalExperienceYears !== undefined) candidateUpdates.totalExperienceYears = Number(updateCandidateDetails.totalExperienceYears);
      if (updateCandidateDetails.currentCompany !== undefined) candidateUpdates.currentCompany = updateCandidateDetails.currentCompany;
      if (updateCandidateDetails.currentSalary !== undefined) candidateUpdates.currentSalary = updateCandidateDetails.currentSalary;
      if (updateCandidateDetails.expectedSalary !== undefined) candidateUpdates.expectedSalary = updateCandidateDetails.expectedSalary;
      if (updateCandidateDetails.noticePeriod !== undefined) candidateUpdates.noticePeriod = updateCandidateDetails.noticePeriod;
      if (updateCandidateDetails.appliedLocation !== undefined) candidateUpdates.appliedLocation = updateCandidateDetails.appliedLocation;
      if (updateCandidateDetails.hasTwoWheeler !== undefined) candidateUpdates.hasTwoWheeler = Boolean(updateCandidateDetails.hasTwoWheeler);
      if (updateCandidateDetails.hasDrivingLicense !== undefined) candidateUpdates.hasDrivingLicense = Boolean(updateCandidateDetails.hasDrivingLicense);
      if (updateCandidateDetails.interestedInFieldSales !== undefined) candidateUpdates.interestedInFieldSales = Boolean(updateCandidateDetails.interestedInFieldSales);
      if (updateCandidateDetails.interestedInAutomobile !== undefined) candidateUpdates.interestedInAutomobile = Boolean(updateCandidateDetails.interestedInAutomobile);
      if (updateCandidateDetails.generalNotes !== undefined) candidateUpdates.generalNotes = updateCandidateDetails.generalNotes;
    }

    candidateUpdates.leadPriorityScore = calculateLeadPriorityScore({
      createdAt: candidate.createdAt,
      leadStage: newLeadStage,
      hasTwoWheeler: candidateUpdates.hasTwoWheeler ?? candidate.hasTwoWheeler,
      hasDrivingLicense: candidateUpdates.hasDrivingLicense ?? candidate.hasDrivingLicense,
      interestedInFieldSales: candidateUpdates.interestedInFieldSales ?? candidate.interestedInFieldSales,
      totalExperienceYears: candidateUpdates.totalExperienceYears ?? candidate.totalExperienceYears,
      callActivitiesCount: candidate.callActivities.length + 1,
      lastOutcome: outcome,
      email: candidate.email,
      currentLocation: candidate.currentLocation,
      education: candidateUpdates.education ?? candidate.education,
      expectedSalary: candidateUpdates.expectedSalary ?? candidate.expectedSalary,
    });

    const updatedCandidate = await prisma.candidate.update({
      where: { id: candidateId },
      data: candidateUpdates,
      include: {
        shortlistRecord: true,
        callbacks: { where: { status: 'PENDING' } },
      },
    });

    // 6. Update permanent Daily Calling Summary for today & executive
    await updateDailySummary(callDate, req.user!.id);

    // 7. Audit log
    await logActivity({
      userId: req.user!.id,
      candidateId,
      action: 'CALL_LOGGED',
      details: `Call logged: ${outcome} | Remarks: ${remarks || 'None'}`,
      oldValue: candidate.leadStage,
      newValue: newLeadStage,
    });

    return res.status(201).json({
      success: true,
      callActivity,
      candidate: updatedCandidate,
      callback: createdCallback,
    });
  } catch (err: any) {
    console.error('Log call error:', err);
    return res.status(500).json({ error: 'Failed to log call activity' });
  }
});

// Helper function to update permanent Daily Calling Summary record
export async function updateDailySummary(date: string, executiveId: string) {
  try {
    // Count all calls by this executive on this date
    const calls = await prisma.callActivity.findMany({
      where: {
        callDate: date,
        executiveId,
      },
      select: {
        candidateId: true,
        outcome: true,
      },
    });

    const totalAttempts = calls.length;
    const uniqueCandidates = new Set(calls.map(c => c.candidateId)).size;
    const confirmedCount = calls.filter(c => c.outcome === 'CONFIRMED').length;
    const shortlistedCount = calls.filter(c => c.outcome === 'SHORTLISTED').length;
    const notInterestedCount = calls.filter(c => c.outcome === 'NOT_INTERESTED').length;
    const rnrCount = calls.filter(c => c.outcome === 'RNR' || c.outcome === 'SWITCHED_OFF').length;
    const busyCallbackCount = calls.filter(c => c.outcome === 'BUSY' || c.outcome === 'CALL_BACK').length;
    const wrongNumberCount = calls.filter(c => c.outcome === 'WRONG_NUMBER' || c.outcome === 'NUMBER_INVALID').length;

    const assignedCount = await prisma.candidate.count({
      where: {
        assignedExecutiveId: executiveId,
        isDeleted: false,
      },
    });

    const pendingCount = Math.max(0, assignedCount - uniqueCandidates);
    const conversionRate = uniqueCandidates > 0 ? ((shortlistedCount + confirmedCount) / uniqueCandidates) * 100 : 0;

    await prisma.dailyCallingSummary.upsert({
      where: {
        date_executiveId: {
          date,
          executiveId,
        },
      },
      update: {
        assignedLeadsCount: assignedCount,
        uniqueCalledCount: uniqueCandidates,
        totalAttemptsCount: totalAttempts,
        confirmedCount,
        shortlistedCount,
        notInterestedCount,
        rnrCount,
        busyCallbackCount,
        wrongNumberCount,
        pendingCount,
        conversionRate: parseFloat(conversionRate.toFixed(1)),
      },
      create: {
        date,
        executiveId,
        assignedLeadsCount: assignedCount,
        uniqueCalledCount: uniqueCandidates,
        totalAttemptsCount: totalAttempts,
        confirmedCount,
        shortlistedCount,
        notInterestedCount,
        rnrCount,
        busyCallbackCount,
        wrongNumberCount,
        pendingCount,
        conversionRate: parseFloat(conversionRate.toFixed(1)),
      },
    });
  } catch (err) {
    console.error('Failed to update daily summary:', err);
  }
}

export default router;
