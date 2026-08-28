export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'EXECUTIVE'
  | 'TEAM_LEADER'
  | 'HR_MANAGER'
  | 'RECRUITER'
  | 'DATA_ENTRY_OPERATOR'
  | 'READ_ONLY_MANAGER';

export interface Permission {
  id: string;
  code: string;
  name: string;
  category: string;
  description?: string | null;
}

export interface Role {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isSystem: boolean;
  userCount?: number;
  permissions: string[];
}

export interface User {
  id: string;
  name: string;
  username?: string | null;
  email: string;
  role: UserRole | string;
  roleName?: string;
  roleId?: string | null;
  phone?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'DEACTIVATED';
  joiningDate?: string | null;
  lastLoginAt?: string | null;
  profilePhoto?: string | null;
  targetCallsDaily: number;
  targetShortlistDaily: number;
  createdAt?: string;
  permissions?: string[];
  stats?: {
    leadsAssigned: number;
    callsCompleted: number;
    shortlistedCount: number;
  };
}

// ----------------------------------------------------
// TEAM & COACHING INTERFACES
// ----------------------------------------------------

export interface Team {
  id: string;
  teamName: string;
  teamLeaderId: string;
  status: 'ACTIVE' | 'INACTIVE' | string;
  createdAt: string;
  teamLeader?: { id: string; name: string; email: string; phone?: string | null };
  memberCount?: number;
  members?: User[];
}

export interface TeamMembership {
  id: string;
  teamId: string;
  userId: string;
  status: string;
  joinedAt: string;
  team?: Team;
  user?: User;
}

export interface CoachingNote {
  id: string;
  executiveId: string;
  teamLeaderId: string;
  teamId?: string | null;
  note: string;
  category: 'PERFORMANCE' | 'COACHING' | 'ATTENDANCE' | 'QUALITY' | 'GENERAL' | string;
  visibility: 'PRIVATE_TO_MANAGERS' | 'VISIBLE_TO_EXECUTIVE' | string;
  createdAt: string;
  teamLeader?: { id: string; name: string };
  executive?: { id: string; name: string };
}

// ----------------------------------------------------
// NOTIFICATION INTERFACES
// ----------------------------------------------------

export type NotificationType =
  | 'LEAD_ASSIGNED'
  | 'LEAD_REASSIGNED'
  | 'CALLBACK_DUE'
  | 'CALLBACK_OVERDUE'
  | 'CANDIDATE_SHORTLISTED'
  | 'CV_SUBMITTED'
  | 'INTERVIEW_SCHEDULED'
  | 'CANDIDATE_SELECTED'
  | 'CANDIDATE_JOINED'
  | 'JOB_ORDER_ASSIGNED'
  | 'PERFORMANCE_ALERT'
  | 'COACHING_NOTE'
  | 'SYSTEM';

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  entityType?: 'CANDIDATE' | 'JOB_ORDER' | 'CALLBACK' | 'APPLICATION' | 'TEAM' | 'COACHING_NOTE' | 'SYSTEM' | string | null;
  entityId?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

// ----------------------------------------------------
// COMMUNICATION & WHATSAPP INTERFACES
// ----------------------------------------------------

export interface MessageTemplate {
  id: string;
  name: string;
  category: string;
  subject?: string | null;
  bodyText: string;
  variables?: string | null;
  isActive: boolean;
  createdById?: string | null;
  createdAt: string;
}

export interface CommunicationActivity {
  id: string;
  candidateId: string;
  userId: string;
  jobOrderId?: string | null;
  clientId?: string | null;
  channel: 'WHATSAPP' | 'EMAIL' | 'SMS' | 'CALL' | 'NOTE' | string;
  communicationType: string;
  templateId?: string | null;
  messageContent: string;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  provider: string;
  externalMessageId?: string | null;
  deliveryStatus: 'INITIATED' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | string;
  sentAt: string;
  deliveredAt?: string | null;
  readAt?: string | null;
  notes?: string | null;
  createdAt: string;
  user?: { id: string; name: string; email?: string; role?: string };
  jobOrder?: { id: string; jobTitle: string; displayJobId: string };
  client?: { id: string; companyName: string };
  template?: { id: string; name: string };
}

