'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/common/Badge';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Building2,
  Briefcase,
  Users,
} from 'lucide-react';

export default function ImportLeadsPage() {
  const { hasPermission } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [targetCompanyId, setTargetCompanyId] = useState('');
  const [targetJobId, setTargetJobId] = useState('');

  // Preview State
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<any | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [resComp, resJobs] = await Promise.all([
        fetch('/api/companies'),
        fetch('/api/jobs'),
      ]);
      if (resComp.ok) {
        const c = await resComp.json();
        setCompanies(c.data || []);
        if (c.data?.length > 0) setTargetCompanyId(c.data[0].id);
      }
      if (resJobs.ok) {
        const j = await resJobs.json();
        setJobs(j.data || []);
        if (j.data?.length > 0) setTargetJobId(j.data[0].id);
      }
    } catch (err) {
      console.error('Error loading import dropdowns', err);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setCommitResult(null);
      await generatePreview(selectedFile);
    }
  };

  const generatePreview = async (selectedFile: File) => {
    setParsing(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/imports/preview', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const d = await res.json();
        setPreviewData(d.data);
      }
    } catch (err) {
      console.error('Error generating preview', err);
    } finally {
      setParsing(false);
    }
  };

  const handleCommitImport = async () => {
    if (!file || !targetCompanyId || !targetJobId) return;
    setCommitting(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', targetCompanyId);
      formData.append('jobId', targetJobId);

      const res = await fetch('/api/imports/commit', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const d = await res.json();
        setCommitResult(d.data);
        setPreviewData(null);
        setFile(null);
      }
    } catch (err) {
      console.error('Error committing import', err);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <span className="text-xs font-semibold text-teal-600 uppercase tracking-wider">
          SMART RECONCILIATION ENGINE
        </span>
        <h2 className="text-lg font-bold text-slate-900 mt-0.5">Excel & CSV Dataset Importer</h2>
        <p className="text-xs text-slate-500">
          Reconciles Candidate Master, Dashboard, and Shortlist sheets into normalized candidates and applications.
        </p>
      </div>

      {/* Target Campaign Selection */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-teal-600" />
          <span>Step 1: Select Target Company & Job Campaign Opening</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target Client Company</label>
            <select
              value={targetCompanyId}
              onChange={(e) => setTargetCompanyId(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg text-xs"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName} ({c.city})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target Job Requirement</label>
            <select
              value={targetJobId}
              onChange={(e) => setTargetJobId(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg text-xs"
            >
              {jobs
                .filter((j) => !targetCompanyId || j.companyId === targetCompanyId)
                .map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.jobTitle} ({j.vacancies} vacancies)
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Upload Zone */}
      <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm text-center">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mx-auto border border-teal-100 shadow-sm">
            <FileSpreadsheet className="w-6 h-6" />
          </div>

          <div>
            <h4 className="text-sm font-bold text-slate-900">Upload Recruitment Excel (.xlsx / .csv)</h4>
            <p className="text-xs text-slate-500 mt-1">
              Supports multi-sheet workbooks e.g. <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">Telecalling Operation.xlsx</code>
            </p>
          </div>

          <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-sm transition-colors">
            <Upload className="w-4 h-4" />
            <span>Select File to Parse</span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" />
          </label>

          {file && (
            <p className="text-xs font-semibold text-slate-700">
              Selected: <span className="text-teal-700 font-mono">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>
      </div>

      {/* Parsing Loader */}
      {parsing && (
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
          <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs font-semibold text-slate-700">Reading workbook sheets & normalizing phone numbers...</p>
        </div>
      )}

      {/* Preview Section */}
      {previewData && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-4">
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                Step 2: Pre-Commit Preview & Validation
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                Parsed {previewData.totalRows} Rows from {previewData.filename}
              </h3>
              <div className="flex gap-2 mt-2">
                {previewData.detectedSheets.map((s: string) => (
                  <Badge key={s} variant="info">
                    Sheet: {s}
                  </Badge>
                ))}
              </div>
            </div>

            <button
              onClick={handleCommitImport}
              disabled={committing}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {committing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Commit Import to Database</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Sample Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Candidate Name</th>
                  <th className="py-2.5 px-3">Raw Phone (Excel)</th>
                  <th className="py-2.5 px-3">Normalized Canonical Phone</th>
                  <th className="py-2.5 px-3">Location</th>
                  <th className="py-2.5 px-3">Experience</th>
                  <th className="py-2.5 px-3">Assets</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewData.previewRows?.map((r: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-slate-900">{r.name}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{r.rawPhone}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-teal-700">{r.normalizedPhone}</td>
                    <td className="py-2.5 px-3 text-slate-700">{r.location}</td>
                    <td className="py-2.5 px-3 text-slate-700">{r.experience}</td>
                    <td className="py-2.5 px-3 text-slate-700">{r.assets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Success Commit Banner */}
      {commitResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-emerald-900 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            <h3 className="text-base font-bold">Import Batch Committed Successfully!</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs pt-2 border-t border-emerald-200">
            <div>
              <span className="text-emerald-700 block">Batch Code:</span>
              <strong className="font-mono text-emerald-950 text-sm">{commitResult.batchCode}</strong>
            </div>
            <div>
              <span className="text-emerald-700 block">Imported Candidates:</span>
              <strong className="text-emerald-950 text-sm">{commitResult.importedCount} Records</strong>
            </div>
            <div>
              <span className="text-emerald-700 block">Deduplicated Matches:</span>
              <strong className="text-emerald-950 text-sm">{commitResult.duplicateCount} Existing</strong>
            </div>
            <div>
              <span className="text-emerald-700 block">Skipped / Invalid:</span>
              <strong className="text-emerald-950 text-sm">{commitResult.skippedCount} Rows</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
