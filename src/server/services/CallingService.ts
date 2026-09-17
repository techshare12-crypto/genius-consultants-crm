import { prisma } from '@/server/db/prisma';
import { AuditService } from '@/server/services/AuditService';

export interface LogCallInput {
  applicationId: string;
  candidateId: string;
  executiveId: string;
  callOutcome: 'CONNECTED' | 'RNR' | 'CALLBACK' | 'NOT_INTERESTED' | 'INTERESTED' | 'NOT_ELIGIBLE' | 'WRONG_NUMBER' | 'SWITCHED_OFF' | 'BUSY' | 'SHORTLISTED';
  remarks?: string;
  callbackRequired?: boolean;
  callbackDateTime?: string | null;
  callbackReason?: string;
  callbackPriority?: 'HIGH' | 'MEDIUM' | 'LOW';
}

export class CallingService {
  /**
   * Logs a call outcome, creates call log, optionally schedules callback,
   * transitions application stage according to business rules, and updates CRM presence.
   */
  static async logCall(input: LogCallInput) {
    const {
      applicationId,
      candidateId,
      executiveId,
      callOutcome,
      remarks,
      callbackRequired,
      callbackDateTime,
      callbackReason,
      callbackPriority,
    } = input;

    return await prisma.$transaction(async (tx) => {
      // 1. Fetch current application
      const app = await tx.application.findUnique({
        where: { id: applicationId },
        include: { candidate: true, job: true },
      });

      if (!app) {
        throw new Error('Application not found');
      }

      // Executive Concurrency Guard: Prevent logging calls on leads assigned to another executive
      if (app.assignedExecutiveId && app.assignedExecutiveId !== executiveId) {
        throw new Error(`Forbidden: Application ${app.applicationCode} is currently assigned to another executive.`);
      }

      // 2. Create immutable CallLog
      const callLog = await tx.callLog.create({
        data: {
          applicationId,
          candidateId,
          executiveId,
          callOutcome,
          remarks: remarks || null,
          callbackRequired: !!callbackRequired,
          callbackDateTime: callbackDateTime ? new Date(callbackDateTime) : null,
        },
      });

      // 3. Handle Callback Creation if requested
      let callbackRecord = null;
      if (callbackRequired && callbackDateTime) {
        callbackRecord = await tx.callback.create({
          data: {
            applicationId,
            candidateId,
            executiveId,
            sourceCallLogId: callLog.id,
            scheduledAt: new Date(callbackDateTime),
            reason: callbackReason || remarks || 'Follow-up requested by candidate',
            priority: callbackPriority || 'MEDIUM',
            status: 'PENDING',
          },
        });
      }

      // 4. State Transition Logic
      let nextStage = app.currentStage;
      let formStatus = app.formStatus;
      let cvStatus = app.cvStatus;

      if (callOutcome === 'SHORTLISTED') {
        nextStage = 'SHORTLISTED';
        if (formStatus === 'PENDING') formStatus = 'SENT';
      } else if (callOutcome === 'INTERESTED') {
        if (app.currentStage === 'NEW' || app.currentStage === 'ASSIGNED' || app.currentStage === 'CALLING') {
          nextStage = 'INTERESTED';
        }
      } else if (app.currentStage === 'ASSIGNED' || app.currentStage === 'NEW') {
        nextStage = 'CALLING';
      }

      // Update application stage if changed
      if (nextStage !== app.currentStage || formStatus !== app.formStatus) {
        await tx.application.update({
          where: { id: applicationId },
          data: {
            currentStage: nextStage,
            formStatus,
            formSentAt: formStatus === 'SENT' ? new Date() : app.formSentAt,
          },
        });
      }

      // 5. Update Executive CRM Activity presence
      await tx.user.update({
        where: { id: executiveId },
        data: {
          presenceStatus: 'AFTER_CALL_WORK',
          lastActivityAt: new Date(),
        },
      });

      // 6. Audit Logging
      await AuditService.log(
        {
          userId: executiveId,
          action: 'CALL_LOGGED',
          entity: 'CallLog',
          entityId: callLog.id,
          oldValues: { previousStage: app.currentStage },
          newValues: {
            outcome: callOutcome,
            newStage: nextStage,
            callbackScheduled: !!callbackRecord,
          },
        },
        tx
      );

      return {
        callLog,
        callback: callbackRecord,
        newStage: nextStage,
      };
    });
  }

  /**
   * Completes a scheduled callback.
   */
  static async completeCallback(callbackId: string, executiveId: string, completionRemarks: string) {
    const cb = await prisma.callback.findUnique({
      where: { id: callbackId },
    });

    if (!cb) throw new Error('Callback not found');

    const updated = await prisma.callback.update({
      where: { id: callbackId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        completionRemarks,
      },
    });

    await AuditService.log({
      userId: executiveId,
      action: 'CALLBACK_COMPLETED',
      entity: 'Callback',
      entityId: callbackId,
      newValues: { completionRemarks, completedAt: new Date() },
    });

    return updated;
  }

  /**
   * Generates WhatsApp message template text for manual copy-paste
   */
  static generateWhatsAppMessage(type: 'FORM' | 'CV_REQUEST' | 'INTERVIEW_INVITE', data: {
    candidateName: string;
    jobTitle: string;
    companyName: string;
    formUrl?: string;
    interviewDate?: string;
    interviewLocation?: string;
  }): string {
    switch (type) {
      case 'FORM':
        return `Hello ${data.candidateName},\n\nThank you for speaking with Genius Consultancy regarding the *${data.jobTitle}* opening at *${data.companyName}*.\n\nPlease complete your candidate application form using the link below:\n${data.formUrl || 'https://forms.gle/sample-form'}\n\nKindly share your CV on this WhatsApp number once completed.\n\nBest Regards,\nGenius Consultancy Team`;

      case 'CV_REQUEST':
        return `Hello ${data.candidateName},\n\nWe have received your details for *${data.jobTitle}* at *${data.companyName}*. Please send a clear copy of your updated CV / Resume here on WhatsApp for internal screening.\n\nThank you,\nGenius Consultancy`;

      case 'INTERVIEW_INVITE':
        return `Congratulations ${data.candidateName}!\n\nYour profile has been shortlisted for an interview for the *${data.jobTitle}* role at *${data.companyName}*.\n\n📅 Date & Time: ${data.interviewDate || 'As scheduled'}\n📍 Venue: ${data.interviewLocation || 'Company Office'}\n\nPlease carry 2 copies of your resume, Aadhar Card, and Driving License.\n\nBest of luck,\nGenius Consultancy`;

      default:
        return '';
    }
  }
}
