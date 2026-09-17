import { prisma } from '@/server/db/prisma';
import { getStartAndEndOfDayIST } from '@/server/utils/date';

export interface ReportFilter {
  startDate?: string;
  endDate?: string;
  executiveId?: string;
  jobId?: string;
  companyId?: string;
}

export class ReportService {
  /**
   * Generates Operations Dashboard metrics dynamically from the database.
   */
  static async getOperationsOverview(filter: ReportFilter) {
    const { start, end } = getStartAndEndOfDayIST(filter.startDate);

    // Call logs in period
    const callWhere: any = {};
    if (filter.startDate) callWhere.createdAt = { gte: start, lte: end };
    if (filter.executiveId) callWhere.executiveId = filter.executiveId;

    const callLogs = await prisma.callLog.findMany({ where: callWhere });

    const totalAttempts = callLogs.length;
    const connectedCalls = callLogs.filter((c) => c.callOutcome === 'CONNECTED').length;
    const rnrCalls = callLogs.filter((c) => c.callOutcome === 'RNR').length;
    const callbacksLogged = callLogs.filter((c) => c.callbackRequired || c.callOutcome === 'CALLBACK').length;
    const interestedCalls = callLogs.filter((c) => c.callOutcome === 'INTERESTED').length;
    const shortlistedCalls = callLogs.filter((c) => c.callOutcome === 'SHORTLISTED').length;

    // Applications in period
    const apps = await prisma.application.findMany({
      include: {
        job: { select: { jobTitle: true, company: { select: { companyName: true } } } },
        assignedExecutive: { select: { id: true, fullName: true } },
      },
    });

    const totalApplications = apps.length;
    const totalAssigned = apps.filter((a) => a.assignedExecutiveId !== null).length;
    const formPending = apps.filter((a) => a.currentStage === 'SHORTLISTED' && a.formStatus === 'PENDING').length;
    const formReceived = apps.filter((a) => a.formStatus === 'RECEIVED').length;
    const cvPending = apps.filter((a) => a.currentStage === 'SHORTLISTED' && a.cvStatus !== 'CV_RECEIVED').length;
    const cvReceived = apps.filter((a) => a.cvStatus === 'CV_RECEIVED' || a.cvStatus === 'VERIFIED').length;
    const screeningPending = apps.filter((a) => a.currentStage === 'SCREENING_PENDING' || a.currentStage === 'SCREENING_IN_PROGRESS').length;
    const screeningPassed = apps.filter((a) => a.currentStage === 'SCREENING_PASSED').length;
    const finalShortlist = apps.filter((a) => a.currentStage === 'FINAL_SHORTLIST').length;
    const sentToClient = apps.filter((a) => a.currentStage === 'SENT_TO_CLIENT').length;
    const interviewPending = apps.filter((a) => a.currentStage === 'INTERVIEW_SCHEDULED' || a.currentStage === 'INTERVIEW_PENDING').length;
    const selected = apps.filter((a) => a.currentStage === 'SELECTED' || a.currentStage === 'JOINING_PENDING').length;
    const joined = apps.filter((a) => a.currentStage === 'JOINED').length;

    // Conversion Rates with numerators & denominators
    const connectionRate = totalAttempts > 0 ? (connectedCalls / totalAttempts) * 100 : 0;
    const interestRate = connectedCalls > 0 ? (interestedCalls / connectedCalls) * 100 : 0;
    const shortlistRate = connectedCalls > 0 ? (shortlistedCalls / connectedCalls) * 100 : 0;
    const screeningPassRate = (screeningPassed + finalShortlist + sentToClient + selected + joined) > 0 ? ((screeningPassed + finalShortlist + sentToClient + selected + joined) / (formReceived || 1)) * 100 : 0;
    const selectionRate = (interviewPending + selected + joined) > 0 ? ((selected + joined) / (interviewPending + selected + joined)) * 100 : 0;
    const joiningRate = (selected + joined) > 0 ? (joined / (selected + joined)) * 100 : 0;

    return {
      calling: {
        totalAttempts,
        connectedCalls,
        rnrCalls,
        callbacksLogged,
        interestedCalls,
        shortlistedCalls,
      },
      pipeline: {
        totalApplications,
        totalAssigned,
        formPending,
        formReceived,
        cvPending,
        cvReceived,
        screeningPending,
        screeningPassed,
        finalShortlist,
        sentToClient,
        interviewPending,
        selected,
        joined,
      },
      conversions: {
        connectionRate: { value: parseFloat(connectionRate.toFixed(1)), numerator: connectedCalls, denominator: totalAttempts },
        interestRate: { value: parseFloat(interestRate.toFixed(1)), numerator: interestedCalls, denominator: connectedCalls },
        shortlistRate: { value: parseFloat(shortlistRate.toFixed(1)), numerator: shortlistedCalls, denominator: connectedCalls },
        screeningPassRate: { value: parseFloat(screeningPassRate.toFixed(1)), numerator: screeningPassed + finalShortlist, denominator: formReceived },
        selectionRate: { value: parseFloat(selectionRate.toFixed(1)), numerator: selected + joined, denominator: interviewPending + selected + joined },
        joiningRate: { value: parseFloat(joiningRate.toFixed(1)), numerator: joined, denominator: selected + joined },
      },
    };
  }

