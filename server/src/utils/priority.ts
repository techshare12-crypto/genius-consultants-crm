interface CandidateScoreInput {
  createdAt: Date;
  leadStage: string;
  hasTwoWheeler?: boolean;
  hasDrivingLicense?: boolean;
  interestedInFieldSales?: boolean;
  totalExperienceYears?: number;
  callActivitiesCount?: number;
  callbacksCount?: number;
  lastOutcome?: string;
  email?: string | null;
  currentLocation?: string | null;
  education?: string | null;
  expectedSalary?: string | null;
}

/**
 * Calculates a dynamic Lead Priority Score (0 - 100).
 * High priority = Fresh leads, confirmed interest, pending callbacks, eligible candidates.
 */
export function calculateLeadPriorityScore(candidate: CandidateScoreInput): number {
  let score = 50;

  // Freshness (added in last 48 hours gets boost)
  const ageHours = (Date.now() - new Date(candidate.createdAt).getTime()) / (1000 * 60 * 60);
  if (ageHours < 24) score += 20;
  else if (ageHours < 72) score += 10;
  else if (ageHours > 168) score -= 10;

  // Eligibility bonus (Key recruitment criteria)
  if (candidate.hasTwoWheeler) score += 5;
  if (candidate.hasDrivingLicense) score += 5;
  if (candidate.interestedInFieldSales) score += 5;
  if ((candidate.totalExperienceYears ?? 0) > 0) score += 5;

  // Stage & Call activity bonus
  if (candidate.leadStage === 'SHORTLISTED' || candidate.leadStage === 'INTERESTED') score += 15;
  if (candidate.lastOutcome === 'CALL_BACK' || candidate.lastOutcome === 'BUSY') score += 10;
  if (candidate.lastOutcome === 'RNR') {
    // If called many times without answer, lower priority
    const attempts = candidate.callActivitiesCount || 0;
    if (attempts >= 4) score -= 25;
    else score -= 5;
  }
  if (candidate.lastOutcome === 'NOT_INTERESTED' || candidate.lastOutcome === 'NUMBER_INVALID') {
    score = 5;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculates a Data Quality Score (0 - 100) based on profile completeness and validity.
 */
export function calculateDataQualityScore(candidate: {
  name: string;
  primaryPhone: string;
  email?: string | null;
  currentLocation?: string | null;
  education?: string | null;
  totalExperienceYears?: number;
  currentSalary?: string | null;
  expectedSalary?: string | null;
  noticePeriod?: string | null;
}): number {
  let score = 0;
  if (candidate.name && candidate.name.trim().length > 2) score += 20;
  if (candidate.primaryPhone && candidate.primaryPhone.length === 10) score += 30;
  if (candidate.email && candidate.email.includes('@')) score += 10;
  if (candidate.currentLocation && candidate.currentLocation.trim().length > 1) score += 10;
  if (candidate.education) score += 10;
  if (candidate.totalExperienceYears !== undefined) score += 5;
  if (candidate.expectedSalary) score += 10;
  if (candidate.noticePeriod) score += 5;

  return Math.min(100, score);
}
