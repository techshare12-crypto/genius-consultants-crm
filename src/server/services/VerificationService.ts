import { prisma } from '@/server/db/prisma';
import { AuditService } from '@/server/services/AuditService';

export interface QualificationCriterion {
  key: string;
  label: string;
  requirement: string;
  candidateValue: string;
  status: 'MATCH' | 'MISMATCH' | 'REVIEW' | 'NOT_ANSWERED';
  isMandatory: boolean;
  notes?: string;
}

export interface QualificationResult {
  overallStatus: 'MATCH' | 'MISMATCH' | 'REVIEW';
  matchCount: number;
  mismatchCount: number;
  reviewCount: number;
  notAnsweredCount: number;
  rules: QualificationCriterion[];
}

export interface VerificationDataInput {
  email?: string | null;
  age?: number | null;
  gender?: string | null;
  currentLocation?: string | null;
  appliedLocation?: string | null;
  education?: string | null;
  experienceYears?: number | null;
  experienceMonths?: number | null;
  currentCompany?: string | null;
  previousCompany?: string | null;
  currentSalary?: number | null;
  expectedSalary?: number | null;
  noticePeriod?: string | null;
  hasTwoWheeler?: boolean | null;
  hasDrivingLicense?: boolean | null;
  interestedInFieldSales?: boolean | null;
  interestedInAutomobile?: boolean | null;
  skills?: string[];
  languages?: string[];
  assets?: string[];
  customAnswers?: Record<string, any>;
}

