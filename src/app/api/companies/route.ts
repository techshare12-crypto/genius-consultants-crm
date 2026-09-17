import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hasPermission } from '@/server/middleware/auth';
import { prisma } from '@/server/db/prisma';
import { CreateCompanySchema } from '@/server/validators/schemas';
import { AuditService } from '@/server/services/AuditService';

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  if (!hasPermission(session, 'company.view') && !hasPermission(session, 'company.manage')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  const where: any = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { companyName: { contains: search } },
      { city: { contains: search } },
      { companyCode: { contains: search } },
    ];
  }

  const companies = await prisma.company.findMany({
    where,
    include: {
      contacts: true,
      jobRequirements: {
        select: {
          id: true,
          jobCode: true,
          jobTitle: true,
          vacancies: true,
          location: true,
          jobStatus: true,
          _count: { select: { applications: true } },
        },
      },
      createdBy: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: companies });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  if (!hasPermission(session, 'company.manage')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = CreateCompanySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const { companyName, industry, companyType, address, city, state, pincode, website, status, source, notes, primaryContact } = parsed.data;

    const totalCompanies = await prisma.company.count();
    const companyCode = `COMP-${String(totalCompanies + 1).padStart(4, '0')}`;

    const company = await prisma.$transaction(async (tx) => {
      const created = await tx.company.create({
        data: {
          companyCode,
          companyName,
          industry,
          companyType,
          address,
          city,
          state,
          pincode,
          website: website || null,
          status: status as any,
          source,
          notes,
          createdById: session.userId,
          contacts: primaryContact
            ? {
                create: {
                  contactName: primaryContact.contactName,
                  designation: primaryContact.designation || null,
                  phone: primaryContact.phone,
                  email: primaryContact.email || null,
                  isPrimary: true,
                },
              }
            : undefined,
        },
        include: { contacts: true },
      });

      await AuditService.log(
        {
          userId: session.userId,
          action: 'COMPANY_CREATED',
          entity: 'Company',
          entityId: created.id,
          newValues: { companyCode, companyName, status },
        },
        tx
      );

      return created;
    });

    return NextResponse.json({ success: true, data: company });
  } catch (err: any) {
    console.error('Create company error:', err);
    return NextResponse.json({ success: false, error: 'Failed to create company' }, { status: 500 });
  }
}
