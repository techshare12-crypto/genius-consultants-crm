'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Lock, Mail, ArrowRight, Shield, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);
    if (!result.success) {
      setError(result.error || 'Failed to login');
      setLoading(false);
    }
  };

  const setTestAccount = (testEmail: string) => {
    setEmail(testEmail);
    setPassword('Password@123');
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-950 p-8 text-center border-b border-slate-800">
          <div className="w-12 h-12 bg-teal-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl mx-auto shadow-lg shadow-teal-500/20">
            G
          </div>
          <h2 className="text-xl font-bold text-white mt-4 tracking-tight">GENIUS CONSULTANCY</h2>
          <p className="text-xs text-slate-400 mt-1 font-medium">Internal Recruitment Operations Portal</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Official Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@geniusconsultancy.com"
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <span>Sign in to CRM</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* 1-Click Role Fill Buttons for Quick Testing */}
        <div className="bg-slate-50 p-6 border-t border-slate-100 text-center">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
            Quick Test Logins (Development Seed)
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setTestAccount('admin@geniusconsultancy.com')}
              className="p-2 bg-white hover:bg-teal-50 hover:text-teal-700 border border-slate-200 rounded-lg text-left transition-colors"
            >
              <div className="font-bold text-slate-900 text-[11px]">Super Admin (Mj)</div>
              <div className="text-[10px] text-slate-400">Full Access</div>
            </button>

            <button
              type="button"
              onClick={() => setTestAccount('ops@geniusconsultancy.com')}
              className="p-2 bg-white hover:bg-teal-50 hover:text-teal-700 border border-slate-200 rounded-lg text-left transition-colors"
            >
              <div className="font-bold text-slate-900 text-[11px]">Operations Head</div>
              <div className="text-[10px] text-slate-400">Lead Assign & Quality</div>
            </button>

            <button
              type="button"
              onClick={() => setTestAccount('jyoti@geniusconsultancy.com')}
              className="p-2 bg-white hover:bg-teal-50 hover:text-teal-700 border border-slate-200 rounded-lg text-left transition-colors"
            >
              <div className="font-bold text-slate-900 text-[11px]">Jyoti Khandelwal</div>
              <div className="text-[10px] text-slate-400">Screening + Executive</div>
            </button>

            <button
              type="button"
              onClick={() => setTestAccount('rahul@geniusconsultancy.com')}
              className="p-2 bg-white hover:bg-teal-50 hover:text-teal-700 border border-slate-200 rounded-lg text-left transition-colors"
            >
              <div className="font-bold text-slate-900 text-[11px]">Rahul Sharma</div>
              <div className="text-[10px] text-slate-400">Executive Calling</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
