import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { authenticate, AuthenticatedRequest, requirePermission, requireRoles } from '../middleware/auth';
import { logActivity } from '../services/audit';
import { createAndEmitNotification } from '../services/socket';

const router = Router();

// Helper to normalize phone number for WhatsApp
function getNormalizedWhatsAppPhone(phone?: string | null): string {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length === 10) return `91${cleaned}`;
  if (cleaned.length === 12 && cleaned.startsWith('91')) return cleaned;
  if (cleaned.length === 11 && cleaned.startsWith('0')) return `91${cleaned.substring(1)}`;
  return cleaned;
}

// Variable replacement engine
function replaceTemplateVariables(templateText: string, vars: Record<string, string>): string {
  let result = templateText;
  for (const [key, val] of Object.entries(vars)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, val || '');
  }
  return result;
}

// ----------------------------------------------------
// MESSAGE TEMPLATES
// ----------------------------------------------------

// GET /api/communications/templates - List templates
router.get('/templates', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { category } = req.query;
    const where: any = { isActive: true };
    if (category && category !== 'ALL') where.category = String(category);

    const templates = await prisma.messageTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ templates });
  } catch (err: any) {
    console.error('Fetch templates error:', err);
    return res.status(500).json({ error: 'Failed to fetch message templates' });
  }
});

// POST /api/communications/templates - Create template
router.post('/templates', authenticate, requirePermission('manage_communications'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, category, subject, bodyText, variables } = req.body;

    if (!name || !category || !bodyText) {
      return res.status(400).json({ error: 'Name, Category, and Body Text are required' });
    }

    const template = await prisma.messageTemplate.create({
      data: {
        id: uuidv4(),
        name: name.trim(),
        category,
        subject: subject ? subject.trim() : null,
        bodyText: bodyText.trim(),
        variables: variables || null,
        isActive: true,
        createdById: req.user!.id,
      },
    });

    await logActivity({
      userId: req.user!.id,
      action: 'MESSAGE_TEMPLATE_CREATED',
      details: `Created WhatsApp template: ${template.name} [${template.category}]`,
    });

    return res.status(201).json({ template });
  } catch (err: any) {
    console.error('Create template error:', err);
    return res.status(500).json({ error: 'Failed to create message template' });
  }
});

// PUT /api/communications/templates/:id - Update template
router.put('/templates/:id', authenticate, requirePermission('manage_communications'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, category, subject, bodyText, variables, isActive } = req.body;

    const updated = await prisma.messageTemplate.update({
      where: { id },
      data: {
        name,
        category,
        subject,
        bodyText,
        variables,
        isActive,
      },
    });

    return res.json({ template: updated });
  } catch (err: any) {
    console.error('Update template error:', err);
    return res.status(500).json({ error: 'Failed to update message template' });
  }
});

// ----------------------------------------------------
// CANDIDATE COMMUNICATION HISTORY TIMELINE
// ----------------------------------------------------

