import React, { useState, useEffect } from 'react';
import { MessageTemplate, CommunicationActivity, CandidateFormTracking, CommunicationReminder } from '../types';
import { communicationsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatDateTime, formatDate, formatPhone } from '../utils/helpers';
import { Modal } from '../components/common/Modal';
import {
  MessageSquare,
  Send,
  Sparkles,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Edit2,
  Search,
  Filter,
  ExternalLink,
  Layers,
  TrendingUp,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';

export const CommunicationsCenter: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'TEMPLATES' | 'STREAM' | 'FORMS' | 'REMINDERS'>('TEMPLATES');
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Template Modal
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [templateName, setTemplateName] = useState<string>('');
  const [templateCategory, setTemplateCategory] = useState<string>('JOB_OPPORTUNITY');
  const [templateSubject, setTemplateSubject] = useState<string>('');
  const [templateBody, setTemplateBody] = useState<string>('');

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  const fetchCommunicationsData = async () => {
    setLoading(true);
    try {
      const [templRes, analRes] = await Promise.all([
        communicationsApi.getTemplates({ category: selectedCategoryFilter }),
        communicationsApi.getAnalytics(),
      ]);
      setTemplates(templRes.data.templates || []);
      setAnalytics(analRes.data);
    } catch (err) {
      console.error('Failed to load communications data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunicationsData();
  }, [selectedCategoryFilter]);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await communicationsApi.createTemplate({
        name: templateName,
        category: templateCategory,
        subject: templateSubject,
        bodyText: templateBody,
        variables: 'candidateName, jobTitle, companyName, salary, jobLocation, interviewDate, interviewTime, registrationFormLink, executiveName',
      });
      setCreateModalOpen(false);
      setTemplateName('');
      setTemplateSubject('');
      setTemplateBody('');
      fetchCommunicationsData();
      alert('Message Template created successfully.');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create template');
    }
  };

  const handleInsertVariable = (varName: string) => {
    setTemplateBody((prev) => `${prev} {{${varName}}}`);
  };

  const isSuperOrAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-semibold text-xs border border-emerald-500/30 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              WhatsApp & Candidate Communication Center
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Live Messaging Hub
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-1">
            Communication & Outreach Management
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            Admin-managed WhatsApp message templates, variable injection engine, registration form tracking, and CV follow-up reminders.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {isSuperOrAdmin && (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs shadow-md shadow-emerald-500/20 transition active:scale-95 text-white"
            >
              <Plus className="w-4 h-4" />
              <span>+ Create Message Template</span>
            </button>
          )}

          <button
            onClick={fetchCommunicationsData}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Telemetry Counter Strip */}
      {analytics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="text-[10px] text-slate-400 uppercase font-bold">WhatsApp Initiated Today</div>
            <div className="text-xl font-black text-emerald-700 mt-1">{analytics.today.whatsAppInitiated}</div>
          </div>
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Registration Forms Sent</div>
            <div className="text-xl font-black text-blue-700 mt-1">{analytics.today.formsSent}</div>
          </div>
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Forms Pending Completion</div>
            <div className="text-xl font-black text-amber-600 mt-1">{analytics.today.formsPending}</div>
          </div>
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="text-[10px] text-slate-400 uppercase font-bold">CV Requests Sent</div>
            <div className="text-xl font-black text-purple-700 mt-1">{analytics.today.cvRequestsSent}</div>
          </div>
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 shadow-sm">
            <div className="text-[10px] text-rose-700 uppercase font-bold">Reminders Due</div>
            <div className="text-xl font-black text-rose-800 mt-1">{analytics.today.remindersDue}</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-sm">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Total Month Communications</div>
            <div className="text-xl font-black text-emerald-400 mt-1">{analytics.month.totalCommunications}</div>
          </div>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          {[
            { id: 'TEMPLATES', label: `WhatsApp Templates (${templates.length})`, icon: MessageSquare },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">Filter Category:</span>
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="p-1.5 border border-slate-200 rounded-xl bg-white text-xs font-bold text-slate-800"
          >
            <option value="ALL">All Categories</option>
            <option value="GENERAL_INTRO">General Introduction</option>
            <option value="JOB_OPPORTUNITY">Job Opportunity</option>
            <option value="REGISTRATION_FORM">Registration Form</option>
            <option value="CV_REQUEST">CV Request</option>
            <option value="CALLBACK_REMINDER">Callback Reminder</option>
            <option value="INTERVIEW_INVITATION">Interview Invitation</option>
            <option value="INTERVIEW_REMINDER">Interview Reminder</option>
            <option value="SELECTION_UPDATE">Selection Update</option>
            <option value="JOINING_REMINDER">Joining Reminder</option>
          </select>
        </div>
      </div>

      {/* TAB 1: MESSAGE TEMPLATES */}
      {activeTab === 'TEMPLATES' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md p-5 flex flex-col justify-between space-y-4 transition"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold text-[10px] uppercase border border-emerald-200">
                    {tpl.category.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formatDate(tpl.createdAt)}
                  </span>
                </div>

                <h3 className="font-bold text-sm text-slate-900 leading-snug">{tpl.name}</h3>

                {tpl.subject && (
                  <div className="text-xs font-semibold text-blue-700">
                    Subject: {tpl.subject}
                  </div>
                )}

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 font-sans leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto">
                  {tpl.bodyText}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Active Variable Tags</span>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                  Auto-Injected
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE TEMPLATE MODAL */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        maxWidth="md"
        title="Create New WhatsApp Message Template"
      >
        <form onSubmit={handleCreateTemplate} className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Template Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Maruti Arena - Sales Advisor Opening Pitch"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="w-full p-2.5 border rounded-xl font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Category *</label>
              <select
                value={templateCategory}
                onChange={(e) => setTemplateCategory(e.target.value)}
                className="w-full p-2.5 border rounded-xl bg-white font-semibold"
              >
                <option value="JOB_OPPORTUNITY">Job Opportunity</option>
                <option value="GENERAL_INTRO">General Introduction</option>
                <option value="REGISTRATION_FORM">Registration Form</option>
                <option value="CV_REQUEST">CV Request</option>
                <option value="CALLBACK_REMINDER">Callback Reminder</option>
                <option value="INTERVIEW_INVITATION">Interview Invitation</option>
                <option value="INTERVIEW_REMINDER">Interview Reminder</option>
                <option value="SELECTION_UPDATE">Selection Update</option>
                <option value="JOINING_REMINDER">Joining Reminder</option>
                <option value="CUSTOM">Custom Template</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Subject Header</label>
              <input
                type="text"
                placeholder="e.g. Opportunity from Genius Consultants"
                value={templateSubject}
                onChange={(e) => setTemplateSubject(e.target.value)}
                className="w-full p-2.5 border rounded-xl"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-bold text-slate-700">Message Body (WhatsApp Text) *</label>
              <span className="text-[10px] text-slate-400">Click below to insert dynamic variables:</span>
            </div>

            {/* Quick Variable Insert Badges */}
            <div className="flex flex-wrap gap-1 mb-2">
              {[
                'candidateName',
                'jobTitle',
                'companyName',
                'jobLocation',
                'salary',
                'interviewDate',
                'interviewTime',
                'registrationFormLink',
                'executiveName',
              ].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => handleInsertVariable(v)}
                  className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-mono text-[10px] border border-blue-200 transition"
                >
                  +{`{{${v}}}`}
                </button>
              ))}
            </div>

            <textarea
              rows={5}
              required
              placeholder="e.g. Dear {{candidateName}}, we have an urgent opening for *{{jobTitle}}* at *{{companyName}}* in *{{jobLocation}}* with salary *{{salary}}*..."
              value={templateBody}
              onChange={(e) => setTemplateBody(e.target.value)}
              className="w-full p-3 border rounded-xl font-sans leading-relaxed"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button type="button" onClick={() => setCreateModalOpen(false)} className="px-3.5 py-2 border rounded-xl">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow">Save Template</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
