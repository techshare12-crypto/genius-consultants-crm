import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { authenticate, AuthenticatedRequest, requirePermission } from '../middleware/auth';
import { logActivity } from '../services/audit';

const router = Router();

// GET /api/clients - List all corporate clients with summary stats
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, industry, search } = req.query;

    const where: any = {};
    if (status && status !== 'ALL') where.status = String(status);
    if (industry && industry !== 'ALL') where.industry = String(industry);
    if (search) {
      const q = String(search).toLowerCase();
      where.OR = [
        { companyName: { contains: q } },
        { contactPersonName: { contains: q } },
        { city: { contains: q } },
        { displayClientId: { contains: q } },
        { email: { contains: q } },
      ];
    }

    const clients = await prisma.client.findMany({
      where,
      include: {
        _count: {
          select: {
            jobOrders: true,
            submissions: true,
            placements: { where: { status: 'JOINED' } },
          },
        },
      },
      orderBy: { companyName: 'asc' },
    });

    const sanitized = clients.map((c) => ({
      ...c,
      stats: {
        totalJobOrders: c._count.jobOrders,
        totalSubmissions: c._count.submissions,
        totalJoined: c._count.placements,
      },
    }));

    return res.json({ clients: sanitized });
  } catch (err: any) {
    console.error('Fetch clients error:', err);
    return res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// GET /api/clients/:id - 360° Client Profile
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        jobOrders: {
          include: {
            submissions: true,
            placements: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        submissions: {
          include: {
            candidate: { select: { id: true, name: true, primaryPhone: true, displaySlNo: true } },
            jobOrder: { select: { id: true, jobTitle: true, displayJobId: true } },
            submittedBy: { select: { id: true, name: true } },
          },
          orderBy: { submissionDate: 'desc' },
        },
        placements: {
          include: {
            candidate: { select: { id: true, name: true, primaryPhone: true, displaySlNo: true } },
            placedBy: { select: { id: true, name: true } },
          },
          orderBy: { selectionDate: 'desc' },
        },
      },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client company not found' });
    }

    const c = client as any;
    const totalVacancies = (c.jobOrders || []).reduce((acc: number, j: any) => acc + (j.numberOfVacancies || 0), 0);
    const activeJobs = (c.jobOrders || []).filter((j: any) => j.status === 'OPEN').length;
    const totalJoined = (c.placements || []).filter((p: any) => p.status === 'JOINED').length;

    return res.json({
      client: {
        ...c,
        summary: {
          totalJobOrders: (c.jobOrders || []).length,
          activeJobOrders: activeJobs,
          totalVacancies,
          totalSubmissions: (c.submissions || []).length,
          totalJoined,
        },
      },
    });
  } catch (err: any) {
    console.error('Client profile error:', err);
    return res.status(500).json({ error: 'Failed to fetch client profile' });
  }
});

// POST /api/clients - Create Client
router.post('/', authenticate, requirePermission('manage_clients'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      companyName,
      companyLogo,
      industry,
      companyWebsite,
      companyAddress,
      city,
      state,
      country = 'India',
      contactPersonName,
      designation,
      mobileNumber,
      whatsappNumber,
      email,
      secondaryContactPerson,
      secondaryContactNumber,
      hrContact,
      recruitmentContact,
      recruitmentFeeType = 'PERCENTAGE',
      feeAmountOrPercent = 8.33,
      paymentTerms = '30 Days from Date of Joining',
      invoiceTerms,
      replacementPeriodDays = 90,
      status = 'ACTIVE',
    } = req.body;

    if (!companyName || !industry || !contactPersonName || !mobileNumber || !email) {
      return res.status(400).json({ error: 'Company Name, Industry, Contact Person, Mobile, and Email are required' });
    }

    // Generate unique displayClientId (GC-CLI-001)
    const count = await prisma.client.count();
    const displayClientId = `GC-CLI-${String(count + 1).padStart(3, '0')}`;

    const newClient = await prisma.client.create({
      data: {
        id: uuidv4(),
        displayClientId,
        companyName: companyName.trim(),
        companyLogo: companyLogo || null,
        industry: industry.trim(),
        companyWebsite: companyWebsite ? companyWebsite.trim() : null,
        companyAddress: companyAddress ? companyAddress.trim() : null,
        city: city ? city.trim() : null,
        state: state ? state.trim() : null,
        country: country || 'India',
        contactPersonName: contactPersonName.trim(),
        designation: designation ? designation.trim() : null,
        mobileNumber: String(mobileNumber).trim(),
        whatsappNumber: whatsappNumber ? String(whatsappNumber).trim() : String(mobileNumber).trim(),
        email: email.toLowerCase().trim(),
        secondaryContactPerson: secondaryContactPerson || null,
        secondaryContactNumber: secondaryContactNumber || null,
        hrContact: hrContact || null,
        recruitmentContact: recruitmentContact || null,
        recruitmentFeeType,
        feeAmountOrPercent: Number(feeAmountOrPercent) || 8.33,
        paymentTerms,
        invoiceTerms: invoiceTerms || null,
        replacementPeriodDays: Number(replacementPeriodDays) || 90,
        status: status || 'ACTIVE',
        createdById: req.user!.id,
      },
    });

    await logActivity({
      userId: req.user!.id,
      action: 'CLIENT_CREATED',
      details: `Created new corporate client: ${newClient.companyName} (${newClient.displayClientId})`,
    });

    return res.status(201).json({ client: newClient });
  } catch (err: any) {
    console.error('Create client error:', err);
    return res.status(500).json({ error: 'Failed to create corporate client' });
  }
});

