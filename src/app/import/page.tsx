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
  MapPin,
} from 'lucide-react';

export default function ImportLeadsPage() {
  const { hasPermission } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [targetCompanyId, setTargetCompanyId] = useState('');
  const [targetJobId, setTargetJobId] = useState('');
  const [targetLocation, setTargetLocation] = useState('');

  // Preview & Processing State
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoadingData(true);
    try {
      const [resComp, resJobs] = await Promise.all([
        fetch('/api/companies'),
        fetch('/api/jobs'),
      ]);

      let loadedCompanies: any[] = [];
      let loadedJobs: any[] = [];

      if (resComp.ok) {
        const c = await resComp.json();
        loadedCompanies = c.data || [];
        setCompanies(loadedCompanies);
      }

      if (resJobs.ok) {
        const j = await resJobs.json();
        loadedJobs = j.data || [];
        setJobs(loadedJobs);
      }

      // Automatically select initial company and matching job if available
      if (loadedCompanies.length > 0) {
        const initialCompId = loadedCompanies[0].id;
        setTargetCompanyId(initialCompId);

        const matchingJobs = loadedJobs.filter((jb: any) => jb.companyId === initialCompId);
        if (matchingJobs.length > 0) {
          setTargetJobId(matchingJobs[0].id);
        } else {
          setTargetJobId('');
        }
      }
    } catch (err: any) {
      console.error('Error loading import dropdowns', err);
      setError('Failed to load Companies or Job Requirements. Please refresh the page.');
    } finally {
      setLoadingData(false);
    }
  };

  const handleCompanyChange = (newCompanyId: string) => {
    setTargetCompanyId(newCompanyId);
    setError(null);
    const matchingJobs = jobs.filter((j) => j.companyId === newCompanyId);
    if (matchingJobs.length > 0) {
      setTargetJobId(matchingJobs[0].id);
    } else {
      setTargetJobId('');
    }
    setTargetLocation('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setCommitResult(null);
      setError(null);
      await generatePreview(selectedFile);
    }
  };

  const generatePreview = async (selectedFile: File) => {
    setParsing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/imports/preview', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to generate preview from the uploaded file.');
        setPreviewData(null);
      } else {
        setPreviewData(data.data);
      }
    } catch (err: any) {
      console.error('Error generating preview', err);
      setError(err.message || 'Network error occurred while parsing workbook preview.');
      setPreviewData(null);
    } finally {
      setParsing(false);
    }
  };

  const handleCommitImport = async () => {
    setError(null);

    if (!file) {
      setError('Please select an Excel (.xlsx / .xls / .csv) file to import.');
      return;
    }

    if (!targetCompanyId || !targetJobId) {
      setError('Please select a Target Client Company and Target Job Requirement before committing the import.');
      return;
    }

    setCommitting(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', targetCompanyId);
      formData.append('jobId', targetJobId);
      if (targetLocation) {
        formData.append('targetLocation', targetLocation);
      }

      const res = await fetch('/api/imports/commit', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Server rejected the import commit request.');
        return;
      }

      setCommitResult(data.data);
      setPreviewData(null);
      setFile(null);
      setError(null);
    } catch (err: any) {
      console.error('Error committing import', err);
      setError(err.message || 'An unexpected error occurred while committing import to the database.');
    } finally {
      setCommitting(false);
    }
  };

  const availableJobsForSelectedCompany = jobs.filter(
    (j) => !targetCompanyId || j.companyId === targetCompanyId
  );

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

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-900 flex items-start gap-3 shadow-sm animate-in fade-in duration-200">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <h4 className="font-bold text-rose-950">Import Notification / Error</h4>
            <p className="mt-0.5 text-rose-800">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-xs font-bold text-rose-700 hover:text-rose-900 px-2 py-1 rounded bg-rose-100 hover:bg-rose-200 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Target Campaign Selection */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-teal-600" />
          <span>Step 1: Select Target Company & Job Campaign Opening</span>
        </h3>

        {loadingData ? (
          <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading active companies and job requirements...</span>
          </div>
        ) : companies.length === 0 ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <strong>No Client Companies Available in CRM:</strong>
              <p className="mt-0.5 text-amber-800">
                To import candidates and associate them with job openings, please add a Client Company and Job Requirement first.
              </p>
            </div>
            <a
              href="/companies"
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold whitespace-nowrap shadow-sm transition-colors"
            >
              Go to Companies →
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Client Company <span className="text-rose-500">*</span>
              </label>
              <select
                value={targetCompanyId}
                onChange={(e) => handleCompanyChange(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-medium text-slate-800"
              >
                <option value="">-- Select Target Client Company --</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} {c.city ? `(${c.city})` : ''} [{c.companyCode || 'COMP'}]
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Job Requirement <span className="text-rose-500">*</span>
              </label>
              {!targetCompanyId ? (
                <select
                  disabled
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-400 cursor-not-allowed"
                >
                  <option value="">-- Select a company first --</option>
                </select>
              ) : availableJobsForSelectedCompany.length === 0 ? (
                <div className="p-2.5 border border-amber-200 bg-amber-50 rounded-lg text-xs text-amber-800 flex items-center justify-between">
                  <span>No open job requirements for this company.</span>
                  <a href="/jobs" className="text-teal-700 hover:text-teal-900 font-bold underline ml-2">
                    Create Job Opening
                  </a>
                </div>
              ) : (
                <select
                  value={targetJobId}
                  onChange={(e) => {
                    setTargetJobId(e.target.value);
                    setTargetLocation('');
                    setError(null);
                  }}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-medium text-slate-800"
                >
                  <option value="">-- Select Target Job Requirement --</option>
                  {availableJobsForSelectedCompany.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.jobTitle} ({j.vacancies || 1} vacancies) - {j.location}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {(() => {
              const selectedJobObj = jobs.find((j) => j.id === targetJobId);
              const selectedJobLocations: string[] = [];
              if (selectedJobObj) {
                if (selectedJobObj.locations && selectedJobObj.locations.length > 0) {
                  selectedJobLocations.push(...selectedJobObj.locations.map((l: any) => l.city));
                } else if (selectedJobObj.location) {
                  selectedJobObj.location.split(',').forEach((s: string) => {
                    const trimmed = s.trim();
                    if (trimmed && !selectedJobLocations.includes(trimmed)) selectedJobLocations.push(trimmed);
                  });
                }
              }
              if (selectedJobLocations.length > 1) {
                return (
                  <div className="md:col-span-2 bg-slate-50 border border-teal-200 rounded-lg p-3">
                    <label className="block text-xs font-semibold text-teal-900 mb-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-teal-600" />
                      <span>Target Job Opening Location (Multi-Location Opening)</span>
                    </label>
                    <select
                      value={targetLocation}
                      onChange={(e) => setTargetLocation(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-medium text-slate-800"
                    >
                      <option value="">-- Auto-detect from Excel per Candidate / Support All Locations --</option>
                      {selectedJobLocations.map((loc) => (
                        <option key={loc} value={loc}>
                          🎯 Specific Target Location: {loc}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        )}
      </div>

      {/* Upload Zone */}
      <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm text-center">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mx-auto border border-teal-100 shadow-sm">
            <FileSpreadsheet className="w-6 h-6" />
          </div>

          <div>
            <h4 className="text-sm font-bold text-slate-900">Upload Recruitment Excel (.xlsx / .xls / .csv)</h4>
            <p className="text-xs text-slate-500 mt-1">
              Supports multi-sheet workbooks e.g. <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">Genius_Consultancy_CRM_Demo_Leads.xlsx</code>
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
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200 shadow-sm">
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
              <div className="flex flex-wrap gap-2 mt-2">
                {previewData.detectedSheets.map((s: string) => (
                  <Badge key={s} variant="info">
                    Sheet: {s}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <button
                onClick={handleCommitImport}
                disabled={committing || !targetCompanyId || !targetJobId}
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {committing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Committing Leads to Database...</span>
                  </>
                ) : (
                  <>
                    <span>Commit Import to Database</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              {(!targetCompanyId || !targetJobId) && (
                <span className="text-[11px] text-amber-600 font-medium">
                  Select target company & job above to enable commit
                </span>
              )}
            </div>
          </div>

          {/* Sample Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Candidate Name</th>
                  <th className="py-2.5 px-3">Raw Phone (Excel)</th>
                  <th className="py-2.5 px-3">Normalized Phone</th>
                  <th className="py-2.5 px-3">Candidate Residence</th>
                  <th className="py-2.5 px-3">Target Applied Location</th>
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
                    <td className="py-2.5 px-3 text-slate-700">{r.location || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-700 font-medium text-teal-800">{r.appliedLocation || r.location || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-700">{r.experience || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-700">{r.assets || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Success Commit Banner */}
      {commitResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-emerald-900 shadow-sm space-y-3 animate-in fade-in duration-200">
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
