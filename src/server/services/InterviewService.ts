import { prisma } from '@/server/db/prisma';
import { AuditService } from '@/server/services/AuditService';

export interface ScheduleInterviewInput {
  applicationId: string;
  submissionId?: string | null;
  roundNumber?: number;
  roundName: string;
  scheduledAt: string;
  mode?: 'OFFLINE' | 'VIRTUAL';
  location?: string;
  notes?: string;
  userId: string;
}

export interface UpdateInterviewOutcomeInput {
  interviewId: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'RESCHEDULED' | 'NO_SHOW' | 'CANCELLED';
  outcome: 'PENDING' | 'SELECTED_FOR_NEXT_ROUND' | 'SELECTED' | 'REJECTED' | 'HOLD';
  feedback: string;
  userId: string;
  scheduleNextRound?: boolean;
  nextRoundScheduledAt?: string;
  nextRoundName?: string;
}

export class InterviewService {
  /**
   * Schedules a new interview round for an application.
   */
  static async scheduleInterview(input: ScheduleInterviewInput) {
    const { applicationId, submissionId, roundNumber, roundName, scheduledAt, mode, location, notes, userId } = input;

    return await prisma.$transaction(async (tx) => {
      const app = await tx.application.findUnique({ where: { id: applicationId } });
      if (!app) throw new Error('Application not found');

      // Create Interview record
      const interview = await tx.interview.create({
        data: {
          applicationId,
          submissionId: submissionId || null,
          roundNumber: roundNumber || 1,
          roundName,
          scheduledAt: new Date(scheduledAt),
          mode: mode || 'OFFLINE',
          location: location || null,
          status: 'SCHEDULED',
          outcome: 'PENDING',
          feedback: notes || null,
          updatedById: userId,
        },
      });

      // Update Application stage to INTERVIEW_SCHEDULED
      await tx.application.update({
        where: { id: applicationId },
        data: { currentStage: 'INTERVIEW_SCHEDULED' as any },
      });

      // Audit Log
      await AuditService.log(
        {
          userId,
          action: 'INTERVIEW_SCHEDULED',
          entity: 'Interview',
          entityId: interview.id,
          newValues: {
            roundNumber: interview.roundNumber,
            roundName,
            scheduledAt,
            stage: 'INTERVIEW_SCHEDULED',
          },
        },
        tx
      );

      return interview;
    });
  }

  /**
   * Updates interview outcome, supports multiple rounds and terminal transitions (SELECTED / REJECTED / JOINING).
   */
  static async updateInterviewOutcome(input: UpdateInterviewOutcomeInput) {
    const {
      interviewId,
      status,
      outcome,
      feedback,
      userId,
      scheduleNextRound,
      nextRoundScheduledAt,
      nextRoundName,
    } = input;

    return await prisma.$transaction(async (tx) => {
      const interview = await tx.interview.findUnique({
        where: { id: interviewId },
        include: { application: true },
      });

      if (!interview) throw new Error('Interview record not found');

      // Update current interview record
      const updatedInterview = await tx.interview.update({
        where: { id: interviewId },
        data: {
          status,
          outcome,
          feedback,
          updatedById: userId,
        },
      });

      let nextAppStage: any = interview.application.currentStage;
      let nextRoundRecord = null;

      // Handle outcomes
      if (outcome === 'SELECTED_FOR_NEXT_ROUND' && scheduleNextRound && nextRoundScheduledAt) {
        nextAppStage = 'INTERVIEW_SCHEDULED';
        nextRoundRecord = await tx.interview.create({
          data: {
            applicationId: interview.applicationId,
            submissionId: interview.submissionId,
            roundNumber: interview.roundNumber + 1,
            roundName: nextRoundName || `Round ${interview.roundNumber + 1}`,
            scheduledAt: new Date(nextRoundScheduledAt),
            mode: interview.mode,
            location: interview.location,
            status: 'SCHEDULED',
            outcome: 'PENDING',
            updatedById: userId,
          },
        });
      } else if (outcome === 'SELECTED') {
        nextAppStage = 'SELECTED';
      } else if (outcome === 'REJECTED') {
        nextAppStage = 'REJECTED';
      } else if (status === 'COMPLETED' && outcome === 'PENDING') {
        nextAppStage = 'INTERVIEW_COMPLETED';
      }

      // Update Application stage if changed
      if (nextAppStage !== interview.application.currentStage) {
        await tx.application.update({
          where: { id: interview.applicationId },
          data: { currentStage: nextAppStage as any },
        });
      }

      // Audit Log
      await AuditService.log(
        {
          userId,
          action: 'INTERVIEW_OUTCOME_UPDATED',
          entity: 'Interview',
          entityId: interviewId,
          oldValues: { previousOutcome: interview.outcome, previousStage: interview.application.currentStage },
          newValues: {
            outcome,
            feedback,
            newStage: nextAppStage,
            nextRoundCreated: !!nextRoundRecord,
          },
        },
        tx
      );

      return {
        interview: updatedInterview,
        nextRound: nextRoundRecord,
        newStage: nextAppStage,
      };
    });
  }

  /**
   * Updates Joining Status (SELECTED -> JOINING_PENDING -> JOINED / NOT_JOINED).
   */
  static async updateJoiningStatus(
    applicationId: string,
    userId: string,
    status: 'JOINING_PENDING' | 'JOINED' | 'NOT_JOINED',
    joiningDate?: string | null,
    reason?: string
  ) {
    const app = await prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) throw new Error('Application not found');

    const updated = await prisma.application.update({
      where: { id: applicationId },
      data: {
        currentStage: status as any,
        notes: reason ? `${app.notes ? app.notes + '\n' : ''}Joining Note: ${reason}` : app.notes,
      },
    });

    await AuditService.log({
      userId,
      action: 'JOINING_STATUS_UPDATED',
      entity: 'Application',
      entityId: applicationId,
      oldValues: { stage: app.currentStage },
      newValues: { stage: status, joiningDate, reason },
    });

    return updated;
  }
}
