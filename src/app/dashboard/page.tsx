'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { StatCard } from '@/components/common/StatCard';
import { PresenceBadge, StageBadge } from '@/components/common/Badge';
import {
  PhoneCall,
  PhoneForwarded,
  UserCheck,
  FileCheck,
  Send,
  CheckCircle2,
  Users,
  Activity,
  ArrowUpRight,
  Clock,
  Briefcase,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [resReport, resTeam] = await Promise.all([
        fetch('/api/reports/overview'),
        fetch('/api/reports/executives'),
      ]);

      if (resReport.ok) {
        const d = await resReport.json();
        setData(d.data);
      }
      if (resTeam.ok) {
        const t = await resTeam.json();
        setTeam(t.data);
      }
    } catch (err) {
      console.error('Error fetching dashboard', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  const calling = data?.calling || {};
  const pipeline = data?.pipeline || {};
  const conversions = data?.conversions || {};

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider">
            OPERATIONS COMMAND CENTER
          </span>
          <h2 className="text-xl font-bold mt-1">Welcome back, {user?.fullName}</h2>
          <p className="text-xs text-slate-400 mt-1">
            Recruitment pipeline overview, calling throughput, and live team presence.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/calling"
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <PhoneCall className="w-4 h-4" />
            <span>Open Calling Station</span>
          </Link>
          <Link
            href="/screening"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <FileCheck className="w-4 h-4" />
            <span>Screening Queue</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Assigned Leads"
          value={pipeline.totalAssigned || 0}
          subtitle={`Across ${pipeline.totalApplications || 0} total applications`}
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Calling Attempts"
          value={calling.totalAttempts || 0}
          subtitle={`${calling.connectedCalls || 0} connected calls`}
          icon={PhoneCall}
          color="teal"
        />
        <StatCard
          title="Shortlisted Candidates"
          value={pipeline.screeningPending + pipeline.screeningPassed + pipeline.finalShortlist || 0}
          subtitle={`${pipeline.cvReceived || 0} CVs verified`}
          icon={UserCheck}
          color="purple"
        />
        <StatCard
          title="Final Joined Placements"
          value={pipeline.joined || 0}
          subtitle={`${pipeline.selected || 0} selected / pending joining`}
          icon={CheckCircle2}
          color="emerald"
        />
      </div>

      {/* Conversion Funnel Metrics */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-teal-600" />
          <span>Dynamic Recruitment Conversion Rates (Real Database Metrics)</span>
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Connection Rate</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{conversions.connectionRate?.value || 0}%</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {conversions.connectionRate?.numerator} / {conversions.connectionRate?.denominator} calls
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Interest Rate</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{conversions.interestRate?.value || 0}%</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {conversions.interestRate?.numerator} / {conversions.interestRate?.denominator} connected
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Shortlist Rate</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{conversions.shortlistRate?.value || 0}%</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {conversions.shortlistRate?.numerator} / {conversions.shortlistRate?.denominator} connected
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Screening Pass Rate</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{conversions.screeningPassRate?.value || 0}%</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {conversions.screeningPassRate?.numerator} / {conversions.screeningPassRate?.denominator} forms
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Selection Rate</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{conversions.selectionRate?.value || 0}%</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {conversions.selectionRate?.numerator} / {conversions.selectionRate?.denominator} interviewed
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Joining Rate</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">{conversions.joiningRate?.value || 0}%</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {conversions.joiningRate?.numerator} / {conversions.joiningRate?.denominator} selected
            </p>
          </div>
        </div>
      </div>

      {/* Live Team Status & Calling Operations Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Live Team Activity & Daily Performance</h3>
            <p className="text-xs text-slate-500">
              Real-time CRM activity state, calling output, conversion rate, and quality reviews.
            </p>
          </div>
          <Link
            href="/reports"
            className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
          >
            <span>Full Reports</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Executive</th>
                <th className="py-3 px-4">CRM Presence</th>
                <th className="py-3 px-4 text-center">Assigned</th>
                <th className="py-3 px-4 text-center">Calls</th>
                <th className="py-3 px-4 text-center">Connected</th>
                <th className="py-3 px-4 text-center">Callbacks</th>
                <th className="py-3 px-4 text-center">Shortlisted</th>
                <th className="py-3 px-4 text-center">Conversion</th>
                <th className="py-3 px-4 text-center">Quality Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {team.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    <div>{m.name}</div>
                    <div className="text-[11px] text-slate-400 font-normal">{m.email}</div>
                  </td>
                  <td className="py-3 px-4">
                    <PresenceBadge status={m.presenceStatus} />
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-slate-700">{m.assignedLeads}</td>
                  <td className="py-3 px-4 text-center font-semibold text-slate-900">{m.totalCalls}</td>
                  <td className="py-3 px-4 text-center text-teal-600 font-semibold">{m.connected}</td>
                  <td className="py-3 px-4 text-center text-amber-600 font-semibold">{m.callbacks}</td>
                  <td className="py-3 px-4 text-center text-purple-600 font-semibold">{m.shortlisted}</td>
                  <td className="py-3 px-4 text-center font-bold text-slate-900">{m.conversionRate}%</td>
                  <td className="py-3 px-4 text-center">
                    <span className="font-semibold px-2 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200">
                      ★ {m.qualityRating}
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
