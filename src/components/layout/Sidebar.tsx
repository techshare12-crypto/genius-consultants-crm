'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  PhoneCall,
  CalendarClock,
  Users,
  Briefcase,
  Building2,
  FileCheck2,
  Send,
  BarChart3,
  Award,
  Upload,
  UserCog,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const { hasRole, hasPermission } = useAuth();

  const navItems = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      show: true,
    },
    {
      label: 'Calling Workspace',
      href: '/calling',
      icon: PhoneCall,
      show: hasPermission('calling.log'),
      badge: 'Live Queue',
    },
    {
      label: 'Callbacks Center',
      href: '/callbacks',
      icon: CalendarClock,
      show: hasPermission('callback.manage_own') || hasPermission('callback.manage_all'),
    },
    {
      label: 'Candidate Master',
      href: '/candidates',
      icon: Users,
      show: hasPermission('candidate.view_assigned') || hasPermission('candidate.view_all'),
    },
    {
      label: 'Applications Pipeline',
      href: '/applications',
      icon: Briefcase,
      show: hasPermission('application.view_own') || hasPermission('application.view_all'),
    },
    {
      label: 'Screening Center',
      href: '/screening',
      icon: FileCheck2,
      show: hasPermission('screening.view'),
    },
    {
      label: 'Client Submissions',
      href: '/submissions',
      icon: Send,
      show: hasPermission('submission.manage') || hasPermission('interview.manage'),
    },
    {
      label: 'Companies & BD',
      href: '/companies',
      icon: Building2,
      show: hasPermission('company.view'),
    },
    {
      label: 'Job Requirements',
      href: '/jobs',
      icon: Briefcase,
      show: hasPermission('job.view'),
    },
    {
      label: 'Operations Reports',
      href: '/reports',
      icon: BarChart3,
      show: hasPermission('reports.operations') || hasPermission('reports.recruitment'),
    },
    {
      label: 'Quality Management',
      href: '/quality',
      icon: Award,
      show: hasPermission('quality.review') || hasRole('EXECUTIVE'),
    },
    {
      label: 'Import Leads',
      href: '/import',
      icon: Upload,
      show: hasPermission('candidate.import'),
    },
    {
      label: 'Employee Management',
      href: '/admin/employees',
      icon: UserCog,
      show: hasPermission('user.manage') || hasPermission('user.view') || hasRole('SUPER_ADMIN'),
    },
    {
      label: 'Audit Trail',
      href: '/audit',
      icon: ShieldCheck,
      show: hasPermission('audit.view'),
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 shrink-0 select-none">
      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Operations Navigation
        </div>

        {navItems
          .filter((item) => item.show)
          .map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge ? (
                  <span className="text-[9px] bg-teal-800/80 text-teal-200 px-1.5 py-0.5 rounded font-mono font-medium">
                    {item.badge}
                  </span>
                ) : (
                  isActive && <ChevronRight className="w-3.5 h-3.5 text-teal-200" />
                )}
              </Link>
            );
          })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 text-[11px] text-slate-400 bg-slate-950/40">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-300">Genius CRM</span>
          <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">v1.1</span>
        </div>
        <p className="text-[10px] text-slate-400 mt-1">Manual External Dialing Mode</p>
      </div>
    </aside>
  );
}
