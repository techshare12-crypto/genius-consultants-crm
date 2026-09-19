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
   * Central Evaluation Gate: Determines whether an application is ready for the Screening Queue.
   * STRICT RULE: Application MUST be in SHORTLISTED stage AND have both Form RECEIVED and CV RECEIVED/VERIFIED.
   */
  static evaluateScreeningReadiness(app: {
    currentStage: string;
    formStatus: string;
    cvStatus: string;
  }): { shouldAdvance: boolean; nextStage?: string; nextAction: string } {
    const isFormReady = app.formStatus === 'RECEIVED';
    const isCvReady = ['CV_RECEIVED', 'VERIFIED'].includes(app.cvStatus);

    if (app.currentStage === 'SHORTLISTED' && isFormReady && isCvReady) {
      return { shouldAdvance: true, nextStage: 'SCREENING_PENDING', nextAction: '✓ Ready for Screening' };
    }

    let nextAction = 'Next: Call candidate';
    if (app.currentStage === 'NEW' || app.currentStage === 'ASSIGNED') {
      nextAction = 'Next: Call candidate';
    } else if (app.currentStage === 'CALLING') {
      nextAction = 'Next: Complete call & log outcome';
    } else if (app.currentStage === 'INTERESTED') {
      nextAction = 'Next: Shortlist candidate if suitable';
    } else if (app.currentStage === 'SHORTLISTED') {
      if (!isFormReady && !isCvReady) {
        nextAction = app.formStatus === 'SENT' ? 'Next: Follow up for Google Form' : 'Next: Send Google Form';
      } else if (isFormReady && !isCvReady) {
        nextAction = app.cvStatus === 'CV_REQUESTED' ? 'Next: Follow up for WhatsApp CV' : 'Next: Request CV via WhatsApp';
      } else if (!isFormReady && isCvReady) {
        nextAction = app.formStatus === 'SENT' ? 'Next: Follow up for Google Form' : 'Next: Send Google Form';
      } else {
        nextAction = '✓ Ready for Screening';
      }
    } else if (app.currentStage === 'SCREENING_PENDING') {
      nextAction = '✓ Waiting for Screening Manager';
    } else if (app.currentStage === 'SCREENING_PASSED') {
      nextAction = '✓ Passed Screening (Eligible for Final Shortlist)';
    } else if (app.currentStage === 'FINAL_SHORTLIST') {
      nextAction = '✓ Final Shortlisted (Ready for Client Submission)';
    } else if (app.currentStage === 'SENT_TO_CLIENT') {
      nextAction = '✓ Submitted to Client (Schedule Interview)';
    }

    return { shouldAdvance: false, nextAction };
  }

  /**
   * Updates Form and CV tracking status with timestamp preservation and idempotency.
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
    const now = new Date();

    if (updates.formStatus !== undefined) {
      dataToUpdate.formStatus = updates.formStatus;
      if (updates.formStatus === 'SENT') {
        dataToUpdate.formSentAt = app.formSentAt || now;
      } else if (updates.formStatus === 'RECEIVED') {
        dataToUpdate.formReceivedAt = app.formReceivedAt || now;
      }
    }

    if (updates.cvStatus !== undefined) {
      dataToUpdate.cvStatus = updates.cvStatus;
      if (updates.cvStatus === 'CV_REQUESTED') {
        dataToUpdate.cvRequestedAt = app.cvRequestedAt || now;
      } else if (updates.cvStatus === 'CV_RECEIVED' || updates.cvStatus === 'VERIFIED') {
        dataToUpdate.cvReceivedAt = app.cvReceivedAt || now;
      }
    }

    // Evaluate screening gate
    const mergedState = {
      currentStage: app.currentStage,
      formStatus: updates.formStatus !== undefined ? updates.formStatus : app.formStatus,
      cvStatus: updates.cvStatus !== undefined ? updates.cvStatus : app.cvStatus,
    };

    const readiness = ScreeningService.evaluateScreeningReadiness(mergedState);
    if (readiness.shouldAdvance && readiness.nextStage) {
      dataToUpdate.currentStage = readiness.nextStage;
      dataToUpdate.readyForScreeningAt = app.readyForScreeningAt || now;
    }

    const updated = await prisma.application.update({
      where: { id: applicationId },
      data: dataToUpdate,
      include: {
        candidate: true,
        job: { include: { company: true } },
      },
    });

    await AuditService.log({
      userId,
      action: 'DOCUMENT_STATUS_UPDATED',
      entity: 'Application',
      entityId: applicationId,
      oldValues: { formStatus: app.formStatus, cvStatus: app.cvStatus, stage: app.currentStage },
      newValues: {
        formStatus: updated.formStatus,
        cvStatus: updated.cvStatus,
        stage: updated.currentStage,
        updates,
      },
    });

    return {
      application: updated,
      formStatus: updated.formStatus,
      cvStatus: updated.cvStatus,
      currentStage: updated.currentStage,
      readyForScreeningAt: updated.readyForScreeningAt,
      nextAction: readiness.nextAction,
    };
  }

  /**
   * Explicitly shortlists a candidate application after executive calling review.
   */
  static async shortlistApplication(applicationId: string, userId: string, notes?: string) {
    const app = await prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) throw new Error('Application not found');

    const dataToUpdate: any = {
      currentStage: 'SHORTLISTED',
      notes: notes ? `${app.notes ? app.notes + '\n' : ''}Executive Shortlist: ${notes}` : app.notes,
    };

    // If documents were already collected prior to shortlisting, gate auto-advances
    const mergedState = {
      currentStage: 'SHORTLISTED',
      formStatus: app.formStatus,
      cvStatus: app.cvStatus,
    };

    const readiness = ScreeningService.evaluateScreeningReadiness(mergedState);
    if (readiness.shouldAdvance && readiness.nextStage) {
      dataToUpdate.currentStage = readiness.nextStage;
      dataToUpdate.readyForScreeningAt = app.readyForScreeningAt || new Date();
    }

    const updated = await prisma.application.update({
      where: { id: applicationId },
      data: dataToUpdate,
      include: {
        candidate: true,
        job: { include: { company: true } },
      },
    });

    await AuditService.log({
      userId,
      action: 'APPLICATION_SHORTLISTED',
      entity: 'Application',
      entityId: applicationId,
      oldValues: { stage: app.currentStage },
      newValues: { stage: updated.currentStage, notes },
    });

    return {
      application: updated,
      currentStage: updated.currentStage,
      nextAction: readiness.nextAction,
    };
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

        // Strict State Machine: Only candidates who have explicitly PASSED internal screening can move to FINAL_SHORTLIST
        if (app.currentStage !== 'SCREENING_PASSED') {
          throw new Error(
            `Application ${app.applicationCode || appId} cannot be moved to Final Shortlist. Candidate must be in 'SCREENING_PASSED' stage, but is currently in '${app.currentStage}'.`
          );
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
