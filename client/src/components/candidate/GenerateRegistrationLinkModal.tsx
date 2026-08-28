import React, { useState } from 'react';
import { Candidate, RegistrationLink } from '../../types';
import { registrationsApi } from '../../services/api';
import { Modal } from '../common/Modal';
import { getWhatsAppUrl } from '../../utils/helpers';
import { Link2, Copy, Check, MessageSquare, ExternalLink, ShieldCheck, Sparkles } from 'lucide-react';

interface GenerateRegistrationLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate | null;
  onSuccess?: (link: RegistrationLink) => void;
}

export const GenerateRegistrationLinkModal: React.FC<GenerateRegistrationLinkModalProps> = ({
  isOpen,
  onClose,
  candidate,
  onSuccess,
}) => {
  const [validityDays, setValidityDays] = useState<number>(7);
  const [generating, setGenerating] = useState<boolean>(false);
  const [generatedLink, setGeneratedLink] = useState<any>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const handleGenerate = async () => {
    if (!candidate) return;
    setGenerating(true);
    try {
      const res = await registrationsApi.generateLink({
        candidateId: candidate.id,
        validityDays,
      });
      setGeneratedLink(res.data.link);
      if (onSuccess) onSuccess(res.data.link);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to generate link');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppSend = () => {
    if (!candidate || !generatedLink) return;
    const msg = `Dear ${candidate.name}, greetings from Genius Consultants. Please complete your registration and upload your updated CV through this secure portal link: ${generatedLink.url} (Valid for ${validityDays} days).`;
    const waUrl = getWhatsAppUrl(candidate.whatsappNumber || candidate.primaryPhone, msg);
    window.open(waUrl, '_blank');
  };

  if (!candidate) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      title="Generate Candidate Self-Service Registration Link"
    >
      <div className="space-y-4 text-xs">
        {/* Context Card */}
        <div className="p-3.5 bg-blue-50 rounded-2xl border border-blue-200 flex items-center justify-between">
          <div>
            <div className="font-bold text-slate-900">{candidate.name} ({candidate.displaySlNo})</div>
            <div className="text-[11px] text-blue-800 font-mono">Mobile: {candidate.primaryPhone}</div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-blue-200/70 text-blue-900 font-bold text-[10px]">
            Zero-Password Auth
          </span>
        </div>

        {!generatedLink ? (
          <div className="space-y-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Token Validity Duration</label>
              <select
                value={validityDays}
                onChange={(e) => setValidityDays(parseInt(e.target.value, 10))}
                className="w-full p-2.5 border border-slate-200 rounded-xl bg-white font-semibold text-slate-800"
              >
                <option value={3}>3 Days (Urgent Requirements)</option>
                <option value={7}>7 Days (Standard Portal Access)</option>
                <option value={14}>14 Days (Extended Drive)</option>
                <option value={30}>30 Days (Campus / Bulk Pool)</option>
              </select>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] text-slate-600 space-y-1">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Security & Privacy Safeguard:</span>
              </div>
              <p>
                The candidate will receive a cryptographically random access token. No CRM login required.
                Candidate profile changes enter a review queue before merging into Master.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 active:scale-95 transition"
              >
                <Sparkles className="w-4 h-4" />
                <span>{generating ? 'Generating Link...' : 'Generate Secure Token Link'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            {/* Generated Link Display */}
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700">Public Registration Link</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedLink.url}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-800 select-all"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center gap-1 transition flex-shrink-0"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={handleWhatsAppSend}
                className="p-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition active:scale-95"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Send via WhatsApp</span>
              </button>

              <a
                href={generatedLink.url}
                target="_blank"
                rel="noreferrer"
                className="p-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition active:scale-95"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Public Portal</span>
              </a>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 border border-slate-200 hover:bg-slate-50 font-bold rounded-xl text-slate-700"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
