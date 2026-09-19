import { useState, useEffect } from 'react';
import { ArrowLeft, AlertTriangle, Loader2, MapPin, MapPinOff, ExternalLink, FileText, Activity } from 'lucide-react';
import { api } from '../services/api';
import { ErrorState } from '../components/States';
import { SeverityBadge, RiskBadge, PriorityCodeBadge } from '../components/Badges';
import DetectionCard from '../components/DetectionCard';
import ReportModal from '../components/ReportModal';
import { formatDate, formatCost } from '../utils/format';

export default function InspectionDetail({ id, setPage }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showReport, setShowReport] = useState(false);

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
      <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-8 text-center space-y-4">
        <p className="text-white font-bold">No inspection selected</p>
        <p className="text-xs text-gray-400">Select an inspection record to view full AI intelligence details.</p>
        <button className="px-4 py-2 bg-[#38BDF8] text-slate-950 font-bold text-xs rounded-lg inline-flex items-center gap-2" onClick={() => setPage('history')}>
          <ArrowLeft size={14} /> Go to History
        </button>
      </div>
    );
  }

  if (loading) return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-12 text-center text-gray-400">
      <Loader2 size={32} className="animate-spin text-[#38BDF8] mx-auto mb-2" />
      <p className="text-xs font-medium">Loading RoadSense Intelligence for Inspection #{id}…</p>
    </div>
  );

  if (error) {
    return (
      <div className="space-y-4">
        <button className="px-3 py-1.5 bg-[#1F2937] text-gray-300 text-xs rounded-lg" onClick={() => setPage('history')}>
          ← Back to History
        </button>
        <ErrorState message={error} />
      </div>
    );
  }

  if (!data) return null;

  const { detections = [], total_estimated_cost, overall_severity, created_at, latitude, longitude } = data;
  const rec = data.maintenance_recommendation || {};
  const explain = data.explainability || {};

  const hasGps = latitude != null && longitude != null;
  const mapsUrl = hasGps
    ? `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}&zoom=16`
    : null;

  return (
    <div className="space-y-6">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#1F2937] pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPage('history')}
            className="p-2 bg-[#1F2937] hover:bg-[#374151] text-gray-300 rounded-lg transition text-xs font-medium flex items-center gap-1"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Inspection #{id}</h1>
            <p className="text-xs text-gray-400">{formatDate(created_at)}</p>
          </div>
        </div>

        <button
          onClick={() => setShowReport(true)}
          className="px-4 py-2 bg-[#38BDF8] hover:bg-[#0284C7] text-slate-950 font-bold text-xs rounded-lg transition shadow-lg flex items-center gap-2"
        >
          <FileText size={16} /> Open Inspection Report Modal
        </button>
      </div>

      {/* Primary Intelligence Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#111827] border border-[#1F2937] p-4 rounded-xl shadow-xl text-center">
          <span className="text-xs text-gray-400 block mb-1">ROAD RISK SCORE</span>
          <RiskBadge level={data.risk_level} score={data.risk_score} />
        </div>

        <div className="bg-[#111827] border border-[#1F2937] p-4 rounded-xl shadow-xl text-center">
          <span className="text-xs text-gray-400 block mb-1">MAINTENANCE PRIORITY</span>
          <PriorityCodeBadge code={rec.priority_code} label={rec.priority_label} />
        </div>

        <div className="bg-[#111827] border border-[#1F2937] p-4 rounded-xl shadow-xl text-center">
          <span className="text-xs text-gray-400 block mb-1">OVERALL SEVERITY</span>
          <SeverityBadge value={overall_severity} />
        </div>

        <div className="bg-[#111827] border border-[#1F2937] p-4 rounded-xl shadow-xl text-center">
          <span className="text-xs text-gray-400 block mb-1">ESTIMATED REPAIR</span>
          <span className="text-base font-bold text-[#22C55E]">{formatCost(total_estimated_cost)}</span>
        </div>
      </div>

      {/* AI Recommendation Box */}
      <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 shadow-xl space-y-3">
        <h3 className="text-xs font-bold text-[#38BDF8] uppercase tracking-wider">
          AI Maintenance Recommendation & Dispatch Plan
        </h3>
        <p className="text-sm font-bold text-white bg-[#1F2937] p-3 rounded-lg border border-[#374151]">
          {rec.action || 'Routine Maintenance Patrol'}
        </p>
        {rec.reasons && (
          <ul className="list-disc list-inside text-xs text-gray-300 space-y-1">
            {rec.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}
      </div>

      {/* AI Explainability */}
      {explain.summary && (
        <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 shadow-xl space-y-2">
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
            <Activity size={14} className="text-[#38BDF8]" /> AI Reasoning ("Why this result?")
          </h3>
          <p className="text-xs text-gray-300 bg-[#1F2937]/50 p-3 rounded-lg border border-[#374151]">
            {explain.summary}
          </p>
        </div>
      )}

      {/* GPS Location Section */}
      <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4 shadow-xl">
        <div className="flex items-center gap-2 mb-2">
          {hasGps ? <MapPin size={16} className="text-emerald-400" /> : <MapPinOff size={16} className="text-gray-500" />}
          <span className="font-bold text-sm text-white">{hasGps ? 'Geographic Location Logged' : 'Location Not Available'}</span>
        </div>

        {hasGps ? (
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
            <div className="text-gray-300 font-mono">
              Lat: <strong className="text-white">{Number(latitude).toFixed(6)}</strong> &nbsp;&nbsp;
              Lon: <strong className="text-white">{Number(longitude).toFixed(6)}</strong>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage('map')}
                className="px-3 py-1.5 bg-[#1F2937] hover:bg-[#374151] text-[#38BDF8] font-medium rounded-lg transition flex items-center gap-1.5"
              >
                <MapPin size={13} /> GIS Map View
              </button>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-[#1F2937] hover:bg-[#374151] text-gray-300 font-medium rounded-lg transition flex items-center gap-1.5"
              >
                <ExternalLink size={13} /> OpenStreetMap ↗
              </a>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400">Analyzed without GPS coordinates.</p>
        )}
      </div>

      {/* Detections List */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-500" />
          Detected Defects ({detections.length})
        </h3>
        {detections.length === 0 ? (
          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-8 text-center text-gray-400 text-sm">
            No defect instances identified in this record.
          </div>
        ) : (
          <div className="space-y-3">
            {detections.map((d, i) => (
              <DetectionCard key={i} detection={d} />
            ))}
          </div>
        )}
      </div>

      {/* Report Modal */}
      {showReport && (
        <ReportModal
          inspection={data}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
