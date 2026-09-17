import { prisma } from '@/server/db/prisma';
import { AuditService } from '@/server/services/AuditService';

export interface CreateQualityReviewInput {
  applicationId: string;
  executiveId: string;
  reviewerId: string;
  communicationScore: number;
  jobExplanationScore: number;
  processAdherenceScore: number;
  remarks: string;
}

export class QualityService {
  static async createReview(input: CreateQualityReviewInput) {
    const { applicationId, executiveId, reviewerId, communicationScore, jobExplanationScore, processAdherenceScore, remarks } = input;

    // Calculate average rating
    const rating = Math.round((communicationScore + jobExplanationScore + processAdherenceScore) / 3);

    const review = await prisma.qualityReview.create({
      data: {
        applicationId,
        executiveId,
        reviewerId,
        rating,
        communicationScore,
        jobExplanationScore,
        processAdherenceScore,
        remarks,
        reviewedAt: new Date(),
      },
    });

    await AuditService.log({
      userId: reviewerId,
      action: 'QUALITY_REVIEW_CREATED',
      entity: 'QualityReview',
      entityId: review.id,
      newValues: {
        executiveId,
        rating,
        communicationScore,
        jobExplanationScore,
        processAdherenceScore,
        remarks,
      },
    });

    return review;
  }

  static async getExecutiveQualitySummary(executiveId: string) {
    const reviews = await prisma.qualityReview.findMany({
      where: { executiveId },
      include: {
        reviewer: { select: { id: true, fullName: true } },
        application: {
          select: {
            id: true,
            applicationCode: true,
            candidate: { select: { fullName: true } },
            job: { select: { jobTitle: true } },
          },
        },
      },
      orderBy: { reviewedAt: 'desc' },
    });

    if (reviews.length === 0) {
      return { totalReviews: 0, averageRating: 0, reviews: [] };
    }

    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    return {
      totalReviews: reviews.length,
      averageRating: parseFloat(avg.toFixed(1)),
      reviews,
    };
  }
}
