import { formatConfidence, formatCost, severityValueClass } from '../utils/format';
import { SeverityBadge, PriorityBadge } from './Badges';

export default function DetectionCard({ detection }) {
  const { class_name, confidence, severity, priority, estimated_cost, recommended_action, bbox } = detection;

  return (
    <div className="detection-card">
      <div className="detection-card-header">
        <div>
          <div className="detection-card-name">{class_name}</div>
          <div className="detection-card-confidence">
            Confidence: <strong>{formatConfidence(confidence)}</strong>
          </div>
        </div>
        <SeverityBadge value={severity} />
      </div>

      <div className="detection-grid">
        <div className="detection-item">
          <div className="di-label">Severity</div>
          <div className={`di-value ${severityValueClass(severity)}`}>{severity}</div>
        </div>
        <div className="detection-item">
          <div className="di-label">Priority</div>
          <div className={`di-value ${severityValueClass(priority)}`}>{priority}</div>
        </div>
        <div className="detection-item">
          <div className="di-label">Estimated Repair</div>
          <div className="di-value">{formatCost(estimated_cost)}</div>
        </div>
        <div className="detection-item">
          <div className="di-label">Bounding Box</div>
          <div className="di-value" style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
            [{Math.round(bbox.x1)},{Math.round(bbox.y1)},{Math.round(bbox.x2)},{Math.round(bbox.y2)}]
          </div>
        </div>
      </div>

      {recommended_action && (
        <div className="recommendation-box">
          <div className="rec-label">Recommended Action</div>
          <p>{recommended_action}</p>
        </div>
      )}
    </div>
  );
}
