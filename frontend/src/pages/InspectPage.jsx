import { useState, useRef, useCallback } from 'react';
import {
  UploadCloud, X, ScanSearch, CheckCircle2, AlertTriangle,
  Zap, Image as ImageIcon, AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { formatFileSize, formatCost, severityValueClass } from '../utils/format';
import { SeverityBadge } from '../components/Badges';
import DetectionCard from '../components/DetectionCard';

const STEPS = [
  { id: 'upload', label: 'Uploading image…' },
  { id: 'preprocess', label: 'Pre-processing image…' },
  { id: 'inference', label: 'Running YOLO inference…' },
  { id: 'analyze', label: 'Applying road intelligence…' },
  { id: 'save', label: 'Saving to database…' },
];

export default function InspectPage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [drag, setDrag] = useState(false);
  const [step, setStep] = useState(-1); // -1 = idle, 0..4 = progress
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef();

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
    setError(null);
    setStep(-1);
  };

  const analyze = async () => {
    setError(null);
    setResult(null);

    // Simulate step-by-step progress while awaiting real API
    let done = false;
    let si = 0;
    setStep(0);

    const ticker = setInterval(() => {
      if (done) return;
      si = Math.min(si + 1, STEPS.length - 2);
      setStep(si);
    }, 600);

    try {
      const data = await api.analyzeInspection(file);
      clearInterval(ticker);
      done = true;
      setStep(STEPS.length); // all done
      setResult(data);
    } catch (e) {
      clearInterval(ticker);
      done = true;
      setStep(-1);
      setError(e.message || 'Analysis failed. Please try again.');
    }
  };

  const analysisRunning = step >= 0 && step < STEPS.length;
  const analysisDone = step === STEPS.length;

  return (
    <>
      <div className="page-header">
        <div className="page-title">Inspect Road</div>
        <div className="page-desc">Upload a road image for real-time AI damage detection using YOLOv8.</div>
      </div>

      {error && (
        <div className="error-banner" style={{ marginBottom: 20 }}>
          <AlertCircle size={16} />
          <p>{error}</p>
        </div>
      )}

      <div className="inspect-layout">
        {/* LEFT: Upload + Progress */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Upload zone */}
          {!file ? (
            <label
              className={`upload-zone ${drag ? 'drag-over' : ''}`}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              htmlFor="road-upload"
            >
              <input
                id="road-upload"
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={e => pickFile(e.target.files[0])}
              />
              <div className="upload-icon">
                <UploadCloud size={26} />
              </div>
              <h3>Drop a road image here</h3>
              <p>or click to browse your files</p>
              <div className="formats">Supports: JPEG · PNG · WebP · BMP · up to 20 MB</div>
            </label>
          ) : (
            <div className="image-preview">
              <img src={preview} alt="Selected road" />
              <div className="image-preview-info">
                <div className="image-preview-name">{file.name}</div>
                <div className="image-preview-size">{formatFileSize(file.size)}</div>
                <div className="image-preview-actions">
                  <button className="btn btn-primary" onClick={analyze} disabled={analysisRunning}>
                    <ScanSearch size={14} />
                    {analysisRunning ? 'Analyzing…' : 'Analyze Road'}
                  </button>
                  {!analysisRunning && (
                    <button className="btn btn-ghost" onClick={reset}>
                      <X size={14} />
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Progress */}
          {analysisRunning && (
            <div className="analysis-progress">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
                <div className="spinner" />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  Analyzing…
                </span>
              </div>
              <div className="progress-steps">
                {STEPS.map((s, i) => {
                  const done = i < step;
                  const active = i === step;
                  return (
                    <div
                      key={s.id}
                      className={`progress-step ${active ? 'active' : done ? 'done' : 'pending'}`}
                    >
                      {done ? <CheckCircle2 className="step-icon" size={16} /> :
                       active ? <Zap className="step-icon" size={16} /> :
                       <div className="step-icon" style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid currentColor', opacity: 0.3 }} />
                      }
                      {s.label}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Success message */}
          {analysisDone && result && (
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 'var(--r-md)', padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
              <CheckCircle2 size={16} style={{ color: '#4ade80' }} />
              <p style={{ fontSize: 13, color: '#86efac' }}>
                Analysis complete — <strong>{result.detection_count ?? result.detections?.length ?? 0}</strong> defect(s) detected. Saved to database as inspection <strong>#{result.inspection_id || result.id}</strong>.
              </p>
            </div>
          )}

          {/* Preview of analyzed image */}
          {analysisDone && preview && (
            <div>
              <div className="section-title" style={{ marginBottom: 10 }}>
                <ImageIcon size={14} style={{ display: 'inline', marginRight: 6 }} />
                Submitted Image
              </div>
              <div className="analyzed-image-wrap">
                <img src={preview} alt="Analyzed road" />
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {analysisDone && result ? (
            <>
              {/* Summary metrics */}
              <div className="result-summary">
                <ResultMetric label="Defects" value={result.detection_count ?? result.detections?.length ?? 0} cls="count" />
                <ResultMetric label="Severity" value={result.overall_severity || 'NONE'} cls={severityValueClass(result.overall_severity)} />
                <ResultMetric label="Priority" value={result.overall_priority || result.priority || 'NONE'} cls={severityValueClass(result.overall_priority || result.priority)} />
                <ResultMetric label="Est. Cost" value={formatCost(result.total_estimated_cost)} cls="cost" />
              </div>

              {/* Detections */}
              {result.detections?.length > 0 ? (
                <>
                  <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={15} />
                    Detected Defects ({result.detections.length})
                  </div>
                  <div className="detections-list">
                    {result.detections.map((d, i) => (
                      <DetectionCard key={i} detection={d} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="stat-card" style={{ textAlign: 'center', padding: 32 }}>
                  <CheckCircle2 size={32} style={{ color: '#22c55e', margin: '0 auto 10px' }} />
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 16 }}>Road is clear</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>No road damage detected above confidence threshold.</div>
                </div>
              )}
            </>
          ) : (
            !file ? (
              <div className="stat-card" style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
                <ScanSearch size={40} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>Results appear here</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>Upload a road image and click Analyze to see real AI detections.</div>
                </div>
              </div>
            ) : null
          )}
        </div>
      </div>
    </>
  );
}

function ResultMetric({ label, value, cls }) {
  return (
    <div className="result-metric">
      <div className="label">{label}</div>
      <div className={`value ${cls}`}>{value}</div>
    </div>
  );
}
