import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RefreshCw, MapPin, Filter, AlertCircle, Eye, Flame, ShieldAlert } from 'lucide-react';
import { api } from '../services/api';
import { formatCost, formatDate } from '../utils/format';
import { SeverityBadge, RiskBadge, PriorityCodeBadge } from '../components/Badges';

// Fix leaflet default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Severity-colored marker icons
function createSeverityIcon(severity, riskScore = 0) {
  let color = '#22C55E';
  if (severity === 'CRITICAL' || riskScore >= 81) color = '#EF4444';
  else if (severity === 'HIGH' || riskScore >= 61) color = '#F59E0B';
  else if (severity === 'MEDIUM' || riskScore >= 31) color = '#38BDF8';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="38" viewBox="0 0 24 36">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z" fill="${color}" stroke="#111827" stroke-width="1.8"/>
    <circle cx="12" cy="12" r="5" fill="#FFFFFF" fill-opacity="0.9"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [26, 38],
    iconAnchor: [13, 38],
    popupAnchor: [0, -38],
  });
}

const SEVERITIES = ['ALL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'];

export default function RoadMapPage({ setPage, setSelectedId }) {
  const [allInspections, setAllInspections] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [showHotspots, setShowHotspots] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [filterSeverity, setFilterSeverity] = useState('ALL');

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [historyData, hotspotData] = await Promise.all([
        api.getInspectionHistory({ limit: 100, has_gps: true }),
        api.getHotspots(0.5).catch(() => ({ hotspots: [] }))
      ]);

      const inspections = Array.isArray(historyData) ? historyData : (historyData?.inspections || []);
      const geotagged = inspections.filter((i) => i.latitude != null && i.longitude != null);
      
      setAllInspections(geotagged);
      setHotspots(hotspotData?.hotspots || []);
    } catch (e) {
      setError(e.message || 'Failed to load GIS map data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const refresh = () => { setRefreshing(true); fetchData(true); };

  const markers = allInspections.filter((i) =>
    filterSeverity === 'ALL' || (i.overall_severity || 'NONE').toUpperCase() === filterSeverity
  );

  const defaultCenter = [20.5937, 78.9629];
  const defaultZoom = 5;

  const center =
    markers.length > 0
      ? [markers[0].latitude, markers[0].longitude]
      : hotspots.length > 0
      ? [hotspots[0].center_latitude, hotspots[0].center_longitude]
      : defaultCenter;

  const zoom = markers.length > 0 || hotspots.length > 0 ? 13 : defaultZoom;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#1F2937] pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">AI GIS Road Defect Map & Hotspots</h1>
          <p className="text-sm text-gray-400">
            Geospatial defect clustering overlaying municipal road inspection markers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHotspots(!showHotspots)}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition flex items-center gap-2 border ${
              showHotspots
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-[#1F2937] text-gray-400 border-[#374151]'
            }`}
          >
            <Flame size={15} /> {showHotspots ? 'Hotspot Overlay Active' : 'Show Hotspots Overlay'}
          </button>

          <button
            onClick={refresh}
            disabled={refreshing}
            className="p-2 bg-[#1F2937] hover:bg-[#374151] text-gray-300 rounded-lg transition"
            title="Refresh Map"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-gray-400" />
          <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Severity Filter:</span>
          <div className="flex gap-1.5">
            {SEVERITIES.map((s) => (
              <button
                key={s}
                onClick={() => setFilterSeverity(s)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  filterSeverity === s
                    ? 'bg-[#38BDF8] text-slate-950 font-bold'
                    : 'bg-[#1F2937] text-gray-300 hover:bg-[#374151]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-gray-400 font-mono">
          📍 Plotted Sites: <strong className="text-white">{markers.length}</strong> | Active Hotspot Zones: <strong className="text-amber-400">{hotspots.length}</strong>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/40 border border-red-800/50 rounded-xl text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={18} />
          <p>{error}</p>
        </div>
      )}

      {/* Main Map & Hotspots Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Map View */}
        <div className="lg:col-span-3 bg-[#111827] border border-[#1F2937] rounded-xl overflow-hidden shadow-2xl h-[560px] relative">
          {loading ? (
            <div className="absolute inset-0 z-10 bg-[#111827]/90 flex flex-col items-center justify-center text-gray-400 text-xs">
              <span className="w-6 h-6 border-2 border-t-[#38BDF8] border-r-transparent rounded-full animate-spin mb-2"></span>
              Loading GIS tiles & geospatial markers…
            </div>
          ) : markers.length === 0 && hotspots.length === 0 ? (
            <div className="absolute inset-0 z-10 bg-[#111827]/90 flex flex-col items-center justify-center text-gray-400 text-xs p-6 text-center">
              <MapPin size={36} className="text-gray-600 mb-2" />
              <p className="font-bold text-white text-sm">No Geotagged Inspections Found</p>
              <p className="text-gray-400 mt-1 max-w-xs">
                Capture GPS location when conducting an inspection to display interactive markers and hotspot zones here.
              </p>
            </div>
          ) : null}

          <MapContainer
            center={center}
            zoom={zoom}
            style={{ height: '100%', width: '100%', background: '#0F1117' }}
            key={`${center[0]}-${center[1]}-${zoom}`}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Hotspot Circles Overlay */}
            {showHotspots && hotspots.map((hs) => (
              <Circle
                key={hs.id}
                center={[hs.center_latitude, hs.center_longitude]}
                radius={(hs.radius_km || 0.5) * 1000}
                pathOptions={{
                  color: hs.severity === 'CRITICAL' ? '#EF4444' : (hs.severity === 'HIGH' ? '#F59E0B' : '#38BDF8'),
                  fillColor: hs.severity === 'CRITICAL' ? '#EF4444' : (hs.severity === 'HIGH' ? '#F59E0B' : '#38BDF8'),
                  fillOpacity: 0.25,
                  weight: 2
                }}
              >
                <Popup>
                  <div className="font-sans text-xs space-y-1">
                    <div className="font-bold text-sm text-red-600">🔥 {hs.name}</div>
                    <div><strong>Defects:</strong> {hs.total_defects} instances</div>
                    <div><strong>Inspections:</strong> {hs.inspection_count} sites</div>
                    <div><strong>Avg Risk:</strong> {hs.average_risk_score}/100</div>
                    <div><strong>Est. Cost:</strong> ₹{(hs.total_estimated_cost || 0).toLocaleString('en-IN')}</div>
                  </div>
                </Popup>
              </Circle>
            ))}

            {/* Individual Inspection Markers */}
            {markers.map((insp) => (
              <Marker
                key={insp.id}
                position={[insp.latitude, insp.longitude]}
                icon={createSeverityIcon(insp.overall_severity, insp.risk_score)}
              >
                <Popup minWidth={240}>
                  <div className="font-sans text-xs space-y-2 p-1">
                    <div className="flex justify-between items-center border-b pb-1">
                      <span className="font-extrabold text-sm text-slate-900">Inspection #{insp.id}</span>
                      <span className="text-[10px] font-mono font-bold bg-slate-200 px-1.5 py-0.5 rounded">
                        Risk: {insp.risk_score ?? 0}
                      </span>
                    </div>

                    <table className="w-full text-left">
                      <tbody>
                        <tr>
                          <td className="text-gray-500 py-0.5">Severity:</td>
                          <td className="font-bold py-0.5">{insp.overall_severity || 'NONE'}</td>
                        </tr>
                        <tr>
                          <td className="text-gray-500 py-0.5">Detections:</td>
                          <td className="font-bold py-0.5">{insp.detection_count || 0}</td>
                        </tr>
                        <tr>
                          <td className="text-gray-500 py-0.5">Est. Cost:</td>
                          <td className="font-bold text-emerald-600 py-0.5">{formatCost(insp.total_estimated_cost)}</td>
                        </tr>
                      </tbody>
                    </table>

                    <button
                      onClick={() => { setSelectedId(insp.id); setPage('detail'); }}
                      className="w-full py-1.5 bg-[#38BDF8] text-slate-950 font-bold rounded text-xs flex items-center justify-center gap-1 mt-2"
                    >
                      <Eye size={12} /> View Details
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Hotspots Side Drawer */}
        <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Flame size={18} className="text-amber-500" />
              <h2 className="text-base font-bold text-white">Hotspot Clusters</h2>
            </div>
            <p className="text-xs text-gray-400 mb-4">Spatial defect density zones</p>

            {hotspots.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">
                More geographically distributed inspections required to compute cluster hotspots.
              </div>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {hotspots.map((hs) => (
                  <div
                    key={hs.id}
                    className="bg-[#1F2937]/60 border border-[#374151] rounded-xl p-3 space-y-2 hover:border-[#38BDF8] transition"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-white">{hs.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        hs.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {hs.severity}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-300">
                      <div>Defects: <strong className="text-white">{hs.total_defects}</strong></div>
                      <div>Inspections: <strong className="text-white">{hs.inspection_count}</strong></div>
                    </div>

                    <div className="border-t border-[#374151] pt-2 flex justify-between items-center text-xs">
                      <span className="text-gray-400">Risk: <strong className="text-[#38BDF8]">{hs.average_risk_score}/100</strong></span>
                      <span className="font-bold text-[#22C55E]">₹{(hs.total_estimated_cost || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
