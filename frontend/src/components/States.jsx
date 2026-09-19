import { Loader2, AlertCircle, Inbox } from 'lucide-react';

export function LoadingState({ message = 'Loading…' }) {
  return (
    <div className="state-container">
      <Loader2 className="state-icon" size={32} style={{ animation: 'spin 0.7s linear infinite' }} />
      <p className="state-desc">{message}</p>
    </div>
  );
}

export function EmptyState({ title = 'No data', description }) {
  return (
    <div className="state-container">
      <Inbox className="state-icon" size={40} />
      <p className="state-title">{title}</p>
      {description && <p className="state-desc">{description}</p>}
    </div>
  );
}

export function ErrorState({ message }) {
  return (
    <div className="state-container state-error">
      <AlertCircle className="state-icon" size={36} style={{ color: '#f87171' }} />
      <p className="state-title">Something went wrong</p>
      <p className="state-desc">{message || 'An unexpected error occurred.'}</p>
    </div>
  );
}
