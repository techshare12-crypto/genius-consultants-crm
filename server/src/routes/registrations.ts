import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { logActivity } from '../services/audit';
import { createAndEmitNotification, notifyTeamLeaderOfExecutive } from '../services/socket';
import {
  storageService,
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_FILE_SIZE_BYTES,
} from '../services/storage';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_FILE_SIZE_BYTES },
});

// Helper for authorization boundary check
async function checkCandidateAccess(user: any, candidateId: string): Promise<{ authorized: boolean; candidate: any }> {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: { assignedExecutive: true },
  });

  if (!candidate) return { authorized: false, candidate: null };

  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
    return { authorized: true, candidate };
  }

  if (user.role === 'EXECUTIVE') {
    return { authorized: candidate.assignedExecutiveId === user.id, candidate };
  }

  if (user.role === 'TEAM_LEADER') {
    const leaderTeams = await prisma.team.findMany({
      where: { teamLeaderId: user.id, status: 'ACTIVE' },
      include: { memberships: { where: { status: 'ACTIVE' }, select: { userId: true } } },
    });
    const memberIds = leaderTeams.flatMap((t) => t.memberships.map((m) => m.userId));
    const authorized = !!candidate.assignedExecutiveId && memberIds.includes(candidate.assignedExecutiveId);
    return { authorized, candidate };
  }

  return { authorized: false, candidate };
}

// ----------------------------------------------------
// AUTHENTICATED CRM REGISTRATION LINK MANAGEMENT
// ----------------------------------------------------

// POST /api/registrations/generate-link - Generate secure registration token
router.post('/generate-link', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { candidateId, jobOrderId, validityDays = 7 } = req.body;

    if (!candidateId) {
      return res.status(400).json({ error: 'Candidate ID is required' });
    }

    const { authorized, candidate } = await checkCandidateAccess(user, candidateId);
    if (!authorized) {
      return res.status(403).json({ error: 'Access denied: You are not authorized for this candidate' });
    }

    // Generate cryptographically random token
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

    const link = await prisma.registrationLink.create({
      data: {
        id: uuidv4(),
        token,
        candidateId,
        jobOrderId: jobOrderId || null,
        createdById: user.id,
        status: 'ACTIVE',
        expiresAt,
        stepCompleted: 1,
      },
      include: {
        candidate: { select: { id: true, name: true, primaryPhone: true, displaySlNo: true } },
        jobOrder: { select: { id: true, jobTitle: true, displayJobId: true } },
      },
    });

    // Track in CandidateFormTracking
    const clientBaseUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
    const registrationUrl = `${clientBaseUrl}/register/${token}`;
    await prisma.candidateFormTracking.create({
      data: {
        id: uuidv4(),
        candidateId,
        jobOrderId: jobOrderId || null,
        formName: 'Candidate Self-Service Registration Portal',
        formUrl: registrationUrl,
        sentById: user.id,
        status: 'SENT',
      },
    });

    // Create Communication Activity record
    await prisma.communicationActivity.create({
      data: {
        id: uuidv4(),
        candidateId,
        userId: user.id,
        jobOrderId: jobOrderId || null,
        channel: 'WHATSAPP',
        communicationType: 'REGISTRATION_FORM',
        messageContent: `Registration link generated: ${registrationUrl}`,
        recipientPhone: candidate.primaryPhone,
        provider: 'WHATSAPP_WEB',
        deliveryStatus: 'INITIATED',
      },
    });

    await logActivity({
      userId: user.id,
      candidateId,
      action: 'REGISTRATION_LINK_GENERATED',
      details: `Generated registration link valid until ${expiresAt.toISOString().split('T')[0]}`,
    });

    return res.status(201).json({
      link: {
        ...link,
        url: registrationUrl,
      },
    });
  } catch (err: any) {
    console.error('Generate registration link error:', err);
    return res.status(500).json({ error: 'Failed to generate registration link' });
  }
});

