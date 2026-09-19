import { prisma } from '@/server/db/prisma';
import { AuditService } from '@/server/services/AuditService';

export interface AssignLeadInput {
  applicationIds: string[];
  executiveId: string;
  teamId?: string | null;
  assignedById: string;
  reason?: string;
}

export class AssignmentService {
  /**
   * Assigns or Reassigns an array of Applications to a Recruitment Executive.
   * Runs in an atomic transaction with pessimistic locking to prevent race conditions.
   */
  static async assignApplications(input: AssignLeadInput) {
    const { applicationIds, executiveId, teamId, assignedById, reason } = input;

    // Verify executive exists and is active
    const executive = await prisma.user.findUnique({
      where: { id: executiveId },
      include: { userRoles: { include: { role: true } } },
    });

    if (!executive || executive.status !== 'ACTIVE') {
      throw new Error('Target executive does not exist or is not active.');
    }

    const assignedCount = await prisma.$transaction(async (tx) => {
      let count = 0;

      for (const appId of applicationIds) {
        let currentApp: any;
        try {
          const lockedRows = await tx.$queryRaw<Array<{
            id: string;
            applicationCode: string;
            candidateId: string;
            jobId: string;
            companyId: string;
            assignedExecutiveId: string | null;
            assignedTeamId: string | null;
            assignedById: string | null;
            assignedAt: Date | null;
            currentStage: string;
          }>>`SELECT id, "applicationCode", "candidateId", "jobId", "companyId", "assignedExecutiveId", "assignedTeamId", "assignedById", "assignedAt", "currentStage"::text as "currentStage" FROM "applications" WHERE id = ${appId} FOR UPDATE`;
          currentApp = lockedRows?.[0];
        } catch {
          // SQLite fallback for unit testing environments
          currentApp = await tx.application.findUnique({ where: { id: appId } });
        }

        if (!currentApp) {
          throw new Error(`Application ${appId} not found or could not be locked.`);
        }

        // 2. Business Rule: Prevent reassignment of closed / terminal applications
        if (['CLOSED', 'JOINED', 'REJECTED'].includes(currentApp.currentStage)) {
          throw new Error(`Cannot assign application ${currentApp.applicationCode} in terminal stage ${currentApp.currentStage}`);
        }

        // 3. Close ALL existing active assignment history records for this application
        await tx.applicationAssignmentHistory.updateMany({
          where: {
            applicationId: currentApp.id,
            unassignedAt: null,
          },
          data: {
            unassignedAt: new Date(),
            reason: reason || (currentApp.assignedExecutiveId ? 'Reassigned to another executive' : 'Initial assignment updated'),
          },
        });

        // 4. Determine new stage (if NEW, transition to ASSIGNED)
        const nextStage = currentApp.currentStage === 'NEW' ? 'ASSIGNED' : currentApp.currentStage;

        // 5. Update Application record
        const updatedApp = await tx.application.update({
          where: { id: currentApp.id },
          data: {
            assignedExecutiveId: executiveId,
            assignedTeamId: teamId || executive.teamId || null,
            assignedById: assignedById,
            assignedAt: new Date(),
            currentStage: nextStage as any,
          },
        });

        // 6. Create immutable assignment history entry (the single active assignment record)
        await tx.applicationAssignmentHistory.create({
          data: {
            applicationId: currentApp.id,
            candidateId: currentApp.candidateId,
            executiveId: executiveId,
            teamId: teamId || executive.teamId || null,
            assignedById: assignedById,
            assignedAt: new Date(),
            unassignedAt: null,
            reason: reason || 'Lead assigned',
            assignmentMode: 'MANUAL',
          },
        });

        // 7. Record immutable Audit Log
        await AuditService.log(
          {
            userId: assignedById,
            action: currentApp.assignedExecutiveId ? 'APPLICATION_REASSIGNED' : 'APPLICATION_ASSIGNED',
            entity: 'Application',
            entityId: currentApp.id,
            oldValues: {
              assignedExecutiveId: currentApp.assignedExecutiveId,
              stage: currentApp.currentStage,
            },
            newValues: {
              assignedExecutiveId: executiveId,
              stage: nextStage,
            },
          },
          tx
        );

        // 8. Create Notification for Executive
        await tx.notification.create({
          data: {
            userId: executiveId,
            title: 'New Lead Assigned',
            message: `Lead ${currentApp.applicationCode} has been assigned to your calling queue.`,
            type: 'LEAD_ASSIGNED',
            entityType: 'APPLICATION',
            entityId: currentApp.id,
          },
        });

        count++;
      }

      return count;
    });

    return { success: true, count: assignedCount };
  }

  /**
   * Retrieves full assignment history for an application.
   */
  static async getAssignmentHistory(applicationId: string) {
    return prisma.applicationAssignmentHistory.findMany({
      where: { applicationId },
      include: {
        executive: { select: { id: true, fullName: true, email: true } },
        assignedBy: { select: { id: true, fullName: true } },
        team: { select: { id: true, name: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }
}
