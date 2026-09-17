'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { StageBadge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import {
  Briefcase,
  Search,
  Filter,
  UserCheck,
  Building2,
  Clock,
  History,
  Phone,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function ApplicationsPage() {
  const { hasPermission } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);
  const [executives, setExecutives] = useState<any[]>([]);
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
  const [stageFilter, setStageFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Assign Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [targetExecId, setTargetExecId] = useState('');
  const [assignReason, setAssignReason] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Timeline / History Modal
  const [timelineData, setTimelineData] = useState<any | null>(null);

  useEffect(() => {
    fetchApplications();
    fetchExecutives();
  }, [stageFilter, search]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      let url = `/api/applications?limit=100&search=${encodeURIComponent(search)}`;
      if (stageFilter) url += `&stage=${stageFilter}`;

      const res = await fetch(url);
      if (res.ok) {
        const d = await res.json();
        setApplications(d.data || []);
      }
    } catch (err) {
      console.error('Error fetching applications', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchExecutives = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const d = await res.json();
        const execs = (d.data || []).filter((u: any) => u.roles.includes('EXECUTIVE') || u.roles.includes('SCREENING_MANAGER'));
        setExecutives(execs);
      }
    } catch (err) {
      console.error('Error loading executives', err);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedAppIds(applications.map((a) => a.id));
    } else {
      setSelectedAppIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedAppIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAssignLeads = async () => {
    if (!targetExecId || selectedAppIds.length === 0) return;
    setAssigning(true);

    try {
      const res = await fetch('/api/applications/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationIds: selectedAppIds,
          executiveId: targetExecId,
          reason: assignReason || 'Operations batch assignment',
        }),
      });

      if (res.ok) {
        setShowAssignModal(false);
        setSelectedAppIds([]);
        setAssignReason('');
        await fetchApplications();
      }
    } catch (err) {
      console.error('Error assigning leads', err);
    } finally {
      setAssigning(false);
    }
  };

  const viewTimeline = async (appId: string) => {
    try {
      const res = await fetch(`/api/applications/${appId}/history`);
      if (res.ok) {
        const d = await res.json();
        setTimelineData(d.data);
      }
    } catch (err) {
      console.error('Error loading timeline', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-teal-600 uppercase tracking-wider">
            OPERATIONS WORKSPACE
          </span>
          <h2 className="text-lg font-bold text-slate-900 mt-0.5">Recruitment Applications Pipeline</h2>
          <p className="text-xs text-slate-500">
            One-active executive assignment per candidate transaction with immutable history and audit trail.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code, candidate..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
          >
            <option value="">All Stages</option>
            <option value="NEW">New Leads</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="CALLING">Calling</option>
            <option value="INTERESTED">Interested</option>
            <option value="SHORTLISTED">Shortlisted</option>
            <option value="SCREENING_PENDING">Screening Pending</option>
            <option value="SCREENING_PASSED">Screening Passed</option>
            <option value="FINAL_SHORTLIST">Final Shortlist</option>
            <option value="SENT_TO_CLIENT">Sent to Client</option>
            <option value="SELECTED">Selected</option>
            <option value="JOINED">Joined</option>
          </select>

          {hasPermission('application.assign') && (
            <button
              disabled={selectedAppIds.length === 0}
              onClick={() => setShowAssignModal(true)}
              className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
            >
              <UserCheck className="w-4 h-4" />
              <span>Assign ({selectedAppIds.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                {hasPermission('application.assign') && (
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={selectedAppIds.length === applications.length && applications.length > 0}
                    />
                  </th>
                )}
                <th className="py-3 px-4">App Code & Candidate</th>
                <th className="py-3 px-4">Job Requirement</th>
                <th className="py-3 px-4">Client Company</th>
                <th className="py-3 px-4">Assigned Executive</th>
                <th className="py-3 px-4">Recruitment Stage</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No applications found.
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                    {hasPermission('application.assign') && (
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedAppIds.includes(app.id)}
                          onChange={() => handleToggleSelect(app.id)}
                        />
                      </td>
                    )}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{app.candidate?.fullName}</div>
                      <div className="font-mono text-[11px] text-teal-700">{app.candidate?.normalizedPhone}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{app.applicationCode}</div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{app.job?.jobTitle}</td>
                    <td className="py-3 px-4 font-medium text-slate-600">{app.company?.companyName}</td>
                    <td className="py-3 px-4">
                      {app.assignedExecutive ? (
                        <div className="font-semibold text-slate-900">{app.assignedExecutive.fullName}</div>
                      ) : (
                        <span className="text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StageBadge stage={app.currentStage} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => viewTimeline(app.id)}
                        className="px-2.5 py-1 text-slate-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg text-xs font-medium border border-slate-200 transition-colors flex items-center gap-1 ml-auto"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>Timeline</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Leads Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title="Assign Leads to Executive"
        subtitle={`Assigning ${selectedAppIds.length} application(s) with atomic history preservation`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target Executive</label>
            <select
              value={targetExecId}
              onChange={(e) => setTargetExecId(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg text-xs"
            >
              <option value="">Select an active executive...</option>
              {executives.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName} ({e.roles.join(', ')})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Assignment Reason / Notes</label>
            <input
              type="text"
              value={assignReason}
              onChange={(e) => setAssignReason(e.target.value)}
              placeholder="e.g. Campaign lead distribution"
              className="w-full p-2 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowAssignModal(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleAssignLeads}
              disabled={!targetExecId || assigning}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              Confirm Assignment
            </button>
          </div>
        </div>
      </Modal>

      {/* Comprehensive Application Timeline Modal */}
      <Modal
        isOpen={!!timelineData}
        onClose={() => setTimelineData(null)}
        title={`Recruitment Timeline — ${timelineData?.application?.candidate?.fullName}`}
        subtitle={`App: ${timelineData?.application?.applicationCode} | Job: ${timelineData?.application?.job?.jobTitle}`}
        maxWidth="2xl"
      >
        {timelineData && (
          <div className="space-y-6">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block font-semibold uppercase">Current Status</span>
                <div className="mt-1">
                  <StageBadge stage={timelineData.application.currentStage} />
                </div>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block font-semibold uppercase">Assigned Executive</span>
                <span className="text-xs font-bold text-slate-900">
                  {timelineData.application.assignedExecutive?.fullName || 'Unassigned'}
                </span>
              </div>
            </div>

            {/* Chronological Timeline */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
                Recruitment Event History
              </h4>
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {timelineData.timeline?.map((item: any) => (
                  <div key={item.id} className="relative group">
                    <span className="absolute -left-6 top-1 w-3 h-3 bg-teal-600 rounded-full border-2 border-white ring-2 ring-slate-100"></span>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{item.title}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(item.timestamp).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{item.description}</p>
                      <span className="text-[10px] text-slate-400 font-medium">By: {item.actor}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
