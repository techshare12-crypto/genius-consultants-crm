import { Router, Response } from 'express';
import prisma from '../prisma/client';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/dashboard - Main executive & operations dashboard metrics
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

    const isExec = req.user!.role === 'EXECUTIVE';
    const userFilter = isExec ? { assignedExecutiveId: req.user!.id } : {};
    const callExecFilter = isExec ? { executiveId: req.user!.id } : {};

    // 1. All Time Metrics
    const [totalCandidates, totalActiveLeads, totalShortlistedAllTime, totalSentToHrAllTime] = await Promise.all([
      prisma.candidate.count({ where: { isDeleted: false, ...userFilter } }),
      prisma.candidate.count({
        where: {
          isDeleted: false,
          leadStage: { notIn: ['NOT_INTERESTED', 'INVALID', 'REJECTED', 'SENT_TO_HR'] },
          ...userFilter,
        },
      }),
      prisma.shortlistRecord.count({
        where: isExec ? { candidate: { assignedExecutiveId: req.user!.id, isDeleted: false } } : { candidate: { isDeleted: false } },
      }),
      prisma.candidateSubmission.count({
        where: isExec ? { candidate: { assignedExecutiveId: req.user!.id } } : {},
      }),
    ]);

    // 2. User Management Operational Stats
    const [totalActiveAdmins, totalActiveExecutives, totalActiveAll] = await Promise.all([
      prisma.user.count({ where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] }, status: 'ACTIVE' } }),
      prisma.user.count({ where: { role: 'EXECUTIVE', status: 'ACTIVE' } }),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
    ]);

    // 3. Today's Calling Metrics
    const todayCalls = await prisma.callActivity.findMany({
      where: {
        callDate: today,
        ...callExecFilter,
      },
      select: {
        candidateId: true,
        executiveId: true,
        outcome: true,
      },
    });

    const todayAttempts = todayCalls.length;
    const todayUnique = new Set(todayCalls.map(c => c.candidateId)).size;
    const todayInterested = todayCalls.filter(c => c.outcome === 'INTERESTED').length;
    const todayShortlisted = todayCalls.filter(c => c.outcome === 'SHORTLISTED').length;
    const todayNotInterested = todayCalls.filter(c => c.outcome === 'NOT_INTERESTED' || c.outcome === 'NOT_ELIGIBLE').length;
    const todayRNR = todayCalls.filter(c => c.outcome === 'RNR' || c.outcome === 'NO_ANSWER' || c.outcome === 'SWITCHED_OFF').length;
    const todayBusy = todayCalls.filter(c => c.outcome === 'BUSY' || c.outcome === 'CALLBACK' || c.outcome === 'CALL_BACK').length;
    const todayWrongNumber = todayCalls.filter(c => c.outcome === 'WRONG_NUMBER' || c.outcome === 'NUMBER_INVALID').length;
    const todayConnected = todayAttempts - todayRNR - todayWrongNumber;

    // Real Operations Pipeline Today
    const [formsSentToday, formsCompletedToday, cvReceivedToday, readyToSendCount, sentToHrToday] = await Promise.all([
      prisma.shortlistRecord.count({ where: { formSentAt: { gte: todayStart } } }),
      prisma.shortlistRecord.count({ where: { formCompletedAt: { gte: todayStart } } }),
      prisma.shortlistRecord.count({ where: { cvReceivedAt: { gte: todayStart } } }),
      prisma.shortlistRecord.count({ where: { shortlistStatus: 'READY_TO_SEND' } }),
      prisma.candidateSubmission.count({ where: { submissionDate: { gte: todayStart } } }),
    ]);

    // Executives active today
    const activeExecsTodaySet = new Set(todayCalls.map(c => c.executiveId));
    const executivesWorkingToday = activeExecsTodaySet.size;
    const executivesInactiveToday = Math.max(0, totalActiveExecutives - executivesWorkingToday);

    // Callbacks
    const [overdueCallbacksCount, todayCallbacksCount] = await Promise.all([
      prisma.callback.count({
        where: {
          status: 'PENDING',
          callbackDate: { lt: today },
          ...callExecFilter,
        },
      }),
      prisma.callback.count({
        where: {
          status: 'PENDING',
          callbackDate: today,
          ...callExecFilter,
        },
      }),
    ]);

    // 4. Month's Metrics
    const monthCalls = await prisma.callActivity.findMany({
      where: {
        callDate: { gte: startOfMonth },
        ...callExecFilter,
      },
      select: {
        candidateId: true,
        outcome: true,
      },
    });

    const monthAttempts = monthCalls.length;
    const monthUnique = new Set(monthCalls.map(c => c.candidateId)).size;
    const monthShortlisted = monthCalls.filter(c => c.outcome === 'SHORTLISTED').length;
    const monthConversionRate = monthUnique > 0
      ? parseFloat(((monthShortlisted / monthUnique) * 100).toFixed(1))
      : 0;

    // 5. Last 7 Days Calling Trend
    const past7Days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      past7Days.push(d.toISOString().slice(0, 10));
    }

    const past7Calls = await prisma.callActivity.findMany({
      where: {
        callDate: { in: past7Days },
        ...callExecFilter,
      },
      select: {
        callDate: true,
        outcome: true,
      },
    });

    const trendMap: Record<string, { date: string; totalCalls: number; connected: number; shortlisted: number }> = {};
    for (const d of past7Days) {
      trendMap[d] = { date: d.slice(5), totalCalls: 0, connected: 0, shortlisted: 0 };
    }

    for (const call of past7Calls) {
      if (trendMap[call.callDate]) {
        trendMap[call.callDate].totalCalls++;
        if (!['RNR', 'NO_ANSWER', 'SWITCHED_OFF', 'WRONG_NUMBER', 'NUMBER_INVALID'].includes(call.outcome)) {
          trendMap[call.callDate].connected++;
        }
        if (call.outcome === 'SHORTLISTED') trendMap[call.callDate].shortlisted++;
      }
    }

    // 6. Status-wise Distribution
    const stages = await prisma.candidate.groupBy({
      by: ['leadStage'],
      where: { isDeleted: false, ...userFilter },
      _count: { id: true },
    });

    const statusDistribution = stages.map(s => ({
      stage: s.leadStage,
      count: s._count.id,
    }));

    // 7. Upcoming & Overdue Callbacks List
    const upcomingCallbacks = await prisma.callback.findMany({
      where: {
        status: 'PENDING',
        callbackDate: { lte: today },
        ...callExecFilter,
      },
      orderBy: [
        { priority: 'asc' },
        { callbackDate: 'asc' },
        { callbackTime: 'asc' },
      ],
      take: 6,
      include: {
        candidate: {
          select: { id: true, name: true, primaryPhone: true, currentLocation: true },
        },
        executive: { select: { id: true, name: true } },
      },
    });

    // 8. Recent Activity Feed
    const recentActivities = await prisma.activityLog.findMany({
      where: isExec ? { userId: req.user!.id } : {},
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: {
        user: { select: { id: true, name: true, role: true } },
        candidate: { select: { id: true, name: true, displaySlNo: true } },
      },
    });

    // 9. Active Company Requirements summary
    const companyRequirements = await prisma.jobOrder.findMany({
      where: { status: 'OPEN' },
      select: {
        id: true,
        jobTitle: true,
        numberOfVacancies: true,
        jobLocation: true,
        client: { select: { companyName: true } },
        _count: { select: { applications: true } },
      },
      take: 5,
    });

    return res.json({
      userStats: {
        totalActiveAdmins,
        totalActiveExecutives,
        totalActiveAll,
        executivesWorkingToday,
        executivesInactiveToday,
        totalLeadsAssignedToday: totalCandidates,
        callsCompletedToday: todayAttempts,
        pendingCalls: Math.max(0, totalCandidates - todayUnique),
        totalShortlistedToday: todayShortlisted,
      },
      today: {
        totalLeadsAssigned: totalCandidates,
        totalCallsAttempted: todayAttempts,
        connectedCalls: todayConnected,
        interested: todayInterested,
        shortlisted: todayShortlisted,
        formsSent: formsSentToday,
        formsCompleted: formsCompletedToday,
        cvReceived: cvReceivedToday,
        readyToSend: readyToSendCount,
        sentToHr: sentToHrToday,
        notInterested: todayNotInterested,
        rnr: todayRNR,
        busyCallBack: todayBusy,
        wrongNumber: todayWrongNumber,
        pendingCalls: Math.max(0, totalCandidates - todayUnique),
        overdueCallbacks: overdueCallbacksCount,
        todayCallbacks: todayCallbacksCount,
      },
      month: {
        totalCalls: monthAttempts,
        uniqueCandidatesContacted: monthUnique,
        totalShortlisted: monthShortlisted,
        conversionRate: monthConversionRate,
      },
      allTime: {
        totalCandidates,
        totalActiveLeads,
        totalShortlisted: totalShortlistedAllTime,
        totalSentToHr: totalSentToHrAllTime,
      },
      trend: Object.values(trendMap),
      statusDistribution,
      upcomingCallbacks,
      recentActivities,
      companyRequirements,
    });
  } catch (err: any) {
    console.error('Dashboard metrics error:', err);
    return res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

export default router;
