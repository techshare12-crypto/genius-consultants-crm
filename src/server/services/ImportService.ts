import * as XLSX from 'xlsx';
import { prisma } from '@/server/db/prisma';
import { normalizeIndianPhone } from '@/server/utils/phone';
import { AuditService } from '@/server/services/AuditService';

export interface DuplicateCandidateMatch {
  row: number;
  candidateName: string;
  phone: string;
  email?: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  duplicateType:
    | 'DUPLICATE_HIGH_PHONE'
    | 'DUPLICATE_HIGH_EMAIL'
    | 'DUPLICATE_MEDIUM_PHONE_NAME'
    | 'DUPLICATE_MEDIUM_EMAIL_NAME'
    | 'DUPLICATE_LOW_NAME_LOCATION'
    | 'DUPLICATE_LOW_NAME_EDUCATION';
  matchReason: string;
}

export interface ParseResult {
  filename: string;
  detectedSheets: string[];
  totalRows: number;
  previewRows: Array<Record<string, any>>;
  highConfidenceDuplicates: DuplicateCandidateMatch[];
  mediumConfidenceDuplicates: DuplicateCandidateMatch[];
  lowConfidenceDuplicates: DuplicateCandidateMatch[];
  summary: {
    newCandidates: number;
    existingCandidates: number;
    potentialDuplicates: number;
    applicationsToCreate: number;
    shortlistedToEnrich: number;
  };
}

