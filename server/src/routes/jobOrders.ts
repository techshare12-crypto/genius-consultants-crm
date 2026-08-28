import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { authenticate, AuthenticatedRequest, requirePermission } from '../middleware/auth';
import { logActivity } from '../services/audit';

const router = Router();

// GET /api/job-orders - List Job Orders / Vacancies
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId, status, priority, location, search } = req.query;

    const where: any = {};
    if (clientId && clientId !== 'ALL') where.clientId = String(clientId);
    if (status && status !== 'ALL') where.status = String(status);
    if (priority && priority !== 'ALL') where.priority = String(priority);
    if (location && location !== 'ALL') where.jobLocation = { contains: String(location) };
    if (search) {
      const q = String(search).toLowerCase();
      where.OR = [
        { jobTitle: { contains: q } },
        { displayJobId: { contains: q } },
        { department: { contains: q } },
        { client: { companyName: { contains: q } } },
      ];
    }

    const jobOrders = await prisma.jobOrder.findMany({
      where,
      include: {
        client: {
          select: { id: true, displayClientId: true, companyName: true, industry: true, city: true },
        },
        assignedManager: { select: { id: true, name: true, email: true } },
        _count: {
          select: {
            applications: true,
            submissions: true,
            interviews: true,
            placements: { where: { status: 'JOINED' } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const sanitized = jobOrders.map((j) => ({
      ...j,
      stats: {
        totalSourced: j._count.applications,
        totalSubmissions: j._count.submissions,
        totalInterviews: j._count.interviews,
        totalJoined: j._count.placements,
      },
    }));

    return res.json({ jobOrders: sanitized });
  } catch (err: any) {
    console.error('Fetch job orders error:', err);
    return res.status(500).json({ error: 'Failed to fetch job orders' });
  }
});

// GET /api/job-orders/:id - Job Order Detail & Live KPI Funnel
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const job = await prisma.jobOrder.findUnique({
      where: { id },
      include: {
        client: true,
        assignedManager: { select: { id: true, name: true, email: true } },
        applications: {
          include: {
            candidate: true,
            assignedExecutive: { select: { id: true, name: true } },
            submissions: true,
            interviews: true,
            placements: true,
          },
          orderBy: { updatedAt: 'desc' },
        },
        submissions: {
          include: {
            candidate: { select: { id: true, name: true, primaryPhone: true, displaySlNo: true } },
            submittedBy: { select: { id: true, name: true } },
          },
          orderBy: { submissionDate: 'desc' },
        },
        interviews: {
          include: {
            candidate: { select: { id: true, name: true, primaryPhone: true, displaySlNo: true } },
            scheduledBy: { select: { id: true, name: true } },
          },
          orderBy: { interviewDate: 'asc' },
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

    if (!job) {
      return res.status(404).json({ error: 'Job Order not found' });
    }

    const j = job as any;

    // Live KPI Funnel aggregation
    const totalCandidates = (j.applications || []).length;
    const callingCount = (j.applications || []).filter((a: any) => ['CALLING', 'ASSIGNED'].includes(a.applicationStage)).length;
    const shortlistedCount = (j.applications || []).filter((a: any) => ['SHORTLISTED', 'FORM_COMPLETED', 'CV_RECEIVED', 'SUBMITTED_TO_CLIENT', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'SELECTED', 'JOINED'].includes(a.applicationStage)).length;
    const submittedCount = (j.submissions || []).length;
    const interviewCount = (j.interviews || []).length;
    const selectedCount = (j.placements || []).length;
    const joinedCount = (j.placements || []).filter((p: any) => p.status === 'JOINED').length;

    const conversionRates = {
      shortlistRate: totalCandidates > 0 ? parseFloat(((shortlistedCount / totalCandidates) * 100).toFixed(1)) : 0,
      submissionRate: shortlistedCount > 0 ? parseFloat(((submittedCount / shortlistedCount) * 100).toFixed(1)) : 0,
      interviewRate: submittedCount > 0 ? parseFloat(((interviewCount / submittedCount) * 100).toFixed(1)) : 0,
      selectionRate: interviewCount > 0 ? parseFloat(((selectedCount / interviewCount) * 100).toFixed(1)) : 0,
      joiningRate: selectedCount > 0 ? parseFloat(((joinedCount / selectedCount) * 100).toFixed(1)) : 0,
    };

    return res.json({
      jobOrder: {
        ...job,
        funnel: {
          totalCandidates,
          callingCount,
          shortlistedCount,
          submittedCount,
          interviewCount,
          selectedCount,
          joinedCount,
          conversionRates,
        },
      },
    });
  } catch (err: any) {
    console.error('Job detail error:', err);
    return res.status(500).json({ error: 'Failed to fetch job order details' });
  }
});

// POST /api/job-orders - Create Job Order
router.post('/', authenticate, requirePermission('manage_job_orders'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      clientId,
      jobTitle,
      department,
      clientContactPerson,
      jobLocation,
      numberOfVacancies = 1,
      employmentType = 'FULL_TIME',
      jobDescription,
      requiredSkills,
      requiredEducation,
      minExperienceYears = 0,
      maxExperienceYears = 10,
      minSalary,
      maxSalary,
      salaryType = 'ANNUAL_CTC',
      incentives,
      minAge,
      maxAge,
      genderPreference = 'ANY',
      twoWheelerRequired = false,
      drivingLicenseRequired = false,
      fieldSalesRequired = false,
      automobileExpRequired = false,
      languagesRequired,
      deadline,
      priority = 'MEDIUM',
      assignedManagerId,
      targetCandidates = 50,
    } = req.body;

    if (!clientId || !jobTitle || !jobLocation) {
      return res.status(400).json({ error: 'Client ID, Job Title, and Job Location are required' });
    }

    const count = await prisma.jobOrder.count();
    const displayJobId = `GC-JOB-${String(count + 1).padStart(3, '0')}`;

    const newJob = await prisma.jobOrder.create({
      data: {
        id: uuidv4(),
        displayJobId,
        clientId,
        jobTitle: jobTitle.trim(),
        department: department ? department.trim() : null,
        clientContactPerson: clientContactPerson ? clientContactPerson.trim() : null,
        jobLocation: jobLocation.trim(),
        numberOfVacancies: Number(numberOfVacancies) || 1,
        employmentType,
        jobDescription: jobDescription ? jobDescription.trim() : null,
        requiredSkills: requiredSkills ? requiredSkills.trim() : null,
        requiredEducation: requiredEducation ? requiredEducation.trim() : null,
        minExperienceYears: parseFloat(String(minExperienceYears)) || 0,
        maxExperienceYears: parseFloat(String(maxExperienceYears)) || 10,
        minSalary: minSalary ? parseFloat(String(minSalary)) : null,
        maxSalary: maxSalary ? parseFloat(String(maxSalary)) : null,
        salaryType,
        incentives: incentives ? incentives.trim() : null,
        minAge: minAge ? parseInt(String(minAge), 10) : null,
        maxAge: maxAge ? parseInt(String(maxAge), 10) : null,
        genderPreference,
        twoWheelerRequired: Boolean(twoWheelerRequired),
        drivingLicenseRequired: Boolean(drivingLicenseRequired),
        fieldSalesRequired: Boolean(fieldSalesRequired),
        automobileExpRequired: Boolean(automobileExpRequired),
        languagesRequired: languagesRequired ? languagesRequired.trim() : null,
        deadline: deadline ? new Date(deadline) : null,
        priority,
        assignedManagerId: assignedManagerId || req.user!.id,
        targetCandidates: Number(targetCandidates) || 50,
        status: 'OPEN',
      },
      include: {
        client: { select: { id: true, companyName: true } },
      },
    });

    await logActivity({
      userId: req.user!.id,
      action: 'JOB_ORDER_CREATED',
      details: `Created new Job Order: ${newJob.jobTitle} (${newJob.displayJobId}) for ${newJob.client.companyName}`,
    });

    return res.status(201).json({ jobOrder: newJob });
  } catch (err: any) {
    console.error('Create job order error:', err);
    return res.status(500).json({ error: 'Failed to create job order' });
  }
});

// PUT /api/job-orders/:id - Update Job Order
router.put('/:id', authenticate, requirePermission('manage_job_orders'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const body = req.body;

    const existing = await prisma.jobOrder.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Job Order not found' });
    }

    const updated = await prisma.jobOrder.update({
      where: { id },
      data: {
        jobTitle: body.jobTitle !== undefined ? body.jobTitle.trim() : existing.jobTitle,
        department: body.department !== undefined ? body.department : existing.department,
        clientContactPerson: body.clientContactPerson !== undefined ? body.clientContactPerson : existing.clientContactPerson,
        jobLocation: body.jobLocation !== undefined ? body.jobLocation.trim() : existing.jobLocation,
        numberOfVacancies: body.numberOfVacancies !== undefined ? Number(body.numberOfVacancies) : existing.numberOfVacancies,
        employmentType: body.employmentType !== undefined ? body.employmentType : existing.employmentType,
        jobDescription: body.jobDescription !== undefined ? body.jobDescription : existing.jobDescription,
        requiredSkills: body.requiredSkills !== undefined ? body.requiredSkills : existing.requiredSkills,
        requiredEducation: body.requiredEducation !== undefined ? body.requiredEducation : existing.requiredEducation,
        minExperienceYears: body.minExperienceYears !== undefined ? parseFloat(String(body.minExperienceYears)) : existing.minExperienceYears,
        maxExperienceYears: body.maxExperienceYears !== undefined ? parseFloat(String(body.maxExperienceYears)) : existing.maxExperienceYears,
        minSalary: body.minSalary !== undefined ? (body.minSalary ? parseFloat(String(body.minSalary)) : null) : existing.minSalary,
        maxSalary: body.maxSalary !== undefined ? (body.maxSalary ? parseFloat(String(body.maxSalary)) : null) : existing.maxSalary,
        salaryType: body.salaryType !== undefined ? body.salaryType : existing.salaryType,
        incentives: body.incentives !== undefined ? body.incentives : existing.incentives,
        minAge: body.minAge !== undefined ? (body.minAge ? parseInt(String(body.minAge), 10) : null) : existing.minAge,
        maxAge: body.maxAge !== undefined ? (body.maxAge ? parseInt(String(body.maxAge), 10) : null) : existing.maxAge,
        genderPreference: body.genderPreference !== undefined ? body.genderPreference : existing.genderPreference,
        twoWheelerRequired: body.twoWheelerRequired !== undefined ? Boolean(body.twoWheelerRequired) : existing.twoWheelerRequired,
        drivingLicenseRequired: body.drivingLicenseRequired !== undefined ? Boolean(body.drivingLicenseRequired) : existing.drivingLicenseRequired,
        fieldSalesRequired: body.fieldSalesRequired !== undefined ? Boolean(body.fieldSalesRequired) : existing.fieldSalesRequired,
        automobileExpRequired: body.automobileExpRequired !== undefined ? Boolean(body.automobileExpRequired) : existing.automobileExpRequired,
        languagesRequired: body.languagesRequired !== undefined ? body.languagesRequired : existing.languagesRequired,
        deadline: body.deadline !== undefined ? (body.deadline ? new Date(body.deadline) : null) : existing.deadline,
        priority: body.priority !== undefined ? body.priority : existing.priority,
        status: body.status !== undefined ? body.status : existing.status,
        closureReason: body.closureReason !== undefined ? body.closureReason : existing.closureReason,
        closedDate: body.status === 'CLOSED' && existing.status !== 'CLOSED' ? new Date() : existing.closedDate,
      },
    });

    await logActivity({
      userId: req.user!.id,
      action: 'JOB_ORDER_UPDATED',
      details: `Updated Job Order: ${updated.jobTitle} (${updated.displayJobId})`,
    });

    return res.json({ jobOrder: updated });
  } catch (err: any) {
    console.error('Update job error:', err);
    return res.status(500).json({ error: 'Failed to update job order' });
  }
});