// GET /api/registrations - List links with filters
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { status, candidateId, jobOrderId } = req.query;

    const where: any = {};
    if (status && status !== 'ALL') where.status = status as string;
    if (candidateId) where.candidateId = candidateId as string;
    if (jobOrderId) where.jobOrderId = jobOrderId as string;

    if (user.role === 'EXECUTIVE') {
      where.candidate = { assignedExecutiveId: user.id };
    }

    const links = await prisma.registrationLink.findMany({
      where,
      include: {
        candidate: { select: { id: true, name: true, primaryPhone: true, displaySlNo: true, leadStage: true } },
        jobOrder: { select: { id: true, jobTitle: true, displayJobId: true } },
        createdBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return res.json({ links });
  } catch (err: any) {
    console.error('List registration links error:', err);
    return res.status(500).json({ error: 'Failed to fetch registration links' });
  }
});

// GET /api/registrations/analytics - Telemetry metrics
router.get('/analytics', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [total, active, draft, submitted, underReview, approved, correctionReq, expired] = await Promise.all([
      prisma.registrationLink.count(),
      prisma.registrationLink.count({ where: { status: 'ACTIVE' } }),
      prisma.registrationLink.count({ where: { status: 'DRAFT' } }),
      prisma.registrationLink.count({ where: { status: 'SUBMITTED' } }),
      prisma.registrationLink.count({ where: { status: 'UNDER_REVIEW' } }),
      prisma.registrationLink.count({ where: { status: 'APPROVED' } }),
      prisma.registrationLink.count({ where: { status: 'CORRECTION_REQUIRED' } }),
      prisma.registrationLink.count({ where: { status: 'EXPIRED' } }),
    ]);

    return res.json({
      totalGenerated: total,
      activeCount: active,
      draftCount: draft,
      submittedCount: submitted,
      underReviewCount: underReview,
      approvedCount: approved,
      correctionRequiredCount: correctionReq,
      expiredCount: expired,
    });
  } catch (err: any) {
    console.error('Registration analytics error:', err);
    return res.status(500).json({ error: 'Failed to fetch registration analytics' });
  }
});

// GET /api/registrations/:id - Get specific registration link details with diff
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = req.user!;

    const link = await prisma.registrationLink.findUnique({
      where: { id },
      include: {
        candidate: {
          include: {
            documents: { where: { isCurrentVersion: true } },
            jobApplications: { include: { jobOrder: true } },
          },
        },
        jobOrder: { include: { client: true } },
        createdBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });

    if (!link) return res.status(404).json({ error: 'Registration link not found' });

    const { authorized } = await checkCandidateAccess(user, link.candidateId);
    if (!authorized) {
      return res.status(403).json({ error: 'Access denied: You are not authorized to view this registration' });
    }

    return res.json({ link });
  } catch (err: any) {
    console.error('Get registration detail error:', err);
    return res.status(500).json({ error: 'Failed to fetch registration details' });
  }
});

