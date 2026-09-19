import { prisma } from '@/server/db/prisma';
import { getStartAndEndOfDayIST, formatISTDateTime, IST_TIMEZONE } from '@/server/utils/date';
import { AuthenticatedUser, hasPermission } from '@/server/middleware/auth';

export interface ReportFilter {
  startDate?: string;
  endDate?: string;
  executiveId?: string;
  jobId?: string;
  companyId?: string;
}

export interface ProductivityFilter {
  datePreset?: 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'CUSTOM';
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string;   // HH:mm
  executiveId?: string;
  teamId?: string;
  jobId?: string;
}

function getISTDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function resolveISTPeriod(filter: ProductivityFilter) {
  const now = new Date();
  const todayISTStr = getISTDateString(now);

  let startStr = todayISTStr;
  let endStr = todayISTStr;
  let label = 'Today';

  const preset = filter.datePreset || (filter.startDate ? 'CUSTOM' : 'TODAY');

  if (preset === 'YESTERDAY') {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    startStr = getISTDateString(yesterday);
    endStr = startStr;
    label = 'Yesterday';
  } else if (preset === 'LAST_7_DAYS') {
    const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    startStr = getISTDateString(sevenDaysAgo);
    endStr = todayISTStr;
    label = 'Last 7 Days';
  } else if (preset === 'LAST_30_DAYS') {
    const thirtyDaysAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    startStr = getISTDateString(thirtyDaysAgo);
    endStr = todayISTStr;
    label = 'Last 30 Days';
  } else if (preset === 'CUSTOM') {
    startStr = filter.startDate || todayISTStr;
    endStr = filter.endDate || filter.startDate || todayISTStr;
    label = `${startStr} to ${endStr}`;
  }

  let startMinutes: number | null = null;
  let endMinutes: number | null = null;

  if (filter.startTime && /^\d{1,2}:\d{2}$/.test(filter.startTime)) {
    const [h, m] = filter.startTime.split(':').map(Number);
    startMinutes = h * 60 + m;
  }

  if (filter.endTime && /^\d{1,2}:\d{2}$/.test(filter.endTime)) {
    const [h, m] = filter.endTime.split(':').map(Number);
    endMinutes = h * 60 + m;
  }

  const startUtc = new Date(`${startStr}T00:00:00.000+05:30`);
  const endUtc = new Date(`${endStr}T23:59:59.999+05:30`);

  return {
    startUtc,
    endUtc,
    startTimeMinutes: startMinutes,
    endTimeMinutes: endMinutes,
    displayRange: label,
  };
}

function isWithinISTTime(d: Date, startMinutes: number | null, endMinutes: number | null): boolean {
  if (startMinutes === null && endMinutes === null) return true;

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const h = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const m = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  const totalMin = h * 60 + m;

  if (startMinutes !== null && totalMin < startMinutes) return false;
  if (endMinutes !== null && totalMin > endMinutes) return false;
  return true;
}

