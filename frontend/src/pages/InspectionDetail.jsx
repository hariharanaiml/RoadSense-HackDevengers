import { useState, useEffect } from 'react';
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { ErrorState } from '../components/States';
import { SeverityBadge } from '../components/Badges';
import DetectionCard from '../components/DetectionCard';
import { formatDate, formatCost, formatConfidence } from '../utils/format';

export default function InspectionDetail({ id, setPage }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.getInspection(id).then(d => {
      if (!cancelled) { setData(d); setLoading(false); }
    }).catch(e => {
      if (!cancelled) { setError(e.message || 'Failed to load inspection'); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return (
    <div className="state-container">
      <Loader2 size={32} style={{ animation: 'spin 0.7s linear infinite', color: 'var(--brand)' }} />
      <p className="state-desc">Loading inspection #{id}…</p>
    </div>
  );

  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const { detections = [], total_estimated_cost, overall_severity, priority, created_at } = data;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost" onClick={() => setPage('history')}>
          <ArrowLeft size={14} /> Back
        </button>
        <div>
          <div className="page-title">Inspection #{id}</div>
          <div className="page-desc">{formatDate(created_at)}</div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="result-summary" style={{ marginBottom: 20 }}>
        <div className="result-metric">
          <div className="label">Detections</div>
          <div className="value count">{detections.length}</div>
        </div>
        <div className="result-metric">
          <div className="label">Severity</div>
          <div className={`value severity-${(overall_severity || 'none').toLowerCase()}`}>
            {overall_severity || 'NONE'}
          </div>
        </div>
        <div className="result-metric">
          <div className="label">Priority</div>
          <div className={`value severity-${(priority || 'none').toLowerCase()}`}>
            {priority || 'NONE'}
          </div>
        </div>
        <div className="result-metric">
          <div className="label">Est. Cost</div>
          <div className="value cost">{formatCost(total_estimated_cost)}</div>
        </div>
      </div>

      {/* Detections list */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <AlertTriangle size={15} style={{ color: 'var(--text-muted)' }} />
        <div className="section-title">
          Detected Defects ({detections.length})
        </div>
      </div>

      {detections.length === 0 ? (
        <div className="stat-card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: 'var(--text-muted)' }}>No defects were detected in this inspection.</p>
        </div>
      ) : (
        <div className="detections-list">
          {detections.map((d, i) => (
            <DetectionCard key={i} detection={d} />
          ))}
        </div>
      )}
    </>
  );
}
