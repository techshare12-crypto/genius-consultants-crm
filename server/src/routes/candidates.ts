import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { authenticate, requireRoles, AuthenticatedRequest } from '../middleware/auth';
import { normalizePhoneNumber, isValidMobileNumber } from '../utils/phone';
import { calculateLeadPriorityScore, calculateDataQualityScore } from '../utils/priority';
import { logActivity } from '../services/audit';

const router = Router();

// Helper to generate unique human-readable SL NO
async function generateDisplaySlNo(): Promise<string> {
  const count = await prisma.candidate.count();
  const year = new Date().getFullYear();
  const serial = String(count + 1).padStart(5, '0');
  return `GC-${year}-${serial}`;
}

// GET /api/candidates - List candidates with advanced filtering, sorting, pagination
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      page = '1',
      limit = '50',
      search = '',
      stage,
      executiveId,
      location,
      source,
      minExp,
      hasTwoWheeler,
      hasLicense,
      fieldSales,
      shortlistedOnly,
      sortBy = 'createdAt_desc',
      isDeleted = 'false',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const take = Math.min(200, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * take;

    const where: any = {
      isDeleted: isDeleted === 'true',
    };

    // Role-based access control for Executives:
    // Executives can only see leads assigned to them unless specifically permitted
    if (req.user!.role === 'EXECUTIVE') {
      where.assignedExecutiveId = req.user!.id;
    } else if (executiveId && executiveId !== 'ALL') {
      if (executiveId === 'UNASSIGNED') {
        where.assignedExecutiveId = null;
      } else {
        where.assignedExecutiveId = executiveId as string;
      }
    }

    if (stage && stage !== 'ALL') {
      where.leadStage = stage as string;
    }

    if (location && location !== 'ALL') {
      where.currentLocation = { contains: location as string };
    }

    if (source && source !== 'ALL') {
      where.leadSource = source as string;
    }

    if (hasTwoWheeler === 'true') where.hasTwoWheeler = true;
    if (hasLicense === 'true') where.hasDrivingLicense = true;
    if (fieldSales === 'true') where.interestedInFieldSales = true;

    if (minExp) {
      where.totalExperienceYears = { gte: parseFloat(minExp as string) };
    }

    if (shortlistedOnly === 'true') {
      where.shortlistRecord = { isNot: null };
    }

    if (search) {
      const q = (search as string).trim();
      const normPhone = normalizePhoneNumber(q);
      where.OR = [
        { name: { contains: q } },
        { primaryPhone: { contains: normPhone || q } },
        { secondaryPhone: { contains: normPhone || q } },
        { displaySlNo: { contains: q } },
        { email: { contains: q } },
        { currentLocation: { contains: q } },
        { appliedLocation: { contains: q } },
        { currentCompany: { contains: q } },
      ];
    }

    // Determine orderBy
    let orderBy: any = { createdAt: 'desc' };
    if (sortBy === 'createdAt_asc') orderBy = { createdAt: 'asc' };
    else if (sortBy === 'name_asc') orderBy = { name: 'asc' };
    else if (sortBy === 'name_desc') orderBy = { name: 'desc' };
    else if (sortBy === 'priority_desc') orderBy = { leadPriorityScore: 'desc' };
    else if (sortBy === 'location_asc') orderBy = { currentLocation: 'asc' };

    const [total, candidates] = await Promise.all([
      prisma.candidate.count({ where }),
      prisma.candidate.findMany({
        where,
        take,
        skip,
        orderBy,
        include: {
          assignedExecutive: {
            select: { id: true, name: true, email: true },
          },
          shortlistRecord: true,
          callbacks: {
            where: { status: 'PENDING' },
            orderBy: { callbackDate: 'asc' },
            take: 1,
          },
          _count: {
            select: {
              callActivities: true,
              callbacks: true,
            },
          },
        },
      }),
    ]);

    return res.json({
      candidates,
      pagination: {
        page: pageNum,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (err: any) {
    console.error('Fetch candidates error:', err);
    return res.status(500).json({ error: 'Failed to fetch candidates' });
  }
});

// GET /api/candidates/:id - Get complete 360-degree Candidate Profile
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const candidate = await prisma.candidate.findUnique({
      where: { id },
      include: {
        assignedExecutive: {
          select: { id: true, name: true, email: true, phone: true },
        },
        leadOwner: {
          select: { id: true, name: true, email: true },
        },
        importBatch: {
          select: { id: true, batchName: true, fileName: true, createdAt: true },
        },
        shortlistRecord: {
          include: {
            shortlistedBy: {
              select: { id: true, name: true },
            },
          },
        },
        callActivities: {
          orderBy: { createdAt: 'desc' },
          include: {
            executive: {
              select: { id: true, name: true },
            },
          },
        },
        callbacks: {
          orderBy: { callbackDate: 'desc' },
          include: {
            executive: {
              select: { id: true, name: true },
            },
          },
        },
        leadAssignments: {
          orderBy: { assignedAt: 'desc' },
          include: {
            assignedBy: { select: { id: true, name: true } },
            assignedTo: { select: { id: true, name: true } },
          },
        },
        activityLogs: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Role check: Executive can only view assigned candidate
    if (req.user!.role === 'EXECUTIVE' && candidate.assignedExecutiveId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied: Candidate is not assigned to you' });
    }

    return res.json({ candidate });
  } catch (err: any) {
    console.error('Fetch candidate profile error:', err);
    return res.status(500).json({ error: 'Failed to fetch candidate details' });
  }
});

// POST /api/candidates - Add single candidate
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name,
      primaryPhone,
      secondaryPhone,
      whatsappNumber,
      email,
      age,
      gender,
      currentLocation,
      nativeLocation,
      education,
      totalExperienceYears,
      currentJobTitle,
      currentCompany,
      previousCompany,
      skills,
      languages,
      currentSalary,
      expectedSalary,
      appliedLocation,
      preferredLocations,
      noticePeriod,
      hasTwoWheeler,
      hasDrivingLicense,
      interestedInFieldSales,
      interestedInAutomobile,
      customEligibility,
      leadSource,
      generalNotes,
      assignedExecutiveId,
    } = req.body;

    if (!name || !primaryPhone) {
      return res.status(400).json({ error: 'Candidate Name and Primary Contact Number are required' });
    }

    const normPhone = normalizePhoneNumber(primaryPhone);
    if (!normPhone || normPhone.length < 10) {
      return res.status(400).json({ error: 'Invalid contact number format' });
    }

    // Check duplicate
    const existing = await prisma.candidate.findFirst({
      where: {
        primaryPhone: normPhone,
        isDeleted: false,
      },
    });

    if (existing) {
      return res.status(409).json({
        error: `Candidate already exists with phone ${normPhone} (ID: ${existing.displaySlNo}, Name: ${existing.name})`,
        candidate: existing,
      });
    }

    const displaySlNo = await generateDisplaySlNo();
    const candidateId = uuidv4();

    const dataQualityScore = calculateDataQualityScore({
      name,
      primaryPhone: normPhone,
      email,
      currentLocation,
      education,
      totalExperienceYears: totalExperienceYears ? Number(totalExperienceYears) : 0,
      currentSalary,
      expectedSalary,
      noticePeriod,
    });

    const leadPriorityScore = calculateLeadPriorityScore({
      createdAt: new Date(),
      leadStage: assignedExecutiveId ? 'ASSIGNED' : 'NEW',
      hasTwoWheeler: Boolean(hasTwoWheeler),
      hasDrivingLicense: Boolean(hasDrivingLicense),
      interestedInFieldSales: Boolean(interestedInFieldSales),
      totalExperienceYears: Number(totalExperienceYears) || 0,
      email,
      currentLocation,
      education,
      expectedSalary,
    });

    const candidate = await prisma.candidate.create({
      data: {
        id: candidateId,
        displaySlNo,
        name: name.trim(),
        primaryPhone: normPhone,
        secondaryPhone: secondaryPhone ? normalizePhoneNumber(secondaryPhone) : null,
        whatsappNumber: whatsappNumber ? normalizePhoneNumber(whatsappNumber) : normPhone,
        email: email ? email.toLowerCase().trim() : null,
        age: age ? Number(age) : null,
        gender: gender || null,
        currentLocation: currentLocation || null,
        nativeLocation: nativeLocation || null,
        education: education || null,
        totalExperienceYears: totalExperienceYears ? Number(totalExperienceYears) : 0,
        currentJobTitle: currentJobTitle || null,
        currentCompany: currentCompany || null,
        previousCompany: previousCompany || null,
        skills: skills || null,
        languages: languages || null,
        currentSalary: currentSalary || null,
        expectedSalary: expectedSalary || null,
        appliedLocation: appliedLocation || null,
        preferredLocations: preferredLocations || null,
        noticePeriod: noticePeriod || null,
        hasTwoWheeler: Boolean(hasTwoWheeler),
        hasDrivingLicense: Boolean(hasDrivingLicense),
        interestedInFieldSales: Boolean(interestedInFieldSales),
        interestedInAutomobile: Boolean(interestedInAutomobile),
        customEligibility: customEligibility || null,
        leadSource: leadSource || 'Manual Entry',
        generalNotes: generalNotes || null,
        assignedExecutiveId: assignedExecutiveId || (req.user!.role === 'EXECUTIVE' ? req.user!.id : null),
        leadOwnerId: req.user!.id,
        leadStage: assignedExecutiveId ? 'ASSIGNED' : 'NEW',
        dataQualityScore,
        leadPriorityScore,
      },
    });

    await logActivity({
      userId: req.user!.id,
      candidateId: candidate.id,
      action: 'CANDIDATE_CREATED',
      details: `Created candidate ${candidate.name} (${candidate.displaySlNo})`,
    });

    return res.status(201).json({ candidate });
  } catch (err: any) {
    console.error('Create candidate error:', err);
    return res.status(500).json({ error: 'Failed to create candidate' });
  }
});

