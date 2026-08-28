import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  PhoneCall,
  Clock,
  Star,
  CalendarCheck,
  Award,
  UploadCloud,
  UserPlus,
  FileSpreadsheet,
  History,
  ShieldCheck,
  Building2,
  Briefcase,
  UsersRound,
  MessageSquare,
  FileText,
  LucideIcon,
} from 'lucide-react';

export type NavTab =
  | 'DASHBOARD'
  | 'CANDIDATES'
  | 'MY_LEADS'
  | 'IMPORT'
  | 'ASSIGNMENTS'
  | 'CALLING_WORKSPACE'
  | 'CALLBACKS'
  | 'SHORTLISTED'
  | 'CLIENTS'
  | 'JOB_ORDERS'
  | 'COMMUNICATIONS'
  | 'DOCUMENTS'
  | 'TEAM_DASHBOARD'
  | 'USER_MANAGEMENT'
  | 'DAILY_TRACKER'
  | 'PERFORMANCE'
  | 'REPORTS'
  | 'ACTIVITY_LOGS';

interface NavItem {
  id: NavTab;
  label: string;
  icon: LucideIcon;
  highlight?: boolean;
  highlightAdmin?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { user } = useAuth();
  const isExec = user?.role === 'EXECUTIVE';
  const isTeamLeader = user?.role === 'TEAM_LEADER';
  const isAdminOrSuper = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const navSections: NavSection[] = [
    {
      title: 'OPERATIONS',
      items: [
        { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'CALLING_WORKSPACE', label: 'Calling Workspace', icon: PhoneCall, highlight: true },
        { id: 'SHORTLISTED', label: 'Shortlisted Processing', icon: Star, highlight: true },
        { id: 'CALLBACKS', label: 'Callback Center', icon: Clock },
        { id: 'CANDIDATES', label: 'Candidate Master', icon: Users },
        { id: 'MY_LEADS', label: 'My Assigned Leads', icon: UserCheck },
        ...(!isExec ? [
          { id: 'IMPORT' as NavTab, label: 'Import Leads (Excel/CSV)', icon: UploadCloud },
          { id: 'ASSIGNMENTS' as NavTab, label: 'Lead Assignment', icon: UserPlus },
        ] : []),
      ],
    },
    {
      title: 'COMPANIES & REQUIREMENTS',
      items: [
        { id: 'CLIENTS', label: 'Corporate Clients', icon: Building2 },
        { id: 'JOB_ORDERS', label: 'Job Requirements / Vacancies', icon: Briefcase },
      ],
    },
    {
      title: 'COMMUNICATION & DOCS',
      items: [
        { id: 'COMMUNICATIONS' as NavTab, label: 'WhatsApp & Outreach', icon: MessageSquare },
        { id: 'DOCUMENTS' as NavTab, label: 'Document & CV Center', icon: FileSpreadsheet },
      ],
    },
    ...((isTeamLeader || isAdminOrSuper) ? [
      {
        title: 'TEAM MANAGEMENT',
        items: [
          { id: 'TEAM_DASHBOARD' as NavTab, label: 'Team Leader Hub', icon: UsersRound, highlightAdmin: true },
          ...(isAdminOrSuper ? [
            { id: 'USER_MANAGEMENT' as NavTab, label: 'User & RBAC Portal', icon: ShieldCheck, highlightAdmin: true },
          ] : []),
        ],
      },
    ] : []),
    {
      title: 'REPORTS & EXPORTS',
      items: [
        { id: 'DAILY_TRACKER', label: 'Daily Calling Tracker', icon: CalendarCheck },
        { id: 'PERFORMANCE', label: 'Executive Performance', icon: Award },
        { id: 'REPORTS', label: 'Operations Reports', icon: FileText },
      ],
    },
    {
      title: 'SYSTEM',
      items: [
        { id: 'ACTIVITY_LOGS', label: 'Audit Logs', icon: History },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-[calc(100vh-4rem)] border-r border-slate-800 select-none">
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {navSections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            <h3 className="px-3 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
              {section.title}
            </h3>
            <div className="space-y-0.5 mt-1">
              {section.items.map((item) => {
                const isActive = currentTab === item.id;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold'
                        : item.highlight
                        ? 'text-emerald-400 hover:bg-slate-800/80 hover:text-emerald-300 font-bold'
                        : item.highlightAdmin
                        ? 'text-indigo-300 hover:bg-slate-800 hover:text-white'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive
                          ? 'text-white'
                          : item.highlight
                          ? 'text-emerald-400'
                          : item.highlightAdmin
                          ? 'text-indigo-400'
                          : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800/60 text-center">
        <div className="text-[10px] text-slate-500 font-medium">
          Genius Consultants • Telecalling Operations
        </div>
      </div>
    </aside>
  );
};
