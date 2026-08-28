import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import {
  PhoneCall,
  LogOut,
  Shield,
  ChevronDown,
  Bell,
  Check,
  CheckCheck,
  Clock,
  UserCheck,
  Award,
  Calendar,
  Send,
  MessageSquare,
} from 'lucide-react';
import { formatDateTime } from '../../utils/helpers';

interface NavbarProps {
  onOpenQuickCall?: () => void;
  onNavigate?: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenQuickCall, onNavigate }) => {
  const { user, logout, switchUser } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [notifDropdownOpen, setNotifDropdownOpen] = useState<boolean>(false);

  const demoUsers = [
    { email: 'admin@genius.com', name: 'Dr. Vikash Sengupta', role: 'Super Admin', badge: 'bg-purple-100 text-purple-800' },
    { email: 'manager@genius.com', name: 'Rohan Deshmukh', role: 'Manager / Admin', badge: 'bg-blue-100 text-blue-800' },
    { email: 'priya@genius.com', name: 'Priya Sharma', role: 'Telecaller (Exec)', badge: 'bg-emerald-100 text-emerald-800' },
    { email: 'rahul@genius.com', name: 'Rahul Verma', role: 'Team Leader', badge: 'bg-amber-100 text-amber-800' },
    { email: 'amit@genius.com', name: 'Amit Patel', role: 'Telecaller (Exec)', badge: 'bg-emerald-100 text-emerald-800' },
  ];

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'LEAD_ASSIGNED':
      case 'LEAD_REASSIGNED':
        return <UserCheck className="w-3.5 h-3.5 text-blue-500" />;
      case 'CANDIDATE_SHORTLISTED':
        return <Award className="w-3.5 h-3.5 text-sky-500" />;
      case 'INTERVIEW_SCHEDULED':
        return <Calendar className="w-3.5 h-3.5 text-purple-500" />;
      case 'CV_SUBMITTED':
        return <Send className="w-3.5 h-3.5 text-emerald-500" />;
      case 'COACHING_NOTE':
        return <MessageSquare className="w-3.5 h-3.5 text-amber-500" />;
      case 'CALLBACK_OVERDUE':
      case 'CALLBACK_DUE':
        return <Clock className="w-3.5 h-3.5 text-rose-500" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-900 text-white font-bold text-lg shadow-md shadow-blue-500/20">
          GC
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-slate-900 tracking-tight text-base sm:text-lg">
              GENIUS CONSULTANTS
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 rounded border border-blue-200/80">
              Operations Portal
            </span>
          </div>
          <p className="text-xs text-slate-500 hidden sm:block">
            Recruitment CRM • Team Leader Workflow • Real-Time Engine
          </p>
        </div>
      </div>

      {/* Center / Right controls */}
      <div className="flex items-center gap-3">
        {/* Quick Role / User Switcher */}
        <div className="relative group">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition">
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            <span>Switch Role / User</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
          
          <div className="absolute right-0 mt-1 w-64 p-2 bg-white rounded-xl shadow-xl border border-slate-200 hidden group-hover:block z-50 animate-scale-in">
            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Select Demo Role / User
            </div>
            <div className="space-y-1 mt-1">
              {demoUsers.map((u) => (
                <button
                  key={u.email}
                  onClick={() => switchUser(u.email)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition ${
                    user?.email === u.email ? 'bg-blue-50 text-blue-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-medium">{u.name}</div>
                    <div className="text-[11px] text-slate-500">{u.role}</div>
                  </div>
                  {user?.email === u.email && (
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Real-time Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
            className="relative p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
            title="Notifications"
          >
            <Bell className={`w-4 h-4 ${unreadCount > 0 ? 'text-blue-600 animate-bounce' : ''}`} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-bold text-[9px] min-w-[18px] text-center shadow">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown Preview */}
          {notifDropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-scale-in">
              <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-sky-400" />
                  <span className="font-bold text-xs">Notifications ({unreadCount} new)</span>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[11px] text-sky-300 hover:underline flex items-center gap-1 font-medium"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 text-xs">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (!n.isRead) markAsRead(n.id);
                        if (n.entityType === 'TEAM' && onNavigate) onNavigate('TEAM_DASHBOARD');
                        if (n.entityType === 'CANDIDATE' && onNavigate) onNavigate('CANDIDATES');
                        if (n.entityType === 'JOB_ORDER' && onNavigate) onNavigate('JOB_ORDERS');
                      }}
                      className={`p-3.5 flex items-start gap-3 cursor-pointer transition ${
                        !n.isRead ? 'bg-blue-50/70 hover:bg-blue-50' : 'hover:bg-slate-50 opacity-80'
                      }`}
                    >
                      <div className="p-2 rounded-xl bg-white border border-slate-200 shadow-sm flex-shrink-0 mt-0.5">
                        {getNotificationIcon(n.type)}
                      </div>
                      <div className="flex-1 space-y-0.5">
                        <div className="font-bold text-slate-900 flex items-center justify-between">
                          <span>{n.title}</span>
                          {!n.isRead && (
                            <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 leading-snug">{n.message}</p>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {formatDateTime(n.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Start Calling Workspace Button */}
        {onOpenQuickCall && (
          <button
            onClick={onOpenQuickCall}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-sm transition active:scale-95"
          >
            <PhoneCall className="w-3.5 h-3.5 animate-pulse" />
            <span className="hidden sm:inline">Start Calling</span>
          </button>
        )}

        {/* User profile dropdown & logout */}
        {user && (
          <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-slate-800 text-white font-medium flex items-center justify-center text-xs shadow-inner">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-xs font-semibold text-slate-800 truncate max-w-[120px]">
                  {user.name}
                </div>
                <div className="text-[10px] font-medium text-slate-500 uppercase">
                  {user.role}
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