export interface CandidateFormTracking {
  id: string;
  candidateId: string;
  jobOrderId?: string | null;
  formName: string;
  formUrl: string;
  sentById: string;
  sentDate: string;
  status: 'NOT_SENT' | 'SENT' | 'COMPLETED' | string;
  completedDate?: string | null;
  createdAt: string;
  sentBy?: { id: string; name: string };
  jobOrder?: { id: string; jobTitle: string };
}

export interface CommunicationReminder {
  id: string;
  candidateId: string;
  userId: string;
  jobOrderId?: string | null;
  reminderType: string;
  dueDate: string;
  dueTime?: string | null;
  status: 'PENDING' | 'SENT' | 'DISMISSED' | string;
  reminderCount: number;
  lastReminderAt?: string | null;
  createdAt: string;
  user?: { id: string; name: string };
}

// ----------------------------------------------------
// DOCUMENT & CV MANAGEMENT INTERFACES
// ----------------------------------------------------

export interface CandidateDocument {
  id: string;
  candidateId: string;
  jobOrderId?: string | null;
  applicationId?: string | null;
  clientId?: string | null;
  documentType:
    | 'CV_RESUME'
    | 'UPDATED_CV'
    | 'AADHAAR_ID'
    | 'PAN_TAX'
    | 'EDUCATION_CERT'
    | 'EXPERIENCE_CERT'
    | 'SALARY_SLIP'
    | 'OFFER_LETTER'
    | 'PHOTO'
    | 'DRIVING_LICENSE'
    | 'OTHER'
    | string;
  documentCategory?: string | null;
  originalFileName: string;
  storedFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageProvider: string;
  storageKey: string;
  versionNumber: number;
  isCurrentVersion: boolean;
  uploadedById: string;
  verificationStatus: 'PENDING' | 'RECEIVED' | 'VERIFIED' | 'REJECTED' | 'REUPLOAD_REQUIRED' | string;
  verifiedById?: string | null;
  verifiedAt?: string | null;
  verificationRemarks?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  uploadedBy?: { id: string; name: string; role?: string };
  verifiedBy?: { id: string; name: string; role?: string };
  jobOrder?: { id: string; jobTitle: string; displayJobId: string };
}

// ----------------------------------------------------
// CANDIDATE REGISTRATION PORTAL INTERFACES
// ----------------------------------------------------

export interface RegistrationLink {
  id: string;
  token: string;
  candidateId: string;
  jobOrderId?: string | null;
  createdById: string;
  status:
    | 'ACTIVE'
    | 'DRAFT'
    | 'SUBMITTED'
    | 'UNDER_REVIEW'
    | 'APPROVED'
    | 'CORRECTION_REQUIRED'
    | 'REJECTED'
    | 'EXPIRED'
    | 'DISABLED'
    | string;
  expiresAt: string;
  usedAt?: string | null;
  stepCompleted: number;
  draftData?: any;
  submittedData?: any;
  reviewNotes?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  candidate?: {
    id: string;
    name: string;
    primaryPhone: string;
    email?: string;
    displaySlNo: string;
    leadStage?: string;
    currentLocation?: string;
    education?: string;
    totalExperienceYears?: number;
    currentJobTitle?: string;
    currentCompany?: string;
    currentSalary?: string;
    expectedSalary?: string;
    skills?: string;
    languages?: string;
    hasTwoWheeler?: boolean;
    hasDrivingLicense?: boolean;
    noticePeriod?: string;
    documents?: CandidateDocument[];
    jobApplications?: any[];
  };
  jobOrder?: {
    id: string;
    jobTitle: string;
    displayJobId: string;
    client?: { companyName: string; industry?: string };
  };
  createdBy?: { id: string; name: string };
  reviewedBy?: { id: string; name: string };
}

// ----------------------------------------------------
// CORPORATE CLIENT & JOB ORDER INTERFACES
// ----------------------------------------------------

