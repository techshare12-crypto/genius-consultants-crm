import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'green' | 'blue' | 'orange' | 'amber' | 'red' | 'purple' | 'gray' | 'slate' | 'indigo';
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'gray',
  size = 'sm',
  dot = false,
  className = '',
}) => {
  const variantStyles = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    blue: 'bg-sky-50 text-sky-700 border-sky-200/80',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    orange: 'bg-orange-50 text-orange-700 border-orange-200/80',
    amber: 'bg-amber-50 text-amber-800 border-amber-200/80',
    red: 'bg-rose-50 text-rose-700 border-rose-200/80',
    purple: 'bg-purple-50 text-purple-700 border-purple-200/80',
    gray: 'bg-slate-100 text-slate-700 border-slate-200',
    slate: 'bg-slate-800 text-white border-slate-700',
  };

  const dotColors = {
    green: 'bg-emerald-500',
    blue: 'bg-sky-500',
    indigo: 'bg-indigo-500',
    orange: 'bg-orange-500',
    amber: 'bg-amber-500',
    red: 'bg-rose-500',
    purple: 'bg-purple-500',
    gray: 'bg-slate-400',
    slate: 'bg-slate-300',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs font-medium',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
};

export const StageBadge: React.FC<{ stage: string }> = ({ stage }) => {
  switch (stage) {
    case 'SHORTLISTED':
      return <Badge variant="blue" dot>Shortlisted</Badge>;
    case 'CONFIRMED':
    case 'JOINED':
      return <Badge variant="green" dot>{stage === 'JOINED' ? 'Joined' : 'Confirmed'}</Badge>;
    case 'CONTACTED':
    case 'INTERESTED':
      return <Badge variant="indigo" dot>{stage === 'INTERESTED' ? 'Interested' : 'Contacted'}</Badge>;
    case 'CALLING_IN_PROGRESS':
    case 'ASSIGNED':
      return <Badge variant="orange" dot>{stage === 'ASSIGNED' ? 'Assigned' : 'In Progress'}</Badge>;
    case 'RNR':
      return <Badge variant="amber" dot>RNR</Badge>;
    case 'NOT_INTERESTED':
      return <Badge variant="red" dot>Not Interested</Badge>;
    case 'INVALID':
    case 'REJECTED':
      return <Badge variant="red" dot>{stage === 'INVALID' ? 'Invalid Number' : 'Rejected'}</Badge>;
    case 'NEW':
    default:
      return <Badge variant="gray" dot>New Lead</Badge>;
  }
};

export const OutcomeBadge: React.FC<{ outcome: string }> = ({ outcome }) => {
  switch (outcome) {
    case 'CONFIRMED':
      return <Badge variant="green">Confirmed</Badge>;
    case 'SHORTLISTED':
      return <Badge variant="blue">Shortlisted</Badge>;
    case 'CALL_BACK':
    case 'BUSY':
      return <Badge variant="orange">{outcome === 'CALL_BACK' ? 'Call Back' : 'Busy'}</Badge>;
    case 'RNR':
    case 'SWITCHED_OFF':
      return <Badge variant="amber">{outcome === 'RNR' ? 'RNR' : 'Switched Off'}</Badge>;
    case 'NOT_INTERESTED':
    case 'NOT_ELIGIBLE':
      return <Badge variant="red">{outcome === 'NOT_INTERESTED' ? 'Not Interested' : 'Not Eligible'}</Badge>;
    case 'WRONG_NUMBER':
    case 'NUMBER_INVALID':
      return <Badge variant="red">{outcome === 'WRONG_NUMBER' ? 'Wrong Number' : 'Invalid Number'}</Badge>;
    case 'ALREADY_EMPLOYED':
      return <Badge variant="purple">Employed</Badge>;
    default:
      return <Badge variant="gray">{outcome}</Badge>;
  }
};
