import { z } from 'zod';

// ==========================================
// AUTH & USERS
// ==========================================

export const PasswordValidationSchema = z.string().min(8, 'Password must be at least 8 characters');

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const CreateUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  fullName: z.string().min(2, 'Full name is required'),
  password: PasswordValidationSchema,
  phone: z.string().optional(),
  roles: z.array(z.string()).min(1, 'At least one role must be assigned'),
  teamId: z.string().uuid().optional().nullable(),
});

export const UpdateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  presenceStatus: z.enum(['ONLINE', 'ACTIVE', 'CALLING_ACTIVITY', 'AFTER_CALL_WORK', 'IDLE', 'BREAK', 'OFFLINE']).optional(),
  teamId: z.string().uuid().optional().nullable(),
  roles: z.array(z.string()).optional(),
  password: PasswordValidationSchema.optional(),
});

export const ResetPasswordSchema = z.object({
  password: PasswordValidationSchema,
});

// ==========================================
// COMPANIES & BUSINESS DEVELOPMENT
// ==========================================

export const CreateCompanySchema = z.object({
  companyName: z.string().min(2, 'Company name is required'),
  industry: z.string().optional(),
  companyType: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  status: z.enum(['PROSPECT', 'CONTACTED', 'DISCUSSION', 'NEGOTIATION', 'CONTRACT_PENDING', 'ACTIVE', 'INACTIVE', 'CLOSED']).default('PROSPECT'),
  source: z.string().optional(),
  notes: z.string().optional(),
  primaryContact: z.object({
    contactName: z.string().min(2, 'Primary contact name is required'),
    designation: z.string().optional(),
    phone: z.string().min(7, 'Contact phone is required'),
    email: z.string().email().optional().or(z.literal('')),
  }).optional(),
});

export const JobLocationInputSchema = z.object({
  city: z.string().min(1, 'City is required'),
  state: z.string().optional().nullable(),
  vacancies: z.number().int().min(1, 'Location vacancies must be at least 1').default(1),
});

