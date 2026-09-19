import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RefreshCw, MapPin, Filter, AlertCircle, Eye } from 'lucide-react';
import { api } from '../services/api';
import { formatCost, formatDate } from '../utils/format';
import { SeverityBadge } from '../components/Badges';

// Fix leaflet default marker icon broken by bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Severity-colored icons
function createSeverityIcon(severity) {
  const colors = {
    HIGH: '#ef4444',
    MEDIUM: '#f59e0b',
    LOW: '#22c55e',
    NONE: '#6b7280',
  };
  const color = colors[(severity || 'NONE').toUpperCase()] || colors.NONE;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z" fill="${color}" stroke="white" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="5" fill="white" fill-opacity="0.85"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  });
}

const SEVERITIES = ['ALL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'];

export default function RoadMapPage({ setPage, setSelectedId }) {
  const [allInspections, setAllInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [filterSeverity, setFilterSeverity] = useState('ALL');

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await api.getInspectionHistory({ limit: 100, has_gps: true });
      const inspections = Array.isArray(data) ? data : (data?.inspections || []);
      // Only keep inspections with real GPS coordinates
      const geotagged = inspections.filter(
        (i) => i.latitude != null && i.longitude != null
      );
      setAllInspections(geotagged);
    } catch (e) {
      setError(e.message || 'Failed to load map data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const refresh = () => { setRefreshing(true); fetchData(true); };

  // Client-side severity filter
  const markers = allInspections.filter((i) =>
    filterSeverity === 'ALL' || (i.overall_severity || 'NONE').toUpperCase() === filterSeverity
  );

  // Default center: India
  const defaultCenter = [20.5937, 78.9629];
  const defaultZoom = 5;

  // If we have markers, center on the first one
  const center =
    markers.length > 0
      ? [markers[0].latitude, markers[0].longitude]
      : allInspections.length > 0
      ? [allInspections[0].latitude, allInspections[0].longitude]
      : defaultCenter;

  const zoom = markers.length > 0 || allInspections.length > 0 ? 13 : defaultZoom;

  return (
    <>
      <div className="page-header">
        <div className="page-title">Road Map</div>
        <div className="page-desc">
          Geolocated inspections plotted on the map — only inspections with GPS coordinates appear as markers.
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Filter size={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 4 }}>Severity:</span>
          {SEVERITIES.map((s) => (
            <button
              key={s}
              id={`map-filter-${s.toLowerCase()}`}
              className={`btn btn-ghost`}
              style={{
                padding: '6px 12px', fontSize: 11, fontWeight: 600,
                ...(filterSeverity === s
                  ? { background: 'var(--brand-muted)', color: 'var(--brand)', borderColor: 'var(--brand)' }
                  : {}),
              }}
              onClick={() => setFilterSeverity(s)}
            >
              {s}
            </button>
          ))}
        </div>

        <button
          className="btn-icon"
          id="map-refresh-btn"
          onClick={refresh}
          disabled={refreshing}
          title="Refresh map data"
        >
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }} />
        </button>

        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>
          <MapPin size={11} style={{ display: 'inline', marginRight: 4 }} />
          {markers.length} / {allInspections.length} geolocated
        </span>
      </div>

      {error && (
        <div className="error-banner" style={{ marginBottom: 16 }}>
          <AlertCircle size={16} />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="state-container">
          <div className="spinner" />
          <p className="state-desc">Loading map data…</p>
        </div>
      ) : (
        <div
          style={{
            borderRadius: 'var(--r-lg)',
            overflow: 'hidden',
            border: '1px solid var(--border)',
            height: 520,
            position: 'relative',
          }}
        >
          {allInspections.length === 0 && (
            <div
              style={{
                position: 'absolute', inset: 0, zIndex: 9999,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(15,17,23,0.85)', gap: 12, pointerEvents: 'none',
              }}
            >
              <MapPin size={36} style={{ color: 'var(--text-muted)' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 500 }}>
                No geolocated inspections yet
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                Capture GPS when analyzing a road to see markers here.
              </p>
            </div>
          )}
          <MapContainer
            center={center}
            zoom={zoom}
            style={{ height: '100%', width: '100%', background: '#0f1117' }}
            key={`${center[0]}-${center[1]}-${zoom}`}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {markers.map((insp) => (
              <Marker
                key={insp.id}
                position={[insp.latitude, insp.longitude]}
                icon={createSeverityIcon(insp.overall_severity)}
              >
                <Popup minWidth={220}>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
                      Inspection #{insp.id}
                    </div>
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <tbody>
                        <tr>
                          <td style={{ color: '#666', paddingRight: 8, paddingBottom: 4 }}>Severity</td>
                          <td style={{ fontWeight: 600, paddingBottom: 4 }}>{insp.overall_severity || 'NONE'}</td>
                        </tr>
                        <tr>
                          <td style={{ color: '#666', paddingRight: 8, paddingBottom: 4 }}>Priority</td>
                          <td style={{ fontWeight: 600, paddingBottom: 4 }}>{insp.overall_priority || 'NONE'}</td>
                        </tr>
                        <tr>
                          <td style={{ color: '#666', paddingRight: 8, paddingBottom: 4 }}>Detections</td>
                          <td style={{ fontWeight: 600, paddingBottom: 4 }}>{insp.detection_count ?? 0}</td>
                        </tr>
                        <tr>
                          <td style={{ color: '#666', paddingRight: 8, paddingBottom: 4 }}>Est. Cost</td>
                          <td style={{ fontWeight: 600, paddingBottom: 4 }}>{formatCost(insp.total_estimated_cost)}</td>
                        </tr>
                        <tr>
                          <td style={{ color: '#666', paddingRight: 8 }}>Date</td>
                          <td style={{ fontSize: 11 }}>{formatDate(insp.created_at)}</td>
                        </tr>
                      </tbody>
                    </table>
                    <button
                      id={`map-view-insp-${insp.id}`}
                      onClick={() => { setSelectedId(insp.id); setPage('detail'); }}
                      style={{
                        marginTop: 10, width: '100%',
                        background: '#2563eb', color: '#fff',
                        border: 'none', borderRadius: 6,
                        padding: '7px 0', fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: 6,
                      }}
                    >
                      <Eye size={12} />
                      View Inspection
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
    </>
  );
}