// POST /api/registrations/:id/approve - Approve submitted changes and apply to Candidate Master
router.post('/:id/approve', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { reviewNotes } = req.body;
    const user = req.user!;

    const link = await prisma.registrationLink.findUnique({
      where: { id },
      include: { candidate: true },
    });

    if (!link) return res.status(404).json({ error: 'Registration record not found' });
    const l = link as any;

    const { authorized } = await checkCandidateAccess(user, l.candidateId);
    if (!authorized) {
      return res.status(403).json({ error: 'Access denied: You are not authorized to review this registration' });
    }

    if (!l.submittedData) {
      return res.status(400).json({ error: 'No submitted data to approve' });
    }

    const submitted = JSON.parse(l.submittedData);

    // Apply submitted data to Candidate Master safely
    const updatedCandidate = await prisma.candidate.update({
      where: { id: l.candidateId },
      data: {
        name: submitted.name || l.candidate?.name,
        email: submitted.email || l.candidate?.email,
        whatsappNumber: submitted.whatsappNumber || l.candidate?.whatsappNumber,
        currentLocation: submitted.currentCity || submitted.currentLocation || l.candidate?.currentLocation,
        education: submitted.education || l.candidate?.education,
        totalExperienceYears: submitted.totalExperience ? parseFloat(submitted.totalExperience) : l.candidate?.totalExperienceYears,
        currentJobTitle: submitted.currentDesignation || submitted.currentJobTitle || l.candidate?.currentJobTitle,
        currentCompany: submitted.currentCompany || l.candidate?.currentCompany,
        currentSalary: submitted.currentSalary || l.candidate?.currentSalary,
        expectedSalary: submitted.expectedSalary || l.candidate?.expectedSalary,
        noticePeriod: submitted.noticePeriod || l.candidate?.noticePeriod,
        skills: Array.isArray(submitted.skills) ? submitted.skills.join(', ') : (submitted.skills || l.candidate?.skills),
        languages: Array.isArray(submitted.languages) ? submitted.languages.join(', ') : (submitted.languages || l.candidate?.languages),
        hasTwoWheeler: submitted.hasTwoWheeler !== undefined ? Boolean(submitted.hasTwoWheeler) : l.candidate?.hasTwoWheeler,
        hasDrivingLicense: submitted.hasDrivingLicense !== undefined ? Boolean(submitted.hasDrivingLicense) : l.candidate?.hasDrivingLicense,
        leadStage: 'QUALIFIED',
      },
    });

    // Update Registration Link status
    const updatedLink = await prisma.registrationLink.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || 'Candidate profile updates approved and applied to Master.',
      },
    });

    // Update shortlist record if exists
    await prisma.shortlistRecord.updateMany({
      where: { candidateId: l.candidateId },
      data: { formFilled: 'COMPLETED' },
    });

    await logActivity({
      userId: user.id,
      candidateId: l.candidateId,
      action: 'REGISTRATION_APPROVED',
      details: `Approved self-service registration and applied updates to Candidate Master`,
    });

    return res.json({ success: true, link: updatedLink, candidate: updatedCandidate });
  } catch (err: any) {
    console.error('Approve registration error:', err);
    return res.status(500).json({ error: 'Failed to approve registration' });
  }
});

// POST /api/registrations/:id/request-correction - Request candidate corrections
router.post('/:id/request-correction', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { reviewNotes } = req.body;
    const user = req.user!;

    if (!reviewNotes) {
      return res.status(400).json({ error: 'Review notes are required when requesting corrections' });
    }

    const link = await prisma.registrationLink.findUnique({
      where: { id },
    });

    if (!link) return res.status(404).json({ error: 'Registration record not found' });

    const { authorized } = await checkCandidateAccess(user, link.candidateId);
    if (!authorized) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await prisma.registrationLink.update({
      where: { id },
      data: {
        status: 'CORRECTION_REQUIRED',
        reviewNotes,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });

    await logActivity({
      userId: user.id,
      candidateId: link.candidateId,
      action: 'REGISTRATION_CORRECTION_REQUESTED',
      details: `Requested corrections: "${reviewNotes}"`,
    });

    return res.json({ success: true, link: updated });
  } catch (err: any) {
    console.error('Request correction error:', err);
    return res.status(500).json({ error: 'Failed to request correction' });
  }
});

// POST /api/registrations/:id/disable - Disable registration token
router.post('/:id/disable', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = req.user!;

    const link = await prisma.registrationLink.findUnique({ where: { id } });
    if (!link) return res.status(404).json({ error: 'Registration record not found' });

    const { authorized } = await checkCandidateAccess(user, link.candidateId);
    if (!authorized) return res.status(403).json({ error: 'Access denied' });

    const updated = await prisma.registrationLink.update({
      where: { id },
      data: { status: 'DISABLED' },
    });

    return res.json({ success: true, link: updated });
  } catch (err: any) {
    console.error('Disable link error:', err);
    return res.status(500).json({ error: 'Failed to disable registration link' });
  }
});

// ----------------------------------------------------
// PUBLIC CANDIDATE REGISTRATION ENDPOINTS (NO CRM LOGIN)
// ----------------------------------------------------