export interface Client {
  id: string;
  displayClientId: string;
  companyName: string;
  companyLogo?: string | null;
  industry: string;
  companyWebsite?: string | null;
  companyAddress?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  contactPersonName: string;
  designation?: string | null;
  mobileNumber: string;
  whatsappNumber?: string | null;
  email: string;
  secondaryContactPerson?: string | null;
  secondaryContactNumber?: string | null;
  hrContact?: string | null;
  recruitmentContact?: string | null;
  recruitmentFeeType: 'PERCENTAGE' | 'FIXED' | 'RETAINER' | string;
  feeAmountOrPercent: number;
  paymentTerms?: string | null;
  invoiceTerms?: string | null;
  replacementPeriodDays: number;
  status: 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED' | string;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string };
  jobOrders?: JobOrder[];
  submissions?: CandidateSubmission[];
  placements?: Placement[];
  stats?: {
    totalJobOrders: number;
    totalSubmissions: number;
    totalJoined: number;
  };
  summary?: {
    totalJobOrders: number;
    activeJobOrders: number;
    totalVacancies: number;
    totalSubmissions: number;
    totalJoined: number;
  };
}

export interface JobOrder {
  id: string;
  displayJobId: string;
  clientId: string;
  jobTitle: string;
  department?: string | null;
  clientContactPerson?: string | null;
  jobLocation: string;
  numberOfVacancies: number;
  employmentType: string;
  jobDescription?: string | null;
  requiredSkills?: string | null;
  requiredEducation?: string | null;
  minExperienceYears: number;
  maxExperienceYears: number;
  minSalary?: number | null;
  maxSalary?: number | null;
  salaryType: string;
  incentives?: string | null;
  minAge?: number | null;
  maxAge?: number | null;
  genderPreference?: string | null;
  twoWheelerRequired: boolean;
  drivingLicenseRequired: boolean;
  fieldSalesRequired: boolean;
  automobileExpRequired: boolean;
  languagesRequired?: string | null;
  jobOrderDate: string;
  deadline?: string | null;
  googleFormUrl?: string | null;
  hrContactName?: string | null;
  hrContactPhone?: string | null;
  hrContactWhatsapp?: string | null;
  hrContactEmail?: string | null;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | 'URGENT' | string;
  assignedManagerId?: string | null;
  targetCandidates: number;
  status: 'DRAFT' | 'OPEN' | 'ON_HOLD' | 'CLOSED' | 'CANCELLED' | string;
  closedDate?: string | null;
  closureReason?: string | null;
  finalNumberJoined: number;
  createdAt: string;
  updatedAt: string;
  client?: Client;
  assignedManager?: { id: string; name: string };
  applications?: CandidateJobApplication[];
  submissions?: CandidateSubmission[];
  interviews?: Interview[];
  placements?: Placement[];
  stats?: {
    totalSourced: number;
    totalSubmissions: number;
    totalInterviews: number;
    totalJoined: number;
  };
  funnel?: {
    totalCandidates: number;
    callingCount: number;
    shortlistedCount: number;
    submittedCount: number;
    interviewCount: number;
    selectedCount: number;
    joinedCount: number;
    conversionRates: {
      shortlistRate: number;
      submissionRate: number;
      interviewRate: number;
      selectionRate: number;
      joiningRate: number;
    };
  };
}

export type ApplicationStage =
  | 'NEW_LEAD'
  | 'ASSIGNED'
  | 'CALLING'
  | 'INTERESTED'
  | 'NOT_INTERESTED'
  | 'NOT_ELIGIBLE'
  | 'RNR'
  | 'CALLBACK'
  | 'SHORTLISTED'
  | 'FORM_PENDING'
  | 'FORM_COMPLETED'
  | 'CV_PENDING'
  | 'CV_RECEIVED'
  | 'SUBMITTED_TO_CLIENT'
  | 'INTERVIEW_SCHEDULED'
  | 'INTERVIEW_COMPLETED'
  | 'SELECTED'
  | 'REJECTED'
  | 'JOINED'
  | 'DROPPED';

export interface CandidateJobApplication {
  id: string;
  candidateId: string;
  jobOrderId: string;
  assignedExecutiveId?: string | null;
  addedById?: string | null;
  applicationStage: ApplicationStage;
  stageNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  candidate?: Candidate;
  jobOrder?: JobOrder;
  assignedExecutive?: { id: string; name: string };
  addedBy?: { id: string; name: string };
  submissions?: CandidateSubmission[];
  interviews?: Interview[];
  placements?: Placement[];
}

