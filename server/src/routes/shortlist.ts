import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { logActivity } from '../services/audit';
import { createAndEmitNotification, notifyTeamLeaderOfExecutive } from '../services/socket';

function getWhatsAppUrl(phone: string, text?: string): string {
  const clean = phone.replace(/[^0-9]/g, '');
  const withCountry = clean.length === 10 ? `91${clean}` : clean;
  const encoded = text ? encodeURIComponent(text) : '';
  return `https://wa.me/${withCountry}?text=${encoded}`;
}

const router = Router();

// GET /api/shortlist - List shortlisted candidates in the real operations pipeline
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      dateRange = 'ALL',
      startDate,
      endDate,
      executiveId,
      location,
      shortlistStatus,
      formFilled,
      cvReceivedWhatsapp,
      search,
    } = req.query;

    const where: any = {
      candidate: {
        isDeleted: false,
      },
    };

    // Role check: Executive sees only candidates assigned to them
    if (req.user!.role === 'EXECUTIVE') {
      where.candidate.assignedExecutiveId = req.user!.id;
    } else if (executiveId && executiveId !== 'ALL') {
      where.candidate.assignedExecutiveId = executiveId as string;
    }

    if (location && location !== 'ALL') {
      where.candidate.currentLocation = { contains: location as string };
    }

    if (shortlistStatus && shortlistStatus !== 'ALL') {
      where.shortlistStatus = shortlistStatus as string;
    }

    if (formFilled && formFilled !== 'ALL') {
      where.formFilled = formFilled as string;
    }

    if (cvReceivedWhatsapp && cvReceivedWhatsapp !== 'ALL') {
      where.cvReceivedWhatsapp = cvReceivedWhatsapp as string;
    }

    // Date filters
    const now = new Date();
    if (dateRange === 'TODAY') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      where.shortlistedAt = { gte: todayStart };
    } else if (dateRange === 'WEEK') {
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
      weekStart.setHours(0, 0, 0, 0);
      where.shortlistedAt = { gte: weekStart };
    } else if (dateRange === 'MONTH') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      where.shortlistedAt = { gte: monthStart };
    } else if (startDate && endDate) {
      where.shortlistedAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    if (search) {
      const q = (search as string).trim();
      where.candidate.OR = [
        { name: { contains: q } },
        { primaryPhone: { contains: q } },
        { displaySlNo: { contains: q } },
        { currentLocation: { contains: q } },
      ];
    }

    const shortlistedRecords = await prisma.shortlistRecord.findMany({
      where,
      orderBy: { shortlistedAt: 'desc' },
      include: {
        candidate: {
          include: {
            assignedExecutive: { select: { id: true, name: true, email: true } },
            documents: { where: { isCurrentVersion: true } },
            callActivities: {
              orderBy: { createdAt: 'desc' },
              take: 3,
            },
          },
        },
        jobOrder: {
          include: {
            client: { select: { id: true, companyName: true, industry: true } },
          },
        },
        client: { select: { id: true, companyName: true } },
        shortlistedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Compute real workflow summary stats
    const totalShortlisted = shortlistedRecords.length;
    const formPendingCount = shortlistedRecords.filter((r) => r.formFilled === 'PENDING').length;
    const formSentCount = shortlistedRecords.filter((r) => r.formFilled === 'SENT').length;
    const formCompletedCount = shortlistedRecords.filter((r) => r.formFilled === 'COMPLETED').length;
    const cvPendingCount = shortlistedRecords.filter((r) => r.cvReceivedWhatsapp === 'PENDING' || r.cvReceivedWhatsapp === 'REQUESTED').length;
    const cvReceivedCount = shortlistedRecords.filter((r) => r.cvReceivedWhatsapp === 'RECEIVED' || r.cvReceivedWhatsapp === 'UPLOADED').length;
    const readyToSendCount = shortlistedRecords.filter((r) => r.shortlistStatus === 'READY_TO_SEND').length;
    const sentToHrCount = shortlistedRecords.filter((r) => r.shortlistStatus === 'SENT_TO_HR' || r.shortlistStatus === 'COMPLETED').length;

    return res.json({
      records: shortlistedRecords,
      stats: {
        totalShortlisted,
        formPendingCount,
        formSentCount,
        formCompletedCount,
        cvPendingCount,
        cvReceivedCount,
        readyToSendCount,
        sentToHrCount,
      },
    });
  } catch (err: any) {
    console.error('Fetch shortlist error:', err);
    return res.status(500).json({ error: 'Failed to fetch shortlisted candidates' });
  }
});

// POST /api/shortlist - Mark a candidate as shortlisted
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { candidateId, jobOrderId, clientId, clientName, jobRole, remarks, googleFormUrl } = req.body;

    if (!candidateId) {
      return res.status(400).json({ error: 'Candidate ID is required' });
    }

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    let defaultFormUrl = googleFormUrl;
    if (!defaultFormUrl && jobOrderId) {
      const job = await prisma.jobOrder.findUnique({ where: { id: jobOrderId } });
      if (job?.googleFormUrl) defaultFormUrl = job.googleFormUrl;
    }
    if (!defaultFormUrl) {
      defaultFormUrl = 'https://forms.gle/genius-consultants-candidate-form';
    }

    // Upsert shortlist record
    const record = await prisma.shortlistRecord.upsert({
      where: { candidateId },
      update: {
        shortlistStatus: 'SHORTLISTED',
        jobOrderId: jobOrderId || undefined,
        clientId: clientId || undefined,
        clientName: clientName || undefined,
        jobRole: jobRole || undefined,
        remarks: remarks || undefined,
        googleFormUrl: defaultFormUrl,
      },
      create: {
        id: uuidv4(),
        candidateId,
        shortlistedById: req.user!.id,
        shortlistStatus: 'SHORTLISTED',
        jobOrderId: jobOrderId || null,
        clientId: clientId || null,
        clientName: clientName || null,
        jobRole: jobRole || null,
        remarks: remarks || null,
        googleFormUrl: defaultFormUrl,
        formFilled: 'PENDING',
        cvReceivedWhatsapp: 'PENDING',
      },
      include: {
        candidate: {
          include: {
            assignedExecutive: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Update candidate stage to SHORTLISTED
    await prisma.candidate.update({
      where: { id: candidateId },
      data: { leadStage: 'SHORTLISTED' },
    });

    // Notify Team Leader
    try {
      await notifyTeamLeaderOfExecutive(req.user!.id, {
        type: 'CANDIDATE_SHORTLISTED',
        title: 'Candidate Shortlisted',
        message: `${req.user!.name} shortlisted candidate ${candidate.name} for ${jobRole || 'Company Requirement'}.`,
        entityType: 'SHORTLIST',
        entityId: record.id,
      });
    } catch (e) {
      console.error('Notification error:', e);
    }

    await logActivity({
      userId: req.user!.id,
      candidateId,
      action: 'CANDIDATE_SHORTLISTED',
      details: `Candidate marked as Shortlisted for role: ${jobRole || 'General'} | Client: ${clientName || 'Direct'}`,
    });

    return res.status(201).json({ success: true, record });
  } catch (err: any) {
    console.error('Shortlist candidate error:', err);
    return res.status(500).json({ error: 'Failed to shortlist candidate' });
  }
});

// POST /api/shortlist/:id/send-google-form - Send Google Form via WhatsApp
router.post('/:id/send-google-form', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { customFormUrl } = req.body;

    const record = await prisma.shortlistRecord.findUnique({
      where: { id },
      include: {
        candidate: true,
        jobOrder: { include: { client: true } },
      },
    });

    if (!record) return res.status(404).json({ error: 'Shortlist record not found' });
    const rec = record as any;

    const formUrl = customFormUrl || rec.googleFormUrl || rec.jobOrder?.googleFormUrl || 'https://forms.gle/genius-consultants-candidate-form';
    const roleTitle = rec.jobRole || rec.jobOrder?.jobTitle || 'Executive';
    const company = rec.clientName || rec.jobOrder?.client?.companyName || 'our Client';

    const msg = `Dear ${rec.candidate?.name || 'Candidate'}, greetings from Genius Consultants. As discussed, please fill this quick candidate details form for the *${roleTitle}* role at *${company}*: ${formUrl}. Please reply once completed so we can proceed with your profile submission. Best regards, ${req.user!.name}.`;
    const waUrl = getWhatsAppUrl(rec.candidate?.whatsappNumber || rec.candidate?.primaryPhone || '', msg);

    const updated = await prisma.shortlistRecord.update({
      where: { id },
      data: {
        formFilled: 'SENT',
        formSentAt: new Date(),
        shortlistStatus: rec.shortlistStatus === 'SHORTLISTED' ? 'FORM_SENT' : rec.shortlistStatus,
        googleFormUrl: formUrl,
      },
      include: { candidate: true },
    });

    // Record Communication Activity
    await prisma.communicationActivity.create({
      data: {
        id: uuidv4(),
        candidateId: rec.candidateId,
        userId: req.user!.id,
        jobOrderId: rec.jobOrderId,
        channel: 'WHATSAPP',
        communicationType: 'GOOGLE_FORM',
        messageContent: msg,
        recipientPhone: rec.candidate?.primaryPhone || '',
        provider: 'WHATSAPP_WEB',
        deliveryStatus: 'INITIATED',
      },
    });

    await logActivity({
      userId: req.user!.id,
      candidateId: rec.candidateId,
      action: 'GOOGLE_FORM_SENT',
      details: `Sent Google Form link via WhatsApp: ${formUrl}`,
    });

    return res.json({ success: true, whatsappUrl: waUrl, record: updated });
  } catch (err: any) {
    console.error('Send Google Form error:', err);
    return res.status(500).json({ error: 'Failed to send Google Form' });
  }
});

// POST /api/shortlist/:id/mark-form-completed - Mark Google Form as Completed
router.post('/:id/mark-form-completed', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const record = await prisma.shortlistRecord.findUnique({
      where: { id },
      include: { candidate: true },
    });

    if (!record) return res.status(404).json({ error: 'Shortlist record not found' });
    const rec = record as any;

    const isCvReady = rec.cvReceivedWhatsapp === 'RECEIVED' || rec.cvReceivedWhatsapp === 'UPLOADED';
    const nextStatus = isCvReady ? 'READY_TO_SEND' : 'FORM_COMPLETED';

    const updated = await prisma.shortlistRecord.update({
      where: { id },
      data: {
        formFilled: 'COMPLETED',
        formCompletedAt: new Date(),
        shortlistStatus: nextStatus,
        readyToSendAt: isCvReady ? new Date() : rec.readyToSendAt,
      },
      include: { candidate: true },
    });

    await logActivity({
      userId: req.user!.id,
      candidateId: rec.candidateId,
      action: 'GOOGLE_FORM_COMPLETED',
      details: `Marked candidate Google Form as COMPLETED`,
    });

    return res.json({ success: true, record: updated });
  } catch (err: any) {
    console.error('Mark form completed error:', err);
    return res.status(500).json({ error: 'Failed to mark form completed' });
  }
});

