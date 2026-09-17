'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { PresenceBadge } from '@/components/common/Badge';
import { LogOut, Bell, User, PhoneCall, Shield, Activity, ChevronDown } from 'lucide-react';

export function Navbar() {
  const { user, logout, updatePresence } = useAuth();
  const [presenceDropdown, setPresenceDropdown] = useState(false);

  if (!user) return null;

  const presenceOptions = [
    { value: 'ACTIVE', label: 'Active', desc: 'Available for work' },
    { value: 'CALLING_ACTIVITY', label: 'Calling Session', desc: 'Working in Calling Station' },
    { value: 'AFTER_CALL_WORK', label: 'After Call Work', desc: 'Updating logs / notes' },
    { value: 'IDLE', label: 'Idle', desc: 'Away briefly' },
    { value: 'BREAK', label: 'Break', desc: 'Lunch / Tea break' },
  ];

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-30 sticky top-0">
      {/* Brand / Context Title */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">
          G
        </div>
        <div>
          <h1 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            GENIUS CONSULTANCY
            <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded border border-slate-200 uppercase">
              Internal CRM
            </span>
          </h1>
          <p className="text-[11px] text-slate-500 font-medium">Recruitment Operations & Telecalling System</p>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Presence Status Selector */}
        <div className="relative">
          <button
            onClick={() => setPresenceDropdown(!presenceDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium transition-colors"
          >
            <span className="text-slate-500 text-[11px]">CRM Status:</span>
            <PresenceBadge status={user.presenceStatus} />
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {presenceDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50">
              <div className="px-3 py-1 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Set CRM Activity Status
              </div>
              {presenceOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    updatePresence(opt.value);
                    setPresenceDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex flex-col transition-colors"
                >
                  <span className="text-xs font-semibold text-slate-800">{opt.label}</span>
                  <span className="text-[10px] text-slate-400">{opt.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User Badge */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div className="text-right">
            <p className="text-xs font-bold text-slate-900 leading-tight">{user.fullName}</p>
            <p className="text-[10px] text-teal-600 font-semibold tracking-tight">{user.roles.join(', ')}</p>
          </div>
          <button
            onClick={logout}
            title="Logout"
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