// POST /api/job-orders/:id/add-candidates - Sourcing: Attach Candidates to Job Order
router.post('/:id/add-candidates', authenticate, requirePermission('source_candidates_to_jobs', 'manage_job_orders'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { candidateIds, assignedExecutiveId } = req.body;

    if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
      return res.status(400).json({ error: 'Candidate IDs array is required' });
    }

    const job = await prisma.jobOrder.findUnique({ where: { id } });
    if (!job) {
      return res.status(404).json({ error: 'Job Order not found' });
    }

    let addedCount = 0;
    for (const candId of candidateIds) {
      // Check if already exists in this job
      const exists = await prisma.candidateJobApplication.findUnique({
        where: {
          candidateId_jobOrderId: {
            candidateId: candId,
            jobOrderId: id,
          },
        },
      });

      if (!exists) {
        await prisma.candidateJobApplication.create({
          data: {
            id: uuidv4(),
            candidateId: candId,
            jobOrderId: id,
            assignedExecutiveId: assignedExecutiveId || null,
            addedById: req.user!.id,
            applicationStage: assignedExecutiveId ? 'ASSIGNED' : 'NEW_LEAD',
          },
        });
        addedCount++;
      }
    }

    await logActivity({
      userId: req.user!.id,
      action: 'CANDIDATES_ADDED_TO_JOB',
      details: `Sourced ${addedCount} candidates into Job Order: ${job.jobTitle} (${job.displayJobId})`,
    });

    return res.json({
      message: `Successfully attached ${addedCount} candidates to ${job.jobTitle}`,
      addedCount,
    });
  } catch (err: any) {
    console.error('Add candidates to job error:', err);
    return res.status(500).json({ error: 'Failed to add candidates to job order' });
  }
});