// PUT /api/candidates/:id - Update candidate details
router.put('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const body = req.body;

    const existing = await prisma.candidate.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    if (req.user!.role === 'EXECUTIVE' && existing.assignedExecutiveId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied: Candidate is not assigned to you' });
    }

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.primaryPhone !== undefined) updateData.primaryPhone = normalizePhoneNumber(body.primaryPhone);
    if (body.secondaryPhone !== undefined) updateData.secondaryPhone = normalizePhoneNumber(body.secondaryPhone);
    if (body.whatsappNumber !== undefined) updateData.whatsappNumber = normalizePhoneNumber(body.whatsappNumber);
    if (body.email !== undefined) updateData.email = body.email ? body.email.toLowerCase().trim() : null;
    if (body.age !== undefined) updateData.age = body.age ? Number(body.age) : null;
    if (body.gender !== undefined) updateData.gender = body.gender;
    if (body.currentLocation !== undefined) updateData.currentLocation = body.currentLocation;
    if (body.nativeLocation !== undefined) updateData.nativeLocation = body.nativeLocation;
    if (body.education !== undefined) updateData.education = body.education;
    if (body.totalExperienceYears !== undefined) updateData.totalExperienceYears = Number(body.totalExperienceYears);
    if (body.currentJobTitle !== undefined) updateData.currentJobTitle = body.currentJobTitle;
    if (body.currentCompany !== undefined) updateData.currentCompany = body.currentCompany;
    if (body.previousCompany !== undefined) updateData.previousCompany = body.previousCompany;
    if (body.skills !== undefined) updateData.skills = body.skills;
    if (body.languages !== undefined) updateData.languages = body.languages;
    if (body.currentSalary !== undefined) updateData.currentSalary = body.currentSalary;
    if (body.expectedSalary !== undefined) updateData.expectedSalary = body.expectedSalary;
    if (body.appliedLocation !== undefined) updateData.appliedLocation = body.appliedLocation;
    if (body.preferredLocations !== undefined) updateData.preferredLocations = body.preferredLocations;
    if (body.noticePeriod !== undefined) updateData.noticePeriod = body.noticePeriod;
    if (body.hasTwoWheeler !== undefined) updateData.hasTwoWheeler = Boolean(body.hasTwoWheeler);
    if (body.hasDrivingLicense !== undefined) updateData.hasDrivingLicense = Boolean(body.hasDrivingLicense);
    if (body.interestedInFieldSales !== undefined) updateData.interestedInFieldSales = Boolean(body.interestedInFieldSales);
    if (body.interestedInAutomobile !== undefined) updateData.interestedInAutomobile = Boolean(body.interestedInAutomobile);
    if (body.customEligibility !== undefined) updateData.customEligibility = body.customEligibility;
    if (body.generalNotes !== undefined) updateData.generalNotes = body.generalNotes;
    
    // Only Admin/Manager can update manager notes
    if (body.managerNotes !== undefined && req.user!.role !== 'EXECUTIVE') {
      updateData.managerNotes = body.managerNotes;
    }

    if (body.leadStage !== undefined) {
      updateData.leadStage = body.leadStage;
    }

    // Recalculate scores
    updateData.dataQualityScore = calculateDataQualityScore({
      name: updateData.name || existing.name,
      primaryPhone: updateData.primaryPhone || existing.primaryPhone,
      email: updateData.email !== undefined ? updateData.email : existing.email,
      currentLocation: updateData.currentLocation !== undefined ? updateData.currentLocation : existing.currentLocation,
      education: updateData.education !== undefined ? updateData.education : existing.education,
      totalExperienceYears: updateData.totalExperienceYears !== undefined ? updateData.totalExperienceYears : existing.totalExperienceYears,
      currentSalary: updateData.currentSalary !== undefined ? updateData.currentSalary : existing.currentSalary,
      expectedSalary: updateData.expectedSalary !== undefined ? updateData.expectedSalary : existing.expectedSalary,
      noticePeriod: updateData.noticePeriod !== undefined ? updateData.noticePeriod : existing.noticePeriod,
    });

    const updated = await prisma.candidate.update({
      where: { id },
      data: updateData,
      include: {
        assignedExecutive: { select: { id: true, name: true } },
        shortlistRecord: true,
      },
    });

    await logActivity({
      userId: req.user!.id,
      candidateId: id,
      action: 'CANDIDATE_UPDATED',
      details: `Updated candidate details for ${updated.name}`,
    });

    return res.json({ candidate: updated });
  } catch (err: any) {
    console.error('Update candidate error:', err);
    return res.status(500).json({ error: 'Failed to update candidate' });
  }
});

// DELETE /api/candidates/:id - Soft delete candidate (Admin/Super Admin only)
router.delete('/:id', authenticate, requireRoles('ADMIN', 'SUPER_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const candidate = await prisma.candidate.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    await logActivity({
      userId: req.user!.id,
      candidateId: id,
      action: 'CANDIDATE_DELETED',
      details: `Soft deleted candidate ${candidate.name} (${candidate.displaySlNo})`,
    });

    return res.json({ success: true, message: 'Candidate soft deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete candidate' });
  }
});

// POST /api/candidates/:id/restore - Restore soft-deleted candidate (Admin only)
router.post('/:id/restore', authenticate, requireRoles('ADMIN', 'SUPER_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const candidate = await prisma.candidate.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
      },
    });

    await logActivity({
      userId: req.user!.id,
      candidateId: id,
      action: 'CANDIDATE_RESTORED',
      details: `Restored candidate ${candidate.name} (${candidate.displaySlNo})`,
    });

    return res.json({ success: true, candidate });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to restore candidate' });
  }
});

export default router;