// POST /api/shortlist/:id/request-cv - Request CV via WhatsApp
router.post('/:id/request-cv', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const record = await prisma.shortlistRecord.findUnique({
      where: { id },
      include: {
        candidate: true,
        jobOrder: { include: { client: true } },
      },
    });

    if (!record) return res.status(404).json({ error: 'Shortlist record not found' });
    const rec = record as any;

    const roleTitle = rec.jobRole || rec.jobOrder?.jobTitle || 'Executive';
    const msg = `Dear ${rec.candidate?.name || 'Candidate'}, please send your updated Resume / CV (PDF or Word format) on this WhatsApp number for the *${roleTitle}* vacancy. Best regards, ${req.user!.name} (Genius Consultants).`;
    const waUrl = getWhatsAppUrl(rec.candidate?.whatsappNumber || rec.candidate?.primaryPhone || '', msg);

    const updated = await prisma.shortlistRecord.update({
      where: { id },
      data: {
        cvReceivedWhatsapp: 'REQUESTED',
        cvRequestedAt: new Date(),
        shortlistStatus: rec.shortlistStatus === 'FORM_COMPLETED' ? 'CV_REQUESTED' : rec.shortlistStatus,
      },
      include: { candidate: true },
    });

    await prisma.communicationActivity.create({
      data: {
        id: uuidv4(),
        candidateId: rec.candidateId,
        userId: req.user!.id,
        jobOrderId: rec.jobOrderId,
        channel: 'WHATSAPP',
        communicationType: 'CV_REQUEST',
        messageContent: msg,
        recipientPhone: rec.candidate?.primaryPhone || '',
        provider: 'WHATSAPP_WEB',
        deliveryStatus: 'INITIATED',
      },
    });

    await logActivity({
      userId: req.user!.id,
      candidateId: rec.candidateId,
      action: 'CV_REQUESTED_WHATSAPP',
      details: `Requested CV from candidate via WhatsApp`,
    });

    return res.json({ success: true, whatsappUrl: waUrl, record: updated });
  } catch (err: any) {
    console.error('Request CV error:', err);
    return res.status(500).json({ error: 'Failed to request CV' });
  }
});

