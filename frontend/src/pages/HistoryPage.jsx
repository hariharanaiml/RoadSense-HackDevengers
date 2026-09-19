import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Eye, Clock, Filter, Search, AlertCircle, MapPin, MapPinOff, ChevronDown
} from 'lucide-react';
import { api } from '../services/api';
import { LoadingState, EmptyState, ErrorState } from '../components/States';
import { SeverityBadge } from '../components/Badges';
import { formatDate, formatCost } from '../utils/format';

const PAGE_SIZE = 15;

export default function HistoryPage({ setPage, setSelectedId }) {
  const [inspections, setInspections] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [filterGps, setFilterGps] = useState('ALL');

  const fetchHistory = useCallback(async (currentOffset = 0, isAppend = false) => {
    if (isAppend) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const params = {
        limit: PAGE_SIZE,
        offset: currentOffset,
      };
      if (filterSeverity !== 'ALL') {
        params.severity = filterSeverity;
      }
      if (filterGps === 'WITH_GPS') {
        params.has_gps = true;
      } else if (filterGps === 'WITHOUT_GPS') {
        params.has_gps = false;
      }

      const res = await api.getInspectionHistory(params);
      const items = res.inspections || [];
      const resTotal = res.total ?? items.length;

      setTotal(resTotal);
      setOffset(currentOffset);
      if (isAppend) {
        setInspections(prev => [...prev, ...items]);
      } else {
        setInspections(items);
      }
    } catch (e) {
      setError(e.message || 'Failed to load history');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [filterSeverity, filterGps]);

  useEffect(() => {
    fetchHistory(0, false);
  }, [fetchHistory]);

  const refresh = () => {
    setRefreshing(true);
    fetchHistory(0, false);
  };

  const handleLoadMore = () => {
    const nextOffset = offset + PAGE_SIZE;
    fetchHistory(nextOffset, true);
  };

  // Optional client-side search by ID over loaded records
  const filtered = inspections.filter(row => {
    if (!search.trim()) return true;
    return String(row.id).includes(search.trim());
  });

  const hasMore = inspections.length < total;

  return (
    <>
      <div className="page-header">
        <div className="page-title">Inspection History</div>
        <div className="page-desc">All saved road inspection records with YOLO detections.</div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search by ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px 8px 32px',
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)', color: 'var(--text-primary)',
              fontSize: 13, outline: 'none'
            }}
          />
        </div>

        {/* Severity filter */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Filter size={14} style={{ color: 'var(--text-muted)' }} />
          {['ALL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'].map(s => (
            <button
              key={s}
              className={`btn btn-ghost ${filterSeverity === s ? 'active-filter' : ''}`}
              style={{
                padding: '6px 12px', fontSize: 11, fontWeight: 600,
                ...(filterSeverity === s ? { background: 'var(--brand-muted)', color: 'var(--brand)', borderColor: 'var(--brand)' } : {})
              }}
              onClick={() => setFilterSeverity(s)}
            >
              {s}
            </button>
          ))}
        </div>

        {/* GPS filter */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <MapPin size={14} style={{ color: 'var(--text-muted)' }} />
          {[
            { id: 'ALL', label: 'All' },
            { id: 'WITH_GPS', label: 'With GPS' },
            { id: 'WITHOUT_GPS', label: 'No GPS' }
          ].map(g => (
            <button
              key={g.id}
              className={`btn btn-ghost ${filterGps === g.id ? 'active-filter' : ''}`}
              style={{
                padding: '6px 12px', fontSize: 11, fontWeight: 600,
                ...(filterGps === g.id ? { background: 'var(--brand-muted)', color: 'var(--brand)', borderColor: 'var(--brand)' } : {})
              }}
              onClick={() => setFilterGps(g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>

        <button className="btn-icon" onClick={refresh} disabled={refreshing} title="Refresh">
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }} />
        </button>

        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>
          {inspections.length} / {total} records
        </span>
      </div>

      {loading ? <LoadingState message="Loading inspection records…" /> :
       error ? <ErrorState message={error} /> :
       total === 0 ? (
        <EmptyState title="No inspection records" description="Analyze a road image to create the first inspection record." />
       ) : filtered.length === 0 ? (
        <div className="state-container">
          <AlertCircle size={32} style={{ color: 'var(--text-muted)' }} />
          <p className="state-title">No matching records</p>
          <p className="state-desc">Try adjusting your filter or search criteria.</p>
        </div>
       ) : (
        <div className="table-card table-mobile-cards">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date &amp; Time</th>
                  <th>Detections</th>
                  <th>Max Severity</th>
                  <th>Est. Cost</th>
                  <th>Top Defect</th>
                  <th>Location</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => {
                  const maxSev = row.overall_severity || getMaxSeverity(row.detections || []);
                  const count = row.detection_count ?? row.detections?.length ?? 0;
                  const topDefect = getTopDefect(row.detections || []);
                  const hasGps = row.latitude != null && row.longitude != null;
                  return (
                    <tr key={row.id}>
                      <td className="mono primary" data-label="ID">#{row.id}</td>
                      <td data-label="Date">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={11} style={{ color: 'var(--text-muted)' }} />
                          <span style={{ fontSize: 12 }}>{formatDate(row.created_at)}</span>
                        </div>
                      </td>
                      <td data-label="Detections">
                        <span style={{ fontWeight: 700, color: 'var(--brand)' }}>
                          {count}
                        </span>
                      </td>
                      <td data-label="Severity"><SeverityBadge value={maxSev} /></td>
                      <td data-label="Cost" className="primary">{formatCost(row.total_estimated_cost)}</td>
                      <td data-label="Top Defect" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {topDefect || (count > 0 ? `${count} defect(s)` : 'None')}
                      </td>
                      <td data-label="Location">
                        {hasGps ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#4ade80' }}>
                            <MapPin size={11} />
                            GPS Captured
                          </span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                            <MapPinOff size={11} />
                            No Location
                          </span>
                        )}
                      </td>
                      <td data-label="View">
                        <button
                          className="btn-icon"
                          title="View details"
                          onClick={() => { setSelectedId(row.id); setPage('detail'); }}
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

          {/* Load More Button */}
          {hasMore && (
            <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'center', borderTop: '1px solid var(--border)' }}>
              <button
                className="btn btn-ghost"
                onClick={handleLoadMore}
                disabled={loadingMore}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', fontSize: 12, fontWeight: 600 }}
              >
                {loadingMore ? (
                  <>
                    <RefreshCw size={13} style={{ animation: 'spin 0.7s linear infinite' }} />
                    Loading more…
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} />
                    Load More ({total - inspections.length} remaining)
                  </>
                )}
              </button>
            </div>
          )}
        </div>
       )}
    </>
  );
}


function getMaxSeverity(detections) {
  const order = ['high', 'medium', 'low'];
  for (const s of order) {
    if (detections.some(d => (d.severity || '').toLowerCase() === s)) return s.toUpperCase();
  }
  return detections.length > 0 ? 'LOW' : 'NONE';
}

function getTopDefect(detections) {
  if (!detections.length) return null;
  const map = {};
  for (const d of detections) {
    const n = d.class_name || '?';
    map[n] = (map[n] || 0) + 1;
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}