export const CreateJobSchema = z
  .object({
    companyId: z.string().uuid('Invalid company ID'),
    jobTitle: z.string().min(2, 'Job title is required'),
    department: z.string().optional(),
    jobDescription: z.string().optional(),
    vacancies: z.number().int().min(1, 'Total vacancies must be at least 1').default(1),
    location: z.string().min(2, 'Location is required'),
    locations: z.array(z.union([z.string(), JobLocationInputSchema])).optional(),
    salaryMin: z.number().optional().nullable(),
    salaryMax: z.number().optional().nullable(),
    salaryText: z.string().optional(),
    experienceMin: z.number().int().min(0).default(0),
    experienceMax: z.number().int().optional().nullable(),
    educationRequirement: z.string().optional(),
    genderRequirement: z.string().optional(),
    ageRequirement: z.string().optional(),
    skillsRequired: z.array(z.string()).default([]),
    twoWheelerRequired: z.boolean().default(false),
    drivingLicenseRequired: z.boolean().default(false),
    noticePeriod: z.string().optional(),
    jobStatus: z.enum(['DRAFT', 'OPEN', 'ON_HOLD', 'FILLED', 'CLOSED', 'CANCELLED']).default('OPEN'),
  })
  .superRefine((val, ctx) => {
    if (val.locations && val.locations.length > 0) {
      let totalAllocated = 0;
      for (let i = 0; i < val.locations.length; i++) {
        const loc = val.locations[i];
        if (typeof loc === 'string') {
          if (!loc.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Location city cannot be empty',
              path: ['locations', i],
            });
          }
          // If only 1 location is provided as string, it covers all vacancies; otherwise 1
          totalAllocated += val.locations.length === 1 ? val.vacancies : 1;
        } else {
          if (!loc.city || !loc.city.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Location city cannot be empty',
              path: ['locations', i, 'city'],
            });
          }
          if (loc.vacancies === undefined || loc.vacancies === null || loc.vacancies < 1) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Location vacancies must be at least 1',
              path: ['locations', i, 'vacancies'],
            });
          }
          totalAllocated += Number(loc.vacancies) || 0;
        }
      }

      if (totalAllocated !== val.vacancies) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Location vacancy allocation must equal total vacancies. Allocated: ${totalAllocated} / ${val.vacancies}.`,
          path: ['locations'],
        });
      }
    }
  });

// ==========================================
// CANDIDATES & APPLICATIONS
// ==========================================

export const CreateCandidateSchema = z.object({
  fullName: z.string().min(2, 'Candidate full name is required'),
  phone: z.string().min(7, 'Valid contact number is required'),
  alternatePhone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')),
  gender: z.string().optional(),
  age: z.number().int().min(16).max(75).optional().nullable(),
  currentLocation: z.string().optional(),
  permanentLocation: z.string().optional(),
  education: z.string().optional(),
  experienceYears: z.number().int().min(0).default(0),
  experienceMonths: z.number().int().min(0).max(11).default(0),
  currentCompany: z.string().optional(),
  currentJob: z.string().optional(),
  currentSalary: z.number().optional().nullable(),
  expectedSalary: z.number().optional().nullable(),
  skills: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  hasTwoWheeler: z.boolean().default(false),
  hasDrivingLicense: z.boolean().default(false),
  source: z.string().default('MANUAL_ENTRY'),
  notes: z.string().optional(),
});

export const AssignLeadSchema = z.object({
  applicationIds: z.array(z.string().uuid()).min(1, 'Select at least one application to assign'),
  executiveId: z.string().uuid('Invalid executive ID'),
  teamId: z.string().uuid().optional().nullable(),
  reason: z.string().optional(),
});

// ==========================================
// CALLING & CALLBACKS
// ==========================================

export const LogCallSchema = z.object({
  applicationId: z.string().uuid('Invalid application ID'),
  candidateId: z.string().uuid('Invalid candidate ID'),
  callOutcome: z.enum([
    'CONNECTED',
    'RNR',
    'CALLBACK',
    'NOT_INTERESTED',
    'INTERESTED',
    'NOT_ELIGIBLE',
    'WRONG_NUMBER',
    'SWITCHED_OFF',
    'BUSY',
    'SHORTLISTED',
  ]),
  remarks: z.string().optional(),
  callbackRequired: z.boolean().default(false),
  callbackDateTime: z.string().datetime().optional().nullable(),
  callbackReason: z.string().optional(),
  callbackPriority: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
});

export const CompleteCallbackSchema = z.object({
  callbackId: z.string().uuid('Invalid callback ID'),
  completionRemarks: z.string().min(2, 'Completion remarks are required'),
  nextOutcome: z.enum(['CONNECTED', 'RNR', 'CALLBACK', 'SHORTLISTED', 'NOT_INTERESTED']).optional(),
});

// ==========================================
// CANDIDATE VERIFICATION & QUALIFICATION
// ==========================================

export const SaveVerificationSchema = z.object({
  applicationId: z.string().uuid('Invalid application ID'),
  email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  age: z.number().int().min(16).max(75).optional().nullable(),
  gender: z.string().optional().nullable(),
  currentLocation: z.string().optional().nullable(),
  appliedLocation: z.string().optional().nullable(),
  education: z.string().optional().nullable(),
  experienceYears: z.number().int().min(0).optional().nullable(),
  experienceMonths: z.number().int().min(0).max(11).optional().nullable(),
  currentCompany: z.string().optional().nullable(),
  previousCompany: z.string().optional().nullable(),
  currentSalary: z.number().optional().nullable(),
  expectedSalary: z.number().optional().nullable(),
  noticePeriod: z.string().optional().nullable(),
  hasTwoWheeler: z.boolean().optional().nullable(),
  hasDrivingLicense: z.boolean().optional().nullable(),
  interestedInFieldSales: z.boolean().optional().nullable(),
  interestedInAutomobile: z.boolean().optional().nullable(),
  skills: z.array(z.string()).optional().default([]),
  languages: z.array(z.string()).optional().default([]),
  assets: z.array(z.string()).optional().default([]),
  customAnswers: z.record(z.any()).optional().default({}),
  remarks: z.string().optional().nullable(),
});

// ==========================================
// SCREENING & FINAL SHORTLIST
// ==========================================

export const EvaluateScreeningSchema = z.object({
  applicationId: z.string().uuid('Invalid application ID'),
  screeningStatus: z.enum(['PASS', 'FAIL', 'HOLD']),
  remarks: z.string().min(2, 'Remarks are required for screening evaluation'),
  holdFollowupDate: z.string().optional().nullable(),
  nextAction: z.string().optional(),
});

export const AddToFinalShortlistSchema = z.object({
  applicationIds: z.array(z.string().uuid()).min(1, 'Select at least one application to finalize'),
  jobId: z.string().uuid('Invalid job requirement ID'),
  remarks: z.string().optional(),
});

// ==========================================
// CLIENT SUBMISSIONS & INTERVIEWS
// ==========================================

export const CreateClientSubmissionSchema = z.object({
  companyId: z.string().uuid('Invalid company ID'),
  jobId: z.string().uuid('Invalid job ID'),
  applicationIds: z.array(z.string().uuid()).min(1, 'Select at least one shortlisted application'),
  submissionMethod: z.enum(['EMAIL', 'WHATSAPP_MANUAL', 'PORTAL']).default('EMAIL'),
  remarks: z.string().optional(),
});

export const ScheduleInterviewSchema = z.object({
  applicationId: z.string().uuid('Invalid application ID'),
  submissionId: z.string().uuid().optional().nullable(),
  roundNumber: z.number().int().min(1).default(1),
  roundName: z.string().min(2, 'Round name is required (e.g. Round 1, HR Round)'),
  scheduledAt: z.string().datetime(),
  mode: z.enum(['OFFLINE', 'VIRTUAL']).default('OFFLINE'),
  location: z.string().optional(),
  notes: z.string().optional(),
});

export const UpdateInterviewOutcomeSchema = z.object({
  interviewId: z.string().uuid('Invalid interview ID'),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'RESCHEDULED', 'NO_SHOW', 'CANCELLED']),
  outcome: z.enum(['PENDING', 'SELECTED_FOR_NEXT_ROUND', 'SELECTED', 'REJECTED', 'HOLD']),
  feedback: z.string().min(2, 'Client feedback remarks are required'),
  scheduleNextRound: z.boolean().default(false),
  nextRoundScheduledAt: z.string().datetime().optional(),
  nextRoundName: z.string().optional(),
});

export const UpdateJoiningStatusSchema = z.object({
  applicationId: z.string().uuid('Invalid application ID'),
  status: z.enum(['JOINING_PENDING', 'JOINED', 'NOT_JOINED']),
  joiningDate: z.string().optional().nullable(),
  reason: z.string().optional(),
});

// ==========================================
// QUALITY REVIEWS
// ==========================================

export const CreateQualityReviewSchema = z.object({
  applicationId: z.string().uuid('Invalid application ID'),
  executiveId: z.string().uuid('Invalid executive ID'),
  communicationScore: z.number().int().min(1).max(5),
  jobExplanationScore: z.number().int().min(1).max(5),
  processAdherenceScore: z.number().int().min(1).max(5),
  remarks: z.string().min(5, 'Detailed review remarks required'),
});
