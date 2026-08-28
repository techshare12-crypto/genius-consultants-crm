import React, { useState, useEffect } from 'react';
import { reportsApi, authApi } from '../services/api';
import {
  Download,
  CheckCircle2,
  Users,
  Star,
  Clock,
} from 'lucide-react';

export const Reports: React.FC = () => {
  const [reportType, setReportType] = useState<string>('CANDIDATES');
  const [format, setFormat] = useState<string>('xlsx');
  const [selectedExec, setSelectedExec] = useState<string>('ALL');
  const [executives, setExecutives] = useState<any[]>([]);

  useEffect(() => {
    authApi.getExecutives().then((res: any) => setExecutives(res.data.executives)).catch(() => {});
  }, []);

  const handleDownload = () => {
    const extraParams: Record<string, string> = {};
    if (selectedExec !== 'ALL') extraParams.executiveId = selectedExec;
    const url = reportsApi.getExportUrl(reportType, format, extraParams);
    window.open(url, '_blank');
  };

  const reportCards = [
    {
      id: 'CANDIDATES',
      title: 'Candidate Master Database Report',
      desc: 'Complete candidate registry with permanent UUIDs, contact details, experience, eligibility, and assigned telecallers.',
      icon: Users,
    },
    {
      id: 'DAILY_CALLING',
      title: 'Daily Calling Tracker Report',
      desc: 'Historical daily call volume, unique leads contacted, confirmed candidates, RNRs, busy callbacks, and conversion rates.',
      icon: Clock,
    },
    {
      id: 'SHORTLISTED',
      title: 'Shortlisted Pipeline Report',
      desc: 'Shortlisted candidates, registration form filled status, WhatsApp CV status, client/job details, and recruitment progress.',
      icon: Star,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black tracking-tight text-slate-900">
              Reports & Data Export Center
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Excel (.xlsx) & CSV
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Export filtered operational datasets with complete relational integrity.
          </p>
        </div>
      </div>

      {/* Select Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {reportCards.map((r) => {
          const Icon = r.icon;
          const isSelected = reportType === r.id;
          return (
            <div
              key={r.id}
              onClick={() => setReportType(r.id)}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all space-y-3 ${
                isSelected
                  ? 'border-blue-600 bg-blue-50/40 shadow-md ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                {isSelected && <CheckCircle2 className="w-5 h-5 text-blue-600" />}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{r.title}</h3>
                <p className="text-xs text-slate-500 mt-1">{r.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Export Configuration Box */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="font-bold text-slate-900 text-sm">Export Options & Format</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Export File Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-medium"
            >
              <option value="xlsx">Microsoft Excel (.xlsx)</option>
              <option value="csv">Standard CSV (.csv)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Filter by Executive</label>
            <select
              value={selectedExec}
              onChange={(e) => setSelectedExec(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-medium"
            >
              <option value="ALL">All Executives</option>
              {executives.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Generate & Download Report</span>
          </button>
        </div>
      </div>
    </div>
  );
};
