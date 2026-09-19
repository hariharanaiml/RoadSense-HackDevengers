import { useState, useEffect, useCallback } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, IndianRupee,
  RefreshCw, Eye, Clock, Cpu, MapPin
} from 'lucide-react';
import { api } from '../services/api';
import { useHealth } from '../hooks/useHealth';
import { LoadingState, EmptyState, ErrorState } from '../components/States';
import { SeverityBadge } from '../components/Badges';
import { formatDate, formatCost } from '../utils/format';

const DEFECT_COLORS = [
  '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4',
  '#22c55e', '#f97316', '#3b82f6'
];

export default function Dashboard({ setPage, setSelectedId }) {
  const { health, loading: healthLoading } = useHealth();
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [statsData, historyData] = await Promise.all([
        api.getStats(),
        api.getInspectionHistory(8)
      ]);
      setStats(statsData);
      setRecent(Array.isArray(historyData) ? historyData : (historyData?.inspections || []));
    } catch (e) {
      setError(e.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const refresh = async () => {
    setRefreshing(true);
    await loadData(true);
  };

  // Backend-powered statistics
  const totalInspections = stats?.total_inspections ?? 0;
  const totalDetections = stats?.total_detections ?? 0;
  const totalCost = stats?.total_estimated_cost ?? 0;
  const highRisk = stats?.severity_distribution?.HIGH ?? 0;

  // Defect frequency map from backend stats
  const defectEntries = Object.entries(stats?.defect_frequency || {}).sort((a, b) => b[1] - a[1]);
  const maxCount = defectEntries[0]?.[1] || 1;

  return (
    <>
      {/* Stats grid */}
      <div className="stats-grid">
        <StatCard
          label="Total Inspections"
          value={totalInspections}
          sub="All time"
          icon={<Activity size={16} />}
          iconBg="rgba(37,99,235,0.15)"
          iconColor="#3b82f6"
        />
        <StatCard
          label="Total Detections"
          value={totalDetections}
          sub="Defects identified"
          icon={<AlertTriangle size={16} />}
          iconBg="rgba(245,158,11,0.15)"
          iconColor="#f59e0b"
        />
        <StatCard
          label="High Risk Sites"
          value={highRisk}
          sub="With severe damage"
          icon={<CheckCircle2 size={16} />}
          iconBg="rgba(239,68,68,0.15)"
          iconColor="#ef4444"
        />
        <StatCard
          label="Est. Repair Cost"
          value={formatCost(totalCost)}
          sub="Combined estimate"
          icon={<IndianRupee size={16} />}
          iconBg="rgba(34,197,94,0.15)"
          iconColor="#22c55e"
        />
      </div>

      {/* AI Status Banner */}
      {!healthLoading && health && (
        <div style={{ marginBottom: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="stat-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: '14px 20px', flex: 1, minWidth: 240 }}>
            <Cpu size={18} style={{ color: 'var(--brand)' }} />
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>AI Engine</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: health.model_loaded ? '#22c55e' : '#ef4444' }}>
                {health.model_loaded ? '✓ Model Loaded' : '✗ Model Not Loaded'}
              </div>
            </div>
          </div>
          <div className="stat-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: '14px 20px', flex: 1, minWidth: 240 }}>
            <Activity size={18} style={{ color: '#22c55e' }} />
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Status</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{health.status?.toUpperCase()}</div>
            </div>
          </div>
          {health.classes && (
            <div className="stat-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: '14px 20px', flex: 1, minWidth: 240 }}>
              <CheckCircle2 size={18} style={{ color: '#8b5cf6' }} />
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Detection Classes</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{health.classes.length} classes</div>
              </div>
            </div>
          )}
          {stats?.gps_coverage && (
            <div className="stat-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: '14px 20px', flex: 1, minWidth: 240 }}>
              <MapPin size={18} style={{ color: '#06b6d4' }} />
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>GPS Coverage</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {stats.gps_coverage.with_gps} Geotagged ({stats.gps_coverage.without_gps} no GPS)
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main content row */}
      <div className="dashboard-row">
        {/* Recent inspections table */}
        <div className="table-card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="section-title">Recent Inspections</div>
              <div className="section-subtitle">Last {recent.length} of {totalInspections} records</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-icon" onClick={refresh} disabled={refreshing} title="Refresh">
                <RefreshCw size={14} style={{ animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }} />
              </button>
              <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => setPage('history')}>
                View All
              </button>
            </div>
          </div>

          {loading ? <LoadingState message="Loading inspection records…" /> :
           error ? <ErrorState message={error} /> :
           recent.length === 0 ? (
            <EmptyState
              title="No inspections yet"
              description="Upload a road image to start detecting damage"
            />
           ) : (

            <div className="table-wrap table-mobile-cards">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Date & Time</th>
                    <th>Detections</th>
                    <th>Severity</th>
                    <th>Cost</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map(row => {
                    const maxSev = row.overall_severity || getMaxSeverity(row.detections || []);
                    const count = row.detection_count ?? row.detections?.length ?? 0;
                    return (
                      <tr key={row.id}>
                        <td className="mono primary" data-label="ID">#{row.id}</td>
                        <td data-label="Date">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                            {formatDate(row.created_at)}
                          </div>
                        </td>
                        <td data-label="Detections">
                          <span style={{ fontWeight: 600, color: 'var(--brand)' }}>
                            {count}
                          </span>
                        </td>
                        <td data-label="Severity"><SeverityBadge value={maxSev} /></td>
                        <td data-label="Cost" className="primary">{formatCost(row.total_estimated_cost)}</td>
                        <td data-label="View">
                          <button
                            className="btn-icon"
                            onClick={() => { setSelectedId(row.id); setPage('detail'); }}
                            title="View details"
                          >
                            <Eye size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
           )}
        </div>

        {/* Defect frequency panel */}
        <div className="defect-overview">
          <div className="defect-overview-header">
            <div className="section-title">Defect Frequency</div>
            <div className="section-subtitle">All inspections</div>
          </div>
          {defectEntries.length === 0 ? (
            <EmptyState title="No defect data" />
          ) : (
            defectEntries.map(([name, count], i) => (
              <div key={name} className="defect-bar-row">
                <div className="defect-name" style={{ fontSize: 12 }}>{name}</div>
                <div className="defect-bar-track">
                  <div
                    className="defect-bar-fill"
                    style={{
                      width: `${(count / maxCount) * 100}%`,
                      background: DEFECT_COLORS[i % DEFECT_COLORS.length]
                    }}
                  />
                </div>
                <div className="defect-count">{count}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value, sub, icon, iconBg, iconColor }) {
  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        <div className="stat-card-icon" style={{ background: iconBg, color: iconColor }}>{icon}</div>
      </div>
      <div className="stat-card-value">{value ?? '—'}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  );
}

function getMaxSeverity(detections) {
  const order = ['high', 'medium', 'low'];
  for (const s of order) {
    if (detections.some(d => (d.severity || '').toLowerCase() === s)) return s.toUpperCase();
  }
  return detections.length > 0 ? 'LOW' : 'NONE';
}