// PUT /api/job-orders/applications/:applicationId/stage - Update Application Stage
router.put('/applications/:applicationId/stage', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const applicationId = req.params.applicationId as string;
    const { applicationStage, stageNotes } = req.body;

    const app = await prisma.candidateJobApplication.findUnique({
      where: { id: applicationId },
      include: {
        candidate: true,
        jobOrder: { include: { client: true } },
      },
    });

    if (!app) {
      return res.status(404).json({ error: 'Job application record not found' });
    }

    const application = app as any;

    const updated = await prisma.candidateJobApplication.update({
      where: { id: applicationId as string },
      data: {
        applicationStage,
        stageNotes: stageNotes || application.stageNotes,
      },
    });

    // If shortlisted or above, auto-upsert shortlist record
    if (['SHORTLISTED', 'FORM_COMPLETED', 'CV_RECEIVED', 'SUBMITTED_TO_CLIENT', 'INTERVIEW_SCHEDULED', 'SELECTED', 'JOINED'].includes(applicationStage)) {
      await prisma.shortlistRecord.upsert({
        where: { candidateId: application.candidateId },
        create: {
          id: uuidv4(),
          candidateId: application.candidateId,
          jobOrderId: application.jobOrderId,
          clientId: application.jobOrder?.clientId,
          shortlistedById: req.user!.id,
          formFilled: applicationStage === 'FORM_COMPLETED' ? 'COMPLETED' : 'PENDING',
          cvReceivedWhatsapp: applicationStage === 'CV_RECEIVED' ? 'RECEIVED' : 'PENDING',
          shortlistStatus: applicationStage === 'JOINED' ? 'JOINED' : (applicationStage === 'SELECTED' ? 'CONFIRMED' : 'NEWLY_SHORTLISTED'),
          clientName: application.jobOrder?.client?.companyName,
          jobRole: application.jobOrder?.jobTitle,
          remarks: stageNotes || `Shortlisted for ${application.jobOrder?.jobTitle}`,
        },
        update: {
          jobOrderId: application.jobOrderId,
          clientId: application.jobOrder?.clientId,
          clientName: application.jobOrder?.client?.companyName,
          jobRole: application.jobOrder?.jobTitle,
          shortlistStatus: applicationStage === 'JOINED' ? 'JOINED' : (applicationStage === 'SELECTED' ? 'CONFIRMED' : 'NEWLY_SHORTLISTED'),
        },
      });
    }

    await logActivity({
      userId: req.user!.id,
      candidateId: application.candidateId,
      action: 'JOB_APPLICATION_STAGE_CHANGED',
      details: `Candidate ${application.candidate?.name || 'Candidate'} stage updated to "${applicationStage}" for Job: ${application.jobOrder?.jobTitle || 'Job'}`,
    });

    return res.json({ application: updated });
  } catch (err: any) {
    console.error('Update application stage error:', err);
    return res.status(500).json({ error: 'Failed to update application stage' });
  }
});