export class VerificationService {
  /**
   * Rule-based qualification engine comparing CANDIDATE-VERIFIED data vs JOB REQUIREMENT.
   * Source/Imported data is strictly reference information and is never used as verified truth.
   * Unverified values produce a REVIEW (Under Review) state rather than a false match or mismatch.
   */
  static evaluateQualification(
    verified: Partial<VerificationDataInput>,
    job: {
      location?: string | null;
      salaryMin?: any;
      salaryMax?: any;
      experienceMin?: number | null;
      experienceMax?: number | null;
      ageRequirement?: string | null;
      educationRequirement?: string | null;
      twoWheelerRequired?: boolean | null;
      drivingLicenseRequired?: boolean | null;
      jobTitle?: string | null;
      jobDescription?: string | null;
      skillsRequired?: any;
      company?: { industry?: string | null; companyName?: string | null } | null;
    }
  ): QualificationResult {
    const criteria: QualificationCriterion[] = [];

    // 1. Age Evaluation: Verified Age vs Job Age Criteria
    if (job.ageRequirement) {
      const ageReq = job.ageRequirement.trim();
      const candAge = verified.age;

      if (candAge != null) {
        const numbers = ageReq.match(/\d+/g)?.map(Number) || [];
        if (numbers.length >= 2) {
          const [min, max] = numbers;
          const status = candAge >= min && candAge <= max ? 'MATCH' : 'MISMATCH';
          criteria.push({
            key: 'age',
            label: 'Age Criteria',
            requirement: ageReq,
            candidateValue: `${candAge} Yrs (Verified)`,
            status,
            isMandatory: true,
            notes: status === 'MATCH' ? `Verified age ${candAge} meets criteria (${min}-${max} yrs)` : `Verified age ${candAge} outside criteria (${min}-${max} yrs)`,
          });
        } else if (numbers.length === 1) {
          const isMax = ageReq.toLowerCase().includes('max') || ageReq.toLowerCase().includes('below') || ageReq.toLowerCase().includes('under');
          const status = isMax ? (candAge <= numbers[0] ? 'MATCH' : 'MISMATCH') : (candAge >= numbers[0] ? 'MATCH' : 'MISMATCH');
          criteria.push({
            key: 'age',
            label: 'Age Criteria',
            requirement: ageReq,
            candidateValue: `${candAge} Yrs (Verified)`,
            status,
            isMandatory: true,
            notes: `Verified age evaluated vs threshold (${numbers[0]})`,
          });
        } else {
          criteria.push({
            key: 'age',
            label: 'Age Criteria',
            requirement: ageReq,
            candidateValue: `${candAge} Yrs (Verified)`,
            status: 'REVIEW',
            isMandatory: true,
            notes: 'Age requirement format requires manual review',
          });
        }
      } else {
        // Missing verified age -> REVIEW (Not assumed verified from source)
        criteria.push({
          key: 'age',
          label: 'Age Criteria',
          requirement: ageReq,
          candidateValue: 'Not Verified',
          status: 'REVIEW',
          isMandatory: true,
          notes: 'Candidate age has not been confirmed during call',
        });
      }
    } else {
      criteria.push({
        key: 'age',
        label: 'Age Criteria',
        requirement: 'Open / Any Age',
        candidateValue: verified.age != null ? `${verified.age} Yrs (Verified)` : 'Not required',
        status: 'MATCH',
        isMandatory: false,
      });
    }

    // 2. Experience Evaluation: Verified Experience vs Job Min/Max
    const expMin = job.experienceMin ?? 0;
    const expMax = job.experienceMax;
    let expReqStr = `Min ${expMin} yr`;
    if (expMax) expReqStr += ` - Max ${expMax} yrs`;

    if (verified.experienceYears != null || verified.experienceMonths != null) {
      const candExpYears = (verified.experienceYears ?? 0) + ((verified.experienceMonths ?? 0) / 12);
      const candExpDisplay = `${verified.experienceYears ?? 0}y ${verified.experienceMonths ?? 0}m (Verified)`;

      let expStatus: 'MATCH' | 'MISMATCH' | 'REVIEW' = 'MATCH';
      let expNotes = 'Verified experience satisfies job requirement';

      if (candExpYears < expMin) {
        expStatus = 'MISMATCH';
        expNotes = `${verified.experienceYears ?? 0}y ${verified.experienceMonths ?? 0}m is below required minimum (${expMin} yrs)`;
      } else if (expMax && candExpYears > expMax) {
        expStatus = 'REVIEW';
        expNotes = `${verified.experienceYears ?? 0}y exceeds maximum target (${expMax} yrs) - overqualification review`;
      }

      criteria.push({
        key: 'experience',
        label: 'Experience Level',
        requirement: expReqStr,
        candidateValue: candExpDisplay,
        status: expStatus,
        isMandatory: expMin > 0,
        notes: expNotes,
      });
    } else if (expMin > 0) {
      // Missing verified experience -> REVIEW
      criteria.push({
        key: 'experience',
        label: 'Experience Level',
        requirement: expReqStr,
        candidateValue: 'Not Verified',
        status: 'REVIEW',
        isMandatory: true,
        notes: 'Candidate total experience has not been confirmed during call',
      });
    } else {
      criteria.push({
        key: 'experience',
        label: 'Experience Level',
        requirement: expReqStr,
        candidateValue: 'Fresher / Open',
        status: 'MATCH',
        isMandatory: false,
      });
    }

    // 3. Expected Salary vs Budget
    const salaryMax = job.salaryMax != null ? Number(job.salaryMax) : null;
    const expectedSal = verified.expectedSalary != null ? Number(verified.expectedSalary) : null;

    if (salaryMax != null) {
      if (expectedSal != null) {
        let salStatus: 'MATCH' | 'MISMATCH' | 'REVIEW' = 'MATCH';
        let salNotes = `Expected ₹${expectedSal.toLocaleString()} is within budget (max ₹${salaryMax.toLocaleString()})`;

        if (expectedSal > salaryMax) {
          salStatus = 'MISMATCH';
          salNotes = `Expected ₹${expectedSal.toLocaleString()} exceeds job max budget ₹${salaryMax.toLocaleString()}`;
        }

        criteria.push({
          key: 'salary',
          label: 'Salary Alignment',
          requirement: `Budget up to ₹${salaryMax.toLocaleString()}`,
          candidateValue: `₹${expectedSal.toLocaleString()} (Verified)`,
          status: salStatus,
          isMandatory: true,
          notes: salNotes,
        });
      } else {
        // Missing verified salary -> REVIEW
        criteria.push({
          key: 'salary',
          label: 'Salary Alignment',
          requirement: `Budget up to ₹${salaryMax.toLocaleString()}`,
          candidateValue: 'Not Verified',
          status: 'REVIEW',
          isMandatory: true,
          notes: 'Candidate expected salary has not been confirmed during call',
        });
      }
    } else {
      criteria.push({
        key: 'salary',
        label: 'Salary Alignment',
        requirement: 'Negotiable / Open',
        candidateValue: expectedSal != null ? `₹${expectedSal.toLocaleString()} (Verified)` : 'Open',
        status: 'MATCH',
        isMandatory: false,
      });
    }

    // 4. Two-Wheeler Requirement
    if (job.twoWheelerRequired) {
      if (verified.hasTwoWheeler === true) {
        criteria.push({
          key: 'twoWheeler',
          label: 'Two-Wheeler Requirement',
          requirement: 'Mandatory',
          candidateValue: 'Yes (Confirmed Owns Bike)',
          status: 'MATCH',
          isMandatory: true,
          notes: 'Candidate owns/has 2-wheeler as required',
        });
      } else if (verified.hasTwoWheeler === false) {
        criteria.push({
          key: 'twoWheeler',
          label: 'Two-Wheeler Requirement',
          requirement: 'Mandatory',
          candidateValue: 'No (Confirmed No Bike)',
          status: 'MISMATCH',
          isMandatory: true,
          notes: 'Mandatory 2-wheeler missing for field/delivery role',
        });
      } else {
        criteria.push({
          key: 'twoWheeler',
          label: 'Two-Wheeler Requirement',
          requirement: 'Mandatory',
          candidateValue: 'Not Verified',
          status: 'REVIEW',
          isMandatory: true,
          notes: 'Two-wheeler ownership has not been confirmed with candidate',
        });
      }
    } else {
      criteria.push({
        key: 'twoWheeler',
        label: 'Two-Wheeler Requirement',
        requirement: 'Not required',
        candidateValue: verified.hasTwoWheeler ? 'Has Bike (Bonus Asset)' : 'Not required',
        status: 'MATCH',
        isMandatory: false,
      });
    }

    // 5. Driving License Requirement
    if (job.drivingLicenseRequired) {
      if (verified.hasDrivingLicense === true) {
        criteria.push({
          key: 'drivingLicense',
          label: 'Driving License',
          requirement: 'Mandatory',
          candidateValue: 'Yes (Valid DL Confirmed)',
          status: 'MATCH',
          isMandatory: true,
          notes: 'Candidate holds valid Driving License as required',
        });
      } else if (verified.hasDrivingLicense === false) {
        criteria.push({
          key: 'drivingLicense',
          label: 'Driving License',
          requirement: 'Mandatory',
          candidateValue: 'No (Confirmed No License)',
          status: 'MISMATCH',
          isMandatory: true,
          notes: 'Mandatory Driving License missing for this position',
        });
      } else {
        criteria.push({
          key: 'drivingLicense',
          label: 'Driving License',
          requirement: 'Mandatory',
          candidateValue: 'Not Verified',
          status: 'REVIEW',
          isMandatory: true,
          notes: 'Driving license validity has not been confirmed with candidate',
        });
      }
    } else {
      criteria.push({
        key: 'drivingLicense',
        label: 'Driving License',
        requirement: 'Not required',
        candidateValue: verified.hasDrivingLicense ? 'Has License (Bonus)' : 'Not required',
        status: 'MATCH',
        isMandatory: false,
      });
    }

    // 6. Location Match
    const jobLoc = (job.location || '').trim().toLowerCase();
    const candLoc = (verified.currentLocation || '').trim().toLowerCase();
    const applLoc = (verified.appliedLocation || '').trim().toLowerCase();

    if (jobLoc) {
      if (candLoc || applLoc) {
        if (candLoc.includes(jobLoc) || jobLoc.includes(candLoc) || applLoc.includes(jobLoc)) {
          criteria.push({
            key: 'location',
            label: 'Location Match',
            requirement: job.location || 'Any',
            candidateValue: `${verified.currentLocation || verified.appliedLocation} (Verified)`,
            status: 'MATCH',
            isMandatory: false,
            notes: `Candidate location matches opening (${job.location})`,
          });
        } else {
          criteria.push({
            key: 'location',
            label: 'Location Match',
            requirement: job.location || 'Any',
            candidateValue: `${verified.currentLocation || verified.appliedLocation} (Verified)`,
            status: 'REVIEW',
            isMandatory: false,
            notes: `Candidate in ${verified.currentLocation}, job in ${job.location}. Verify relocation willingness.`,
          });
        }
      } else {
        criteria.push({
          key: 'location',
          label: 'Location Match',
          requirement: job.location || 'Any',
          candidateValue: 'Not Verified',
          status: 'REVIEW',
          isMandatory: false,
          notes: 'Candidate location preference has not been confirmed during call',
        });
      }
    } else {
      criteria.push({
        key: 'location',
        label: 'Location Match',
        requirement: 'Open / Flexible',
        candidateValue: verified.currentLocation ? `${verified.currentLocation} (Verified)` : 'Open',
        status: 'MATCH',
        isMandatory: false,
      });
    }

    // 7. Field Sales Willingness
    const isFieldRole =
      (job.jobTitle?.toLowerCase().includes('field') ?? false) ||
      (job.jobTitle?.toLowerCase().includes('sales') ?? false) ||
      (job.jobDescription?.toLowerCase().includes('field visit') ?? false);

    if (isFieldRole) {
      if (verified.interestedInFieldSales === true) {
        criteria.push({
          key: 'fieldSales',
          label: 'Field Sales Willingness',
          requirement: 'Required for Field Position',
          candidateValue: 'Yes (Confirmed Willing for Field Work)',
          status: 'MATCH',
          isMandatory: true,
          notes: 'Candidate confirmed interest in on-field client visits',
        });
      } else if (verified.interestedInFieldSales === false) {
        criteria.push({
          key: 'fieldSales',
          label: 'Field Sales Willingness',
          requirement: 'Required for Field Position',
          candidateValue: 'No (Not Willing for Field Work)',
          status: 'MISMATCH',
          isMandatory: true,
          notes: 'Candidate not willing for required on-field travel',
        });
      } else {
        criteria.push({
          key: 'fieldSales',
          label: 'Field Sales Willingness',
          requirement: 'Required for Field Position',
          candidateValue: 'Not Verified',
          status: 'REVIEW',
          isMandatory: true,
          notes: 'Field sales willingness has not been confirmed during call',
        });
      }
    } else {
      criteria.push({
        key: 'fieldSales',
        label: 'Field Sales Willingness',
        requirement: 'Office / Non-Field',
        candidateValue: 'Standard Fit',
        status: 'MATCH',
        isMandatory: false,
      });
    }

    // 8. Automobile Sector Alignment
    const isAutoRole =
      (job.jobTitle?.toLowerCase().includes('auto') ?? false) ||
      (job.company?.companyName?.toLowerCase().includes('motors') ?? false) ||
      (job.company?.industry?.toLowerCase().includes('auto') ?? false) ||
      (job.jobDescription?.toLowerCase().includes('automobile') ?? false);

    if (isAutoRole) {
      if (verified.interestedInAutomobile === true) {
        criteria.push({
          key: 'automobile',
          label: 'Automobile Sector Alignment',
          requirement: 'Automobile Opening',
          candidateValue: 'Yes (Confirmed Interest in Auto)',
          status: 'MATCH',
          isMandatory: false,
          notes: 'Candidate confirmed interest in automotive sector',
        });
      } else if (verified.interestedInAutomobile === false) {
        criteria.push({
          key: 'automobile',
          label: 'Automobile Sector Alignment',
          requirement: 'Automobile Opening',
          candidateValue: 'No Prior Preference',
          status: 'REVIEW',
          isMandatory: false,
          notes: 'Candidate has no prior auto preference - assess interest',
        });
      } else {
        criteria.push({
          key: 'automobile',
          label: 'Automobile Sector Alignment',
          requirement: 'Automobile Opening',
          candidateValue: 'Not Verified',
          status: 'REVIEW',
          isMandatory: false,
          notes: 'Automobile sector interest not confirmed with candidate',
        });
      }
    } else {
      criteria.push({
        key: 'automobile',
        label: 'Industry Alignment',
        requirement: 'General Opening',
        candidateValue: 'Standard Fit',
        status: 'MATCH',
        isMandatory: false,
      });
    }

    // Calculate Summary Counts
    let matchCount = 0;
    let mismatchCount = 0;
    let reviewCount = 0;
    let notAnsweredCount = 0;

    for (const c of criteria) {
      if (c.status === 'MATCH') matchCount++;
      else if (c.status === 'MISMATCH') mismatchCount++;
      else if (c.status === 'REVIEW') reviewCount++;
      else if (c.status === 'NOT_ANSWERED') notAnsweredCount++;
    }

    // Overall Status Computation
    let overallStatus: 'MATCH' | 'MISMATCH' | 'REVIEW' = 'MATCH';
    if (mismatchCount > 0) {
      overallStatus = 'MISMATCH';
    } else if (reviewCount > 0 || notAnsweredCount > 0) {
      overallStatus = 'REVIEW';
    }

    return {
      overallStatus,
      matchCount,
      mismatchCount,
      reviewCount,
      notAnsweredCount,
      rules: criteria,
    };
  }

