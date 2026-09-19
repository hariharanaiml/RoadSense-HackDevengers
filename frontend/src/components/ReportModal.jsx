import React from 'react';
import { RiskBadge, PriorityCodeBadge, SeverityBadge } from './Badges';

export default function ReportModal({ inspection, onClose }) {
  if (!inspection) return null;

  const handlePrint = () => {
    window.print();
  };

  const rec = inspection.maintenance_recommendation || {};
  const explain = inspection.explainability || {};
  const detections = inspection.detections || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#111827] border border-[#1F2937] rounded-xl shadow-2xl max-w-3xl w-full text-[#F9FAFB] p-6 max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:border-none print:bg-white print:text-black print:p-0">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b border-[#1F2937] pb-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#38BDF8]"></span>
              <h2 className="text-xl font-bold tracking-tight text-[#38BDF8] print:text-black">
                ROADSENSE AI ROAD INSPECTION REPORT
              </h2>
            </div>
            <p className="text-sm text-gray-400 mt-1 print:text-gray-600">
              Inspection ID #{inspection.id} | Generated on {new Date(inspection.created_at || Date.now()).toLocaleString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl font-bold px-2 py-1 rounded print:hidden"
          >
            &times;
          </button>
        </div>

        {/* Location Badge */}
        <div className="bg-[#1F2937]/50 rounded-lg p-3 mb-6 flex items-center justify-between border border-[#374151] print:bg-gray-100 print:border-gray-300">
          <div className="flex items-center gap-2">
            <span className="text-lg">📍</span>
            <span className="font-medium text-sm">
              {inspection.latitude && inspection.longitude
                ? `GPS Site (${inspection.latitude.toFixed(5)}, ${inspection.longitude.toFixed(5)})`
                : 'No GPS Coordinates Recorded'}
            </span>
          </div>
          {inspection.latitude && inspection.longitude && (
            <a
              href={`https://www.openstreetmap.org/?mlat=${inspection.latitude}&mlon=${inspection.longitude}#map=17/${inspection.latitude}/${inspection.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#38BDF8] hover:underline print:hidden"
            >
              Open map view ↗
            </a>
          )}
        </div>

        {/* Executive Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#1F2937] p-3 rounded-lg border border-[#374151] text-center print:border-gray-300 print:bg-gray-50">
            <span className="text-xs text-gray-400 block mb-1">ROAD RISK SCORE</span>
            <RiskBadge level={inspection.risk_level} score={inspection.risk_score} />
          </div>

          <div className="bg-[#1F2937] p-3 rounded-lg border border-[#374151] text-center print:border-gray-300 print:bg-gray-50">
            <span className="text-xs text-gray-400 block mb-1">PRIORITY</span>
            <PriorityCodeBadge code={rec.priority_code} label={rec.priority_label} />
          </div>

          <div className="bg-[#1F2937] p-3 rounded-lg border border-[#374151] text-center print:border-gray-300 print:bg-gray-50">
            <span className="text-xs text-gray-400 block mb-1">OVERALL SEVERITY</span>
            <SeverityBadge value={inspection.overall_severity} />
          </div>

          <div className="bg-[#1F2937] p-3 rounded-lg border border-[#374151] text-center print:border-gray-300 print:bg-gray-50">
            <span className="text-xs text-gray-400 block mb-1">ESTIMATED REPAIR</span>
            <span className="text-base font-bold text-[#22C55E]">
              ₹{(inspection.total_estimated_cost || 0).toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Maintenance Recommendation */}
        <div className="bg-[#1E293B] border-l-4 border-[#38BDF8] p-4 rounded-r-lg mb-6 print:border-gray-400 print:bg-gray-100">
          <h3 className="text-sm font-semibold text-[#38BDF8] uppercase tracking-wider mb-2 print:text-black">
            AI Maintenance Recommendation
          </h3>
          <p className="font-semibold text-base mb-2 text-white print:text-black">
            {rec.action || 'Routine Maintenance Patrol'}
          </p>
          {rec.reasons && (
            <ul className="list-disc list-inside text-xs text-gray-300 space-y-1 print:text-gray-700">
              {rec.reasons.map((r, idx) => (
                <li key={idx}>{r}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Detected Defects Table */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 print:text-black">
            Detected Road Defects ({detections.length})
          </h3>
          {detections.length === 0 ? (
            <div className="text-center py-6 bg-[#1F2937] rounded-lg text-gray-400 text-sm">
              No defect instances identified on road surface.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-gray-300 border border-[#374151] rounded-lg overflow-hidden print:border-gray-300">
                <thead className="bg-[#1F2937] text-gray-200 uppercase font-semibold print:bg-gray-200 print:text-black">
                  <tr>
                    <th className="py-2 px-3">Defect Class</th>
                    <th className="py-2 px-3">Confidence</th>
                    <th className="py-2 px-3">Severity</th>
                    <th className="py-2 px-3">Est. Cost</th>
                    <th className="py-2 px-3">Recommended Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#374151] print:divide-gray-300">
                  {detections.map((det, i) => (
                    <tr key={i} className="hover:bg-[#1E293B]">
                      <td className="py-2 px-3 font-medium capitalize text-white print:text-black">{det.class_name}</td>
                      <td className="py-2 px-3 font-mono">{Math.round((det.confidence || 0) * 100)}%</td>
                      <td className="py-2 px-3"><SeverityBadge value={det.severity} /></td>
                      <td className="py-2 px-3 font-medium">₹{(det.estimated_cost || 0).toLocaleString('en-IN')}</td>
                      <td className="py-2 px-3 text-gray-300 print:text-gray-800">{det.recommended_action || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* AI Explainability */}
        {explain.risk_reasons && explain.risk_reasons.length > 0 && (
          <div className="mb-6 bg-[#1F2937]/50 p-4 rounded-lg border border-[#374151] print:border-gray-300">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 print:text-black">
              AI Risk Justification
            </h4>
            <ul className="list-disc list-inside text-xs text-gray-300 space-y-1 print:text-gray-700">
              {explain.risk_reasons.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 border-t border-[#1F2937] pt-4 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#1F2937] hover:bg-[#374151] text-white text-sm font-medium rounded-lg transition"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-[#38BDF8] hover:bg-[#0284C7] text-slate-950 font-bold text-sm rounded-lg transition flex items-center gap-2"
          >
            🖨️ Print / Save PDF Report
          </button>
        </div>

      </div>
    </div>
  );
}