// GET /api/communications/history/:candidateId - Candidate Timeline with Role Authorization Boundary
router.get('/history/:candidateId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const candidateId = req.params.candidateId as string;
    const user = req.user!;
    const isSuperOrAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: { assignedExecutive: true },
    });

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Role Security Boundary Enforcement
    if (!isSuperOrAdmin) {
      if (user.role === 'EXECUTIVE') {
        if (candidate.assignedExecutiveId !== user.id) {
          return res.status(403).json({ error: 'Access denied: You can only view communications for your assigned candidates' });
        }
      } else if (user.role === 'TEAM_LEADER') {
        // Must belong to team managed by this Team Leader
        const leaderTeams = await prisma.team.findMany({
          where: { teamLeaderId: user.id, status: 'ACTIVE' },
          include: { memberships: { where: { status: 'ACTIVE' }, select: { userId: true } } },
        });
        const teamMemberIds = leaderTeams.flatMap((t) => t.memberships.map((m) => m.userId));
        if (!candidate.assignedExecutiveId || !teamMemberIds.includes(candidate.assignedExecutiveId)) {
          return res.status(403).json({ error: 'Access denied: Candidate is not assigned to your team' });
        }
      }
    }

    const [communications, formTrackings, reminders] = await Promise.all([
      prisma.communicationActivity.findMany({
        where: { candidateId },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          jobOrder: { select: { id: true, jobTitle: true, displayJobId: true } },
          client: { select: { id: true, companyName: true } },
          template: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.candidateFormTracking.findMany({
        where: { candidateId },
        include: {
          sentBy: { select: { id: true, name: true } },
          jobOrder: { select: { id: true, jobTitle: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.communicationReminder.findMany({
        where: { candidateId },
        include: {
          user: { select: { id: true, name: true } },
        },
        orderBy: { dueDate: 'asc' },
      }),
    ]);

    return res.json({
      candidate: {
        id: candidate.id,
        name: candidate.name,
        displaySlNo: candidate.displaySlNo,
        primaryPhone: candidate.primaryPhone,
      },
      communications,
      formTrackings,
      reminders,
    });
  } catch (err: any) {
    console.error('Candidate history error:', err);
    return res.status(500).json({ error: 'Failed to fetch communication history' });
  }
});

// ----------------------------------------------------
// CLICK-TO-WHATSAPP & FORM WORKFLOWS
// ----------------------------------------------------

// POST /api/communications/send-whatsapp - Prepare variables, generate URL, and log activity
router.post('/send-whatsapp', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      candidateId,
      templateId,
      customMessage,
      jobOrderId,
      clientId,
      communicationType = 'GENERAL_INTRO',
    } = req.body;

    const user = req.user!;
    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    let finalMessage = customMessage || '';
    let jobOrderObj = null;
    let clientObj = null;

    if (jobOrderId) {
      jobOrderObj = await prisma.jobOrder.findUnique({
        where: { id: jobOrderId },
        include: { client: true },
      });
      if (jobOrderObj) clientObj = jobOrderObj.client;
    } else if (clientId) {
      clientObj = await prisma.client.findUnique({ where: { id: clientId } });
    }

    if (templateId) {
      const template = await prisma.messageTemplate.findUnique({ where: { id: templateId } });
      if (template) {
        // Substitute variables
        const variablesMap: Record<string, string> = {
          candidateName: candidate.name,
          jobTitle: jobOrderObj?.jobTitle || 'Executive Opening',
          companyName: clientObj?.companyName || 'Corporate Client',
          jobLocation: jobOrderObj?.jobLocation || candidate.currentLocation || 'Delhi NCR',
          salary: jobOrderObj?.minSalary && jobOrderObj?.maxSalary
            ? `₹${(jobOrderObj.minSalary / 100000).toFixed(1)}L - ${(jobOrderObj.maxSalary / 100000).toFixed(1)}L`
            : 'Negotiable',
          interviewDate: new Date().toISOString().slice(0, 10),
          interviewTime: '11:00 AM',
          registrationFormLink: 'https://geniusconsultants.com/register/GC-2026',
          executiveName: user.name,
        };

        finalMessage = replaceTemplateVariables(template.bodyText, variablesMap);
      }
    }

    const normPhone = getNormalizedWhatsAppPhone(candidate.primaryPhone);
    const encodedText = encodeURIComponent(finalMessage);
    const whatsAppUrl = `https://wa.me/${normPhone}?text=${encodedText}`;

    // Record Communication Activity (Initiated Status)
    const commActivity = await prisma.communicationActivity.create({
      data: {
        id: uuidv4(),
        candidateId,
        userId: user.id,
        jobOrderId: jobOrderId || null,
        clientId: clientObj?.id || null,
        channel: 'WHATSAPP',
        communicationType,
        templateId: templateId || null,
        messageContent: finalMessage,
        recipientPhone: candidate.primaryPhone,
        provider: 'WHATSAPP_WEB',
        deliveryStatus: 'INITIATED',
        sentAt: new Date(),
      },
      include: {
        user: { select: { id: true, name: true } },
        jobOrder: { select: { id: true, jobTitle: true } },
        client: { select: { id: true, companyName: true } },
      },
    });

    await logActivity({
      userId: user.id,
      candidateId,
      action: 'WHATSAPP_INITIATED',
      details: `WhatsApp message initiated for ${candidate.name} (${communicationType})`,
    });

    return res.json({
      communicationActivity: commActivity,
      whatsAppUrl,
      finalMessage,
    });
  } catch (err: any) {
    console.error('Send WhatsApp error:', err);
    return res.status(500).json({ error: 'Failed to initiate WhatsApp communication' });
  }
});

// POST /api/communications/send-form - Track Registration Form Link Sent
router.post('/send-form', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { candidateId, jobOrderId, formUrl = 'https://geniusconsultants.com/register/GC-2026' } = req.body;
    const user = req.user!;

    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    // Track Form
    const formTracking = await prisma.candidateFormTracking.create({
      data: {
        id: uuidv4(),
        candidateId,
        jobOrderId: jobOrderId || null,
        formName: 'Candidate Onboarding & Registration Form',
        formUrl,
        sentById: user.id,
        status: 'SENT',
      },
    });

    // Create 2-day reminder
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 2);

    await prisma.communicationReminder.create({
      data: {
        id: uuidv4(),
        candidateId,
        userId: user.id,
        jobOrderId: jobOrderId || null,
        reminderType: 'FORM_REMINDER',
        dueDate: dueDate.toISOString().slice(0, 10),
        status: 'PENDING',
      },
    });

    // Log Activity
    await logActivity({
      userId: user.id,
      candidateId,
      action: 'REGISTRATION_FORM_SENT',
      details: `Sent Registration Form to ${candidate.name}`,
    });

    return res.status(201).json({ formTracking });
  } catch (err: any) {
    console.error('Send form error:', err);
    return res.status(500).json({ error: 'Failed to record registration form send' });
  }
});

