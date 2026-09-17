import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({ children, variant = 'default', size = 'sm', className = '' }: BadgeProps) {
  const variantStyles = {
    default: 'bg-teal-50 text-teal-700 border-teal-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs font-medium',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-md border ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StageBadge({ stage }: { stage: string }) {
  let variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral' = 'neutral';

  switch (stage) {
    case 'NEW':
      variant = 'neutral';
      break;
    case 'ASSIGNED':
      variant = 'info';
      break;
    case 'CALLING':
      variant = 'warning';
      break;
    case 'INTERESTED':
      variant = 'default';
      break;
    case 'SHORTLISTED':
      variant = 'purple';
      break;
    case 'SCREENING_PENDING':
    case 'SCREENING_IN_PROGRESS':
      variant = 'warning';
      break;
    case 'SCREENING_PASSED':
    case 'FINAL_SHORTLIST':
      variant = 'purple';
      break;
    case 'SCREENING_FAILED':
    case 'REJECTED':
    case 'NOT_JOINED':
      variant = 'danger';
      break;
    case 'SENT_TO_CLIENT':
    case 'INTERVIEW_SCHEDULED':
      variant = 'info';
      break;
    case 'SELECTED':
    case 'JOINING_PENDING':
    case 'JOINED':
      variant = 'success';
      break;
    default:
      variant = 'neutral';
  }

  return <Badge variant={variant}>{stage.replace(/_/g, ' ')}</Badge>;
}

export function PresenceBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; dot: string }> = {
    ONLINE: { label: 'Online', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    ACTIVE: { label: 'Active', color: 'bg-teal-50 text-teal-700 border-teal-200', dot: 'bg-teal-500' },
    CALLING_ACTIVITY: { label: 'In Calling Session', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
    AFTER_CALL_WORK: { label: 'After Call Work', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
    IDLE: { label: 'Idle', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
    BREAK: { label: 'On Break', color: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
    OFFLINE: { label: 'Offline', color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
  };

  const current = map[status] || map.OFFLINE;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${current.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`}></span>
      {current.label}
    </span>
  );
}