// POST /api/shortlist/:id/record-cv-received - Record CV received
router.post('/:id/record-cv-received', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const record = await prisma.shortlistRecord.findUnique({
      where: { id },
      include: { candidate: true },
    });

    if (!record) return res.status(404).json({ error: 'Shortlist record not found' });
    const rec = record as any;

    const isFormReady = rec.formFilled === 'COMPLETED';
    const nextStatus = isFormReady ? 'READY_TO_SEND' : 'CV_RECEIVED';

    const updated = await prisma.shortlistRecord.update({
      where: { id },
      data: {
        cvReceivedWhatsapp: 'RECEIVED',
        cvReceivedAt: new Date(),
        shortlistStatus: nextStatus,
        readyToSendAt: isFormReady ? new Date() : rec.readyToSendAt,
      },
      include: { candidate: true },
    });

    await logActivity({
      userId: req.user!.id,
      candidateId: rec.candidateId,
      action: 'CV_RECEIVED_RECORDED',
      details: `Recorded candidate CV as RECEIVED`,
    });

    return res.json({ success: true, record: updated });
  } catch (err: any) {
    console.error('Record CV error:', err);
    return res.status(500).json({ error: 'Failed to record CV' });
  }
});

// POST /api/shortlist/:id/mark-ready-to-send - Verify checklist & Mark Ready to Send
router.post('/:id/mark-ready-to-send', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const record = await prisma.shortlistRecord.findUnique({
      where: { id },
      include: { candidate: true },
    });

    if (!record) return res.status(404).json({ error: 'Shortlist record not found' });
    const rec = record as any;

    // Validate real workflow checklist
    if (rec.formFilled !== 'COMPLETED') {
      return res.status(400).json({ error: 'Google Form must be marked COMPLETED before marking Ready to Send' });
    }
    if (rec.cvReceivedWhatsapp !== 'RECEIVED' && rec.cvReceivedWhatsapp !== 'UPLOADED') {
      return res.status(400).json({ error: 'Candidate CV must be RECEIVED before marking Ready to Send' });
    }

    const updated = await prisma.shortlistRecord.update({
      where: { id },
      data: {
        shortlistStatus: 'READY_TO_SEND',
        readyToSendAt: new Date(),
      },
      include: { candidate: true },
    });

    // Notify Team Leader
    try {
      await notifyTeamLeaderOfExecutive(req.user!.id, {
        type: 'CANDIDATE_READY_TO_SEND',
        title: 'Candidate Ready to Send to HR',
        message: `${rec.candidate?.name || 'Candidate'} is ready for client HR submission.`,
        entityType: 'SHORTLIST',
        entityId: rec.id,
      });
    } catch (e) {
      console.error('Notification error:', e);
    }

    await logActivity({
      userId: req.user!.id,
      candidateId: rec.candidateId,
      action: 'CANDIDATE_READY_TO_SEND',
      details: `Candidate verified & marked READY_TO_SEND to Corporate Client HR`,
    });

    return res.json({ success: true, record: updated });
  } catch (err: any) {
    console.error('Mark ready to send error:', err);
    return res.status(500).json({ error: 'Failed to mark ready to send' });
  }
});

