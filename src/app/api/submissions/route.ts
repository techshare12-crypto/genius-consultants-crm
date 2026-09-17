import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hasPermission } from '@/server/middleware/auth';
import { CreateClientSubmissionSchema } from '@/server/validators/schemas';
import { SubmissionService } from '@/server/services/SubmissionService';

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId') || undefined;
  const jobId = searchParams.get('jobId') || undefined;

  const submissions = await SubmissionService.listSubmissions(companyId, jobId);
  return NextResponse.json({ success: true, data: submissions });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  if (!hasPermission(session, 'submission.manage')) {
    return NextResponse.json({ success: false, error: 'Forbidden: You do not have permission to create client submissions.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = CreateClientSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const { companyId, jobId, applicationIds, submissionMethod, remarks } = parsed.data;

    const submission = await SubmissionService.createSubmission({
      companyId,
      jobId,
      applicationIds,
      submittedById: session.userId,
      submissionMethod,
      remarks,
    });

    return NextResponse.json({ success: true, data: submission });
  } catch (err: any) {
    console.error('Client submission error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to create client submission' }, { status: 500 });
  }
}
