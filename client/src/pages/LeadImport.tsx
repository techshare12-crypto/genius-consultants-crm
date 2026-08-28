import React, { useState, useEffect } from 'react';
import * as xlsx from 'xlsx';
import { importApi, authApi } from '../services/api';
import { formatDateTime } from '../utils/helpers';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  Download,
  Check,
} from 'lucide-react';

export const LeadImport: React.FC = () => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [duplicateStrategy, setDuplicateStrategy] = useState<'SKIP' | 'UPDATE' | 'IMPORT_AS_REVIEW'>('SKIP');
  const [batchName, setBatchName] = useState<string>('');
  const [leadSource, setLeadSource] = useState<string>('Naukri.com Bulk Lead');
  const [assignedExecId, setAssignedExecId] = useState<string>('');
  const [executives, setExecutives] = useState<any[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [pastBatches, setPastBatches] = useState<any[]>([]);

  const systemFields = [
    { key: 'name', label: 'Candidate Name', required: true },
    { key: 'primaryPhone', label: 'Primary Contact Number', required: true },
    { key: 'secondaryPhone', label: 'Secondary Contact Number' },
    { key: 'whatsappNumber', label: 'WhatsApp Number' },
    { key: 'email', label: 'Email Address' },
    { key: 'currentLocation', label: 'Current Location / City' },
    { key: 'nativeLocation', label: 'Native Location' },
    { key: 'education', label: 'Education / Qualification' },
    { key: 'totalExperienceYears', label: 'Experience (Years)' },
    { key: 'currentJobTitle', label: 'Current Designation / Role' },
    { key: 'currentCompany', label: 'Current Company' },
    { key: 'previousCompany', label: 'Previous Company' },
    { key: 'currentSalary', label: 'Current Salary / CTC' },
    { key: 'expectedSalary', label: 'Expected Salary (Take-home)' },
    { key: 'appliedLocation', label: 'Applied Job Location' },
    { key: 'noticePeriod', label: 'Notice Period' },
    { key: 'hasTwoWheeler', label: 'Has Two-Wheeler (Yes/No)' },
    { key: 'hasDrivingLicense', label: 'Has Driving License (Yes/No)' },
    { key: 'interestedInFieldSales', label: 'Interested in Field Sales (Yes/No)' },
    { key: 'interestedInAutomobile', label: 'Interested in Automobile (Yes/No)' },
    { key: 'generalNotes', label: 'Remarks / Notes' },
  ];

  const fetchBatches = async () => {
    try {
      const res = await importApi.getBatches();
      setPastBatches(res.data.batches);
    } catch (err) {
      console.error('Failed to load batches:', err);
    }
  };

  const fetchExecutives = async () => {
    try {
      const res = await authApi.getExecutives();
      setExecutives(res.data.executives);
    } catch (err) {
      console.error('Failed to fetch execs:', err);
    }
  };

  useEffect(() => {
    fetchBatches();
    fetchExecutives();
  }, []);

  const handleFileUpload = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);
      const res = await importApi.preview(formData);
      setPreviewData(res.data);
      setColumnMappings(res.data.suggestedMappings || {});
      setBatchName(`Import_${uploadedFile.name.replace(/\.[^/.]+$/, '')}_${new Date().toISOString().slice(0, 10)}`);
      setStep(2);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to read file');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!previewData || !file) return;
    setLoading(true);
    try {
      const res = await importApi.execute({
        batchName,
        fileName: file.name,
        columnMappings,
        rows: previewData.fullData,
        duplicateStrategy,
        assignedExecutiveId: assignedExecId || undefined,
        leadSource,
      });
      setImportResult(res.data);
      setStep(4);
      fetchBatches();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to execute import');
    } finally {
      setLoading(false);
    }
  };

  const downloadSampleTemplate = () => {
    const sampleData = [
      {
        'Candidate Name': 'Rajesh Kumar',
        'Contact Number': '9871234560',
        'Email': 'rajesh.kumar@example.com',
        'Current Location': 'New Delhi',
        'Education': 'Graduate (B.Com)',
        'Total Experience': 2.5,
        'Current Company': 'Zomato Logistics',
        'Designation': 'Field Sales Executive',
        'Current Salary': '22000',
        'Expected Salary': '26000',
        'Two Wheeler': 'Yes',
        'Driving License': 'Yes',
        'Field Sales': 'Yes',
        'Notice Period': 'Immediate',
        'Remarks': 'Strong field sales candidate with Delhi NCR area knowledge',
      },
      {
        'Candidate Name': 'Sneha Patil',
        'Contact Number': '9820011223',
        'Email': 'sneha.patil@example.com',
        'Current Location': 'Mumbai',
        'Education': 'MBA (Marketing)',
        'Total Experience': 3.0,
        'Current Company': 'Maruti Suzuki Arena',
        'Designation': 'Showroom Sales Advisor',
        'Current Salary': '28000',
        'Expected Salary': '34000',
        'Two Wheeler': 'Yes',
        'Driving License': 'Yes',
        'Field Sales': 'Yes',
        'Notice Period': '15 Days',
        'Remarks': 'Automobile retail sales experience',
      },
    ];

    const worksheet = xlsx.utils.json_to_sheet(sampleData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Candidates_Template');
    xlsx.writeFile(workbook, 'Genius_Consultants_Lead_Import_Template.xlsx');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black tracking-tight text-slate-900">
              Bulk Lead Import & Deduplication Engine
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Permanent IDs & Batch Tracking
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Import hundreds of leads from Excel or CSV. Automatic phone normalization and duplicate prevention.
          </p>
        </div>

        <button
          onClick={downloadSampleTemplate}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition"
        >
          <Download className="w-4 h-4 text-blue-600" />
          <span>Download Sample Template</span>
        </button>
      </div>

      {/* Stepper Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-xs font-bold">
        {[
          { num: 1, label: 'Upload File' },
          { num: 2, label: 'Column Mapping' },
          { num: 3, label: 'Duplicate Strategy & Assign' },
          { num: 4, label: 'Import Results' },
        ].map((s) => (
          <div
            key={s.num}
            className={`flex items-center gap-2 ${
              step === s.num
                ? 'text-blue-600'
                : step > s.num
                ? 'text-emerald-600'
                : 'text-slate-400'
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s.num
                  ? 'bg-blue-600 text-white'
                  : step > s.num
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {step > s.num ? <Check className="w-3.5 h-3.5" /> : s.num}
            </span>
            <span className="hidden sm:inline">{s.label}</span>
          </div>
        ))}
      </div>

      {/* STEP 1: UPLOAD FILE */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-6 shadow-sm">
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Upload Candidate Excel or CSV File</h2>
            <p className="text-xs text-slate-500">
              Supports .xlsx, .xls, and .csv files up to 20MB. Every imported lead gets a permanent database UUID.
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <label className="block p-8 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl cursor-pointer bg-slate-50/50 hover:bg-blue-50/20 transition">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />
              <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <span className="text-xs font-bold text-blue-600">Choose file or drag here</span>
              <div className="text-[11px] text-slate-400 mt-1">Excel (.xlsx, .xls) or CSV</div>
            </label>
          </div>

          {loading && (
            <div className="text-xs text-blue-600 font-semibold flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Parsing file structure & detecting columns...</span>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: COLUMN MAPPING */}
      {step === 2 && previewData && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Step 2: Map Uploaded Columns to System Fields</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                File: <span className="font-semibold text-slate-800">{previewData.fileName}</span> ({previewData.totalRows} Rows Detected)
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow"
              >
                Continue to Next Step →
              </button>
            </div>
          </div>

          {/* Mapping Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {previewData.detectedColumns.map((col: string) => {
              const currentMapped = columnMappings[col] || '';
              return (
                <div key={col} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-800">{col}</div>
                    <div className="text-[11px] text-slate-400 font-mono truncate max-w-[180px]">
                      Sample: {previewData.previewRows[0]?.[col] || 'empty'}
                    </div>
                  </div>

                  <select
                    value={currentMapped}
                    onChange={(e) => setColumnMappings({ ...columnMappings, [col]: e.target.value })}
                    className="p-2 border border-slate-300 rounded-lg bg-white font-medium text-slate-700 min-w-[190px]"
                  >
                    <option value="">-- Do Not Import --</option>
                    {systemFields.map(sf => (
                      <option key={sf.key} value={sf.key}>
                        {sf.label} {sf.required ? '*' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 3: DUPLICATE STRATEGY & ASSIGN */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-sm">
          <div className="border-b pb-4">
            <h2 className="text-base font-bold text-slate-900">Step 3: Duplicate Strategy, Source & Lead Assignment</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose how existing candidates with matching phone numbers should be handled.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <label
              onClick={() => setDuplicateStrategy('SKIP')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition space-y-2 ${
                duplicateStrategy === 'SKIP'
                  ? 'border-blue-600 bg-blue-50/50'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Skip Duplicates (Recommended)</span>
                <input type="radio" checked={duplicateStrategy === 'SKIP'} readOnly className="text-blue-600" />
              </div>
              <p className="text-slate-500 text-[11px]">
                If a candidate with the normalized phone already exists in the master database, skip them to prevent duplicates.
              </p>
            </label>

            <label
              onClick={() => setDuplicateStrategy('UPDATE')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition space-y-2 ${
                duplicateStrategy === 'UPDATE'
                  ? 'border-blue-600 bg-blue-50/50'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Update Existing Candidate</span>
                <input type="radio" checked={duplicateStrategy === 'UPDATE'} readOnly className="text-blue-600" />
              </div>
              <p className="text-slate-500 text-[11px]">
                Update the existing candidate's latest details while preserving all call history and remarks.
              </p>
            </label>

            <label
              onClick={() => setDuplicateStrategy('IMPORT_AS_REVIEW')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition space-y-2 ${
                duplicateStrategy === 'IMPORT_AS_REVIEW'
                  ? 'border-blue-600 bg-blue-50/50'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Import with Review Flag</span>
                <input type="radio" checked={duplicateStrategy === 'IMPORT_AS_REVIEW'} readOnly className="text-blue-600" />
              </div>
              <p className="text-slate-500 text-[11px]">
                Import new record with a note for manual verification if numbers overlap.
              </p>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-4 border-t border-slate-100">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Batch Name</label>
              <input
                type="text"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Lead Source Tag</label>
              <input
                type="text"
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Auto-Assign to Executive (Optional)</label>
              <select
                value={assignedExecId}
                onChange={(e) => setAssignedExecId(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="">Leave Unassigned for now</option>
                {executives.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back
            </button>
            <button
              onClick={handleExecuteImport}
              disabled={loading}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
            >
              {loading ? 'Processing Import...' : 'Execute Batch Lead Import'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: IMPORT RESULTS */}
      {step === 4 && importResult && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-6 shadow-sm animate-scale-in">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-xl font-black text-slate-900">Lead Import Completed Successfully!</h2>
            <p className="text-xs text-slate-500">
              Batch: <span className="font-bold text-slate-800">{importResult.batch.batchName}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-slate-500 font-medium">Total Rows</div>
              <div className="text-2xl font-black text-slate-800 mt-1">{importResult.summary.totalRows}</div>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="text-emerald-700 font-medium">Imported Valid</div>
              <div className="text-2xl font-black text-emerald-700 mt-1">{importResult.summary.importedCount}</div>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
              <div className="text-amber-700 font-medium">Skipped Duplicates</div>
              <div className="text-2xl font-black text-amber-700 mt-1">{importResult.summary.duplicateCount}</div>
            </div>
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
              <div className="text-rose-700 font-medium">Invalid Phone/Missing</div>
              <div className="text-2xl font-black text-rose-700 mt-1">{importResult.summary.invalidCount}</div>
            </div>
          </div>

          <div className="flex justify-center gap-3 pt-4">
            <button
              onClick={() => {
                setStep(1);
                setFile(null);
                setPreviewData(null);
                setImportResult(null);
              }}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow"
            >
              Import Another File
            </button>
          </div>
        </div>
      )}

      {/* Past Import Batches Log */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
          Past Lead Import Batches Audit History
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                <th className="p-3">Batch Name</th>
                <th className="p-3">Source File</th>
                <th className="p-3">Imported By</th>
                <th className="p-3 text-center">Total Rows</th>
                <th className="p-3 text-center text-emerald-700">Valid Imported</th>
                <th className="p-3 text-center text-amber-700">Duplicates Skipped</th>
                <th className="p-3">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {pastBatches.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{b.batchName}</td>
                  <td className="p-3 text-slate-500 font-mono">{b.fileName}</td>
                  <td className="p-3 font-semibold">{b.importedBy?.name}</td>
                  <td className="p-3 text-center font-bold">{b.totalRows}</td>
                  <td className="p-3 text-center font-bold text-emerald-600">{b.validCount}</td>
                  <td className="p-3 text-center font-bold text-amber-600">{b.duplicateCount}</td>
                  <td className="p-3 font-mono text-slate-400">{formatDateTime(b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
