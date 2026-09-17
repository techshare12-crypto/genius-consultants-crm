import { prisma } from '@/server/db/prisma';
import { AuditService } from '@/server/services/AuditService';

export interface CreateSubmissionInput {
  companyId: string;
  jobId: string;
  applicationIds: string[];
  submittedById: string;
  submissionMethod: 'EMAIL' | 'WHATSAPP_MANUAL' | 'PORTAL';
  remarks?: string;
}

export class SubmissionService {
  /**
   * Bundles shortlisted applications into a ClientSubmission batch.
   */
  static async createSubmission(input: CreateSubmissionInput) {
    const { companyId, jobId, applicationIds, submittedById, submissionMethod, remarks } = input;

    return await prisma.$transaction(async (tx) => {
      // 1. Generate Submission Code
      const totalSubmissions = await tx.clientSubmission.count();
      const submissionCode = `SUB-${String(totalSubmissions + 1).padStart(6, '0')}`;

      // 2. Create Parent Submission Record
      const submission = await tx.clientSubmission.create({
        data: {
          submissionCode,
          companyId,
          jobId,
          submittedById,
          submittedAt: new Date(),
          submissionMethod,
          remarks: remarks || null,
        },
      });

      // 3. Create Child Items and Advance Applications to SENT_TO_CLIENT
      for (const appId of applicationIds) {
        const app = await tx.application.findUnique({ where: { id: appId } });
        if (!app) continue;

        await tx.clientSubmissionItem.create({
          data: {
            submissionId: submission.id,
            applicationId: appId,
            candidateId: app.candidateId,
            clientFeedback: 'Submitted to client HR',
          },
        });

        await tx.application.update({
          where: { id: appId },
          data: {
            currentStage: 'SENT_TO_CLIENT',
          },
        });

        await AuditService.log(
          {
            userId: submittedById,
            action: 'CLIENT_SUBMISSION_CREATED',
            entity: 'ClientSubmission',
            entityId: submission.id,
            oldValues: { applicationId: appId, previousStage: app.currentStage },
            newValues: { submissionCode, newStage: 'SENT_TO_CLIENT' },
          },
          tx
        );
      }

      return submission;
    });
  }

  /**
   * Lists client submissions with details.
   */
  static async listSubmissions(companyId?: string, jobId?: string) {
    const where: any = {};
    if (companyId) where.companyId = companyId;
    if (jobId) where.jobId = jobId;

    return prisma.clientSubmission.findMany({
      where,
      include: {
        company: { select: { id: true, companyName: true } },
        job: { select: { id: true, jobTitle: true } },
        submittedBy: { select: { id: true, fullName: true } },
        items: {
          include: {
            candidate: { select: { id: true, fullName: true, normalizedPhone: true, currentLocation: true } },
            application: { select: { id: true, applicationCode: true, currentStage: true } },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }
}