export class ImportService {
  /**
   * Parses an Excel buffer, detects known operational sheets,
   * performs full 6-tier reconciliation analysis, and returns a preview without committing.
   */
  static parseWorkbookBuffer(buffer: Buffer, filename: string): ParseResult {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const detectedSheets = workbook.SheetNames;

    let candidateMasterData: any[] = [];
    let dashboardData: any[] = [];
    let shortlistedData: any[] = [];

    // 1. Detect CANDIDATE MASTER
    const cmSheetName = detectedSheets.find((s) => /candidate\s*master/i.test(s)) || detectedSheets[0];
    if (cmSheetName && workbook.Sheets[cmSheetName]) {
      candidateMasterData = XLSX.utils.sheet_to_json(workbook.Sheets[cmSheetName], { defval: '' });
    }

    // 2. Detect DASHBOARD sheet
    const dashSheetName = detectedSheets.find((s) => /dashboard/i.test(s));
    if (dashSheetName && workbook.Sheets[dashSheetName]) {
      dashboardData = XLSX.utils.sheet_to_json(workbook.Sheets[dashSheetName], { defval: '' });
    }

    // 3. Detect SHORTLISTED CANDIDATES
    const slSheetName = detectedSheets.find((s) => /shortlist/i.test(s));
    if (slSheetName && workbook.Sheets[slSheetName]) {
      shortlistedData = XLSX.utils.sheet_to_json(workbook.Sheets[slSheetName], { defval: '' });
    }

    // Duplicate detection tracking maps
    const seenPhones = new Map<string, number>();
    const seenEmails = new Map<string, number>();
    const seenPhoneNames = new Map<string, number>();
    const seenEmailNames = new Map<string, number>();
    const seenNameLocations = new Map<string, number>();
    const seenNameEducations = new Map<string, number>();

    const highConfidenceDuplicates: DuplicateCandidateMatch[] = [];
    const mediumConfidenceDuplicates: DuplicateCandidateMatch[] = [];
    const lowConfidenceDuplicates: DuplicateCandidateMatch[] = [];

    candidateMasterData.forEach((row, idx) => {
      const rowNum = idx + 2; // 1-indexed plus header row
      const rawName = String(row['Candidate Name'] || row['Name'] || '').trim();
      const normName = rawName.toLowerCase();
      const rawPhone = row['Phone Number'] || row['Contact number'] || row['Phone'] || '';
      const normPhone = normalizeIndianPhone(rawPhone);
      const rawEmail = String(row['Email'] || row['Email Address'] || row['Mail'] || '').trim().toLowerCase();
      const normEmail = rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : '';
      const rawLocation = String(row['Location'] || row['Current location'] || '').trim().toLowerCase();
      const rawEducation = String(row['Education'] || '').trim().toLowerCase();

      // --- TIER 1: HIGH CONFIDENCE ---
      // A. Exact normalized phone
      if (normPhone) {
        if (seenPhones.has(normPhone)) {
          const prevRow = seenPhones.get(normPhone)!;
          highConfidenceDuplicates.push({
            row: rowNum,
            candidateName: rawName,
            phone: normPhone,
            email: normEmail || undefined,
            confidence: 'HIGH',
            duplicateType: 'DUPLICATE_HIGH_PHONE',
            matchReason: `Exact duplicate phone number ${normPhone} matches row ${prevRow}`,
          });
        } else {
          seenPhones.set(normPhone, rowNum);
        }
      }

      // B. Exact normalized email
      if (normEmail) {
        if (seenEmails.has(normEmail)) {
          const prevRow = seenEmails.get(normEmail)!;
          highConfidenceDuplicates.push({
            row: rowNum,
            candidateName: rawName,
            phone: normPhone || 'N/A',
            email: normEmail,
            confidence: 'HIGH',
            duplicateType: 'DUPLICATE_HIGH_EMAIL',
            matchReason: `Exact duplicate email ${normEmail} matches row ${prevRow}`,
          });
        } else {
          seenEmails.set(normEmail, rowNum);
        }
      }

      // --- TIER 2: MEDIUM CONFIDENCE ---
      // C. Phone + normalized name
      if (normPhone && normName) {
        const phoneNameKey = `${normPhone}::${normName}`;
        if (seenPhoneNames.has(phoneNameKey)) {
          const prevRow = seenPhoneNames.get(phoneNameKey)!;
          mediumConfidenceDuplicates.push({
            row: rowNum,
            candidateName: rawName,
            phone: normPhone,
            confidence: 'MEDIUM',
            duplicateType: 'DUPLICATE_MEDIUM_PHONE_NAME',
            matchReason: `Matching phone ${normPhone} and normalized name "${normName}" matches row ${prevRow}`,
          });
        } else {
          seenPhoneNames.set(phoneNameKey, rowNum);
        }
      }

      // D. Email + normalized name
      if (normEmail && normName) {
        const emailNameKey = `${normEmail}::${normName}`;
        if (seenEmailNames.has(emailNameKey)) {
          const prevRow = seenEmailNames.get(emailNameKey)!;
          mediumConfidenceDuplicates.push({
            row: rowNum,
            candidateName: rawName,
            phone: normPhone || 'N/A',
            email: normEmail,
            confidence: 'MEDIUM',
            duplicateType: 'DUPLICATE_MEDIUM_EMAIL_NAME',
            matchReason: `Matching email ${normEmail} and normalized name "${normName}" matches row ${prevRow}`,
          });
        } else {
          seenEmailNames.set(emailNameKey, rowNum);
        }
      }

      // --- TIER 3: LOW CONFIDENCE ---
      // E. Name + location
      if (normName && rawLocation) {
        const nameLocKey = `${normName}::${rawLocation}`;
        if (seenNameLocations.has(nameLocKey)) {
          const prevRow = seenNameLocations.get(nameLocKey)!;
          lowConfidenceDuplicates.push({
            row: rowNum,
            candidateName: rawName,
            phone: normPhone || 'N/A',
            confidence: 'LOW',
            duplicateType: 'DUPLICATE_LOW_NAME_LOCATION',
            matchReason: `Similar name "${rawName}" and location "${row['Location'] || row['Current location']}" matches row ${prevRow}`,
          });
        } else {
          seenNameLocations.set(nameLocKey, rowNum);
        }
      }

      // F. Name + education
      if (normName && rawEducation) {
        const nameEduKey = `${normName}::${rawEducation}`;
        if (seenNameEducations.has(nameEduKey)) {
          const prevRow = seenNameEducations.get(nameEduKey)!;
          lowConfidenceDuplicates.push({
            row: rowNum,
            candidateName: rawName,
            phone: normPhone || 'N/A',
            confidence: 'LOW',
            duplicateType: 'DUPLICATE_LOW_NAME_EDUCATION',
            matchReason: `Similar name "${rawName}" and qualification "${row['Education']}" matches row ${prevRow}`,
          });
        } else {
          seenNameEducations.set(nameEduKey, rowNum);
        }
      }
    });

    // Prepare preview records
    const previewRows = candidateMasterData.slice(0, 10).map((row) => {
      const rawPhone = row['Phone Number'] || row['Contact number'] || row['Phone'] || '';
      const normPhone = normalizeIndianPhone(rawPhone);
      const candLocation = String(row['Location'] || row['Current location'] || row['City'] || '').trim();
      const appliedLocation = String(
        row['Applied Location'] ||
        row['Applied location'] ||
        row['Target Location'] ||
        row['Job Location'] ||
        row['Work Location'] ||
        ''
      ).trim();

      return {
        name: row['Candidate Name'] || row['Name'] || '',
        rawPhone: String(rawPhone),
        normalizedPhone: normPhone || 'INVALID',
        location: candLocation,
        appliedLocation: appliedLocation || candLocation,
        experience: row['Experience'] || row['Years of experience'] || '',
        education: row['Education'] || '',
        currentJob: row['Current/Latest Job'] || row['Previous/current company'] || '',
        assets: row['Assets'] || '',
      };
    });

    return {
      filename,
      detectedSheets,
      totalRows: candidateMasterData.length,
      previewRows,
      highConfidenceDuplicates,
      mediumConfidenceDuplicates,
      lowConfidenceDuplicates,
      summary: {
        newCandidates: candidateMasterData.length - highConfidenceDuplicates.length,
        existingCandidates: 0,
        potentialDuplicates: highConfidenceDuplicates.length + mediumConfidenceDuplicates.length + lowConfidenceDuplicates.length,
        applicationsToCreate: candidateMasterData.length,
        shortlistedToEnrich: shortlistedData.length,
      },
    };
  }