export interface CandidateSubmission {
  id: string;
  applicationId: string;
  candidateId: string;
  jobOrderId: string;
  clientId: string;
  submittedById: string;
  submissionDate: string;
  cvFileName?: string | null;
  notes?: string | null;
  status: string;
  createdAt: string;
  candidate?: Candidate;
  jobOrder?: JobOrder;
  client?: Client;
  submittedBy?: { id: string; name: string };
}

export interface Interview {
  id: string;
  applicationId: string;
  candidateId: string;
  jobOrderId: string;
  scheduledById: string;
  interviewDate: string;
  interviewTime: string;
  roundNumber: number;
  interviewType: 'IN_PERSON' | 'VIDEO_CALL' | 'TELEPHONIC' | string;
  locationOrLink?: string | null;
  interviewerName?: string | null;
  interviewerDesignation?: string | null;
  result: 'PENDING' | 'SELECTED' | 'REJECTED' | 'NO_SHOW' | 'RESCHEDULE' | string;
  remarks?: string | null;
  createdAt: string;
  candidate?: Candidate;
  jobOrder?: JobOrder;
  scheduledBy?: { id: string; name: string };
}

export interface Placement {
  id: string;
  applicationId: string;
  candidateId: string;
  jobOrderId: string;
  clientId: string;
  placedById: string;
  selectionDate: string;
  joiningDate?: string | null;
  offeredSalary?: number | null;
  finalSalary?: number | null;
  placementFee?: number | null;
  replacementPeriodEndDate?: string | null;
  status: 'SELECTED' | 'JOINED' | 'DROPPED_AFTER_SELECTION' | string;
  notes?: string | null;
  createdAt: string;
  candidate?: Candidate;
  jobOrder?: JobOrder;
  client?: Client;
  placedBy?: { id: string; name: string };
}

export type LeadStage =
  | 'NEW'
  | 'ASSIGNED'
  | 'CALLING_IN_PROGRESS'
  | 'CONTACTED'
  | 'INTERESTED'
  | 'SHORTLISTED'
  | 'FORM_PENDING'
  | 'FORM_FILLED'
  | 'CV_RECEIVED'
  | 'UNDER_REVIEW'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'JOINED'
  | 'NOT_INTERESTED'
  | 'RNR'
  | 'INVALID';

export type CallOutcome =
  | 'CONFIRMED'
  | 'SHORTLISTED'
  | 'NOT_INTERESTED'
  | 'RNR'
  | 'BUSY'
  | 'CALL_BACK'
  | 'WRONG_NUMBER'
  | 'SWITCHED_OFF'
  | 'NUMBER_INVALID'
  | 'ALREADY_EMPLOYED'
  | 'NOT_ELIGIBLE'
  | 'DUPLICATE'
  | 'OTHER';

export type FormStatus = 'PENDING' | 'SENT' | 'COMPLETED' | 'NOT_REQUIRED' | string;
export type CVStatus = 'PENDING' | 'REQUESTED' | 'RECEIVED' | 'UPLOADED' | 'REJECTED' | string;
export type ShortlistStatus =
  | 'SHORTLISTED'
  | 'FORM_SENT'
  | 'FORM_COMPLETED'
  | 'CV_REQUESTED'
  | 'CV_RECEIVED'
  | 'READY_TO_SEND'
  | 'SENT_TO_HR'
  | 'COMPLETED'
  | 'REJECTED'
  | 'HOLD'
  | string;

export interface ShortlistRecord {
  id: string;
  candidateId: string;
  jobOrderId?: string | null;
  clientId?: string | null;
  shortlistedById: string;
  formFilled: FormStatus;
  cvReceivedWhatsapp: CVStatus;
  shortlistStatus: ShortlistStatus;
  clientName?: string | null;
  jobRole?: string | null;
  remarks?: string | null;
  googleFormUrl?: string | null;
  formSentAt?: string | null;
  formCompletedAt?: string | null;
  cvRequestedAt?: string | null;
  cvReceivedAt?: string | null;
  readyToSendAt?: string | null;
  sentToHrAt?: string | null;
  shortlistedAt: string;
  updatedAt: string;
  candidate: Candidate;
  jobOrder?: JobOrder;
  client?: Client;
  shortlistedBy?: { id: string; name: string; email?: string };
}