// POST /api/job-orders/submissions - Record Candidate Submission to Corporate Client
router.post('/submissions', authenticate, requirePermission('submit_to_client', 'manage_job_orders'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { applicationId, notes, cvFileName } = req.body;

    const app = await prisma.candidateJobApplication.findUnique({
      where: { id: applicationId },
      include: { candidate: true, jobOrder: true },
    });

    if (!app) {
      return res.status(404).json({ error: 'Job Application not found' });
    }

    const submission = await prisma.candidateSubmission.create({
      data: {
        id: uuidv4(),
        applicationId,
        candidateId: app.candidateId,
        jobOrderId: app.jobOrderId,
        clientId: app.jobOrder.clientId,
        submittedById: req.user!.id,
        cvFileName: cvFileName || 'Resume.pdf',
        notes: notes || 'Submitted candidate profile for review',
        status: 'SUBMITTED',
      },
    });

    // Update application stage
    await prisma.candidateJobApplication.update({
      where: { id: applicationId },
      data: { applicationStage: 'SUBMITTED_TO_CLIENT' },
    });

    await logActivity({
      userId: req.user!.id,
      candidateId: app.candidateId,
      action: 'CANDIDATE_SUBMITTED_TO_CLIENT',
      details: `Submitted ${app.candidate.name} to client for ${app.jobOrder.jobTitle}`,
    });

    return res.status(201).json({ submission });
  } catch (err: any) {
    console.error('Submission error:', err);
    return res.status(500).json({ error: 'Failed to record candidate submission' });
  }
});

