import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hasPermission } from '@/server/middleware/auth';
import { prisma } from '@/server/db/prisma';
import { CreateJobSchema } from '@/server/validators/schemas';
import { AuditService } from '@/server/services/AuditService';

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');
  const status = searchParams.get('status');

  const where: any = {};
  if (companyId) where.companyId = companyId;
  if (status) where.jobStatus = status;

    const jobs = await prisma.jobRequirement.findMany({
    where,
    include: {
      company: { select: { id: true, companyName: true, companyCode: true, city: true } },
      createdBy: { select: { id: true, fullName: true } },
      locations: true,
      _count: {
        select: {
          applications: true,
          submissions: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: jobs });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  if (!hasPermission(session, 'job.manage')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = CreateJobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const data = parsed.data;
    const totalJobs = await prisma.jobRequirement.count();
    const jobCode = `JOB-${String(totalJobs + 1).padStart(4, '0')}`;

    // Normalize locations
    let locationRecords: { city: string; state?: string | null; vacancies: number }[] = [];
    if (data.locations && Array.isArray(data.locations) && data.locations.length > 0) {
      locationRecords = data.locations.map((loc) => {
        if (typeof loc === 'string') {
          return { city: loc.trim(), state: null, vacancies: 1 };
        }
        return { city: loc.city.trim(), state: loc.state || null, vacancies: loc.vacancies || 1 };
      });
    }

    const job = await prisma.$transaction(async (tx) => {
      const created = await tx.jobRequirement.create({
        data: {
          jobCode,
          companyId: data.companyId,
          jobTitle: data.jobTitle,
          department: data.department || null,
          jobDescription: data.jobDescription || null,
          vacancies: data.vacancies,
          location: data.location,
          salaryMin: data.salaryMin || null,
          salaryMax: data.salaryMax || null,
          salaryText: data.salaryText || null,
          experienceMin: data.experienceMin,
          experienceMax: data.experienceMax || null,
          educationRequirement: data.educationRequirement || null,
          genderRequirement: data.genderRequirement || null,
          ageRequirement: data.ageRequirement || null,
          skillsRequired: JSON.stringify(data.skillsRequired || []),
          twoWheelerRequired: data.twoWheelerRequired,
          drivingLicenseRequired: data.drivingLicenseRequired,
          noticePeriod: data.noticePeriod || null,
          jobStatus: data.jobStatus as any,
          createdById: session.userId,
          ...(locationRecords.length > 0
            ? {
                locations: {
                  create: locationRecords,
                },
              }
            : {}),
        },
        include: { company: true, locations: true },
      });

      await AuditService.log(
        {
          userId: session.userId,
          action: 'JOB_CREATED',
          entity: 'JobRequirement',
          entityId: created.id,
          newValues: { jobCode, jobTitle: data.jobTitle, companyId: data.companyId, locations: locationRecords },
        },
        tx
      );

      return created;
    });

    return NextResponse.json({ success: true, data: job });
  } catch (err: any) {
    console.error('Create job error:', err);
    return NextResponse.json({ success: false, error: 'Failed to create job requirement' }, { status: 500 });
  }
}
