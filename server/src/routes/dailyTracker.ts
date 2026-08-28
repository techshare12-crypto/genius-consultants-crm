import { Router, Response } from 'express';
import prisma from '../prisma/client';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/daily-tracker - Get permanent historical daily calling tracker
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      view = 'DAILY', // 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM'
      startDate,
      endDate,
      executiveId,
    } = req.query;

    const where: any = {};

    // Role check: Executive sees only their own data
    if (req.user!.role === 'EXECUTIVE') {
      where.executiveId = req.user!.id;
    } else if (executiveId && executiveId !== 'ALL') {
      where.executiveId = executiveId as string;
    }

    const today = new Date();
    if (view === 'DAILY') {
      // Last 14 days
      const past14 = new Date(today);
      past14.setDate(today.getDate() - 14);
      where.date = { gte: past14.toISOString().slice(0, 10) };
    } else if (view === 'WEEKLY') {
      // Last 8 weeks
      const past8Weeks = new Date(today);
      past8Weeks.setDate(today.getDate() - 56);
      where.date = { gte: past8Weeks.toISOString().slice(0, 10) };
    } else if (view === 'MONTHLY') {
      // Last 6 months
      const past6Months = new Date(today);
      past6Months.setMonth(today.getMonth() - 6);
      where.date = { gte: past6Months.toISOString().slice(0, 10) };
    } else if (startDate && endDate) {
      where.date = {
        gte: startDate as string,
        lte: endDate as string,
      };
    }

    const summaries = await prisma.dailyCallingSummary.findMany({
      where,
      orderBy: [
        { date: 'desc' },
        { totalAttemptsCount: 'desc' },
      ],
      include: {
        executive: {
          select: { id: true, name: true, email: true, targetCallsDaily: true, targetShortlistDaily: true },
        },
      },
    });

    // Compute aggregated overall totals across the selected period
    let totalAttempts = 0;
    let totalUniqueCalled = 0;
    let totalConfirmed = 0;
    let totalShortlisted = 0;
    let totalRNR = 0;
    let totalBusy = 0;
    let totalWrongNumber = 0;
    let totalNotInterested = 0;

    for (const s of summaries) {
      totalAttempts += s.totalAttemptsCount;
      totalUniqueCalled += s.uniqueCalledCount;
      totalConfirmed += s.confirmedCount;
      totalShortlisted += s.shortlistedCount;
      totalRNR += s.rnrCount;
      totalBusy += s.busyCallbackCount;
      totalWrongNumber += s.wrongNumberCount;
      totalNotInterested += s.notInterestedCount;
    }

    const overallConversion = totalUniqueCalled > 0
      ? parseFloat((((totalConfirmed + totalShortlisted) / totalUniqueCalled) * 100).toFixed(1))
      : 0;

    return res.json({
      summaries,
      totals: {
        totalAttempts,
        totalUniqueCalled,
        totalConfirmed,
        totalShortlisted,
        totalRNR,
        totalBusy,
        totalWrongNumber,
        totalNotInterested,
        overallConversion,
      },
    });
  } catch (err: any) {
    console.error('Daily tracker error:', err);
    return res.status(500).json({ error: 'Failed to fetch daily tracker summaries' });
  }
});

// GET /api/daily-tracker/performance - Executive Performance Tracker & Leaderboard
router.get('/performance', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

    // Fetch all active executives
    const executives = await prisma.user.findMany({
      where: { role: 'EXECUTIVE', status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        targetCallsDaily: true,
        targetShortlistDaily: true,
        _count: {
          select: {
            assignedCandidates: { where: { isDeleted: false } },
            callbacks: { where: { status: 'PENDING' } },
          },
        },
      },
    });

    // Today's stats per executive
    const todaySummaries = await prisma.dailyCallingSummary.findMany({
      where: { date: today },
    });
    const todayMap = new Map(todaySummaries.map(s => [s.executiveId, s]));

    // Monthly stats per executive
    const monthlySummaries = await prisma.dailyCallingSummary.findMany({
      where: { date: { gte: startOfMonth } },
    });

    const monthlyMap = new Map<string, { calls: number; shortlisted: number; confirmed: number; uniqueCalled: number }>();
    for (const ms of monthlySummaries) {
      const existing = monthlyMap.get(ms.executiveId) || { calls: 0, shortlisted: 0, confirmed: 0, uniqueCalled: 0 };
      existing.calls += ms.totalAttemptsCount;
      existing.shortlisted += ms.shortlistedCount;
      existing.confirmed += ms.confirmedCount;
      existing.uniqueCalled += ms.uniqueCalledCount;
      monthlyMap.set(ms.executiveId, existing);
    }

    const performanceList = executives.map(exec => {
      const todayData = todayMap.get(exec.id);
      const monthData = monthlyMap.get(exec.id) || { calls: 0, shortlisted: 0, confirmed: 0, uniqueCalled: 0 };

      const assigned = exec._count.assignedCandidates;
      const todayCalls = todayData?.totalAttemptsCount || 0;
      const todayUnique = todayData?.uniqueCalledCount || 0;
      const todayShortlisted = todayData?.shortlistedCount || 0;
      const todayConfirmed = todayData?.confirmedCount || 0;
      const pendingCallbacks = exec._count.callbacks;

      const completionRate = assigned > 0 ? parseFloat(((todayUnique / assigned) * 100).toFixed(1)) : 0;
      const shortlistConversion = todayUnique > 0 ? parseFloat(((todayShortlisted / todayUnique) * 100).toFixed(1)) : 0;
      const confirmationConversion = todayUnique > 0 ? parseFloat(((todayConfirmed / todayUnique) * 100).toFixed(1)) : 0;

      const monthlyConversion = monthData.uniqueCalled > 0
        ? parseFloat((((monthData.shortlisted + monthData.confirmed) / monthData.uniqueCalled) * 100).toFixed(1))
        : 0;

      return {
        executive: {
          id: exec.id,
          name: exec.name,
          email: exec.email,
          targetCallsDaily: exec.targetCallsDaily,
          targetShortlistDaily: exec.targetShortlistDaily,
        },
        today: {
          assigned,
          callsDone: todayCalls,
          uniqueContacted: todayUnique,
          shortlisted: todayShortlisted,
          confirmed: todayConfirmed,
          pending: Math.max(0, assigned - todayUnique),
          pendingCallbacks,
          completionRate,
          shortlistConversion,
          confirmationConversion,
          targetAchievement: Math.min(100, parseFloat(((todayCalls / exec.targetCallsDaily) * 100).toFixed(1))),
        },
        month: {
          totalCalls: monthData.calls,
          totalShortlisted: monthData.shortlisted,
          totalConfirmed: monthData.confirmed,
          uniqueContacted: monthData.uniqueCalled,
          conversionPercentage: monthlyConversion,
        },
      };
    });

    // Sort leaderboard by today calls descending
    performanceList.sort((a, b) => b.today.callsDone - a.today.callsDone);

    return res.json({ performanceList });
  } catch (err: any) {
    console.error('Fetch performance error:', err);
    return res.status(500).json({ error: 'Failed to fetch executive performance' });
  }
});

export default router;