export interface CallActivity {
  id: string;
  candidateId: string;
  executiveId: string;
  jobOrderId?: string | null;
  callDate: string;
  callTime: string;
  outcome: CallOutcome;
  remarks?: string | null;
  durationSeconds: number;
  createdAt: string;
  jobOrder?: JobOrder;
  executive?: { id: string; name: string };
}

export interface Callback {
  id: string;
  candidateId: string;
  executiveId: string;
  callActivityId?: string | null;
  callbackDate: string;
  callbackTime: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING' | 'COMPLETED' | 'RESCHEDULED' | 'CANCELLED';
  cancelReason?: string | null;
  createdAt: string;
  candidate?: Candidate;
  executive?: { id: string; name: string; email?: string };
  callActivity?: { outcome: string; remarks?: string | null; callDate: string; callTime: string };
}

export interface LeadAssignment {
  id: string;
  candidateId: string;
  assignedById: string;
  assignedToId: string;
  previousExecutiveId?: string | null;
  assignmentMode: string;
  assignedAt: string;
  assignedBy?: { id: string; name: string };
  assignedTo?: { id: string; name: string };
  candidate?: { id: string; displaySlNo: string; name: string; primaryPhone: string };
}

export interface ActivityLog {
  id: string;
  userId?: string | null;
  candidateId?: string | null;
  action: string;
  details?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string; role: string };
  candidate?: { id: string; displaySlNo: string; name: string; primaryPhone: string };
}

export interface Candidate {
  id: string;
  displaySlNo: string;
  importBatchId?: string | null;
  assignedExecutiveId?: string | null;
  leadOwnerId?: string | null;
  leadStage: LeadStage;
  leadPriorityScore: number;
  dataQualityScore: number;
  isDeleted: boolean;
  
  name: string;
  primaryPhone: string;
  secondaryPhone?: string | null;
  whatsappNumber?: string | null;
  email?: string | null;
  age?: number | null;
  gender?: string | null;
  currentLocation?: string | null;
  nativeLocation?: string | null;

  education?: string | null;
  totalExperienceYears: number;
  currentJobTitle?: string | null;
  currentCompany?: string | null;
  previousCompany?: string | null;
  skills?: string | null;
  languages?: string | null;

  currentSalary?: string | null;
  expectedSalary?: string | null;
  appliedLocation?: string | null;
  preferredLocations?: string | null;
  noticePeriod?: string | null;

  hasTwoWheeler: boolean;
  hasDrivingLicense: boolean;
  interestedInFieldSales: boolean;
  interestedInAutomobile: boolean;
  customEligibility?: string | null;

  leadSource: string;
  generalNotes?: string | null;
  managerNotes?: string | null;

  createdAt: string;
  updatedAt: string;

  assignedExecutive?: { id: string; name: string; email?: string; phone?: string } | null;
  leadOwner?: { id: string; name: string; email?: string } | null;
  shortlistRecord?: ShortlistRecord | null;
  callActivities?: CallActivity[];
  callbacks?: Callback[];
  leadAssignments?: LeadAssignment[];
  activityLogs?: ActivityLog[];
  jobApplications?: CandidateJobApplication[];
}

export interface DailyCallingSummary {
  id: string;
  date: string;
  executiveId: string;
  assignedLeadsCount: number;
  uniqueCalledCount: number;
  totalAttemptsCount: number;
  confirmedCount: number;
  shortlistedCount: number;
  notInterestedCount: number;
  rnrCount: number;
  busyCallbackCount: number;
  wrongNumberCount: number;
  pendingCount: number;
  conversionRate: number;
  createdAt: string;
  updatedAt: string;
  executive: {
    id: string;
    name: string;
    email: string;
    targetCallsDaily: number;
    targetShortlistDaily: number;
  };
}
