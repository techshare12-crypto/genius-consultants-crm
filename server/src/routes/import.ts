import { Router, Response } from 'express';
import multer from 'multer';
import * as xlsx from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { authenticate, requireRoles, AuthenticatedRequest } from '../middleware/auth';
import { normalizePhoneNumber } from '../utils/phone';
import { calculateLeadPriorityScore, calculateDataQualityScore } from '../utils/priority';
import { logActivity } from '../services/audit';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB limit

// Helper to generate sequential SL Numbers in bulk
async function generateDisplaySlNos(count: number): Promise<string[]> {
  const currentCount = await prisma.candidate.count();
  const year = new Date().getFullYear();
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const serial = String(currentCount + i + 1).padStart(5, '0');
    result.push(`GC-${year}-${serial}`);
  }
  return result;
}

// POST /api/import/preview - Upload file and get preview with auto-detected column mappings
router.post('/preview', authenticate, requireRoles('ADMIN', 'SUPER_ADMIN'), upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawData = xlsx.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

    if (rawData.length === 0) {
      return res.status(400).json({ error: 'Uploaded file is empty' });
    }

    const detectedColumns = Object.keys(rawData[0]);
    const previewRows = rawData.slice(0, 10);

    // Smart column auto-mapping dictionary
    const fieldMappingSuggestions: Record<string, string> = {};
    for (const col of detectedColumns) {
      const lower = col.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (lower.includes('name') || lower.includes('candidatename') || lower.includes('fullname')) {
        fieldMappingSuggestions[col] = 'name';
      } else if (lower.includes('mobile') || lower.includes('phone') || lower.includes('contact') || lower.includes('cell')) {
        if (!fieldMappingSuggestions[col]) fieldMappingSuggestions[col] = 'primaryPhone';
      } else if (lower.includes('altphone') || lower.includes('secondary') || lower.includes('altcontact')) {
        fieldMappingSuggestions[col] = 'secondaryPhone';
      } else if (lower.includes('whatsapp') || lower.includes('wanumber')) {
        fieldMappingSuggestions[col] = 'whatsappNumber';
      } else if (lower.includes('email') || lower.includes('mail')) {
        fieldMappingSuggestions[col] = 'email';
      } else if (lower.includes('curloc') || lower.includes('city') || lower.includes('location') || lower.includes('address')) {
        fieldMappingSuggestions[col] = 'currentLocation';
      } else if (lower.includes('nativeloc') || lower.includes('hometown')) {
        fieldMappingSuggestions[col] = 'nativeLocation';
      } else if (lower.includes('education') || lower.includes('qualification') || lower.includes('degree')) {
        fieldMappingSuggestions[col] = 'education';
      } else if (lower.includes('exp') || lower.includes('experience') || lower.includes('totalexp')) {
        fieldMappingSuggestions[col] = 'totalExperienceYears';
      } else if (lower.includes('curcomp') || lower.includes('company') || lower.includes('currentcompany') || lower.includes('employer')) {
        fieldMappingSuggestions[col] = 'currentCompany';
      } else if (lower.includes('prevcomp') || lower.includes('previouscompany')) {
        fieldMappingSuggestions[col] = 'previousCompany';
      } else if (lower.includes('designation') || lower.includes('role') || lower.includes('jobtitle') || lower.includes('profile')) {
        fieldMappingSuggestions[col] = 'currentJobTitle';
      } else if (lower.includes('cursal') || lower.includes('currentsalary') || lower.includes('ctc') || lower.includes('currentctc')) {
        fieldMappingSuggestions[col] = 'currentSalary';
      } else if (lower.includes('expsal') || lower.includes('expectedsalary') || lower.includes('expectedctc') || lower.includes('takehome')) {
        fieldMappingSuggestions[col] = 'expectedSalary';
      } else if (lower.includes('apploc') || lower.includes('appliedlocation') || lower.includes('preferredloc')) {
        fieldMappingSuggestions[col] = 'appliedLocation';
      } else if (lower.includes('notice') || lower.includes('noticeperiod') || lower.includes('np')) {
        fieldMappingSuggestions[col] = 'noticePeriod';
      } else if (lower.includes('bike') || lower.includes('wheeler') || lower.includes('twowheeler')) {
        fieldMappingSuggestions[col] = 'hasTwoWheeler';
      } else if (lower.includes('license') || lower.includes('dl') || lower.includes('drivinglicense')) {
        fieldMappingSuggestions[col] = 'hasDrivingLicense';
      } else if (lower.includes('fieldsales') || lower.includes('field') || lower.includes('sales')) {
        fieldMappingSuggestions[col] = 'interestedInFieldSales';
      } else if (lower.includes('auto') || lower.includes('automobile')) {
        fieldMappingSuggestions[col] = 'interestedInAutomobile';
      } else if (lower.includes('remark') || lower.includes('notes') || lower.includes('comment')) {
        fieldMappingSuggestions[col] = 'generalNotes';
      }
    }

    return res.json({
      fileName: req.file.originalname,
      totalRows: rawData.length,
      detectedColumns,
      suggestedMappings: fieldMappingSuggestions,
      previewRows,
      fullData: rawData,
    });
  } catch (err: any) {
    console.error('Import preview error:', err);
    return res.status(500).json({ error: 'Failed to parse uploaded file' });
  }
});

