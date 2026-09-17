import { prisma } from '@/server/db/prisma';
import { AuditService } from '@/server/services/AuditService';

export interface EvaluateScreeningInput {
  applicationId: string;
  screenerId: string;
  screeningStatus: 'PASS' | 'FAIL' | 'HOLD';
  remarks: string;
  holdFollowupDate?: string | null;
  nextAction?: string;
}

export interface AddToFinalShortlistInput {
  applicationIds: string[];
  jobId: string;
  userId: string;
  remarks?: string;
}

export class ScreeningService {
  /**
   * Updates Form and CV tracking status.
   */
  static async updateDocumentStatus(
    applicationId: string,
    userId: string,
    updates: {
      formStatus?: 'PENDING' | 'SENT' | 'RECEIVED';
      cvStatus?: 'CV_REQUIRED' | 'CV_REQUESTED' | 'CV_RECEIVED' | 'VERIFIED';
    }
  ) {
    const app = await prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) throw new Error('Application not found');

    const dataToUpdate: any = {};
    if (updates.formStatus) {
      dataToUpdate.formStatus = updates.formStatus;
      if (updates.formStatus === 'SENT') dataToUpdate.formSentAt = new Date();
      if (updates.formStatus === 'RECEIVED') dataToUpdate.formReceivedAt = new Date();
    }

    if (updates.cvStatus) {
      dataToUpdate.cvStatus = updates.cvStatus;
      if (updates.cvStatus === 'CV_REQUESTED') dataToUpdate.cvRequestedAt = new Date();
      if (updates.cvStatus === 'CV_RECEIVED' || updates.cvStatus === 'VERIFIED') {
        dataToUpdate.cvReceivedAt = new Date();
      }
    }

    // If both form and CV are received, mark application ready for screening
    const isFormReady = (updates.formStatus || app.formStatus) === 'RECEIVED';
    const isCvReady = ['CV_RECEIVED', 'VERIFIED'].includes(updates.cvStatus || app.cvStatus);

    if (isFormReady && isCvReady && app.currentStage === 'SHORTLISTED') {
      dataToUpdate.currentStage = 'SCREENING_PENDING';
      dataToUpdate.readyForScreeningAt = new Date();
    }

    const updated = await prisma.application.update({
      where: { id: applicationId },
      data: dataToUpdate,
    });

    await AuditService.log({
      userId,
      action: 'DOCUMENT_STATUS_UPDATED',
      entity: 'Application',
      entityId: applicationId,
      oldValues: { formStatus: app.formStatus, cvStatus: app.cvStatus, stage: app.currentStage },
      newValues: { formStatus: updated.formStatus, cvStatus: updated.cvStatus, stage: updated.currentStage },
    });

    return updated;
  }

  /**
   * Evaluates screening for an application: PASS, FAIL, or HOLD.
   */
  static async evaluateScreening(input: EvaluateScreeningInput) {
    const { applicationId, screenerId, screeningStatus, remarks, holdFollowupDate, nextAction } = input;

    return await prisma.$transaction(async (tx) => {
      const app = await tx.application.findUnique({ where: { id: applicationId } });
      if (!app) throw new Error('Application not found');

      // Create Screening Record
      const screening = await tx.screening.create({
        data: {
          applicationId,
          screenerId,
          screeningStatus,
          screeningDate: new Date(),
          holdFollowupDate: holdFollowupDate ? new Date(holdFollowupDate) : null,
          remarks,
          nextAction: nextAction || null,
        },
      });

      // Advance Application Stage
      let nextStage: string = app.currentStage;
      if (screeningStatus === 'PASS') {
        nextStage = 'SCREENING_PASSED';
      } else if (screeningStatus === 'FAIL') {
        nextStage = 'SCREENING_FAILED';
      } else if (screeningStatus === 'HOLD') {
        nextStage = 'SCREENING_HOLD';
      }

      const updatedApp = await tx.application.update({
        where: { id: applicationId },
        data: { currentStage: nextStage as any },
      });

      // Audit Log
      await AuditService.log(
        {
          userId: screenerId,
          action: 'SCREENING_EVALUATED',
          entity: 'Screening',
          entityId: screening.id,
          oldValues: { stage: app.currentStage },
          newValues: {
            screeningStatus,
            stage: nextStage,
            remarks,
          },
        },
        tx
      );

      return { screening, application: updatedApp };
    });
  }

  /**
   * Explicitly adds SCREENING_PASSED candidates to the FINAL_SHORTLIST for a job.
   */
  static async addToFinalShortlist(input: AddToFinalShortlistInput) {
    const { applicationIds, jobId, userId, remarks } = input;

    return await prisma.$transaction(async (tx) => {
      let count = 0;
      for (const appId of applicationIds) {
        const app = await tx.application.findUnique({ where: { id: appId } });
        if (!app) continue;

        // Ensure only SCREENING_PASSED or already shortlisted applications can move to FINAL_SHORTLIST
        if (app.currentStage !== 'SCREENING_PASSED' && app.currentStage !== 'SCREENING_PENDING') {
          throw new Error(`Application ${app.applicationCode} cannot be finalized. Current stage: ${app.currentStage}`);
        }

        await tx.application.update({
          where: { id: appId },
          data: {
            currentStage: 'FINAL_SHORTLIST',
            finalShortlistedAt: new Date(),
            finalShortlistedById: userId,
            notes: remarks ? `${app.notes ? app.notes + '\n' : ''}Final Shortlist: ${remarks}` : app.notes,
          },
        });

        await AuditService.log(
          {
            userId,
            action: 'ADDED_TO_FINAL_SHORTLIST',
            entity: 'Application',
            entityId: appId,
            oldValues: { stage: app.currentStage },
            newValues: { stage: 'FINAL_SHORTLIST', finalShortlistedAt: new Date() },
          },
          tx
        );

        count++;
      }

      return { success: true, count };
    });
  }
}