// PUT /api/clients/:id - Update Client
router.put('/:id', authenticate, requirePermission('manage_clients'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const body = req.body;

    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const updated = await prisma.client.update({
      where: { id },
      data: {
        companyName: body.companyName !== undefined ? body.companyName.trim() : existing.companyName,
        companyLogo: body.companyLogo !== undefined ? body.companyLogo : existing.companyLogo,
        industry: body.industry !== undefined ? body.industry.trim() : existing.industry,
        companyWebsite: body.companyWebsite !== undefined ? body.companyWebsite : existing.companyWebsite,
        companyAddress: body.companyAddress !== undefined ? body.companyAddress : existing.companyAddress,
        city: body.city !== undefined ? body.city : existing.city,
        state: body.state !== undefined ? body.state : existing.state,
        country: body.country !== undefined ? body.country : existing.country,
        contactPersonName: body.contactPersonName !== undefined ? body.contactPersonName.trim() : existing.contactPersonName,
        designation: body.designation !== undefined ? body.designation : existing.designation,
        mobileNumber: body.mobileNumber !== undefined ? String(body.mobileNumber).trim() : existing.mobileNumber,
        whatsappNumber: body.whatsappNumber !== undefined ? String(body.whatsappNumber).trim() : existing.whatsappNumber,
        email: body.email !== undefined ? body.email.toLowerCase().trim() : existing.email,
        secondaryContactPerson: body.secondaryContactPerson !== undefined ? body.secondaryContactPerson : existing.secondaryContactPerson,
        secondaryContactNumber: body.secondaryContactNumber !== undefined ? body.secondaryContactNumber : existing.secondaryContactNumber,
        hrContact: body.hrContact !== undefined ? body.hrContact : existing.hrContact,
        recruitmentContact: body.recruitmentContact !== undefined ? body.recruitmentContact : existing.recruitmentContact,
        recruitmentFeeType: body.recruitmentFeeType !== undefined ? body.recruitmentFeeType : existing.recruitmentFeeType,
        feeAmountOrPercent: body.feeAmountOrPercent !== undefined ? Number(body.feeAmountOrPercent) : existing.feeAmountOrPercent,
        paymentTerms: body.paymentTerms !== undefined ? body.paymentTerms : existing.paymentTerms,
        invoiceTerms: body.invoiceTerms !== undefined ? body.invoiceTerms : existing.invoiceTerms,
        replacementPeriodDays: body.replacementPeriodDays !== undefined ? Number(body.replacementPeriodDays) : existing.replacementPeriodDays,
        status: body.status !== undefined ? body.status : existing.status,
      },
    });

    await logActivity({
      userId: req.user!.id,
      action: 'CLIENT_UPDATED',
      details: `Updated corporate client details for: ${updated.companyName}`,
    });

    return res.json({ client: updated });
  } catch (err: any) {
    console.error('Update client error:', err);
    return res.status(500).json({ error: 'Failed to update client' });
  }
});

export default router;