// POST /api/shortlist/:id/send-to-hr - Send Candidate Package to Company HR (Final Operations Step)
router.post('/:id/send-to-hr', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { hrContactName, hrContactPhone, hrContactEmail, submissionMethod = 'WHATSAPP', notes, cvFileName } = req.body;

    const record = await prisma.shortlistRecord.findUnique({
      where: { id },
      include: {
        candidate: {
          include: {
            documents: { where: { isCurrentVersion: true } },
          },
        },
        jobOrder: { include: { client: true } },
      },
    });

    if (!record) return res.status(404).json({ error: 'Shortlist record not found' });

    const rec = record as any;
    const jobOrderId = rec.jobOrderId || (await prisma.jobOrder.findFirst({ select: { id: true } }))?.id;
    const clientId = rec.clientId || rec.jobOrder?.clientId || (await prisma.client.findFirst({ select: { id: true } }))?.id;

    if (!jobOrderId || !clientId) {
      return res.status(400).json({ error: 'Valid Job Requirement and Company must be attached' });
    }

    // Ensure CandidateJobApplication exists
    const app = await prisma.candidateJobApplication.upsert({
      where: {
        candidateId_jobOrderId: {
          candidateId: rec.candidateId,
          jobOrderId,
        },
      },
      create: {
        id: uuidv4(),
        candidateId: rec.candidateId,
        jobOrderId,
        applicationStage: 'SENT_TO_HR',
        assignedExecutiveId: rec.candidate?.assignedExecutiveId,
      },
      update: {
        applicationStage: 'SENT_TO_HR',
      },
    });

    const activeCv = rec.candidate?.documents?.find((d: any) => d.documentType.includes('CV'));

    // Create CandidateSubmission record
    const submission = await prisma.candidateSubmission.create({
      data: {
        id: uuidv4(),
        applicationId: app.id,
        candidateId: rec.candidateId,
        jobOrderId,
        clientId,
        submittedById: req.user!.id,
        submissionMethod,
        hrContactName: hrContactName || rec.jobOrder?.hrContactName || rec.jobOrder?.client?.contactPersonName || 'Company HR',
        hrContactPhone: hrContactPhone || rec.jobOrder?.hrContactPhone || rec.jobOrder?.client?.mobileNumber,
        hrContactEmail: hrContactEmail || rec.jobOrder?.hrContactEmail || rec.jobOrder?.client?.email,
        cvFileName: cvFileName || activeCv?.originalFileName || 'Candidate_Resume.pdf',
        documentId: activeCv?.id || null,
        notes: notes || 'Delivered completed candidate profile and CV package to Client HR.',
        status: 'SENT_TO_HR',
      },
    });

    // Update ShortlistRecord and Candidate stage
    const updated = await prisma.shortlistRecord.update({
      where: { id },
      data: {
        shortlistStatus: 'SENT_TO_HR',
        sentToHrAt: new Date(),
      },
      include: { candidate: true },
    });

    await prisma.candidate.update({
      where: { id: rec.candidateId },
      data: { leadStage: 'SENT_TO_HR' },
    });

    // Notify Team Leader & Executive
    try {
      await createAndEmitNotification({
        userId: req.user!.id,
        type: 'CANDIDATE_SENT_TO_HR',
        title: 'Candidate Package Delivered to HR',
        message: `Successfully delivered ${rec.candidate?.name || 'Candidate'}'s profile to ${rec.clientName || 'Client HR'}.`,
        entityType: 'SHORTLIST',
        entityId: rec.id,
      });
    } catch (e) {
      console.error('Notification error:', e);
    }

    await logActivity({
      userId: req.user!.id,
      candidateId: rec.candidateId,
      action: 'CANDIDATE_SENT_TO_HR',
      details: `Delivered candidate package to Company HR (${submission.hrContactName}) via ${submissionMethod}. Workflow Complete.`,
    });

    return res.json({ success: true, submission, record: updated });
  } catch (err: any) {
    console.error('Send to HR error:', err);
    return res.status(500).json({ error: 'Failed to send candidate to HR' });
  }
});