  /**
   * Commits the reconciled workbook into the database under an ImportBatch.
   */
  static async commitWorkbook(
    buffer: Buffer,
    filename: string,
    uploadedById: string,
    targetJobId: string,
    targetCompanyId: string,
    defaultTargetLocation?: string
  ) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const detectedSheets = workbook.SheetNames;

    const cmSheetName = detectedSheets.find((s) => /candidate\s*master/i.test(s)) || detectedSheets[0];
    const candidateMasterData: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[cmSheetName], { defval: '' });

    const dashSheetName = detectedSheets.find((s) => /dashboard/i.test(s));
    const dashboardData: any[] = dashSheetName ? XLSX.utils.sheet_to_json(workbook.Sheets[dashSheetName], { defval: '' }) : [];

    const slSheetName = detectedSheets.find((s) => /shortlist/i.test(s));
    const shortlistedData: any[] = slSheetName ? XLSX.utils.sheet_to_json(workbook.Sheets[slSheetName], { defval: '' }) : [];

    // Create Index Map of Shortlisted Phones
    const shortlistedPhoneMap = new Set<string>();
    for (const row of shortlistedData) {
      const phone = normalizeIndianPhone(row['Contact number'] || row['Phone Number'] || row['Phone']);
      if (phone) shortlistedPhoneMap.add(phone);
    }

    // Create Index Map of Dashboard rows
    const dashboardPhoneMap = new Map<string, any>();
    for (const row of dashboardData) {
      const phone = normalizeIndianPhone(row['Contact number'] || row['Phone Number'] || row['Phone']);
      if (phone) dashboardPhoneMap.set(phone, row);
    }

    // 1. Validate Target Job Requirement and resolve effective company
    const targetJob = await prisma.jobRequirement.findUnique({
      where: { id: targetJobId },
      include: { company: true, locations: true },
    });
    if (!targetJob) {
      throw new Error(`Target Job Requirement with ID '${targetJobId}' was not found.`);
    }
    const effectiveCompanyId = targetJob.companyId || targetCompanyId;

    // Build valid job locations list
    const validJobLocations: string[] = [];
    if (targetJob.locations && targetJob.locations.length > 0) {
      targetJob.locations.forEach((l) => {
        if (l.city) validJobLocations.push(l.city.trim());
      });
    }
    if (targetJob.location) {
      targetJob.location.split(',').forEach((l) => {
        const trimmed = l.trim();
        if (trimmed && !validJobLocations.includes(trimmed)) {
          validJobLocations.push(trimmed);
        }
      });
    }

    // 2. Create ImportBatch with guaranteed collision-free batchCode
    let batchCount = await prisma.importBatch.count();
    let batchNum = batchCount + 1;
    let batchCode = `BATCH-${String(batchNum).padStart(5, '0')}`;
    while (await prisma.importBatch.findUnique({ where: { batchCode } })) {
      batchNum++;
      batchCode = `BATCH-${String(batchNum).padStart(5, '0')}`;
    }

    const batch = await prisma.importBatch.create({
      data: {
        batchCode,
        filename,
        uploadedById,
        totalRows: candidateMasterData.length,
        status: 'PENDING',
      },
    });

    let importedCount = 0;
    let duplicateCount = 0;
    let skippedCount = 0;

    // Process rows
    for (const row of candidateMasterData) {
      const rawName = String(
        row['Candidate Name'] ||
        row['Name'] ||
        row['Full Name'] ||
        row['Candidate'] ||
        row['Applicant Name'] ||
        ''
      ).trim();

      const rawPhone =
        row['Phone Number'] ||
        row['Contact number'] ||
        row['Phone'] ||
        row['Mobile'] ||
        row['Contact'] ||
        row['Mobile Number'] ||
        '';
      const normPhone = normalizeIndianPhone(rawPhone);

      if (!rawName || !normPhone) {
        skippedCount++;
        continue;
      }

      const dashRow = dashboardPhoneMap.get(normPhone) || {};
      const isShortlisted = shortlistedPhoneMap.has(normPhone);

      const candLocation = String(
        row['Location'] ||
        row['Current location'] ||
        row['City'] ||
        dashRow['Location'] ||
        dashRow['Current location'] ||
        ''
      ).trim();

      const rawAppliedLocation = String(
        row['Applied Location'] ||
        row['Applied location'] ||
        row['Target Location'] ||
        row['Job Location'] ||
        row['Work Location'] ||
        dashRow['Applied location'] ||
        dashRow['Applied Location'] ||
        defaultTargetLocation ||
        ''
      ).trim();

      // Normalize target location against valid job locations
      let targetLocation = rawAppliedLocation;
      if (!targetLocation && validJobLocations.length === 1) {
        targetLocation = validJobLocations[0];
      } else if (targetLocation && validJobLocations.length > 0) {
        const matched = validJobLocations.find((v) => v.toLowerCase() === targetLocation.toLowerCase());
        if (matched) targetLocation = matched;
      } else if (!targetLocation && targetJob.location) {
        targetLocation = targetJob.location;
      }

      const education = String(
        row['Education'] ||
        row['Qualification'] ||
        dashRow['Education'] ||
        dashRow['Qualification'] ||
        ''
      ).trim();

      const rawExp = String(
        row['Experience'] ||
        row['Years of experience'] ||
        row['Exp'] ||
        dashRow['Experience'] ||
        dashRow['Years of experience'] ||
        ''
      );
      const expYears = parseInt(rawExp.replace(/\D/g, '')) || 0;

      const currentJob = String(
        row['Current/Latest Job'] ||
        row['Previous/current company'] ||
        row['Current Company'] ||
        dashRow['Current/Latest Job'] ||
        dashRow['Previous/current company'] ||
        ''
      ).trim();

      const assets = String(row['Assets'] || dashRow['Assets'] || '');
      const hasBike =
        /bike|two\s*wheeler/i.test(assets) ||
        dashRow['Have 2wheeler with license'] === 1 ||
        dashRow['Have 2wheeler with license'] === '1' ||
        String(dashRow['Have 2wheeler with license']).toLowerCase() === 'yes';

      const hasLicense =
        /license|dl/i.test(assets) ||
        dashRow['Have 2wheeler with license'] === 1 ||
        dashRow['Have 2wheeler with license'] === '1' ||
        String(dashRow['Have 2wheeler with license']).toLowerCase() === 'yes';

      // Extract skills
      const rawSkills = String(row['Skills / Notes'] || row['Skills'] || row['Key Skills'] || '');
      const skillsArray = rawSkills
        ? rawSkills.split(',').map((s) => s.trim()).filter(Boolean)
        : ['Sales', 'Communication'];

      // Extract languages
      const rawLanguages = String(row['Languages'] || row['Language'] || row['Languages Known'] || '');
      const languagesArray = rawLanguages
        ? rawLanguages.split(',').map((l) => l.trim()).filter(Boolean)
        : ['Hindi', 'Gujarati'];

      const rawEmail = String(
        row['Email'] ||
        row['Email Address'] ||
        row['Mail'] ||
        row['Email ID'] ||
        dashRow['Email'] ||
        ''
      ).trim().toLowerCase();
      const normEmail = rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : null;

      // Check existing candidate by normalized phone OR exact email (HIGH confidence match)
      let candidate = await prisma.candidate.findFirst({
        where: {
          OR: [
            { normalizedPhone: normPhone },
            ...(normEmail ? [{ email: normEmail }] : []),
          ],
        },
      });

      if (!candidate) {
        let candCount = await prisma.candidate.count();
        let candNum = candCount + 1;
        let candidateCode = `CAN-${String(candNum).padStart(6, '0')}`;
        while (await prisma.candidate.findUnique({ where: { candidateCode } })) {
          candNum++;
          candidateCode = `CAN-${String(candNum).padStart(6, '0')}`;
        }

        candidate = await prisma.candidate.create({
          data: {
            candidateCode,
            fullName: rawName,
            rawPhone: String(rawPhone),
            normalizedPhone: normPhone,
            email: normEmail,
            currentLocation: candLocation,
            education,
            experienceYears: expYears,
            currentJob,
            hasTwoWheeler: hasBike,
            hasDrivingLicense: hasLicense,
            skills: JSON.stringify(skillsArray),
            languages: JSON.stringify(languagesArray),
            source: 'EXCEL_IMPORT',
            sourceReference: filename,
            importBatchId: batch.id,
          },
        });
      } else {
        duplicateCount++;
        // Enrich existing candidate if details were missing
        const updateData: any = {};
        if (!candidate.email && normEmail) updateData.email = normEmail;
        if (!candidate.currentLocation && candLocation) updateData.currentLocation = candLocation;
        if (!candidate.education && education) updateData.education = education;
        if (!candidate.currentJob && currentJob) updateData.currentJob = currentJob;
        if (candidate.experienceYears === 0 && expYears > 0) updateData.experienceYears = expYears;
        if (!candidate.hasTwoWheeler && hasBike) updateData.hasTwoWheeler = true;
        if (!candidate.hasDrivingLicense && hasLicense) updateData.hasDrivingLicense = true;

        if (Object.keys(updateData).length > 0) {
          candidate = await prisma.candidate.update({
            where: { id: candidate.id },
            data: updateData,
          });
        }
      }

      // Check existing application for this candidate & job
      const existingApp = await prisma.application.findFirst({
        where: { candidateId: candidate.id, jobId: targetJobId },
      });

      if (!existingApp) {
        let appCount = await prisma.application.count();
        let appNum = appCount + 1;
        let appCode = `APP-${String(appNum).padStart(6, '0')}`;
        while (await prisma.application.findUnique({ where: { applicationCode: appCode } })) {
          appNum++;
          appCode = `APP-${String(appNum).padStart(6, '0')}`;
        }

        const initialStage = isShortlisted ? 'SHORTLISTED' : 'NEW';
        const formStatus = isShortlisted ? 'RECEIVED' : 'PENDING';
        const cvStatus = isShortlisted ? 'CV_RECEIVED' : 'CV_REQUIRED';

        await prisma.application.create({
          data: {
            applicationCode: appCode,
            candidateId: candidate.id,
            jobId: targetJobId,
            companyId: effectiveCompanyId,
            targetLocation: targetLocation || null,
            currentStage: initialStage,
            formStatus,
            cvStatus,
            formReceivedAt: isShortlisted ? new Date() : null,
            cvReceivedAt: isShortlisted ? new Date() : null,
            readyForScreeningAt: isShortlisted ? new Date() : null,
            createdById: uploadedById,
          },
        });
      } else {
        const updateAppData: any = {};
        if (isShortlisted && existingApp.currentStage === 'NEW') {
          updateAppData.currentStage = 'SHORTLISTED';
          updateAppData.formStatus = 'RECEIVED';
          updateAppData.cvStatus = 'CV_RECEIVED';
          updateAppData.formReceivedAt = existingApp.formReceivedAt || new Date();
          updateAppData.cvReceivedAt = existingApp.cvReceivedAt || new Date();
          updateAppData.readyForScreeningAt = existingApp.readyForScreeningAt || new Date();
        }
        if (!existingApp.targetLocation && targetLocation) {
          updateAppData.targetLocation = targetLocation;
        }

        if (Object.keys(updateAppData).length > 0) {
          await prisma.application.update({
            where: { id: existingApp.id },
            data: updateAppData,
          });
        }
      }

      importedCount++;
    }

    // Update batch status to COMMITTED
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: 'COMMITTED',
        importedRows: importedCount,
        duplicateRows: duplicateCount,
        skippedRows: skippedCount,
      },
    });

    await AuditService.log({
      userId: uploadedById,
      action: 'IMPORT_COMMITTED',
      entity: 'ImportBatch',
      entityId: batch.id,
      newValues: {
        filename,
        importedCount,
        duplicateCount,
        skippedCount,
      },
    });

    return {
      batchId: batch.id,
      batchCode: batch.batchCode,
      importedCount,
      duplicateCount,
      skippedCount,
    };
  }
}
