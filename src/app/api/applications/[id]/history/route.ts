import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hasPermission } from '@/server/middleware/auth';
import { prisma } from '@/server/db/prisma';
import { AssignmentService } from '@/server/services/AssignmentService';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const applicationId = params.id;

  const [app, history, callLogs, callbacks, screenings, interviews, auditLogs] = await Promise.all([
    prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        candidate: true,
        job: { include: { company: true } },
        assignedExecutive: { select: { id: true, fullName: true, email: true } },
      },
    }),
    AssignmentService.getAssignmentHistory(applicationId),
    prisma.callLog.findMany({
      where: { applicationId },
      include: { executive: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.callback.findMany({
      where: { applicationId },
      include: { executive: { select: { fullName: true } } },
      orderBy: { scheduledAt: 'desc' },
    }),
    prisma.screening.findMany({
      where: { applicationId },
      include: { screener: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.interview.findMany({
      where: { applicationId },
      include: { updatedBy: { select: { fullName: true } } },
      orderBy: { scheduledAt: 'desc' },
    }),
    prisma.auditLog.findMany({
      where: { entity: 'Application', entityId: applicationId },
      include: { user: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  if (!app) {
    return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 });
  }

  // Executive Data Isolation: If user does not have application.view_all, they must be the assigned executive
  if (!hasPermission(session, 'application.view_all') && app.assignedExecutiveId !== session.userId) {
    return NextResponse.json({ success: false, error: 'Forbidden: You do not have access to this application.' }, { status: 403 });
  }

  // Construct comprehensive chronological timeline
  const timeline: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    actor: string;
    timestamp: Date;
    metadata?: any;
  }> = [];

  // 1. Creation
  timeline.push({
    id: `create-${app.id}`,
    type: 'APPLICATION_CREATED',
    title: 'Application Created',
    description: `Applied for ${app.job.jobTitle} at ${app.job.company.companyName}`,
    actor: 'System',
    timestamp: app.createdAt,
  });

  // 2. Assignment History
  for (const h of history) {
    timeline.push({
      id: `assign-${h.id}`,
      type: 'ASSIGNMENT',
      title: h.unassignedAt ? 'Reassigned / Closed Assignment' : 'Assigned to Executive',
      description: `Assigned to ${h.executive.fullName} by ${h.assignedBy.fullName}${h.reason ? ` (${h.reason})` : ''}`,
      actor: h.assignedBy.fullName,
      timestamp: h.assignedAt,
    });
  }

  // 3. Call Logs
  for (const cl of callLogs) {
    timeline.push({
      id: `call-${cl.id}`,
      type: 'CALL_LOG',
      title: `Call Logged: ${cl.callOutcome}`,
      description: cl.remarks || `Outcome recorded as ${cl.callOutcome}`,
      actor: cl.executive.fullName,
      timestamp: cl.createdAt,
    });
  }

  // 4. Callbacks
  for (const cb of callbacks) {
    timeline.push({
      id: `cb-${cb.id}`,
      type: 'CALLBACK',
      title: `Callback ${cb.status}: ${cb.priority} Priority`,
      description: `Reason: ${cb.reason}${cb.completionRemarks ? ` | Note: ${cb.completionRemarks}` : ''}`,
      actor: cb.executive.fullName,
      timestamp: cb.completedAt || cb.scheduledAt,
    });
  }

  // 5. Screenings
  for (const sc of screenings) {
    timeline.push({
      id: `screen-${sc.id}`,
      type: 'SCREENING',
      title: `Screening Decision: ${sc.screeningStatus}`,
      description: sc.remarks || `Candidate marked as ${sc.screeningStatus}`,
      actor: sc.screener.fullName,
      timestamp: sc.screeningDate,
    });
  }

  // 6. Interviews
  for (const inv of interviews) {
    timeline.push({
      id: `interview-${inv.id}`,
      type: 'INTERVIEW',
      title: `${inv.roundName} (${inv.mode}) - ${inv.outcome}`,
      description: inv.feedback || `Scheduled at ${inv.location || 'Client Office'}`,
      actor: inv.updatedBy.fullName,
      timestamp: inv.scheduledAt,
    });
  }

  // Sort timeline chronologically descending
  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json({
    success: true,
    data: {
      application: app,
      assignmentHistory: history,
      timeline,
      callLogs,
      callbacks,
      screenings,
      interviews,
      auditLogs,
    },
  });
}