// POST /api/import/execute - Process bulk lead import with duplicate handling
router.post('/execute', authenticate, requireRoles('ADMIN', 'SUPER_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      batchName,
      fileName,
      columnMappings, // { excelColumnName: systemFieldName }
      rows,
      duplicateStrategy = 'SKIP', // 'SKIP' | 'UPDATE' | 'IMPORT_AS_REVIEW'
      assignedExecutiveId,
      leadSource = 'Bulk Excel Import',
    } = req.body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No data rows provided for import' });
    }

    if (!columnMappings) {
      return res.status(400).json({ error: 'Column mappings are required' });
    }

    // Find which column maps to primaryPhone & name
    let phoneCol = '';
    let nameCol = '';
    for (const [excelCol, sysField] of Object.entries(columnMappings)) {
      if (sysField === 'primaryPhone') phoneCol = excelCol;
      if (sysField === 'name') nameCol = excelCol;
    }

    if (!phoneCol || !nameCol) {
      return res.status(400).json({ error: 'Mapping for "Candidate Name" and "Primary Phone Number" is mandatory' });
    }

    // Create Import Batch record
    const batch = await prisma.importBatch.create({
      data: {
        batchName: batchName || `Import_${new Date().toISOString().slice(0, 10)}_${Math.floor(Math.random() * 1000)}`,
        fileName: fileName || 'leads_import.xlsx',
        importedById: req.user!.id,
        totalRows: rows.length,
      },
    });

    let validCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;

    const validNewCandidates: any[] = [];
    const candidatesToUpdate: any[] = [];
    const seenPhonesInBatch = new Set<string>();

    // Fetch existing phone numbers from DB to check duplicates
    const allExistingCandidates = await prisma.candidate.findMany({
      where: { isDeleted: false },
      select: { id: true, primaryPhone: true, name: true },
    });
    const existingPhoneMap = new Map(allExistingCandidates.map(c => [c.primaryPhone, c]));

    for (const row of rows) {
      const rawName = String(row[nameCol] || '').trim();
      const rawPhone = String(row[phoneCol] || '').trim();
      const normalizedPhone = normalizePhoneNumber(rawPhone);

      if (!rawName || !normalizedPhone || normalizedPhone.length < 10) {
        invalidCount++;
        continue;
      }

      // Check if duplicate in DB or duplicate within same import batch
      const isDuplicate = existingPhoneMap.has(normalizedPhone) || seenPhonesInBatch.has(normalizedPhone);

      if (isDuplicate) {
        duplicateCount++;
        if (duplicateStrategy === 'SKIP') {
          continue;
        } else if (duplicateStrategy === 'UPDATE' && existingPhoneMap.has(normalizedPhone)) {
          const existing = existingPhoneMap.get(normalizedPhone)!;
          candidatesToUpdate.push({
            id: existing.id,
            data: mapRowToCandidateData(row, columnMappings, normalizedPhone, rawName),
          });
          continue;
        }
        // If IMPORT_AS_REVIEW, we let it create with a flag in notes
      }

      seenPhonesInBatch.add(normalizedPhone);

      const candidateData = mapRowToCandidateData(row, columnMappings, normalizedPhone, rawName);
      candidateData.importBatchId = batch.id;
      candidateData.leadOwnerId = req.user!.id;
      candidateData.leadSource = leadSource;
      candidateData.assignedExecutiveId = assignedExecutiveId || null;
      candidateData.leadStage = assignedExecutiveId ? 'ASSIGNED' : 'NEW';

      validNewCandidates.push(candidateData);
      validCount++;
    }

    // Generate serial numbers for new candidates
    const displaySlNos = await generateDisplaySlNos(validNewCandidates.length);
    for (let i = 0; i < validNewCandidates.length; i++) {
      validNewCandidates[i].id = uuidv4();
      validNewCandidates[i].displaySlNo = displaySlNos[i];
    }

    // Insert new candidates in transaction / chunk batches
    if (validNewCandidates.length > 0) {
      // Chunk insertions for database performance
      const chunkSize = 100;
      for (let i = 0; i < validNewCandidates.length; i += chunkSize) {
        const chunk = validNewCandidates.slice(i, i + chunkSize);
        await prisma.candidate.createMany({
          data: chunk,
        });
      }
    }

    // Update existing candidates if strategy was UPDATE
    if (candidatesToUpdate.length > 0) {
      for (const item of candidatesToUpdate) {
        await prisma.candidate.update({
          where: { id: item.id },
          data: item.data,
        });
      }
    }

    // Update batch stats
    const updatedBatch = await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        validCount,
        duplicateCount,
        invalidCount,
      },
    });

    await logActivity({
      userId: req.user!.id,
      action: 'LEADS_IMPORTED',
      details: `Imported batch "${batch.batchName}": ${validCount} valid, ${duplicateCount} duplicates, ${invalidCount} invalid`,
    });

    return res.status(201).json({
      success: true,
      batch: updatedBatch,
      summary: {
        totalRows: rows.length,
        importedCount: validCount,
        duplicateCount,
        invalidCount,
        updatedCount: candidatesToUpdate.length,
      },
    });
  } catch (err: any) {
    console.error('Import execute error:', err);
    return res.status(500).json({ error: 'Failed to complete lead import' });
  }
});

