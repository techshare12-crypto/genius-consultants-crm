import { Router, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { authenticate, AuthenticatedRequest, requirePermission } from '../middleware/auth';
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

// Helper for authorization boundary check on a candidate
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
// DOCUMENT UPLOADS & VERSIONING
// ----------------------------------------------------

// POST /api/documents/upload - Upload file with version control
router.post(
  '/upload',
  authenticate,
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const file = req.file;
      const user = req.user!;
      const { candidateId, documentType = 'CV_RESUME', jobOrderId, applicationId, notes } = req.body;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      if (!candidateId) {
        return res.status(400).json({ error: 'Candidate ID is required' });
      }

      // Validate MIME type
      if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.mimetype)) {
        return res.status(400).json({
          error: `Invalid file type: ${file.mimetype}. Allowed types: PDF, DOC, DOCX, JPG, PNG`,
        });
      }

      // Security check
      const { authorized, candidate } = await checkCandidateAccess(user, candidateId);
      if (!authorized) {
        return res.status(403).json({ error: 'Access denied: You are not authorized to upload documents for this candidate' });
      }

      // Save to storage provider
      const storageResult = await storageService.saveFile(
        candidateId,
        file.originalname,
        file.buffer,
        file.mimetype
      );

      // Versioning Logic: Check for prior versions of this document type for candidate
      const existingDoc = await prisma.candidateDocument.findFirst({
        where: {
          candidateId,
          documentType,
          isCurrentVersion: true,
        },
        orderBy: { versionNumber: 'desc' },
      });

      let nextVersionNumber = 1;
      if (existingDoc) {
        nextVersionNumber = existingDoc.versionNumber + 1;
        // Mark previous version as not current
        await prisma.candidateDocument.update({
          where: { id: existingDoc.id },
          data: { isCurrentVersion: false },
        });
      }

      // Create new candidate document record
      const doc = await prisma.candidateDocument.create({
        data: {
          id: uuidv4(),
          candidateId,
          jobOrderId: jobOrderId || null,
          applicationId: applicationId || null,
          documentType,
          originalFileName: file.originalname,
          storedFileName: storageResult.storedFileName,
          mimeType: storageResult.mimeType,
          fileSizeBytes: storageResult.fileSizeBytes,
          storageProvider: storageResult.storageProvider,
          storageKey: storageResult.storageKey,
          versionNumber: nextVersionNumber,
          isCurrentVersion: true,
          uploadedById: user.id,
          verificationStatus: 'RECEIVED',
          notes: notes || null,
        },
        include: {
          uploadedBy: { select: { id: true, name: true, role: true } },
          jobOrder: { select: { id: true, jobTitle: true } },
        },
      });

      // Update Shortlist Record status if CV uploaded
      if (documentType === 'CV_RESUME' || documentType === 'UPDATED_CV') {
        await prisma.shortlistRecord.updateMany({
          where: { candidateId },
          data: { cvReceivedWhatsapp: 'RECEIVED' },
        });

        // Notify Team Leader & Admins
        try {
          await notifyTeamLeaderOfExecutive(user.id, {
            type: 'DOCUMENT_UPLOADED',
            title: `CV v${nextVersionNumber} Uploaded`,
            message: `${user.name} uploaded CV v${nextVersionNumber} for ${candidate.name}.`,
            entityType: 'DOCUMENT',
            entityId: doc.id,
          });
        } catch (e) {
          console.error('Notification error:', e);
        }
      }

      await logActivity({
        userId: user.id,
        candidateId,
        action: nextVersionNumber > 1 ? 'DOCUMENT_NEW_VERSION_UPLOADED' : 'DOCUMENT_UPLOADED',
        details: `Uploaded ${documentType} v${nextVersionNumber}: "${file.originalname}" (${(file.size / 1024).toFixed(1)} KB)`,
      });

      return res.status(201).json({ document: doc });
    } catch (err: any) {
      console.error('Upload document error:', err);
      return res.status(500).json({ error: 'Failed to upload document' });
    }
  }
);

// GET /api/documents/candidate/:candidateId - List all documents for candidate
router.get('/candidate/:candidateId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const candidateId = req.params.candidateId as string;
    const user = req.user!;

    const { authorized } = await checkCandidateAccess(user, candidateId);
    if (!authorized) {
      return res.status(403).json({ error: 'Access denied: You are not authorized to view documents for this candidate' });
    }

    const documents = await prisma.candidateDocument.findMany({
      where: { candidateId },
      include: {
        uploadedBy: { select: { id: true, name: true, role: true } },
        verifiedBy: { select: { id: true, name: true, role: true } },
        jobOrder: { select: { id: true, jobTitle: true, displayJobId: true } },
      },
      orderBy: [{ documentType: 'asc' }, { versionNumber: 'desc' }],
    });

    return res.json({ documents });
  } catch (err: any) {
    console.error('Fetch candidate documents error:', err);
    return res.status(500).json({ error: 'Failed to fetch candidate documents' });
  }
});

