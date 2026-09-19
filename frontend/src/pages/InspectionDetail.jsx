import { useState, useEffect } from 'react';
import { ArrowLeft, AlertTriangle, Loader2, MapPin, MapPinOff, ExternalLink } from 'lucide-react';
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

  if (!id) {
    return (
      <div className="state-container">
        <p className="state-title">No inspection selected</p>
        <p className="state-desc">Select an inspection from the history page to view details.</p>
        <button className="btn btn-primary" onClick={() => setPage('history')} style={{ marginTop: 12 }}>
          <ArrowLeft size={14} style={{ marginRight: 6 }} /> Go to History
        </button>
      </div>
    );
  }

  if (loading) return (
    <div className="state-container">
      <Loader2 size={32} style={{ animation: 'spin 0.7s linear infinite', color: 'var(--brand)' }} />
      <p className="state-desc">Loading inspection #{id}…</p>
    </div>
  );

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <button className="btn btn-ghost" onClick={() => setPage('history')} style={{ alignSelf: 'flex-start' }}>
          <ArrowLeft size={14} /> Back to History
        </button>
        <ErrorState message={error} />
      </div>
    );
  }

  if (!data) return null;


  const { detections = [], total_estimated_cost, overall_severity, overall_priority, created_at, latitude, longitude } = data;
  const hasGps = latitude != null && longitude != null;
  const mapsUrl = hasGps
    ? `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}&zoom=16`
    : null;

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
          <div className={`value severity-${(overall_priority || 'none').toLowerCase()}`}>
            {overall_priority || 'NONE'}
          </div>
        </div>
        <div className="result-metric">
          <div className="label">Est. Cost</div>
          <div className="value cost">{formatCost(total_estimated_cost)}</div>
        </div>
      </div>

      {/* GPS location section */}
      <div
        style={{
          marginBottom: 20,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)',
          padding: '14px 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: hasGps ? 10 : 0 }}>
          {hasGps
            ? <MapPin size={15} style={{ color: '#4ade80' }} />
            : <MapPinOff size={15} style={{ color: 'var(--text-muted)' }} />
          }
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
            {hasGps ? 'GPS Location' : 'Location'}
          </span>
        </div>

        {hasGps ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Latitude:{' '}
              <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                {Number(latitude).toFixed(6)}
              </strong>
              &nbsp;&nbsp;Longitude:{' '}
              <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                {Number(longitude).toFixed(6)}
              </strong>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <button
                id={`detail-view-map-${id}`}
                className="btn btn-ghost"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                onClick={() => setPage('map')}
              >
                <MapPin size={13} />
                View on Map
              </button>
              <a
                id={`detail-osm-link-${id}`}
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, textDecoration: 'none' }}
              >
                <ExternalLink size={13} />
                Open in OpenStreetMap
              </a>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Not available — this inspection was analyzed without GPS.
          </div>
        )}
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
