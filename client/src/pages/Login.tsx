import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, PhoneCall, Lock, Mail, ArrowRight, UserCheck } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const isDev = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_LOGINS === 'true';
  const [email, setEmail] = useState<string>(isDev ? 'priya@genius.com' : '');
  const [password, setPassword] = useState<string>(isDev ? 'Exec@123' : '');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setLoading(true);
    setError(null);
    try {
      await login(demoEmail, demoPass);
    } catch {
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background glowing gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative z-10 animate-scale-in">
        {/* Brand Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 text-white text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-500/30">
            GC
          </div>
          <h1 className="text-xl font-black tracking-tight">GENIUS CONSULTANTS</h1>
          <p className="text-xs text-slate-300">
            Telecalling Operations Portal & Candidate CRM
          </p>
          <div className="pt-2">
            <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 font-mono text-[11px] font-semibold border border-blue-400/30">
              Permanent Candidate ID Engine
            </span>
          </div>
        </div>

        {/* Login Form */}
        <div className="p-8 space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@genius.com"
                  className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/25 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Portal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* 1-Click Quick Demo Switcher (Visible in Development or when explicitly enabled) */}
          {isDev && (
            <div className="pt-4 border-t border-slate-100 space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-center">
                1-Click Demo Login Roles (Dev Mode)
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('priya@genius.com', 'Exec@123')}
                  className="p-2.5 rounded-xl border border-slate-200 hover:bg-blue-50/60 hover:border-blue-300 text-left transition"
                >
                  <div className="font-bold text-xs text-slate-800 flex items-center gap-1">
                    <PhoneCall className="w-3 h-3 text-emerald-600" /> Priya S.
                  </div>
                  <div className="text-[10px] text-slate-500">Telecaller Executive</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('manager@genius.com', 'Manager@123')}
                  className="p-2.5 rounded-xl border border-slate-200 hover:bg-blue-50/60 hover:border-blue-300 text-left transition"
                >
                  <div className="font-bold text-xs text-slate-800 flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-blue-600" /> Rohan D.
                  </div>
                  <div className="text-[10px] text-slate-500">Admin / Manager</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('admin@genius.com', 'Admin@123')}
                  className="col-span-2 p-2.5 rounded-xl border border-slate-200 hover:bg-purple-50/60 hover:border-purple-300 text-left transition"
                >
                  <div className="font-bold text-xs text-slate-800 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-purple-600" /> Dr. Vikash Sengupta
                  </div>
                  <div className="text-[10px] text-slate-500">Super Admin (All Permissions)</div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
