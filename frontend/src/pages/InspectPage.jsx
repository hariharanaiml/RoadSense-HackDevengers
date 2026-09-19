import { useState, useRef, useCallback } from 'react';
import {
  UploadCloud, X, ScanSearch, CheckCircle2, AlertTriangle,
  Zap, Image as ImageIcon, AlertCircle, MapPin, LocateFixed, XCircle, FileText, Activity
} from 'lucide-react';
import { api } from '../services/api';
import { formatFileSize, formatCost } from '../utils/format';
import { SeverityBadge, RiskBadge, PriorityCodeBadge } from '../components/Badges';
import DetectionCard from '../components/DetectionCard';
import ReportModal from '../components/ReportModal';
import AnalysisProgressModal from '../components/AnalysisProgressModal';

export default function InspectPage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [drag, setDrag] = useState(false);
  
  // Progress modal state
  const [stepIndex, setStepIndex] = useState(-1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Inspection result & modal state
  const [result, setResult] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef();

  // GPS state
  const [gps, setGps] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('idle');
  const [gpsError, setGpsError] = useState(null);

  const pickFile = (f) => {
    if (!f || !f.type.startsWith('image/')) {
      setError('Please select a valid image file (JPEG, PNG, WebP).');
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError('Image size must be under 20 MB.');
      return;
    }
    setError(null);
    setResult(null);
    setComparison(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const onDrop = useCallback(e => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    pickFile(f);
  }, []);

  const onDragOver = e => { e.preventDefault(); setDrag(true); };
  const onDragLeave = () => setDrag(false);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setComparison(null);
    setError(null);
    setStepIndex(-1);
    setIsAnalyzing(false);
  };

  // GPS capture
  const captureLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }
    setGpsStatus('loading');
    setGpsError(null);
    setGps(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lon = parseFloat(pos.coords.longitude.toFixed(6));
        setGps({ lat, lon });
        setGpsStatus('captured');
      },
      (err) => {
        setGpsStatus('error');
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setGpsError('Location permission was denied. Please allow access in browser settings.');
            break;
          case err.POSITION_UNAVAILABLE:
            setGpsError('Location information is currently unavailable.');
            break;
          case err.TIMEOUT:
            setGpsError('Location request timed out.');
            break;
          default:
            setGpsError('An unknown error occurred while retrieving location.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const clearLocation = () => {
    setGps(null);
    setGpsStatus('idle');
    setGpsError(null);
  };

  // Live Analysis Execution
  const analyze = async () => {
    setError(null);
    setResult(null);
    setComparison(null);
    setIsAnalyzing(true);
    setStepIndex(0);

    let idx = 0;
    const ticker = setInterval(() => {
      idx = Math.min(idx + 1, 3);
      setStepIndex(idx);
    }, 500);

    try {
      const lat = gps ? gps.lat : null;
      const lon = gps ? gps.lon : null;
      const data = await api.analyzeInspection(file, lat, lon);

      clearInterval(ticker);
      setStepIndex(4);
      await new Promise(r => setTimeout(r, 400));
      setStepIndex(5);
      await new Promise(r => setTimeout(r, 300));

      setResult(data);
      setIsAnalyzing(false);
      setStepIndex(-1);

      // Fetch comparison if inspection saved
      const inspId = data.inspection_id || data.id;
      if (inspId) {
        api.getComparison(inspId)
          .then(compData => setComparison(compData))
          .catch(() => setComparison(null));
      }
    } catch (e) {
      clearInterval(ticker);
      setIsAnalyzing(false);
      setStepIndex(-1);
      setError(e.message || 'Analysis failed. Please try again.');
    }
  };

  const rec = result?.maintenance_recommendation || {};
  const explain = result?.explainability || {};
  const detections = result?.detections || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#1F2937] pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Inspect Road Surface</h1>
          <p className="text-sm text-gray-400">Upload a road image for real-time YOLOv8 defect detection & risk intelligence.</p>
        </div>
        {result && (
          <button
            onClick={() => setShowReport(true)}
            className="px-4 py-2 bg-[#38BDF8] hover:bg-[#0284C7] text-slate-950 font-bold text-xs rounded-lg transition shadow-lg flex items-center gap-2"
          >
            <FileText size={16} /> Generate Inspection Report
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-950/40 border border-red-800/50 rounded-xl text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={18} />
          <p>{error}</p>
        </div>
      )}

      {/* GPS Location Bar */}
      <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4 shadow-xl">
        <div className="flex items-center gap-2 mb-2">
          <MapPin size={16} className="text-[#38BDF8]" />
          <span className="font-bold text-sm text-white">Geographic Location Tag</span>
          <span className="text-xs text-gray-400">(Optional — automatic geotagging)</span>
        </div>

        {gpsStatus === 'idle' && (
          <button
            onClick={captureLocation}
            className="px-3 py-1.5 bg-[#1F2937] hover:bg-[#374151] text-[#38BDF8] font-medium text-xs rounded-lg transition flex items-center gap-2"
          >
            <LocateFixed size={14} /> Capture My Location
          </button>
        )}

        {gpsStatus === 'loading' && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-t-[#38BDF8] border-r-transparent animate-spin"></span>
            Acquiring satellite coordinates…
          </div>
        )}

        {gpsStatus === 'captured' && gps && (
          <div className="flex items-center justify-between bg-emerald-950/30 border border-emerald-800/40 p-3 rounded-lg text-xs">
            <div className="flex items-center gap-2 text-emerald-400 font-medium">
              <CheckCircle2 size={16} />
              <span>Latitude: <strong className="font-mono text-white">{gps.lat.toFixed(6)}</strong></span>
              <span>Longitude: <strong className="font-mono text-white">{gps.lon.toFixed(6)}</strong></span>
            </div>
            <button onClick={clearLocation} className="text-gray-400 hover:text-white text-xs">
              Remove
            </button>
          </div>
        )}

        {gpsStatus === 'error' && (
          <div className="flex items-center justify-between bg-red-950/30 border border-red-800/40 p-3 rounded-lg text-xs text-red-400">
            <span>⚠ {gpsError}</span>
            <button onClick={clearLocation} className="text-gray-300 hover:text-white">Dismiss</button>
          </div>
        )}
      </div>

      {/* Main Grid: Upload vs Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Image Upload & Preview */}
        <div className="space-y-4">
          {!file ? (
            <label
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              htmlFor="road-upload-input"
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[320px] bg-[#111827] ${
                drag ? 'border-[#38BDF8] bg-[#38BDF8]/5' : 'border-[#1F2937] hover:border-[#38BDF8]/50'
              }`}
            >
              <input
                id="road-upload-input"
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => pickFile(e.target.files[0])}
              />
              <div className="p-4 bg-[#1F2937] text-[#38BDF8] rounded-2xl mb-3">
                <UploadCloud size={32} />
              </div>
              <h3 className="text-base font-bold text-white mb-1">Drop a road image here</h3>
              <p className="text-xs text-gray-400 mb-4">or click to select from your device</p>
              <div className="text-[11px] text-gray-500 bg-[#1F2937]/50 px-3 py-1.5 rounded-full border border-[#374151]">
                Supports JPEG · PNG · WebP · BMP · Max 20 MB
              </div>
            </label>
          ) : (
            <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4 shadow-xl space-y-4">
              <div className="relative rounded-lg overflow-hidden max-h-[380px] bg-black flex items-center justify-center">
                <img src={preview} alt="Selected road" className="object-contain max-h-[380px] w-full" />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#1F2937]">
                <div>
                  <div className="text-xs font-bold text-white truncate max-w-[200px]">{file.name}</div>
                  <div className="text-[11px] text-gray-400">{formatFileSize(file.size)}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={analyze}
                    disabled={isAnalyzing}
                    className="px-4 py-2 bg-[#38BDF8] hover:bg-[#0284C7] text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-2"
                  >
                    <ScanSearch size={16} /> Analyze Road
                  </button>
                  <button
                    onClick={reset}
                    disabled={isAnalyzing}
                    className="px-3 py-2 bg-[#1F2937] hover:bg-[#374151] text-gray-300 text-xs font-medium rounded-lg transition"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Feature #7 — Before / After Comparison Card */}
          {comparison && comparison.has_previous && (
            <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-[#1F2937] pb-2">
                <span className="text-xs font-bold text-[#38BDF8] uppercase tracking-wider">
                  Historical Site Trajectory
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  comparison.comparison?.status === 'IMPROVED'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {comparison.comparison?.status} ({comparison.comparison?.improvement_percentage}%)
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-[#1F2937]/50 p-3 rounded-lg border border-[#374151]">
                  <span className="text-gray-400 block text-[11px] mb-1">PREVIOUS INSPECTION</span>
                  <div className="font-bold text-white">Risk: {comparison.previous.risk_score}/100</div>
                  <div className="text-gray-300">{comparison.previous.detection_count} defects</div>
                </div>
                <div className="bg-[#1F2937]/50 p-3 rounded-lg border border-[#374151]">
                  <span className="text-gray-400 block text-[11px] mb-1">CURRENT INSPECTION</span>
                  <div className="font-bold text-white">Risk: {comparison.current.risk_score}/100</div>
                  <div className="text-gray-300">{comparison.current.detection_count} defects</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Intelligence Results */}
        <div className="space-y-6">
          {result ? (
            <>
              {/* Feature #1 — ROAD RISK SCORE */}
              <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-6 shadow-xl space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                      RoadSense AI Risk Score
                    </span>
                    <div className="flex items-baseline gap-3">
                      <span className="text-4xl font-extrabold text-white tracking-tight">
                        {result.risk_score ?? 0}
                      </span>
                      <span className="text-sm text-gray-400">/ 100</span>
                    </div>
                  </div>
                  <RiskBadge score={result.risk_score} level={result.risk_level} />
                </div>

                {result.risk_factors && result.risk_factors.length > 0 && (
                  <div className="bg-[#1F2937]/50 p-3 rounded-lg border border-[#374151] space-y-1 text-xs">
                    <span className="font-bold text-gray-300 block mb-1">Risk Factors Identified:</span>
                    {result.risk_factors.map((f, i) => (
                      <div key={i} className="text-gray-300 flex items-center gap-1.5">
                        <span className="text-[#38BDF8]">✓</span> {f}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Feature #2 — AI MAINTENANCE RECOMMENDATION */}
              <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-6 shadow-xl space-y-4">
                <div className="flex justify-between items-center border-b border-[#1F2937] pb-3">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    AI Maintenance Recommendation
                  </h3>
                  <PriorityCodeBadge code={rec.priority_code} label={rec.priority_label} />
                </div>

                <div className="space-y-2">
                  <span className="text-xs text-gray-400 block">RECOMMENDED ACTION</span>
                  <p className="text-sm font-bold text-white bg-[#1F2937] p-3 rounded-lg border border-[#374151]">
                    {rec.action || 'Schedule maintenance.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs pt-2">
                  <div className="bg-[#1F2937]/50 p-3 rounded-lg border border-[#374151]">
                    <span className="text-gray-400 block mb-1">OVERALL SEVERITY</span>
                    <SeverityBadge value={result.overall_severity} />
                  </div>
                  <div className="bg-[#1F2937]/50 p-3 rounded-lg border border-[#374151]">
                    <span className="text-gray-400 block mb-1">ESTIMATED REPAIR</span>
                    <span className="font-bold text-base text-[#22C55E]">
                      ₹{(result.total_estimated_cost || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Feature #6 — AI EXPLAINABILITY PANEL */}
              {explain.summary && (
                <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-6 shadow-xl space-y-3">
                  <h3 className="text-xs font-bold text-[#38BDF8] uppercase tracking-wider flex items-center gap-1.5">
                    <Activity size={15} /> AI Explainability Panel ("Why This Result?")
                  </h3>
                  <p className="text-xs text-gray-300 leading-relaxed bg-[#1F2937]/40 p-3 rounded-lg border border-[#374151]">
                    {explain.summary}
                  </p>
                </div>
              )}

              {/* Detections List */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-500" />
                  Detected Defects ({detections.length})
                </h3>
                {detections.length === 0 ? (
                  <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-6 text-center text-gray-400 text-sm">
                    ✓ Road surface clear — zero defect instances identified above confidence threshold.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {detections.map((det, i) => (
                      <DetectionCard key={i} detection={det} />
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-10 text-center space-y-3 shadow-xl">
              <ScanSearch size={44} className="mx-auto text-gray-600" />
              <h3 className="text-base font-bold text-white">No Inspection Analyzed Yet</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Upload a road surface photograph on the left and click <strong>Analyze Road</strong> to trigger real-time YOLOv8 neural network inference.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Feature #5 — Live Analysis Animation Progress Modal */}
      <AnalysisProgressModal
        isOpen={isAnalyzing}
        stepIndex={stepIndex}
        error={error}
      />

      {/* Feature #8 — Inspection Report Modal */}
      {showReport && (
        <ReportModal
          inspection={result}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
