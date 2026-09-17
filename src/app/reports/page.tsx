'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  MapPin,
  TrendingUp,
  PhoneCall,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';

export default function ReportsPage() {
  const { hasPermission } = useAuth();
  const [overview, setOverview] = useState<any>(null);
  const [executives, setExecutives] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [resOverview, resExecs, resLocs] = await Promise.all([
        fetch('/api/reports/overview'),
        fetch('/api/reports/executives'),
        fetch('/api/reports/locations'),
      ]);

      if (resOverview.ok) setOverview((await resOverview.json()).data);
      if (resExecs.ok) setExecutives((await resExecs.json()).data || []);
      if (resLocs.ok) setLocations((await resLocs.json()).data || []);
    } catch (err) {
      console.error('Error loading reports', err);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = (type: 'LOCATIONS' | 'EXECUTIVES') => {
    let rows: string[] = [];
    let filename = 'report.csv';

    if (type === 'LOCATIONS') {
      filename = 'location_calling_tracker.csv';
      rows.push('Location,Total Leads,Connected Calls,RNR,Callbacks,Shortlisted,Not Interested');
      for (const loc of locations) {
        rows.push(`"${loc.location}",${loc.totalLeads},${loc.connected},${loc.rnr},${loc.callbacks},${loc.shortlisted},${loc.notInterested}`);
      }
    } else {
      filename = 'executive_performance_matrix.csv';
      rows.push('Executive Name,Email,Assigned Leads,Total Calls,Connected,Callbacks,Shortlisted,Conversion Rate,Quality Rating');
      for (const exec of executives) {
        rows.push(`"${exec.name}","${exec.email}",${exec.assignedLeads},${exec.totalCalls},${exec.connected},${exec.callbacks},${exec.shortlisted},${exec.conversionRate}%,${exec.qualityRating}`);
      }
    }

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-teal-600 uppercase tracking-wider">
            ANALYTICS & CONVERSIONS
          </span>
          <h2 className="text-lg font-bold text-slate-900 mt-0.5">Operations & Recruitment Reports</h2>
          <p className="text-xs text-slate-500">
            Real-time aggregate analytics, dynamic calling trackers, and conversion funnel ratios.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCSV('LOCATIONS')}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Download className="w-4 h-4 text-teal-400" />
            <span>Export Location Tracker (CSV)</span>
          </button>
          <button
            onClick={() => exportCSV('EXECUTIVES')}
            className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export Executive Matrix (CSV)</span>
          </button>
        </div>
      </div>

      {/* Dynamic Location-Wise Calling Tracker (Matches Excel DAILY CALLING TRACKER dynamically) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Location-Wise Calling Tracker (Dynamic Daily Calling Replacement)
            </h3>
            <p className="text-xs text-slate-500">
              Computed directly from Candidate & Call Log events across all campaign locations.
            </p>
          </div>
          <span className="text-xs font-bold text-teal-700">{locations.length} Active Regions</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Location / Region</th>
                <th className="py-3 px-4 text-center">Total Leads</th>
                <th className="py-3 px-4 text-center">Connected</th>
                <th className="py-3 px-4 text-center">RNR</th>
                <th className="py-3 px-4 text-center">Callbacks</th>
                <th className="py-3 px-4 text-center">Shortlisted</th>
                <th className="py-3 px-4 text-center">Not Interested</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {locations.map((loc) => (
                <tr key={loc.location} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-teal-600" />
                    <span>{loc.location}</span>
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-slate-900">{loc.totalLeads}</td>
                  <td className="py-3 px-4 text-center font-semibold text-teal-700">{loc.connected}</td>
                  <td className="py-3 px-4 text-center font-semibold text-slate-500">{loc.rnr}</td>
                  <td className="py-3 px-4 text-center font-semibold text-amber-600">{loc.callbacks}</td>
                  <td className="py-3 px-4 text-center font-bold text-purple-700">{loc.shortlisted}</td>
                  <td className="py-3 px-4 text-center font-semibold text-rose-600">{loc.notInterested}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Executive Performance Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-900">Executive Performance & Conversion Ratios</h3>
          <p className="text-xs text-slate-500">Transparent ratios computed with exact numerator and denominators.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Executive</th>
                <th className="py-3 px-4 text-center">Assigned Leads</th>
                <th className="py-3 px-4 text-center">Calls Made</th>
                <th className="py-3 px-4 text-center">Connected</th>
                <th className="py-3 px-4 text-center">Callbacks Done</th>
                <th className="py-3 px-4 text-center">Shortlisted</th>
                <th className="py-3 px-4 text-center">Conversion Rate</th>
                <th className="py-3 px-4 text-center">Quality Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {executives.map((exec) => (
                <tr key={exec.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    <div>{exec.name}</div>
                    <div className="text-[10px] text-slate-400 font-normal">{exec.email}</div>
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-slate-700">{exec.assignedLeads}</td>
                  <td className="py-3 px-4 text-center font-bold text-slate-900">{exec.totalCalls}</td>
                  <td className="py-3 px-4 text-center font-semibold text-teal-700">{exec.connected}</td>
                  <td className="py-3 px-4 text-center font-semibold text-amber-700">
                    {exec.callbacksCompleted} / {exec.callbacks}
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-purple-700">{exec.shortlisted}</td>
                  <td className="py-3 px-4 text-center font-bold text-slate-900">{exec.conversionRate}%</td>
                  <td className="py-3 px-4 text-center">
                    <span className="font-semibold px-2 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200">
                      ★ {exec.qualityRating}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
