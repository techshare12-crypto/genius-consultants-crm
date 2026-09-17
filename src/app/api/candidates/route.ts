import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hasPermission } from '@/server/middleware/auth';
import { prisma } from '@/server/db/prisma';
import { CreateCandidateSchema } from '@/server/validators/schemas';
import { normalizeIndianPhone } from '@/server/utils/phone';
import { AuditService } from '@/server/services/AuditService';

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const search = searchParams.get('search')?.trim();
  const location = searchParams.get('location');

  const skip = (page - 1) * limit;
  const where: any = {};

  // Executive Data Isolation: If only executive, filter to candidates on their assigned applications
  if (!hasPermission(session, 'candidate.view_all')) {
    where.applications = {
      some: { assignedExecutiveId: session.userId },
    };
  }

  if (location) where.currentLocation = { contains: location };

  if (search) {
    const normPhone = normalizeIndianPhone(search);
    where.OR = [
      { fullName: { contains: search } },
      { candidateCode: { contains: search } },
      { email: { contains: search } },
      normPhone ? { normalizedPhone: { contains: normPhone } } : undefined,
    ].filter(Boolean);
  }

  const [total, candidates] = await Promise.all([
    prisma.candidate.count({ where }),
    prisma.candidate.findMany({
      where,
      skip,
      take: limit,
      include: {
        applications: {
          include: {
            job: { select: { id: true, jobTitle: true, company: { select: { companyName: true } } } },
            assignedExecutive: { select: { id: true, fullName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: candidates,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = CreateCandidateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const data = parsed.data;
    const normalizedPhone = normalizeIndianPhone(data.phone);

    if (!normalizedPhone) {
      return NextResponse.json({ success: false, error: 'Please provide a valid phone number' }, { status: 400 });
    }

    // Duplicate Check
    const existingCandidate = await prisma.candidate.findFirst({
      where: {
        OR: [
          { normalizedPhone },
          data.email ? { email: data.email.toLowerCase().trim() } : undefined,
        ].filter(Boolean) as any,
      },
      include: {
        applications: {
          include: { job: true, assignedExecutive: true },
        },
      },
    });

    if (existingCandidate && body.allowDuplicate !== true) {
      return NextResponse.json({
        success: false,
        isDuplicate: true,
        message: `Possible duplicate detected: candidate already exists with code ${existingCandidate.candidateCode} (${existingCandidate.fullName})`,
        candidate: existingCandidate,
      }, { status: 409 });
    }

    const totalCandidates = await prisma.candidate.count();
    const candidateCode = `CAN-${String(totalCandidates + 1).padStart(6, '0')}`;

    const candidate = await prisma.candidate.create({
      data: {
        candidateCode,
        fullName: data.fullName,
        rawPhone: data.phone,
        normalizedPhone,
        alternatePhone: data.alternatePhone || null,
        email: data.email ? data.email.toLowerCase().trim() : null,
        gender: data.gender || null,
        age: data.age || null,
        currentLocation: data.currentLocation || null,
        permanentLocation: data.permanentLocation || null,
        education: data.education || null,
        experienceYears: data.experienceYears,
        experienceMonths: data.experienceMonths,
        currentCompany: data.currentCompany || null,
        currentJob: data.currentJob || null,
        currentSalary: data.currentSalary || null,
        expectedSalary: data.expectedSalary || null,
        skills: JSON.stringify(data.skills || []),
        languages: JSON.stringify(data.languages || []),
        hasTwoWheeler: data.hasTwoWheeler,
        hasDrivingLicense: data.hasDrivingLicense,
        source: data.source,
        notes: data.notes || null,
      },
    });

    await AuditService.log({
      userId: session.userId,
      action: 'CANDIDATE_CREATED',
      entity: 'Candidate',
      entityId: candidate.id,
      newValues: { candidateCode, fullName: data.fullName, normalizedPhone },
    });

    return NextResponse.json({ success: true, data: candidate });
  } catch (err: any) {
    console.error('Create candidate error:', err);
    return NextResponse.json({ success: false, error: 'Failed to create candidate' }, { status: 500 });
  }
}