// GET /api/import/batches - List past import batches
router.get('/batches', authenticate, requireRoles('ADMIN', 'SUPER_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const batches = await prisma.importBatch.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        importedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      take: 50,
    });

    return res.json({ batches });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch import batches' });
  }
});

function parseBool(val: any): boolean {
  if (typeof val === 'boolean') return val;
  const str = String(val).toLowerCase().trim();
  return str === 'yes' || str === 'true' || str === '1' || str === 'y' || str === 'available';
}

function mapRowToCandidateData(row: Record<string, any>, mappings: Record<string, string>, normPhone: string, name: string): any {
  const data: any = {
    name,
    primaryPhone: normPhone,
  };

  for (const [excelCol, sysField] of Object.entries(mappings)) {
    const val = row[excelCol];
    if (val === undefined || val === null || val === '') continue;

    switch (sysField) {
      case 'secondaryPhone':
        data.secondaryPhone = normalizePhoneNumber(String(val));
        break;
      case 'whatsappNumber':
        data.whatsappNumber = normalizePhoneNumber(String(val));
        break;
      case 'email':
        data.email = String(val).toLowerCase().trim();
        break;
      case 'age':
        data.age = parseInt(String(val), 10) || null;
        break;
      case 'gender':
        data.gender = String(val).trim();
        break;
      case 'currentLocation':
        data.currentLocation = String(val).trim();
        break;
      case 'nativeLocation':
        data.nativeLocation = String(val).trim();
        break;
      case 'education':
        data.education = String(val).trim();
        break;
      case 'totalExperienceYears':
        data.totalExperienceYears = parseFloat(String(val)) || 0;
        break;
      case 'currentJobTitle':
        data.currentJobTitle = String(val).trim();
        break;
      case 'currentCompany':
        data.currentCompany = String(val).trim();
        break;
      case 'previousCompany':
        data.previousCompany = String(val).trim();
        break;
      case 'skills':
        data.skills = String(val).trim();
        break;
      case 'languages':
        data.languages = String(val).trim();
        break;
      case 'currentSalary':
        data.currentSalary = String(val).trim();
        break;
      case 'expectedSalary':
        data.expectedSalary = String(val).trim();
        break;
      case 'appliedLocation':
        data.appliedLocation = String(val).trim();
        break;
      case 'noticePeriod':
        data.noticePeriod = String(val).trim();
        break;
      case 'hasTwoWheeler':
        data.hasTwoWheeler = parseBool(val);
        break;
      case 'hasDrivingLicense':
        data.hasDrivingLicense = parseBool(val);
        break;
      case 'interestedInFieldSales':
        data.interestedInFieldSales = parseBool(val);
        break;
      case 'interestedInAutomobile':
        data.interestedInAutomobile = parseBool(val);
        break;
      case 'generalNotes':
        data.generalNotes = String(val).trim();
        break;
    }
  }

  data.dataQualityScore = calculateDataQualityScore({
    name,
    primaryPhone: normPhone,
    email: data.email,
    currentLocation: data.currentLocation,
    education: data.education,
    totalExperienceYears: data.totalExperienceYears,
    currentSalary: data.currentSalary,
    expectedSalary: data.expectedSalary,
    noticePeriod: data.noticePeriod,
  });

  data.leadPriorityScore = calculateLeadPriorityScore({
    createdAt: new Date(),
    leadStage: 'NEW',
    hasTwoWheeler: data.hasTwoWheeler,
    hasDrivingLicense: data.hasDrivingLicense,
    interestedInFieldSales: data.interestedInFieldSales,
    totalExperienceYears: data.totalExperienceYears,
    email: data.email,
    currentLocation: data.currentLocation,
    education: data.education,
    expectedSalary: data.expectedSalary,
  });

  return data;
}

export default router;
