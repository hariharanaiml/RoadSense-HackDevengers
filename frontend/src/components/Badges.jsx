import { severityClass } from '../utils/format';

export function SeverityBadge({ value }) {
  const cls = severityClass(value);
  return <span className={`badge ${cls}`}>{value || 'NONE'}</span>;
}

export function PriorityBadge({ value }) {
  const cls = severityClass(value);
  return <span className={`badge ${cls}`}>{value || 'NONE'}</span>;
}