// POST /api/job-orders/interviews - Schedule Client Interview
router.post('/interviews', authenticate, requirePermission('schedule_interviews', 'manage_job_orders'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      applicationId,
      interviewDate,
      interviewTime = '11:00',
      roundNumber = 1,
      interviewType = 'IN_PERSON',
      locationOrLink,
      interviewerName,
      interviewerDesignation,
      remarks,
    } = req.body;

    const app = await prisma.candidateJobApplication.findUnique({
      where: { id: applicationId },
      include: { candidate: true, jobOrder: true },
    });

    if (!app) {
      return res.status(404).json({ error: 'Job Application not found' });
    }

    const interview = await prisma.interview.create({
      data: {
        id: uuidv4(),
        applicationId,
        candidateId: app.candidateId,
        jobOrderId: app.jobOrderId,
        scheduledById: req.user!.id,
        interviewDate,
        interviewTime,
        roundNumber: Number(roundNumber) || 1,
        interviewType,
        locationOrLink: locationOrLink || null,
        interviewerName: interviewerName || null,
        interviewerDesignation: interviewerDesignation || null,
        result: 'PENDING',
        remarks: remarks || null,
      },
    });

    // Update application stage
    await prisma.candidateJobApplication.update({
      where: { id: applicationId },
      data: { applicationStage: 'INTERVIEW_SCHEDULED' },
    });

    await logActivity({
      userId: req.user!.id,
      candidateId: app.candidateId,
      action: 'INTERVIEW_SCHEDULED',
      details: `Scheduled interview for ${app.candidate.name} with ${app.jobOrder.jobTitle} on ${interviewDate} at ${interviewTime}`,
    });

    return res.status(201).json({ interview });
  } catch (err: any) {
    console.error('Interview schedule error:', err);
    return res.status(500).json({ error: 'Failed to schedule interview' });
  }
});

// POST /api/job-orders/placements - Record Selection & Final Placement
router.post('/placements', authenticate, requirePermission('record_placements', 'manage_job_orders'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      applicationId,
      joiningDate,
      offeredSalary,
      finalSalary,
      placementFee,
      replacementPeriodEndDate,
      status = 'SELECTED', // SELECTED, JOINED
      notes,
    } = req.body;

    const app = await prisma.candidateJobApplication.findUnique({
      where: { id: applicationId },
      include: { candidate: true, jobOrder: { include: { client: true } } },
    });

    if (!app) {
      return res.status(404).json({ error: 'Job Application not found' });
    }

    const placement = await prisma.placement.create({
      data: {
        id: uuidv4(),
        applicationId,
        candidateId: app.candidateId,
        jobOrderId: app.jobOrderId,
        clientId: app.jobOrder.clientId,
        placedById: req.user!.id,
        selectionDate: new Date(),
        joiningDate: joiningDate ? new Date(joiningDate) : null,
        offeredSalary: offeredSalary ? parseFloat(String(offeredSalary)) : null,
        finalSalary: finalSalary ? parseFloat(String(finalSalary)) : null,
        placementFee: placementFee ? parseFloat(String(placementFee)) : null,
        replacementPeriodEndDate: replacementPeriodEndDate ? new Date(replacementPeriodEndDate) : null,
        status: status || 'SELECTED',
        notes: notes || null,
      },
    });

    // Update application stage to SELECTED or JOINED
    await prisma.candidateJobApplication.update({
      where: { id: applicationId },
      data: { applicationStage: status === 'JOINED' ? 'JOINED' : 'SELECTED' },
    });

    // Also update Candidate master stage
    await prisma.candidate.update({
      where: { id: app.candidateId },
      data: { leadStage: status === 'JOINED' ? 'JOINED' : 'CONFIRMED' },
    });

    await logActivity({
      userId: req.user!.id,
      candidateId: app.candidateId,
      action: status === 'JOINED' ? 'CANDIDATE_JOINED' : 'CANDIDATE_SELECTED',
      details: `${app.candidate.name} marked as ${status} for ${app.jobOrder.jobTitle} at ${app.jobOrder.client.companyName}`,
    });

    return res.status(201).json({ placement });
  } catch (err: any) {
    console.error('Placement error:', err);
    return res.status(500).json({ error: 'Failed to record placement' });
  }
});

export default router;