// PUT /api/shortlist/:id - Update properties
router.put('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { formFilled, cvReceivedWhatsapp, shortlistStatus, clientName, jobRole, remarks } = req.body;

    const existing = await prisma.shortlistRecord.findUnique({
      where: { id },
      include: { candidate: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Shortlist record not found' });
    }

    const updateData: any = {};
    if (formFilled !== undefined) updateData.formFilled = formFilled;
    if (cvReceivedWhatsapp !== undefined) updateData.cvReceivedWhatsapp = cvReceivedWhatsapp;
    if (shortlistStatus !== undefined) updateData.shortlistStatus = shortlistStatus;
    if (clientName !== undefined) updateData.clientName = clientName;
    if (jobRole !== undefined) updateData.jobRole = jobRole;
    if (remarks !== undefined) updateData.remarks = remarks;

    const updated = await prisma.shortlistRecord.update({
      where: { id },
      data: updateData,
      include: {
        candidate: {
          include: {
            assignedExecutive: { select: { id: true, name: true } },
          },
        },
        shortlistedBy: { select: { id: true, name: true } },
      },
    });

    return res.json({ record: updated });
  } catch (err: any) {
    console.error('Update shortlist error:', err);
    return res.status(500).json({ error: 'Failed to update shortlist record' });
  }
});

export default router;