// GET /api/registrations/public/:token - Fetch sanitized registration context
router.get('/public/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const link = await prisma.registrationLink.findUnique({
      where: { token },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            primaryPhone: true,
            email: true,
            currentLocation: true,
            totalExperienceYears: true,
            currentJobTitle: true,
            currentCompany: true,
            education: true,
            skills: true,
          },
        },
        jobOrder: {
          select: {
            id: true,
            jobTitle: true,
            jobLocation: true,
            minSalary: true,
            maxSalary: true,
            client: { select: { companyName: true, industry: true } },
          },
        },
      },
    });

    if (!link) {
      return res.status(404).json({ error: 'Invalid or expired registration link' });
    }

    if (link.status === 'DISABLED') {
      return res.status(403).json({ error: 'This registration link has been disabled' });
    }

    if (new Date(link.expiresAt) < new Date()) {
      await prisma.registrationLink.update({
        where: { id: link.id },
        data: { status: 'EXPIRED' },
      });
      return res.status(410).json({ error: 'This registration link has expired' });
    }

    // Return sanitized data only (NO internal IDs, notes, or admin data)
    return res.json({
      token: link.token,
      status: link.status,
      stepCompleted: link.stepCompleted,
      draftData: link.draftData ? JSON.parse(link.draftData) : null,
      reviewNotes: link.reviewNotes,
      candidate: {
        name: link.candidate.name,
        primaryPhone: link.candidate.primaryPhone,
        email: link.candidate.email,
        currentLocation: link.candidate.currentLocation,
      },
      jobOrder: link.jobOrder
        ? {
            jobTitle: link.jobOrder.jobTitle,
            companyName: link.jobOrder.client?.companyName,
            location: link.jobOrder.jobLocation,
            salaryRange: link.jobOrder.minSalary && link.jobOrder.maxSalary
              ? `₹${(link.jobOrder.minSalary / 100000).toFixed(1)}L - ₹${(link.jobOrder.maxSalary / 100000).toFixed(1)}L`
              : 'Best in Industry',
          }
        : null,
      expiresAt: link.expiresAt,
    });
  } catch (err: any) {
    console.error('Public fetch registration error:', err);
    return res.status(500).json({ error: 'Failed to load registration portal' });
  }
});

// POST /api/registrations/public/:token/save-draft - Save multi-step draft progress
router.post('/public/:token/save-draft', async (req, res) => {
  try {
    const { token } = req.params;
    const { stepCompleted = 1, draftData } = req.body;

    const link = await prisma.registrationLink.findUnique({
      where: { token },
    });

    if (!link || link.status === 'DISABLED' || new Date(link.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired registration session' });
    }

    const updated = await prisma.registrationLink.update({
      where: { id: link.id },
      data: {
        stepCompleted,
        draftData: JSON.stringify(draftData || {}),
        status: link.status === 'ACTIVE' ? 'DRAFT' : link.status,
      },
    });

    return res.json({ success: true, message: 'Draft saved successfully', stepCompleted: updated.stepCompleted });
  } catch (err: any) {
    console.error('Save draft error:', err);
    return res.status(500).json({ error: 'Failed to save draft progress' });
  }
});

// POST /api/registrations/public/token/:token/upload-cv - Upload CV during public self-registration
router.post('/public/token/:token/upload-cv', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const token = req.params.token as string;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No CV file uploaded' });
    }

    if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.mimetype)) {
      return res.status(400).json({ error: 'Invalid file format. Allowed: PDF, DOC, DOCX, JPG, PNG' });
    }

    const link = await prisma.registrationLink.findUnique({
      where: { token },
      include: { candidate: true },
    });

    if (!link || link.status === 'DISABLED' || new Date(link.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired registration session' });
    }

    // Save file via storage abstraction
    const storageResult = await storageService.saveFile(
      link.candidateId,
      file.originalname,
      file.buffer,
      file.mimetype
    );

    // Versioning logic: Check previous active CV
    const existingCv = await prisma.candidateDocument.findFirst({
      where: {
        candidateId: link.candidateId,
        documentType: { in: ['CV_RESUME', 'UPDATED_CV'] },
        isCurrentVersion: true,
      },
      orderBy: { versionNumber: 'desc' },
    });

    let nextVersionNumber = 1;
    if (existingCv) {
      nextVersionNumber = existingCv.versionNumber + 1;
      await prisma.candidateDocument.update({
        where: { id: existingCv.id },
        data: { isCurrentVersion: false },
      });
    }

    // Create new document record
    const doc = await prisma.candidateDocument.create({
      data: {
        id: uuidv4(),
        candidateId: link.candidateId,
        jobOrderId: link.jobOrderId,
        documentType: nextVersionNumber > 1 ? 'UPDATED_CV' : 'CV_RESUME',
        originalFileName: file.originalname,
        storedFileName: storageResult.storedFileName,
        mimeType: storageResult.mimeType,
        fileSizeBytes: storageResult.fileSizeBytes,
        storageProvider: storageResult.storageProvider,
        storageKey: storageResult.storageKey,
        versionNumber: nextVersionNumber,
        isCurrentVersion: true,
        uploadedById: link.createdById, // Stored under the token initiator
        verificationStatus: 'PENDING',
        notes: `Self-uploaded by candidate through Registration Portal`,
      },
    });

    // Update shortlist record cv status
    await prisma.shortlistRecord.updateMany({
      where: { candidateId: link.candidateId },
      data: { cvReceivedWhatsapp: 'RECEIVED' },
    });

    return res.status(201).json({
      documentId: doc.id,
      originalFileName: doc.originalFileName,
      versionNumber: doc.versionNumber,
      fileSizeBytes: doc.fileSizeBytes,
    });
  } catch (err: any) {
    console.error('Candidate public CV upload error:', err);
    return res.status(500).json({ error: 'Failed to upload CV' });
  }
});

