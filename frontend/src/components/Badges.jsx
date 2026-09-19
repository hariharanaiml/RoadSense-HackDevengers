import { severityClass } from '../utils/format';

export function SeverityBadge({ value }) {
  const cls = severityClass(value);
  return <span className={`badge ${cls}`}>{value || 'NONE'}</span>;
}

export function PriorityBadge({ value }) {
  const cls = severityClass(value);
  return <span className={`badge ${cls}`}>{value || 'NONE'}</span>;
}

export function RiskBadge({ level, score }) {
  let badgeClass = 'badge-low';
  if (level === 'CRITICAL' || score >= 81) badgeClass = 'badge-critical';
  else if (level === 'HIGH' || score >= 61) badgeClass = 'badge-high';
  else if (level === 'MODERATE' || score >= 31) badgeClass = 'badge-medium';

  return (
    <span className={`badge ${badgeClass} inline-flex items-center gap-1 font-semibold`}>
      <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
      {score !== undefined ? `${score}/100 ` : ''}{level || 'LOW'}
    </span>
  );
}

export function PriorityCodeBadge({ code, label }) {
  let badgeClass = 'badge-low';
  if (code === 'P1') badgeClass = 'badge-critical';
  else if (code === 'P2') badgeClass = 'badge-high';
  else if (code === 'P3') badgeClass = 'badge-medium';

  return (
    <span className={`badge ${badgeClass} font-mono font-bold uppercase tracking-wider`}>
      {code || 'P4'} {label ? `— ${label}` : ''}
    </span>
  );
}