// GET /api/documents/:id/download - Authenticated Secure Download
router.get('/:id/download', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = req.user!;

    const doc = await prisma.candidateDocument.findUnique({
      where: { id },
      include: { candidate: true },
    });

    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const { authorized } = await checkCandidateAccess(user, doc.candidateId);
    if (!authorized) {
      return res.status(403).json({ error: 'Access denied: You are not authorized to download this document' });
    }

    const buffer = await storageService.getFileBuffer(doc.storageKey);

    await logActivity({
      userId: user.id,
      candidateId: doc.candidateId,
      action: 'DOCUMENT_DOWNLOADED',
      details: `Downloaded ${doc.documentType} v${doc.versionNumber}: ${doc.originalFileName}`,
    });

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.originalFileName)}"`);
    return res.send(buffer);
  } catch (err: any) {
    console.error('Download document error:', err);
    return res.status(500).json({ error: 'Failed to download document' });
  }
});

// GET /api/documents/:id/preview - Authenticated Inline Preview
router.get('/:id/preview', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = req.user!;

    const doc = await prisma.candidateDocument.findUnique({
      where: { id },
      include: { candidate: true },
    });

    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const { authorized } = await checkCandidateAccess(user, doc.candidateId);
    if (!authorized) {
      return res.status(403).json({ error: 'Access denied: You are not authorized to preview this document' });
    }

    const buffer = await storageService.getFileBuffer(doc.storageKey);

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.originalFileName)}"`);
    return res.send(buffer);
  } catch (err: any) {
    console.error('Preview document error:', err);
    return res.status(500).json({ error: 'Failed to preview document' });
  }
});

// POST /api/documents/:id/verify - Verify / Reject / Request Re-upload
router.post('/:id/verify', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { verificationStatus, verificationRemarks } = req.body;
    const user = req.user!;

    const validStatuses = ['VERIFIED', 'REJECTED', 'REUPLOAD_REQUIRED', 'PENDING'];
    if (!validStatuses.includes(verificationStatus)) {
      return res.status(400).json({ error: 'Invalid verification status' });
    }

    if ((verificationStatus === 'REJECTED' || verificationStatus === 'REUPLOAD_REQUIRED') && !verificationRemarks) {
      return res.status(400).json({ error: 'Remarks are mandatory when rejecting or requesting re-upload' });
    }

    const doc = await prisma.candidateDocument.findUnique({
      where: { id },
      include: { candidate: true },
    });

    if (!doc) return res.status(404).json({ error: 'Document not found' });
    const d = doc as any;

    const updated = await prisma.candidateDocument.update({
      where: { id },
      data: {
        verificationStatus,
        verificationRemarks: verificationRemarks || null,
        verifiedById: user.id,
        verifiedAt: new Date(),
      },
      include: {
        verifiedBy: { select: { id: true, name: true } },
      },
    });

    // Notify assigned executive
    if (d.candidate?.assignedExecutiveId) {
      let notifTitle = 'Document Verified';
      let notifType = 'DOCUMENT_VERIFIED';
      if (verificationStatus === 'REJECTED') {
        notifTitle = 'Document Rejected';
        notifType = 'DOCUMENT_REJECTED';
      } else if (verificationStatus === 'REUPLOAD_REQUIRED') {
        notifTitle = 'Document Re-upload Required';
        notifType = 'REUPLOAD_REQUESTED';
      }

      await createAndEmitNotification({
        userId: d.candidate.assignedExecutiveId,
        type: notifType,
        title: notifTitle,
        message: `${user.name} marked ${doc.documentType} v${doc.versionNumber} as ${verificationStatus}: ${verificationRemarks || ''}`,
        entityType: 'DOCUMENT',
        entityId: doc.id,
      });
    }

    await logActivity({
      userId: user.id,
      candidateId: doc.candidateId,
      action: `DOCUMENT_${verificationStatus}`,
      details: `${verificationStatus} ${doc.documentType} v${doc.versionNumber}: "${doc.originalFileName}" - Remarks: ${verificationRemarks || 'None'}`,
    });

    return res.json({ document: updated });
  } catch (err: any) {
    console.error('Verify document error:', err);
    return res.status(500).json({ error: 'Failed to update document verification status' });
  }
});

// GET /api/documents/analytics - Document Metrics & Telemetry
router.get('/analytics', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [totalDocs, pendingDocs, verifiedDocs, rejectedDocs, reuploadDocs, totalCVs] = await Promise.all([
      prisma.candidateDocument.count({ where: { isCurrentVersion: true } }),
      prisma.candidateDocument.count({ where: { verificationStatus: 'PENDING', isCurrentVersion: true } }),
      prisma.candidateDocument.count({ where: { verificationStatus: 'VERIFIED', isCurrentVersion: true } }),
      prisma.candidateDocument.count({ where: { verificationStatus: 'REJECTED', isCurrentVersion: true } }),
      prisma.candidateDocument.count({ where: { verificationStatus: 'REUPLOAD_REQUIRED', isCurrentVersion: true } }),
      prisma.candidateDocument.count({ where: { documentType: { in: ['CV_RESUME', 'UPDATED_CV'] }, isCurrentVersion: true } }),
    ]);

    return res.json({
      totalDocuments: totalDocs,
      pendingVerification: pendingDocs,
      verifiedCount: verifiedDocs,
      rejectedCount: rejectedDocs,
      reuploadRequiredCount: reuploadDocs,
      activeCVs: totalCVs,
    });
  } catch (err: any) {
    console.error('Document analytics error:', err);
    return res.status(500).json({ error: 'Failed to fetch document analytics' });
  }
});

export default router;