  /**
   * Fetch verification for an application and evaluate qualification vs job requirement.
   * Only persisted ApplicationVerification data is treated as verified.
   * If unverified, candidate master values are returned as source reference only.
   */
  static async getVerification(applicationId: string) {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        candidate: true,
        job: {
          include: {
            company: true,
          },
        },
        verification: {
          include: {
            verifiedByUser: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
      },
    });

    if (!app) {
      throw new Error('Application not found');
    }

    // Authoritative verified data comes exclusively from ApplicationVerification
    const verifiedData: Partial<VerificationDataInput> = app.verification
      ? {
          email: app.verification.email ?? undefined,
          age: app.verification.age ?? undefined,
          gender: app.verification.gender ?? undefined,
          currentLocation: app.verification.currentLocation ?? undefined,
          appliedLocation: app.verification.appliedLocation ?? undefined,
          education: app.verification.education ?? undefined,
          experienceYears: app.verification.experienceYears ?? undefined,
          experienceMonths: app.verification.experienceMonths ?? undefined,
          currentCompany: app.verification.currentCompany ?? undefined,
          previousCompany: app.verification.previousCompany ?? undefined,
          currentSalary: app.verification.currentSalary ? Number(app.verification.currentSalary) : undefined,
          expectedSalary: app.verification.expectedSalary ? Number(app.verification.expectedSalary) : undefined,
          noticePeriod: app.verification.noticePeriod ?? undefined,
          hasTwoWheeler: app.verification.hasTwoWheeler ?? undefined,
          hasDrivingLicense: app.verification.hasDrivingLicense ?? undefined,
          interestedInFieldSales: app.verification.interestedInFieldSales ?? undefined,
          interestedInAutomobile: app.verification.interestedInAutomobile ?? undefined,
          skills: Array.isArray(app.verification.skills) ? (app.verification.skills as string[]) : [],
          languages: Array.isArray(app.verification.languages) ? (app.verification.languages as string[]) : [],
        }
      : {};

