import React, { useState, useEffect } from 'react';
import { Candidate, JobOrder, MessageTemplate } from '../../types';
import { communicationsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../common/Modal';
import { MessageSquare, Send, Copy, ExternalLink, Check, Sparkles } from 'lucide-react';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate | null;
  jobOrder?: JobOrder | null;
  onSuccess?: () => void;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  candidate,
  jobOrder,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [messageText, setMessageText] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    try {
      const res = await communicationsApi.getTemplates();
      setTemplates(res.data.templates || []);
      if (res.data.templates.length > 0) {
        applyTemplate(res.data.templates[0]);
      }
    } catch (err) {
      console.error('Failed to load message templates:', err);
    }
  };

  const applyTemplate = (template: MessageTemplate) => {
    setSelectedTemplateId(template.id);
    if (!candidate) return;

    let text = template.bodyText;
    const vars: Record<string, string> = {
      candidateName: candidate.name,
      jobTitle: jobOrder?.jobTitle || 'Sales Executive Opening',
      companyName: jobOrder?.client?.companyName || 'Corporate Client',
      jobLocation: jobOrder?.jobLocation || candidate.currentLocation || 'Delhi NCR',
      salary: jobOrder?.minSalary && jobOrder?.maxSalary
        ? `₹${(jobOrder.minSalary / 100000).toFixed(1)}L - ${(jobOrder.maxSalary / 100000).toFixed(1)}L`
        : 'Negotiable',
      interviewDate: new Date().toISOString().slice(0, 10),
      interviewTime: '11:00 AM',
      registrationFormLink: 'https://geniusconsultants.com/register/GC-2026',
      executiveName: user?.name || 'Genius Recruitment Team',
    };

    for (const [key, val] of Object.entries(vars)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      text = text.replace(regex, val);
    }

    setMessageText(text);
  };

  const handleTemplateChange = (templateId: string) => {
    const t = templates.find((item) => item.id === templateId);
    if (t) {
      applyTemplate(t);
    }
  };

  const handleSend = async () => {
    if (!candidate || !messageText) return;
    setLoading(true);
    try {
      const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
      const res = await communicationsApi.sendWhatsApp({
        candidateId: candidate.id,
        templateId: selectedTemplateId || undefined,
        customMessage: messageText,
        jobOrderId: jobOrder?.id || undefined,
        clientId: jobOrder?.clientId || undefined,
        communicationType: selectedTemplate?.category || 'CUSTOM',
      });

      // Open WhatsApp Web
      if (res.data.whatsAppUrl) {
        window.open(res.data.whatsAppUrl, '_blank', 'noopener,noreferrer');
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to initiate WhatsApp message');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!candidate) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      title="Click-to-WhatsApp Candidate"
    >
      <div className="space-y-4 text-xs">
        {/* Candidate & Job Context Banner */}
        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
              WA
            </div>
            <div>
              <div className="font-bold text-slate-900">
                {candidate.name} ({candidate.primaryPhone})
              </div>
              <div className="text-[11px] text-emerald-800">
                {jobOrder ? `Context: ${jobOrder.jobTitle} @ ${jobOrder.client?.companyName || 'Client'}` : 'Direct Candidate Sourcing'}
              </div>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded bg-emerald-200/80 text-emerald-900 font-bold text-[10px]">
            Delivery: Initiated
          </span>
        </div>

        {/* Template Selector */}
        <div>
          <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Select Message Template</span>
          </label>
          <select
            value={selectedTemplateId}
            onChange={(e) => handleTemplateChange(e.target.value)}
            className="w-full p-2.5 border border-slate-200 rounded-xl bg-white font-semibold text-slate-800 shadow-sm"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                [{t.category}] {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Dynamic Message Preview & Editor */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="font-bold text-slate-700">Message Preview & Customization</label>
            <button
              type="button"
              onClick={handleCopy}
              className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 font-semibold"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied!' : 'Copy Text'}</span>
            </button>
          </div>
          <textarea
            rows={5}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-sans text-xs leading-relaxed focus:bg-white transition"
          />
          <p className="text-[10px] text-slate-400 mt-1">
            * Variables like candidate name, job title, and salary are automatically populated. You may tweak before launching.
          </p>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="text-[11px] text-slate-400 font-mono">
            WhatsApp Web / Mobile API
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-500/20 active:scale-95 transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{loading ? 'Launching...' : 'Open in WhatsApp & Log Activity'}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