// POST /api/registrations/public/:token/submit - Final submission by candidate
router.post('/public/:token/submit', async (req, res) => {
  try {
    const { token } = req.params;
    const { submittedData } = req.body;

    if (!submittedData) {
      return res.status(400).json({ error: 'Submitted profile data is required' });
    }

    const link = await prisma.registrationLink.findUnique({
      where: { token },
      include: {
        candidate: true,
        jobOrder: true,
      },
    });

    if (!link || link.status === 'DISABLED' || new Date(link.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired registration session' });
    }

    // Update RegistrationLink status to SUBMITTED
    const updated = await prisma.registrationLink.update({
      where: { id: link.id },
      data: {
        submittedData: JSON.stringify(submittedData),
        status: 'SUBMITTED',
        usedAt: new Date(),
        stepCompleted: 7,
      },
    });

    // Update CandidateFormTracking
    await prisma.candidateFormTracking.updateMany({
      where: { candidateId: link.candidateId },
      data: { status: 'COMPLETED', completedDate: new Date() },
    });

    // If linked to a Job Order, ensure CandidateJobApplication is created or updated
    if (link.jobOrderId) {
      await prisma.candidateJobApplication.upsert({
        where: {
          candidateId_jobOrderId: {
            candidateId: link.candidateId,
            jobOrderId: link.jobOrderId,
          },
        },
        create: {
          id: uuidv4(),
          candidateId: link.candidateId,
          jobOrderId: link.jobOrderId,
          applicationStage: 'FORM_FILLED',
          assignedExecutiveId: link.candidate.assignedExecutiveId,
        },
        update: {
          applicationStage: 'FORM_FILLED',
        },
      });
    }

    // Notify assigned Executive & Team Leader
    if (link.candidate.assignedExecutiveId) {
      await createAndEmitNotification({
        userId: link.candidate.assignedExecutiveId,
        type: 'REGISTRATION_SUBMITTED',
        title: 'Registration Form Completed',
        message: `Candidate ${link.candidate.name} has submitted their profile details for review.`,
        entityType: 'REGISTRATION',
        entityId: link.id,
      });

      await notifyTeamLeaderOfExecutive(link.candidate.assignedExecutiveId, {
        type: 'REGISTRATION_SUBMITTED',
        title: 'Team Candidate Registration Submitted',
        message: `${link.candidate.name} completed self-service registration.`,
        entityType: 'REGISTRATION',
        entityId: link.id,
      });
    }

    await logActivity({
      candidateId: link.candidateId,
      action: 'REGISTRATION_SUBMITTED',
      details: `Candidate completed self-service registration portal with all 7 steps`,
    });

    return res.json({
      success: true,
      message: 'Your registration has been submitted successfully for verification!',
      linkId: updated.id,
    });
  } catch (err: any) {
    console.error('Final registration submit error:', err);
    return res.status(500).json({ error: 'Failed to submit registration' });
  }
});

export default router;