    const evaluation = this.evaluateQualification(verifiedData, app.job);

    return {
      applicationId: app.id,
      applicationCode: app.applicationCode,
      currentStage: app.currentStage,
      // Source/Imported Master Data (Reference Only)
      sourceCandidate: {
        id: app.candidate.id,
        candidateCode: app.candidate.candidateCode,
        fullName: app.candidate.fullName,
        phone: app.candidate.normalizedPhone,
        email: app.candidate.email,
        currentLocation: app.candidate.currentLocation,
        education: app.candidate.education,
        experienceYears: app.candidate.experienceYears,
        experienceMonths: app.candidate.experienceMonths,
        currentSalary: app.candidate.currentSalary,
        expectedSalary: app.candidate.expectedSalary,
        hasTwoWheeler: app.candidate.hasTwoWheeler,
        hasDrivingLicense: app.candidate.hasDrivingLicense,
      },
      job: {
        id: app.job.id,
        jobTitle: app.job.jobTitle,
        location: app.job.location,
        salaryMin: app.job.salaryMin,
        salaryMax: app.job.salaryMax,
        experienceMin: app.job.experienceMin,
        experienceMax: app.job.experienceMax,
        twoWheelerRequired: app.job.twoWheelerRequired,
        drivingLicenseRequired: app.job.drivingLicenseRequired,
        ageRequirement: app.job.ageRequirement,
        educationRequirement: app.job.educationRequirement,
        companyName: app.job.company.companyName,
      },
      // Candidate-Verified Data (Authoritative)
      verification: app.verification,
      qualificationEvaluation: evaluation,
    };
  }

  /**
   * Save or update candidate-verified data for an application without mutating candidate master source data.
   */
  static async upsertVerification(
    applicationId: string,
    data: VerificationDataInput,
    userId: string
  ) {
    const existing = await prisma.applicationVerification.findUnique({
      where: { applicationId },
    });

    const verification = await prisma.applicationVerification.upsert({
      where: { applicationId },
      create: {
        applicationId,
        verifiedByUserId: userId,
        email: data.email,
        age: data.age,
        gender: data.gender,
        currentLocation: data.currentLocation,
        appliedLocation: data.appliedLocation,
        education: data.education,
        experienceYears: data.experienceYears ?? 0,
        experienceMonths: data.experienceMonths ?? 0,
        currentCompany: data.currentCompany,
        previousCompany: data.previousCompany,
        currentSalary: data.currentSalary != null ? data.currentSalary : null,
        expectedSalary: data.expectedSalary != null ? data.expectedSalary : null,
        noticePeriod: data.noticePeriod,
        hasTwoWheeler: data.hasTwoWheeler,
        hasDrivingLicense: data.hasDrivingLicense,
        interestedInFieldSales: data.interestedInFieldSales,
        interestedInAutomobile: data.interestedInAutomobile,
        skills: data.skills ? JSON.stringify(data.skills) : '[]',
        languages: data.languages ? JSON.stringify(data.languages) : '[]',
        assets: data.assets ? JSON.stringify(data.assets) : '[]',
        customAnswers: data.customAnswers ? JSON.stringify(data.customAnswers) : '{}',
      },
      update: {
        verifiedByUserId: userId,
        email: data.email,
        age: data.age,
        gender: data.gender,
        currentLocation: data.currentLocation,
        appliedLocation: data.appliedLocation,
        education: data.education,
        experienceYears: data.experienceYears ?? 0,
        experienceMonths: data.experienceMonths ?? 0,
        currentCompany: data.currentCompany,
        previousCompany: data.previousCompany,
        currentSalary: data.currentSalary != null ? data.currentSalary : null,
        expectedSalary: data.expectedSalary != null ? data.expectedSalary : null,
        noticePeriod: data.noticePeriod,
        hasTwoWheeler: data.hasTwoWheeler,
        hasDrivingLicense: data.hasDrivingLicense,
        interestedInFieldSales: data.interestedInFieldSales,
        interestedInAutomobile: data.interestedInAutomobile,
        skills: data.skills ? JSON.stringify(data.skills) : '[]',
        languages: data.languages ? JSON.stringify(data.languages) : '[]',
        assets: data.assets ? JSON.stringify(data.assets) : '[]',
        customAnswers: data.customAnswers ? JSON.stringify(data.customAnswers) : '{}',
      },
    });

    // Record audit log
    await AuditService.log({
      userId,
      action: 'VERIFICATION_SAVED',
      entity: 'ApplicationVerification',
      entityId: verification.id,
      oldValues: existing ? existing : undefined,
      newValues: {
        applicationId,
        verifiedByUserId: userId,
        email: data.email,
        age: data.age,
        experienceYears: data.experienceYears,
        experienceMonths: data.experienceMonths,
        expectedSalary: data.expectedSalary,
        hasTwoWheeler: data.hasTwoWheeler,
        hasDrivingLicense: data.hasDrivingLicense,
      },
    });

    return verification;
  }
}