// POST /api/communications/request-cv - Track CV Requested
router.post('/request-cv', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { candidateId, jobOrderId } = req.body;
    const user = req.user!;

    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    // Update shortlist record if exists
    await prisma.shortlistRecord.updateMany({
      where: { candidateId },
      data: { cvReceivedWhatsapp: 'PENDING' },
    });

    // Create 1-day reminder
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);

    const reminder = await prisma.communicationReminder.create({
      data: {
        id: uuidv4(),
        candidateId,
        userId: user.id,
        jobOrderId: jobOrderId || null,
        reminderType: 'CV_REMINDER',
        dueDate: dueDate.toISOString().slice(0, 10),
        status: 'PENDING',
      },
    });

    await logActivity({
      userId: user.id,
      candidateId,
      action: 'CV_REQUESTED',
      details: `Requested updated resume from ${candidate.name}`,
    });

    return res.status(201).json({ message: 'CV request recorded and follow-up reminder created', reminder });
  } catch (err: any) {
    console.error('Request CV error:', err);
    return res.status(500).json({ error: 'Failed to record CV request' });
  }
});

// GET /api/communications/analytics - Telemetry & Metrics
router.get('/analytics', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);

    const [todayComms, todayForms, pendingForms, cvRequests, pendingReminders, totalMonthComms] = await Promise.all([
      prisma.communicationActivity.count({ where: { channel: 'WHATSAPP', createdAt: { gte: new Date(todayStr) } } }),
      prisma.candidateFormTracking.count({ where: { createdAt: { gte: new Date(todayStr) } } }),
      prisma.candidateFormTracking.count({ where: { status: 'SENT' } }),
      prisma.communicationActivity.count({ where: { communicationType: 'CV_REQUEST', createdAt: { gte: new Date(todayStr) } } }),
      prisma.communicationReminder.count({ where: { status: 'PENDING', dueDate: { lte: todayStr } } }),
      prisma.communicationActivity.count({ where: { createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }),
    ]);

    return res.json({
      today: {
        whatsAppInitiated: todayComms,
        formsSent: todayForms,
        formsPending: pendingForms,
        cvRequestsSent: cvRequests,
        remindersDue: pendingReminders,
      },
      month: {
        totalCommunications: totalMonthComms,
      },
    });
  } catch (err: any) {
    console.error('Communications analytics error:', err);
    return res.status(500).json({ error: 'Failed to fetch communication analytics' });
  }
});

export default router;