  /**
   * Generates Executive Performance Matrix.
   */
  static async getExecutivePerformanceMatrix() {
    const executives = await prisma.user.findMany({
      where: {
        userRoles: {
          some: {
            role: { name: { in: ['EXECUTIVE', 'SCREENING_MANAGER'] } },
          },
        },
      },
      include: {
        assignedApplications: true,
        callLogs: true,
        callbacks: true,
        qualityReviewsReceived: true,
      },
    });

    return executives.map((exec) => {
      const calls = exec.callLogs;
      const totalCalls = calls.length;
      const connected = calls.filter((c) => c.callOutcome === 'CONNECTED').length;
      const rnr = calls.filter((c) => c.callOutcome === 'RNR').length;
      const callbacks = exec.callbacks.length;
      const callbacksDone = exec.callbacks.filter((cb) => cb.status === 'COMPLETED').length;
      const shortlisted = exec.assignedApplications.filter((a) =>
        ['SHORTLISTED', 'SCREENING_PENDING', 'SCREENING_PASSED', 'FINAL_SHORTLIST', 'SENT_TO_CLIENT', 'INTERVIEW_SCHEDULED', 'SELECTED', 'JOINED'].includes(a.currentStage)
      ).length;

      const conversion = connected > 0 ? (shortlisted / connected) * 100 : 0;
      const qualityScores = exec.qualityReviewsReceived;
      const avgQuality = qualityScores.length > 0 ? qualityScores.reduce((sum, q) => sum + q.rating, 0) / qualityScores.length : null;

      const idleMinutes = exec.lastActivityAt
        ? Math.max(0, Math.floor((Date.now() - new Date(exec.lastActivityAt).getTime()) / 60000))
        : null;

      return {
        id: exec.id,
        name: exec.fullName,
        email: exec.email,
        presenceStatus: exec.presenceStatus,
        lastActivityAt: exec.lastActivityAt,
        idleMinutes,
        assignedLeads: exec.assignedApplications.length,
        totalCalls,
        connected,
        rnr,
        callbacks,
        callbacksCompleted: callbacksDone,
        shortlisted,
        conversionRate: parseFloat(conversion.toFixed(1)),
        qualityRating: avgQuality ? parseFloat(avgQuality.toFixed(1)) : 'N/A',
      };
    });
  }

  /**
   * Generates Location-wise Calling Tracker (matching the DAILY CALLING TRACKER requirement dynamically).
   */
  static async getLocationWiseCallingTracker() {
    const candidates = await prisma.candidate.findMany({
      include: {
        applications: {
          include: { callLogs: true },
        },
      },
    });

    const locationMap: Record<string, {
      location: string;
      totalLeads: number;
      rnr: number;
      callbacks: number;
      shortlisted: number;
      notInterested: number;
      connected: number;
    }> = {};

    for (const c of candidates) {
      const loc = c.currentLocation || 'Unknown';
      if (!locationMap[loc]) {
        locationMap[loc] = {
          location: loc,
          totalLeads: 0,
          rnr: 0,
          callbacks: 0,
          shortlisted: 0,
          notInterested: 0,
          connected: 0,
        };
      }

      locationMap[loc].totalLeads++;

      for (const app of c.applications) {
        for (const log of app.callLogs) {
          if (log.callOutcome === 'RNR') locationMap[loc].rnr++;
          if (log.callOutcome === 'CALLBACK' || log.callbackRequired) locationMap[loc].callbacks++;
          if (log.callOutcome === 'SHORTLISTED') locationMap[loc].shortlisted++;
          if (log.callOutcome === 'NOT_INTERESTED') locationMap[loc].notInterested++;
          if (log.callOutcome === 'CONNECTED') locationMap[loc].connected++;
        }
      }
    }

    return Object.values(locationMap).sort((a, b) => b.totalLeads - a.totalLeads);
  }
}