function getISTHour(d: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(d);
  return parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
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
            role: { name: { in: ['EXECUTIVE', 'SCREENING_MANAGER', 'TEAM_LEAD'] } },
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
   * Generates Location-wise Calling Tracker.
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

  /**
   * Executive Productivity & Activity Analytics with IST time-range filtering,
   * Unique Leads Worked vs Calls Logged metrics, Hourly breakdowns, and RBAC enforcement.
   */
  static async getExecutiveProductivityAnalytics(
    filter: ProductivityFilter,
    currentUser: AuthenticatedUser
  ) {
    const { startUtc, endUtc, startTimeMinutes, endTimeMinutes, displayRange } = resolveISTPeriod(filter);

    // 1. Determine Executive Scope based on RBAC
    const hasCompanyView =
      currentUser.roles.includes('SUPER_ADMIN') ||
      currentUser.roles.includes('OPERATIONS_HEAD') ||
      hasPermission(currentUser, 'reports.operations');

    const isTeamLead = currentUser.roles.includes('TEAM_LEAD');

    const userWhere: any = {
      status: 'ACTIVE',
    };

    if (!hasCompanyView && !isTeamLead) {
      // Regular executive can only see their own productivity
      userWhere.id = currentUser.userId;
    } else if (isTeamLead && !hasCompanyView) {
      // Team lead sees their team members + themselves
      const ledTeams = await prisma.team.findMany({
        where: { teamLeadId: currentUser.userId },
        select: { id: true },
      });
      const teamIds = ledTeams.map((t) => t.id);
      userWhere.OR = [
        { id: currentUser.userId },
        { teamId: { in: teamIds } },
      ];
    }

    // Apply explicit filters if allowed
    if (filter.executiveId) {
      if (!hasCompanyView && !isTeamLead && filter.executiveId !== currentUser.userId) {
        throw new Error('Forbidden: You can only view your own productivity metrics.');
      }
      userWhere.id = filter.executiveId;
    }

    if (filter.teamId && hasCompanyView) {
      userWhere.teamId = filter.teamId;
    }

    // Fetch matching operational executives
    const executives = await prisma.user.findMany({
      where: userWhere,
      include: {
        team: { select: { id: true, name: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    const executiveIds = executives.map((e) => e.id);

    // 2. Fetch all relevant events in the UTC date window
    const [allCallLogs, allVerifications, allScreenings, allCallbacks, allAuditLogs, assignedCounts] = await Promise.all([
      prisma.callLog.findMany({
        where: {
          createdAt: { gte: startUtc, lte: endUtc },
          executiveId: { in: executiveIds },
          ...(filter.jobId ? { application: { jobId: filter.jobId } } : {}),
        },
        include: {
          application: {
            select: { id: true, jobId: true, candidateId: true },
          },
        },
      }),
      prisma.applicationVerification.findMany({
        where: {
          createdAt: { gte: startUtc, lte: endUtc },
          verifiedByUserId: { in: executiveIds },
          ...(filter.jobId ? { application: { jobId: filter.jobId } } : {}),
        },
        include: {
          application: { select: { id: true, jobId: true } },
        },
      }),
      prisma.screening.findMany({
        where: {
          createdAt: { gte: startUtc, lte: endUtc },
          screenerId: { in: executiveIds },
          ...(filter.jobId ? { application: { jobId: filter.jobId } } : {}),
        },
        include: {
          application: { select: { id: true, jobId: true } },
        },
      }),
      prisma.callback.findMany({
        where: {
          createdAt: { gte: startUtc, lte: endUtc },
          executiveId: { in: executiveIds },
        },
      }),
      prisma.auditLog.findMany({
        where: {
          createdAt: { gte: startUtc, lte: endUtc },
          userId: { in: executiveIds },
          entity: 'Application',
          action: { in: ['STAGE_UPDATE', 'ASSIGNMENT_CREATED', 'VERIFICATION_SAVED'] },
        },
      }),
      prisma.application.groupBy({
        by: ['assignedExecutiveId'],
        _count: { id: true },
        where: {
          assignedExecutiveId: { in: executiveIds },
          ...(filter.jobId ? { jobId: filter.jobId } : {}),
        },
      }),
    ]);

    // 3. Filter records by IST Time-of-Day Window (if specified)
    const callLogs = allCallLogs.filter((c) => isWithinISTTime(c.createdAt, startTimeMinutes, endTimeMinutes));
    const verifications = allVerifications.filter((v) => isWithinISTTime(v.createdAt, startTimeMinutes, endTimeMinutes));
    const screenings = allScreenings.filter((s) => isWithinISTTime(s.createdAt, startTimeMinutes, endTimeMinutes));
    const callbacks = allCallbacks.filter((cb) => isWithinISTTime(cb.createdAt, startTimeMinutes, endTimeMinutes));
    const auditLogs = allAuditLogs.filter((a) => isWithinISTTime(a.createdAt, startTimeMinutes, endTimeMinutes));

    // Map assigned counts
    const assignedMap: Record<string, number> = {};
    for (const item of assignedCounts) {
      if (item.assignedExecutiveId) {
        assignedMap[item.assignedExecutiveId] = item._count.id;
      }
    }

    // 4. Per-Executive Aggregation
    const executiveMatrix = executives.map((exec) => {
      const execCalls = callLogs.filter((c) => c.executiveId === exec.id);
      const execVerifs = verifications.filter((v) => v.verifiedByUserId === exec.id);
      const execScreenings = screenings.filter((s) => s.screenerId === exec.id);
      const execCallbacks = callbacks.filter((cb) => cb.executiveId === exec.id);
      const execAudits = auditLogs.filter((a) => a.userId === exec.id);

      // Compute UNIQUE LEADS WORKED (Distinct Application IDs touched)
      const touchedAppIds = new Set<string>();
      execCalls.forEach((c) => touchedAppIds.add(c.applicationId));
      execVerifs.forEach((v) => touchedAppIds.add(v.applicationId));
      execScreenings.forEach((s) => touchedAppIds.add(s.applicationId));
      execAudits.forEach((a) => touchedAppIds.add(a.entityId));

      const totalCallsLogged = execCalls.length;
      const uniqueLeadsWorked = touchedAppIds.size;

      const connectedCalls = execCalls.filter((c) => c.callOutcome === 'CONNECTED').length;
      const rnrCalls = execCalls.filter((c) => c.callOutcome === 'RNR').length;
      const busyCalls = execCalls.filter((c) => c.callOutcome === 'BUSY').length;
      const switchedOffCalls = execCalls.filter((c) => c.callOutcome === 'SWITCHED_OFF').length;
      const wrongNumberCalls = execCalls.filter((c) => c.callOutcome === 'WRONG_NUMBER').length;
      const interestedCalls = execCalls.filter((c) => c.callOutcome === 'INTERESTED').length;
      const shortlistedCalls = execCalls.filter((c) => c.callOutcome === 'SHORTLISTED').length;
      const notInterestedCalls = execCalls.filter((c) => c.callOutcome === 'NOT_INTERESTED').length;
      const notEligibleCalls = execCalls.filter((c) => c.callOutcome === 'NOT_ELIGIBLE').length;

      const callbacksScheduled = execCallbacks.length;
      const callbacksCompleted = execCallbacks.filter((cb) => cb.status === 'COMPLETED').length;

      const stageAdvancements = execAudits.filter((a) => a.action === 'STAGE_UPDATE').length;

      const connectRate = totalCallsLogged > 0 ? (connectedCalls / totalCallsLogged) * 100 : 0;
      const interestRate = connectedCalls > 0 ? (interestedCalls / connectedCalls) * 100 : 0;
      const shortlistRate = connectedCalls > 0 ? (shortlistedCalls / connectedCalls) * 100 : 0;

      return {
        id: exec.id,
        fullName: exec.fullName,
        email: exec.email,
        teamId: exec.teamId,
        teamName: exec.team?.name || 'Unassigned',
        presenceStatus: exec.presenceStatus,
        lastActivityAt: exec.lastActivityAt,
        assignedLeadsCount: assignedMap[exec.id] || 0,
        uniqueLeadsWorked,
        totalCallsLogged,
        connectedCalls,
        rnrCalls,
        busyCalls,
        switchedOffCalls,
        wrongNumberCalls,
        interestedCalls,
        shortlistedCalls,
        notInterestedCalls,
        notEligibleCalls,
        callbacksScheduled,
        callbacksCompleted,
        verificationsDone: execVerifs.length,
        screeningsDone: execScreenings.length,
        stageAdvancements,
        connectRate: parseFloat(connectRate.toFixed(1)),
        interestRate: parseFloat(interestRate.toFixed(1)),
        shortlistRate: parseFloat(shortlistRate.toFixed(1)),
      };
    });

    // 5. Global / Scope Summary Metrics
    const globalTouchedAppIds = new Set<string>();
    callLogs.forEach((c) => globalTouchedAppIds.add(c.applicationId));
    verifications.forEach((v) => globalTouchedAppIds.add(v.applicationId));
    screenings.forEach((s) => globalTouchedAppIds.add(s.applicationId));
    auditLogs.forEach((a) => globalTouchedAppIds.add(a.entityId));

    const totalCallsLogged = callLogs.length;
    const uniqueLeadsWorked = globalTouchedAppIds.size;
    const totalConnected = callLogs.filter((c) => c.callOutcome === 'CONNECTED').length;
    const totalRnr = callLogs.filter((c) => c.callOutcome === 'RNR').length;
    const totalShortlisted = callLogs.filter((c) => c.callOutcome === 'SHORTLISTED').length;
    const totalInterested = callLogs.filter((c) => c.callOutcome === 'INTERESTED').length;
    const totalBusy = callLogs.filter((c) => c.callOutcome === 'BUSY').length;
    const totalSwitchedOff = callLogs.filter((c) => c.callOutcome === 'SWITCHED_OFF').length;
    const totalWrongNumber = callLogs.filter((c) => c.callOutcome === 'WRONG_NUMBER').length;
    const totalNotInterested = callLogs.filter((c) => c.callOutcome === 'NOT_INTERESTED').length;
    const totalNotEligible = callLogs.filter((c) => c.callOutcome === 'NOT_ELIGIBLE').length;

    const summary = {
      displayRange,
      totalExecutives: executives.length,
      uniqueLeadsWorked,
      totalCallsLogged,
      connectedCalls: totalConnected,
      rnrCalls: totalRnr,
      busyCalls: totalBusy,
      switchedOffCalls: totalSwitchedOff,
      wrongNumberCalls: totalWrongNumber,
      interestedCalls: totalInterested,
      shortlistedCalls: totalShortlisted,
      notInterestedCalls: totalNotInterested,
      notEligibleCalls: totalNotEligible,
      callbacksScheduled: callbacks.length,
      callbacksCompleted: callbacks.filter((cb) => cb.status === 'COMPLETED').length,
      verificationsCompleted: verifications.length,
      screeningsCompleted: screenings.length,
      stageAdvancements: auditLogs.filter((a) => a.action === 'STAGE_UPDATE').length,
      connectRate: totalCallsLogged > 0 ? parseFloat(((totalConnected / totalCallsLogged) * 100).toFixed(1)) : 0,
      interestRate: totalConnected > 0 ? parseFloat(((totalInterested / totalConnected) * 100).toFixed(1)) : 0,
      shortlistRate: totalConnected > 0 ? parseFloat(((totalShortlisted / totalConnected) * 100).toFixed(1)) : 0,
    };

    // 6. Hourly Productivity Breakdown (09:00 to 20:00 IST and all active hours)
    const hourlyMap: Record<number, {
      hour: string;
      hourNumber: number;
      totalCalls: number;
      connectedCalls: number;
      uniqueLeads: Set<string>;
      verifications: number;
      screenings: number;
      callbacks: number;
    }> = {};

    // Initialize 9 AM to 8 PM (9 to 20) by default
    for (let h = 9; h <= 20; h++) {
      const label = `${String(h).padStart(2, '0')}:00 - ${String(h + 1).padStart(2, '0')}:00`;
      hourlyMap[h] = {
        hour: label,
        hourNumber: h,
        totalCalls: 0,
        connectedCalls: 0,
        uniqueLeads: new Set<string>(),
        verifications: 0,
        screenings: 0,
        callbacks: 0,
      };
    }

    // Populate hourly metrics
    for (const c of callLogs) {
      const h = getISTHour(c.createdAt);
      if (!hourlyMap[h]) {
        hourlyMap[h] = {
          hour: `${String(h).padStart(2, '0')}:00 - ${String(h + 1).padStart(2, '0')}:00`,
          hourNumber: h,
          totalCalls: 0,
          connectedCalls: 0,
          uniqueLeads: new Set<string>(),
          verifications: 0,
          screenings: 0,
          callbacks: 0,
        };
      }
      hourlyMap[h].totalCalls++;
      if (c.callOutcome === 'CONNECTED') hourlyMap[h].connectedCalls++;
      hourlyMap[h].uniqueLeads.add(c.applicationId);
    }

    for (const v of verifications) {
      const h = getISTHour(v.createdAt);
      if (hourlyMap[h]) {
        hourlyMap[h].verifications++;
        hourlyMap[h].uniqueLeads.add(v.applicationId);
      }
    }

    for (const s of screenings) {
      const h = getISTHour(s.createdAt);
      if (hourlyMap[h]) {
        hourlyMap[h].screenings++;
        hourlyMap[h].uniqueLeads.add(s.applicationId);
      }
    }

    for (const cb of callbacks) {
      const h = getISTHour(cb.createdAt);
      if (hourlyMap[h]) {
        hourlyMap[h].callbacks++;
      }
    }

    const hourlyBreakdown = Object.values(hourlyMap)
      .sort((a, b) => a.hourNumber - b.hourNumber)
      .map((h) => ({
        hour: h.hour,
        hourNumber: h.hourNumber,
        totalCalls: h.totalCalls,
        connectedCalls: h.connectedCalls,
        uniqueLeadsWorked: h.uniqueLeads.size,
        verificationsCompleted: h.verifications,
        screeningsCompleted: h.screenings,
        callbacksLogged: h.callbacks,
      }));

    // 7. Team-level aggregation
    const teamMap: Record<string, {
      teamId: string;
      teamName: string;
      executiveCount: number;
      uniqueLeadsWorked: number;
      totalCallsLogged: number;
      connectedCalls: number;
      verificationsDone: number;
      screeningsDone: number;
      shortlistedCalls: number;
    }> = {};

    for (const row of executiveMatrix) {
      const tKey = row.teamId || 'unassigned';
      if (!teamMap[tKey]) {
        teamMap[tKey] = {
          teamId: tKey,
          teamName: row.teamName,
          executiveCount: 0,
          uniqueLeadsWorked: 0,
          totalCallsLogged: 0,
          connectedCalls: 0,
          verificationsDone: 0,
          screeningsDone: 0,
          shortlistedCalls: 0,
        };
      }
      teamMap[tKey].executiveCount++;
      teamMap[tKey].uniqueLeadsWorked += row.uniqueLeadsWorked;
      teamMap[tKey].totalCallsLogged += row.totalCallsLogged;
      teamMap[tKey].connectedCalls += row.connectedCalls;
      teamMap[tKey].verificationsDone += row.verificationsDone;
      teamMap[tKey].screeningsDone += row.screeningsDone;
      teamMap[tKey].shortlistedCalls += row.shortlistedCalls;
    }

    const teamBreakdown = Object.values(teamMap).sort((a, b) => b.totalCallsLogged - a.totalCallsLogged);

    return {
      filterApplied: {
        preset: filter.datePreset || 'TODAY',
        startDate: filter.startDate,
        endDate: filter.endDate,
        startTime: filter.startTime,
        endTime: filter.endTime,
        executiveId: filter.executiveId,
        teamId: filter.teamId,
        jobId: filter.jobId,
      },
      summary,
      hourlyBreakdown,
      executiveMatrix: executiveMatrix.sort((a, b) => b.totalCallsLogged - a.totalCallsLogged),
      teamBreakdown,
    };
  }

  /**
   * Executive Activity Timeline with precise CRM activity gap calculations (>=10 minutes).
   * Transparently labels intervals as "CRM activity gap: X min" with no physical idle assumptions.
   */
  static async getExecutiveActivityTimeline(
    filter: { executiveId: string; date?: string; startDate?: string; endDate?: string },
    currentUser: AuthenticatedUser
  ) {
    const hasCompanyView =
      currentUser.roles.includes('SUPER_ADMIN') ||
      currentUser.roles.includes('OPERATIONS_HEAD') ||
      hasPermission(currentUser, 'reports.operations');

    const isTeamLead = currentUser.roles.includes('TEAM_LEAD');

    if (!hasCompanyView && !isTeamLead && filter.executiveId !== currentUser.userId) {
      throw new Error('Forbidden: You can only view your own activity timeline.');
    }

    const executive = await prisma.user.findUnique({
      where: { id: filter.executiveId },
      select: {
        id: true,
        fullName: true,
        email: true,
        presenceStatus: true,
        lastActivityAt: true,
        team: { select: { name: true } },
      },
    });

    if (!executive) {
      throw new Error('Executive not found.');
    }

    // Date range in IST
    const dateStr = filter.date || filter.startDate || getISTDateString(new Date());
    const endDateStr = filter.endDate || dateStr;
    const startUtc = new Date(`${dateStr}T00:00:00.000+05:30`);
    const endUtc = new Date(`${endDateStr}T23:59:59.999+05:30`);

    // Fetch discrete activities
    const [calls, verifications, screenings, callbacks, audits] = await Promise.all([
      prisma.callLog.findMany({
        where: {
          executiveId: filter.executiveId,
          createdAt: { gte: startUtc, lte: endUtc },
        },
        include: {
          application: {
            include: {
              candidate: { select: { fullName: true, normalizedPhone: true } },
              job: { select: { jobTitle: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.applicationVerification.findMany({
        where: {
          verifiedByUserId: filter.executiveId,
          createdAt: { gte: startUtc, lte: endUtc },
        },
        include: {
          application: {
            include: {
              candidate: { select: { fullName: true, normalizedPhone: true } },
              job: { select: { jobTitle: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.screening.findMany({
        where: {
          screenerId: filter.executiveId,
          createdAt: { gte: startUtc, lte: endUtc },
        },
        include: {
          application: {
            include: {
              candidate: { select: { fullName: true } },
              job: { select: { jobTitle: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.callback.findMany({
        where: {
          executiveId: filter.executiveId,
          createdAt: { gte: startUtc, lte: endUtc },
        },
        include: {
          application: {
            include: {
              candidate: { select: { fullName: true, normalizedPhone: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.auditLog.findMany({
        where: {
          userId: filter.executiveId,
          entity: 'Application',
          action: 'STAGE_UPDATE',
          createdAt: { gte: startUtc, lte: endUtc },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Format all events into a unified chronological stream
    interface TimelineEvent {
      id: string;
      type: 'CALL_LOGGED' | 'VERIFICATION_SAVED' | 'SCREENING_CONDUCTED' | 'CALLBACK_SCHEDULED' | 'STAGE_ADVANCED' | 'GAP';
      timestamp: Date;
      formattedTime: string;
      title: string;
      details: string;
      candidateName?: string;
      candidatePhone?: string;
      jobTitle?: string;
      badge?: { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' };
      gapMinutes?: number;
    }

    const rawEvents: { timestamp: Date; event: TimelineEvent }[] = [];

    for (const c of calls) {
      let variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' = 'neutral';
      if (['SHORTLISTED', 'INTERESTED', 'CONNECTED'].includes(c.callOutcome)) variant = 'success';
      else if (c.callOutcome === 'CALLBACK') variant = 'warning';
      else if (['NOT_INTERESTED', 'NOT_ELIGIBLE', 'WRONG_NUMBER'].includes(c.callOutcome)) variant = 'danger';

      rawEvents.push({
        timestamp: c.createdAt,
        event: {
          id: `call_${c.id}`,
          type: 'CALL_LOGGED',
          timestamp: c.createdAt,
          formattedTime: formatISTDateTime(c.createdAt),
          title: `Call Logged: ${c.callOutcome.replace(/_/g, ' ')}`,
          details: c.remarks || `Logged call for application #${c.application.id.slice(0, 8)}`,
          candidateName: c.application.candidate.fullName,
          candidatePhone: c.application.candidate.normalizedPhone,
          jobTitle: c.application.job.jobTitle,
          badge: { label: c.callOutcome.replace(/_/g, ' '), variant },
        },
      });
    }

    for (const v of verifications) {
      rawEvents.push({
        timestamp: v.createdAt,
        event: {
          id: `verif_${v.id}`,
          type: 'VERIFICATION_SAVED',
          timestamp: v.createdAt,
          formattedTime: formatISTDateTime(v.createdAt),
          title: 'Candidate Verification Recorded',
          details: `Verified candidate profile for ${v.application.job.jobTitle}`,
          candidateName: v.application.candidate.fullName,
          candidatePhone: v.application.candidate.normalizedPhone,
          jobTitle: v.application.job.jobTitle,
          badge: { label: 'Verified', variant: 'info' },
        },
      });
    }

    for (const s of screenings) {
      rawEvents.push({
        timestamp: s.createdAt,
        event: {
          id: `screen_${s.id}`,
          type: 'SCREENING_CONDUCTED',
          timestamp: s.createdAt,
          formattedTime: formatISTDateTime(s.createdAt),
          title: `Screening Evaluated (${s.screeningStatus})`,
          details: s.remarks || `Screening outcome: ${s.screeningStatus}`,
          candidateName: s.application.candidate.fullName,
          jobTitle: s.application.job.jobTitle,
          badge: { label: s.screeningStatus, variant: s.screeningStatus === 'PASS' ? 'success' : s.screeningStatus === 'FAIL' ? 'danger' : 'warning' },
        },
      });
    }

    for (const cb of callbacks) {
      rawEvents.push({
        timestamp: cb.createdAt,
        event: {
          id: `cb_${cb.id}`,
          type: 'CALLBACK_SCHEDULED',
          timestamp: cb.createdAt,
          formattedTime: formatISTDateTime(cb.createdAt),
          title: 'Callback Scheduled',
          details: `Scheduled for: ${formatISTDateTime(cb.scheduledAt)}${cb.reason ? ` - ${cb.reason}` : ''}`,
          candidateName: cb.application.candidate.fullName,
          candidatePhone: cb.application.candidate.normalizedPhone,
          badge: { label: `Callback (${cb.priority})`, variant: 'warning' },
        },
      });
    }

    for (const a of audits) {
      const newStage = (a.newValues as any)?.currentStage || 'Stage Changed';
      rawEvents.push({
        timestamp: a.createdAt,
        event: {
          id: `audit_${a.id}`,
          type: 'STAGE_ADVANCED',
          timestamp: a.createdAt,
          formattedTime: formatISTDateTime(a.createdAt),
          title: `Pipeline Stage Advanced to ${newStage}`,
          details: `Application #${a.entityId.slice(0, 8)} stage updated`,
          badge: { label: newStage, variant: 'success' },
        },
      });
    }

    // Sort ascending chronologically
    rawEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Compute Gaps >= 10 minutes between consecutive CRM actions
    const timelineWithGaps: TimelineEvent[] = [];
    let totalGapMinutes = 0;
    let totalGapsCount = 0;

    for (let i = 0; i < rawEvents.length; i++) {
      if (i > 0) {
        const prevTime = rawEvents[i - 1].timestamp.getTime();
        const currTime = rawEvents[i].timestamp.getTime();
        const diffMinutes = Math.floor((currTime - prevTime) / 60000);

        if (diffMinutes >= 10) {
          totalGapMinutes += diffMinutes;
          totalGapsCount++;
          timelineWithGaps.push({
            id: `gap_${i}`,
            type: 'GAP',
            timestamp: new Date(prevTime),
            formattedTime: `${formatISTDateTime(new Date(prevTime))} - ${formatISTDateTime(new Date(currTime))}`,
            title: `CRM activity gap: ${diffMinutes} min`,
            details: `No recorded CRM activity during this interval (${diffMinutes} minutes).`,
            gapMinutes: diffMinutes,
            badge: { label: `${diffMinutes}m Gap`, variant: 'neutral' },
          });
        }
      }
      timelineWithGaps.push(rawEvents[i].event);
    }

    return {
      executive: {
        id: executive.id,
        fullName: executive.fullName,
        email: executive.email,
        teamName: executive.team?.name || 'Unassigned',
        presenceStatus: executive.presenceStatus,
        lastActivityAt: executive.lastActivityAt,
      },
      dateRange: `${dateStr}${endDateStr !== dateStr ? ` to ${endDateStr}` : ''}`,
      totalEvents: rawEvents.length,
      totalGapsCount,
      totalGapMinutes,
      events: timelineWithGaps,
    };
  }

  /**
   * Exports Executive Productivity to CSV formatted text.
   */
  static async exportProductivityCSV(
    filter: ProductivityFilter,
    currentUser: AuthenticatedUser
  ): Promise<string> {
    const analytics = await this.getExecutiveProductivityAnalytics(filter, currentUser);

    const headers = [
      'Executive Name',
      'Email',
      'Team',
      'Presence Status',
      'Assigned Leads',
      'Unique Leads Worked',
      'Total Calls Logged',
      'Connected Calls',
      'RNR Calls',
      'Busy Calls',
      'Callbacks Scheduled',
      'Callbacks Completed',
      'Verifications Done',
      'Screenings Done',
      'Shortlisted',
      'Connect Rate (%)',
      'Shortlist Rate (%)',
      'Last Activity',
    ];

    const rows = analytics.executiveMatrix.map((row) => [
      `"${row.fullName.replace(/"/g, '""')}"`,
      `"${row.email}"`,
      `"${row.teamName.replace(/"/g, '""')}"`,
      row.presenceStatus,
      row.assignedLeadsCount,
      row.uniqueLeadsWorked,
      row.totalCallsLogged,
      row.connectedCalls,
      row.rnrCalls,
      row.busyCalls,
      row.callbacksScheduled,
      row.callbacksCompleted,
      row.verificationsDone,
      row.screeningsDone,
      row.shortlistedCalls,
      `${row.connectRate}%`,
      `${row.shortlistRate}%`,
      row.lastActivityAt ? `"${formatISTDateTime(row.lastActivityAt)}"` : '"Never"',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}
