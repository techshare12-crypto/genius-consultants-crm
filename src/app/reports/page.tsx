'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Modal } from '@/components/common/Modal';
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
  Clock,
  Users,
  ChevronRight,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Eye,
  Activity,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';

export default function ReportsPage() {
  const { user, hasPermission } = useAuth();

  // Navigation Tab
  const [activeTab, setActiveTab] = useState<'PRODUCTIVITY' | 'OPERATIONS' | 'LOCATIONS' | 'PERFORMANCE'>('PRODUCTIVITY');

  // Productivity Analytics State
  const [productivityData, setProductivityData] = useState<any>(null);
  const [loadingProductivity, setLoadingProductivity] = useState(false);

  // Filter State
  const [datePreset, setDatePreset] = useState<'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'CUSTOM'>('TODAY');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedExecutiveId, setSelectedExecutiveId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');

  // Timeline Modal State
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [timelineData, setTimelineData] = useState<any>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [activeTimelineExec, setActiveTimelineExec] = useState<{ id: string; name: string } | null>(null);

  // Legacy Reports State
  const [overview, setOverview] = useState<any>(null);
  const [executives, setExecutives] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loadingLegacy, setLoadingLegacy] = useState(false);

  const isExecutiveOnly = user?.roles?.includes('EXECUTIVE') && !user?.roles?.includes('SUPER_ADMIN') && !user?.roles?.includes('OPERATIONS_HEAD') && !user?.roles?.includes('TEAM_LEAD');

  useEffect(() => {
    fetchProductivityData();
    fetchLegacyReports();
  }, []);

  const fetchProductivityData = async () => {
    setLoadingProductivity(true);
    try {
      const params = new URLSearchParams();
      if (datePreset) params.set('datePreset', datePreset);
      if (datePreset === 'CUSTOM' && startDate) params.set('startDate', startDate);
      if (datePreset === 'CUSTOM' && endDate) params.set('endDate', endDate);
      if (startTime) params.set('startTime', startTime);
      if (endTime) params.set('endTime', endTime);
      if (selectedExecutiveId) params.set('executiveId', selectedExecutiveId);
      if (selectedTeamId) params.set('teamId', selectedTeamId);

      const res = await fetch(`/api/reports/productivity?${params.toString()}`);
      if (res.ok) {
        const d = await res.json();
        setProductivityData(d.data);
      }
    } catch (err) {
      console.error('Error fetching productivity analytics:', err);
    } finally {
      setLoadingProductivity(false);
    }
  };

  const fetchLegacyReports = async () => {
    setLoadingLegacy(true);
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
      setLoadingLegacy(false);
    }
  };

  const handleViewTimeline = async (execId: string, execName: string) => {
    setActiveTimelineExec({ id: execId, name: execName });
    setShowTimelineModal(true);
    setLoadingTimeline(true);

    try {
      const params = new URLSearchParams();
      params.set('executiveId', execId);
      if (datePreset === 'CUSTOM' && startDate) {
        params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
      } else if (datePreset === 'YESTERDAY') {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        params.set('date', yesterday);
      }

      const res = await fetch(`/api/reports/productivity/timeline?${params.toString()}`);
      if (res.ok) {
        const d = await res.json();
        setTimelineData(d.data);
      }
    } catch (err) {
      console.error('Error fetching timeline:', err);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const handleExportProductivityCSV = () => {
    const params = new URLSearchParams();
    if (datePreset) params.set('datePreset', datePreset);
    if (datePreset === 'CUSTOM' && startDate) params.set('startDate', startDate);
    if (datePreset === 'CUSTOM' && endDate) params.set('endDate', endDate);
    if (startTime) params.set('startTime', startTime);
    if (endTime) params.set('endTime', endTime);
    if (selectedExecutiveId) params.set('executiveId', selectedExecutiveId);
    if (selectedTeamId) params.set('teamId', selectedTeamId);

    window.open(`/api/reports/productivity/export?${params.toString()}`, '_blank');
  };

  const exportLegacyCSV = (type: 'LOCATIONS' | 'EXECUTIVES') => {
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

  const summary = productivityData?.summary;
  const executiveMatrix = productivityData?.executiveMatrix || [];
  const hourlyBreakdown = productivityData?.hourlyBreakdown || [];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-teal-600 uppercase tracking-wider">
              EXECUTIVE PRODUCTIVITY & RECRUITMENT OPERATIONS
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-100 text-teal-800">
              IST (Asia/Kolkata)
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">Productivity & Activity Analytics</h1>
          <p className="text-xs text-slate-500">
            Real-time tracking of Unique Leads Worked, Calls Logged, Hourly Output, and CRM Activity Timelines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'PRODUCTIVITY' && (
            <button
              onClick={handleExportProductivityCSV}
              className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Productivity (CSV)</span>
            </button>
          )}

          {activeTab === 'LOCATIONS' && (
            <button
              onClick={() => exportLegacyCSV('LOCATIONS')}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Download className="w-4 h-4 text-teal-400" />
              <span>Export Location Tracker (CSV)</span>
            </button>
          )}

          {activeTab === 'PERFORMANCE' && (
            <button
              onClick={() => exportLegacyCSV('EXECUTIVES')}
              className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export Executive Matrix (CSV)</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('PRODUCTIVITY')}
          className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${
            activeTab === 'PRODUCTIVITY'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>{isExecutiveOnly ? 'My Productivity Dashboard' : 'Executive Productivity & Activity'}</span>
        </button>

        <button
          onClick={() => setActiveTab('OPERATIONS')}
          className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${
            activeTab === 'OPERATIONS'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Pipeline & Conversion Funnel</span>
        </button>

        <button
          onClick={() => setActiveTab('LOCATIONS')}
          className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${
            activeTab === 'LOCATIONS'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Location Calling Tracker</span>
        </button>

        <button
          onClick={() => setActiveTab('PERFORMANCE')}
          className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${
            activeTab === 'PERFORMANCE'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Executive Performance Matrix</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: EXECUTIVE PRODUCTIVITY & ACTIVITY ANALYTICS */}
      {/* ========================================================================= */}
      {activeTab === 'PRODUCTIVITY' && (
        <div className="space-y-5">
          {/* Advanced IST Filter Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Filter className="w-4 h-4 text-teal-600" />
                <span>Productivity Time Window (IST)</span>
              </div>

              {/* Date Presets */}
              <div className="flex flex-wrap gap-1.5 text-xs">
                {(['TODAY', 'YESTERDAY', 'LAST_7_DAYS', 'LAST_30_DAYS', 'CUSTOM'] as const).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      setDatePreset(preset);
                    }}
                    className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                      datePreset === preset
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {preset === 'TODAY' && 'Today'}
                    {preset === 'YESTERDAY' && 'Yesterday'}
                    {preset === 'LAST_7_DAYS' && 'Last 7 Days'}
                    {preset === 'LAST_30_DAYS' && 'Last 30 Days'}
                    {preset === 'CUSTOM' && 'Custom Range'}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Range & Time Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
              {datePreset === 'CUSTOM' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-teal-500"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Arbitrary Start Time (IST)
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  placeholder="e.g. 10:30"
                  className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Arbitrary End Time (IST)
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  placeholder="e.g. 12:15"
                  className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-teal-500"
                />
              </div>

              {!isExecutiveOnly && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Executive Filter</label>
                  <select
                    value={selectedExecutiveId}
                    onChange={(e) => setSelectedExecutiveId(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-teal-500 bg-white"
                  >
                    <option value="">All Executives ({executiveMatrix.length})</option>
                    {executiveMatrix.map((exec: any) => (
                      <option key={exec.id} value={exec.id}>
                        {exec.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-end">
                <button
                  onClick={fetchProductivityData}
                  disabled={loadingProductivity}
                  className="w-full p-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingProductivity ? 'animate-spin' : ''}`} />
                  <span>Apply Filter</span>
                </button>
              </div>
            </div>
          </div>

          {/* Primary Productivity KPI Cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="bg-white rounded-xl border border-teal-200 bg-teal-50/20 p-4 shadow-sm">
                <div className="text-[11px] font-bold text-teal-800 uppercase tracking-wider">
                  Unique Leads Worked
                </div>
                <div className="text-2xl font-bold text-teal-700 mt-1">
                  {summary.uniqueLeadsWorked}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Distinct applications touched</div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Total Calls Logged
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  {summary.totalCallsLogged}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Total call records in window</div>
              </div>

              <div className="bg-white rounded-xl border border-emerald-200 bg-emerald-50/20 p-4 shadow-sm">
                <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                  Connected Calls
                </div>
                <div className="text-2xl font-bold text-emerald-700 mt-1">
                  {summary.connectedCalls}
                </div>
                <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                  {summary.connectRate}% Connect Rate
                </div>
              </div>

              <div className="bg-white rounded-xl border border-purple-200 bg-purple-50/20 p-4 shadow-sm">
                <div className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">
                  Shortlisted
                </div>
                <div className="text-2xl font-bold text-purple-700 mt-1">
                  {summary.shortlistedCalls}
                </div>
                <div className="text-[10px] text-purple-600 font-semibold mt-0.5">
                  {summary.shortlistRate}% Shortlist Rate
                </div>
              </div>

              <div className="bg-white rounded-xl border border-amber-200 bg-amber-50/20 p-4 shadow-sm">
                <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                  Callbacks Scheduled
                </div>
                <div className="text-2xl font-bold text-amber-700 mt-1">
                  {summary.callbacksScheduled}
                </div>
                <div className="text-[10px] text-amber-600 font-semibold mt-0.5">
                  {summary.callbacksCompleted} Completed
                </div>
              </div>

              <div className="bg-white rounded-xl border border-sky-200 bg-sky-50/20 p-4 shadow-sm">
                <div className="text-[11px] font-bold text-sky-800 uppercase tracking-wider">
                  Verifications Done
                </div>
                <div className="text-2xl font-bold text-sky-700 mt-1">
                  {summary.verificationsCompleted}
                </div>
                <div className="text-[10px] text-sky-600 font-semibold mt-0.5">
                  {summary.screeningsCompleted} Screenings
                </div>
              </div>
            </div>
          )}

          {/* Hourly Productivity Breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Hourly Productivity Breakdown (IST)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Granular hourly distribution of calls, unique leads worked, and candidate verifications.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                09:00 AM - 08:00 PM Active Window
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Hour Window (IST)</th>
                    <th className="py-2.5 px-4 text-center">Calls Logged</th>
                    <th className="py-2.5 px-4 text-center">Connected Calls</th>
                    <th className="py-2.5 px-4 text-center">Unique Leads Worked</th>
                    <th className="py-2.5 px-4 text-center">Verifications Done</th>
                    <th className="py-2.5 px-4 text-center">Callbacks Logged</th>
                    <th className="py-2.5 px-4 text-center">Output Intensity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hourlyBreakdown.map((h: any) => {
                    const intensity = h.totalCalls > 10 ? 'High' : h.totalCalls > 4 ? 'Moderate' : h.totalCalls > 0 ? 'Light' : 'Zero';
                    const badgeClass =
                      intensity === 'High'
                        ? 'bg-emerald-100 text-emerald-800'
                        : intensity === 'Moderate'
                        ? 'bg-sky-100 text-sky-800'
                        : intensity === 'Light'
                        ? 'bg-slate-100 text-slate-700'
                        : 'text-slate-400';

                    return (
                      <tr key={h.hour} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-4 font-semibold text-slate-800">{h.hour}</td>
                        <td className="py-2 px-4 text-center font-bold text-slate-900">{h.totalCalls}</td>
                        <td className="py-2 px-4 text-center font-semibold text-emerald-700">{h.connectedCalls}</td>
                        <td className="py-2 px-4 text-center font-bold text-teal-700">{h.uniqueLeadsWorked}</td>
                        <td className="py-2 px-4 text-center font-semibold text-sky-700">{h.verificationsCompleted}</td>
                        <td className="py-2 px-4 text-center font-semibold text-amber-700">{h.callbacksLogged}</td>
                        <td className="py-2 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badgeClass}`}>
                            {intensity}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Executive Productivity Matrix */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Executive Productivity Matrix
                </h3>
                <p className="text-[11px] text-slate-500">
                  Direct breakdown of Unique Leads Worked vs Calls Logged per executive with activity timeline access.
                </p>
              </div>
              <span className="text-[11px] font-bold text-slate-700">{executiveMatrix.length} Executives</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Executive Name</th>
                    <th className="py-3 px-4 text-center">Assigned Leads</th>
                    <th className="py-3 px-4 text-center">Unique Leads Worked</th>
                    <th className="py-3 px-4 text-center">Total Calls Logged</th>
                    <th className="py-3 px-4 text-center">Connected</th>
                    <th className="py-3 px-4 text-center">Shortlisted</th>
                    <th className="py-3 px-4 text-center">Verifications</th>
                    <th className="py-3 px-4 text-center">Connect %</th>
                    <th className="py-3 px-4 text-center">Shortlist %</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {executiveMatrix.map((exec: any) => (
                    <tr key={exec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div>{exec.fullName}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{exec.teamName} • {exec.email}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-600">{exec.assignedLeadsCount}</td>
                      <td className="py-3 px-4 text-center font-bold text-teal-700">{exec.uniqueLeadsWorked}</td>
                      <td className="py-3 px-4 text-center font-bold text-slate-900">{exec.totalCallsLogged}</td>
                      <td className="py-3 px-4 text-center font-semibold text-emerald-700">{exec.connectedCalls}</td>
                      <td className="py-3 px-4 text-center font-bold text-purple-700">{exec.shortlistedCalls}</td>
                      <td className="py-3 px-4 text-center font-semibold text-sky-700">{exec.verificationsDone}</td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-800">{exec.connectRate}%</td>
                      <td className="py-3 px-4 text-center font-semibold text-purple-700">{exec.shortlistRate}%</td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleViewTimeline(exec.id, exec.fullName)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1 mx-auto transition-colors"
                          title="View chronological activity stream & CRM gaps"
                        >
                          <Eye className="w-3.5 h-3.5 text-teal-600" />
                          <span>Timeline</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PIPELINE & CONVERSION FUNNEL */}
      {/* ========================================================================= */}
      {activeTab === 'OPERATIONS' && overview && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Recruitment Conversion Funnel
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-slate-500 font-semibold">Total Applications</div>
                <div className="text-xl font-bold text-slate-900 mt-1">{overview.pipeline.totalApplications}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-slate-500 font-semibold">Form Received</div>
                <div className="text-xl font-bold text-slate-900 mt-1">{overview.pipeline.formReceived}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-slate-500 font-semibold">Screening Passed</div>
                <div className="text-xl font-bold text-slate-900 mt-1">{overview.pipeline.screeningPassed}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-slate-500 font-semibold">Final Shortlist</div>
                <div className="text-xl font-bold text-slate-900 mt-1">{overview.pipeline.finalShortlist}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-slate-500 font-semibold">Sent to Client</div>
                <div className="text-xl font-bold text-slate-900 mt-1">{overview.pipeline.sentToClient}</div>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <div className="text-emerald-800 font-semibold">Selected & Joined</div>
                <div className="text-xl font-bold text-emerald-700 mt-1">{overview.pipeline.joined}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: LOCATION CALLING TRACKER */}
      {/* ========================================================================= */}
      {activeTab === 'LOCATIONS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Location-Wise Calling Tracker
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
      )}

      {/* ========================================================================= */}
      {/* TAB 4: EXECUTIVE PERFORMANCE MATRIX */}
      {/* ========================================================================= */}
      {activeTab === 'PERFORMANCE' && (
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
      )}

      {/* ========================================================================= */}
      {/* EXECUTIVE ACTIVITY TIMELINE MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={showTimelineModal}
        onClose={() => {
          setShowTimelineModal(false);
          setTimelineData(null);
        }}
        title={`Activity Stream: ${activeTimelineExec?.name || 'Executive'}`}
        subtitle={`Chronological CRM activity logs & activity gaps for ${timelineData?.dateRange || 'selected window'}`}
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs">
          {loadingTimeline ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-teal-600" />
              <span>Loading chronological activity timeline...</span>
            </div>
          ) : !timelineData || timelineData.events.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              No recorded CRM activity for this executive during the selected date window.
            </div>
          ) : (
            <>
              {/* Timeline Header Stats */}
              <div className="grid grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Total CRM Events</span>
                  <span className="text-base font-bold text-slate-900">{timelineData.totalEvents}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Activity Gaps (&ge;10m)</span>
                  <span className="text-base font-bold text-amber-700">{timelineData.totalGapsCount}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Total Gap Duration</span>
                  <span className="text-base font-bold text-slate-700">{timelineData.totalGapMinutes} min</span>
                </div>
              </div>

              {/* Chronological Event Stream */}
              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {timelineData.events.map((item: any) => {
                  if (item.type === 'GAP') {
                    return (
                      <div
                        key={item.id}
                        className="bg-amber-50/70 border border-dashed border-amber-300 rounded-lg p-2.5 text-center text-amber-900 font-semibold flex items-center justify-center gap-2 text-[11px]"
                      >
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>{item.title}</span>
                        <span className="text-[10px] text-amber-700 font-normal font-mono">
                          ({item.formattedTime})
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item.id}
                      className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs flex items-start justify-between gap-3 hover:border-slate-300 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">{item.title}</span>
                          {item.badge && (
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              item.badge.variant === 'success'
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.badge.variant === 'warning'
                                ? 'bg-amber-100 text-amber-800'
                                : item.badge.variant === 'danger'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {item.badge.label}
                            </span>
                          )}
                        </div>

                        {item.candidateName && (
                          <div className="text-[11px] text-slate-600 font-medium">
                            Candidate: <span className="text-slate-900 font-semibold">{item.candidateName}</span>
                            {item.candidatePhone && ` (${item.candidatePhone})`}
                            {item.jobTitle && ` • ${item.jobTitle}`}
                          </div>
                        )}

                        <div className="text-[11px] text-slate-500">{item.details}</div>
                      </div>

                      <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap shrink-0">
                        {item.formattedTime}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              onClick={() => {
                setShowTimelineModal(false);
                setTimelineData(null);
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
