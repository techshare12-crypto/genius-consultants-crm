import { Router, Response } from 'express';
import * as xlsx from 'xlsx';
import prisma from '../prisma/client';
import { authenticate, requireRoles, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/reports/export - Export dataset as Excel or CSV
router.get('/export', authenticate, requireRoles('ADMIN', 'SUPER_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      type = 'CANDIDATES', // 'CANDIDATES' | 'DAILY_CALLING' | 'SHORTLISTED' | 'EXECUTIVE_PERFORMANCE' | 'CALLBACKS'
      format = 'xlsx',     // 'xlsx' | 'csv'
      startDate,
      endDate,
      executiveId,
    } = req.query;

    let data: any[] = [];
    let fileName = `report_${type.toString().toLowerCase()}_${new Date().toISOString().slice(0, 10)}`;

    if (type === 'CANDIDATES') {
      const where: any = { isDeleted: false };
      if (executiveId && executiveId !== 'ALL') where.assignedExecutiveId = executiveId as string;

      const candidates = await prisma.candidate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          assignedExecutive: { select: { name: true } },
          shortlistRecord: true,
        },
      });

      data = candidates.map(c => ({
        'Serial No': c.displaySlNo,
        'Candidate ID': c.id,
        'Name': c.name,
        'Phone': c.primaryPhone,
        'WhatsApp': c.whatsappNumber || '',
        'Email': c.email || '',
        'Location': c.currentLocation || '',
        'Education': c.education || '',
        'Total Experience (Yrs)': c.totalExperienceYears,
        'Current Company': c.currentCompany || '',
        'Current Salary': c.currentSalary || '',
        'Expected Salary': c.expectedSalary || '',
        'Stage': c.leadStage,
        'Assigned Executive': c.assignedExecutive?.name || 'Unassigned',
        'Has Two Wheeler': c.hasTwoWheeler ? 'Yes' : 'No',
        'Has License': c.hasDrivingLicense ? 'Yes' : 'No',
        'Interested in Field Sales': c.interestedInFieldSales ? 'Yes' : 'No',
        'Shortlisted': c.shortlistRecord ? 'Yes' : 'No',
        'Date Added': c.createdAt.toISOString().slice(0, 10),
      }));
    } else if (type === 'SHORTLISTED') {
      const shortlisted = await prisma.shortlistRecord.findMany({
        include: {
          candidate: {
            include: {
              assignedExecutive: { select: { name: true } },
            },
          },
          shortlistedBy: { select: { name: true } },
        },
        orderBy: { shortlistedAt: 'desc' },
      });

      data = shortlisted.map(s => ({
        'Serial No': s.candidate.displaySlNo,
        'Candidate Name': s.candidate.name,
        'Contact Number': s.candidate.primaryPhone,
        'Location': s.candidate.currentLocation || '',
        'Executive': s.candidate.assignedExecutive?.name || '',
        'Shortlist Date': s.shortlistedAt.toISOString().slice(0, 10),
        'Shortlist Status': s.shortlistStatus,
        'Form Filled': s.formFilled,
        'CV on WhatsApp': s.cvReceivedWhatsapp,
        'Client Name': s.clientName || '',
        'Job Role': s.jobRole || '',
        'Remarks': s.remarks || '',
      }));
    } else if (type === 'DAILY_CALLING') {
      const where: any = {};
      if (startDate && endDate) where.date = { gte: startDate as string, lte: endDate as string };
      if (executiveId && executiveId !== 'ALL') where.executiveId = executiveId as string;

      const summaries = await prisma.dailyCallingSummary.findMany({
        where,
        orderBy: [{ date: 'desc' }],
        include: {
          executive: { select: { name: true } },
        },
      });

      data = summaries.map(s => ({
        'Date': s.date,
        'Executive': s.executive.name,
        'Leads Assigned': s.assignedLeadsCount,
        'Unique Called': s.uniqueCalledCount,
        'Total Attempts': s.totalAttemptsCount,
        'Confirmed': s.confirmedCount,
        'Shortlisted': s.shortlistedCount,
        'Not Interested': s.notInterestedCount,
        'RNR': s.rnrCount,
        'Busy / Callback': s.busyCallbackCount,
        'Wrong Number': s.wrongNumberCount,
        'Pending Calls': s.pendingCount,
        'Conversion %': s.conversionRate,
      }));
    }

    // Generate Excel / CSV buffer
    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Report');

    if (format === 'csv') {
      const csvOutput = xlsx.utils.sheet_to_csv(worksheet);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}.csv"`);
      return res.send(csvOutput);
    }

    const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.xlsx"`);
    return res.send(excelBuffer);
  } catch (err: any) {
    console.error('Report export error:', err);
    return res.status(500).json({ error: 'Failed to generate report export' });
  }
});

export default router;
