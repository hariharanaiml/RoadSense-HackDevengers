import React from 'react';

const STEPS = [
  { id: 1, label: 'Validating image format & file integrity' },
  { id: 2, label: 'Initializing YOLOv8 neural network' },
  { id: 3, label: 'Detecting road defects & surface damage' },
  { id: 4, label: 'Calculating RoadSense AI Risk Score (0-100)' },
  { id: 5, label: 'Generating maintenance priority & cost recommendations' }
];

export default function AnalysisProgressModal({ isOpen, stepIndex, error }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-[#111827] border border-[#1F2937] rounded-2xl shadow-2xl max-w-md w-full p-6 text-white text-center">
        
        {/* Animated Scanner Graphic */}
        <div className="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-t-[#38BDF8] border-r-transparent border-b-[#0EA5E9] border-l-transparent animate-spin"></div>
          <div className="absolute inset-2 rounded-full border-2 border-[#38BDF8]/30"></div>
          <span className="text-3xl">🛣️</span>
        </div>

        <h3 className="text-xl font-bold text-white mb-1">
          ANALYZING ROAD IMAGE
        </h3>
        <p className="text-xs text-gray-400 mb-6">
          RoadSense AI Pipeline in progress
        </p>

        {/* Step list */}
        <div className="space-y-3 text-left mb-6 bg-[#1F2937]/50 p-4 rounded-xl border border-[#374151]">
          {STEPS.map((step, idx) => {
            const isDone = idx < stepIndex;
            const isCurrent = idx === stepIndex;

            return (
              <div key={step.id} className="flex items-center gap-3 text-xs">
                {isDone ? (
                  <span className="w-5 h-5 rounded-full bg-[#22C55E]/20 text-[#22C55E] flex items-center justify-center font-bold text-xs shrink-0">
                    ✓
                  </span>
                ) : isCurrent ? (
                  <span className="w-5 h-5 rounded-full bg-[#38BDF8]/20 text-[#38BDF8] flex items-center justify-center font-bold text-xs shrink-0 animate-pulse">
                    ●
                  </span>
                ) : (
                  <span className="w-5 h-5 rounded-full bg-[#374151] text-gray-500 flex items-center justify-center font-bold text-xs shrink-0">
                    {step.id}
                  </span>
                )}
                <span className={isDone ? 'text-gray-200 font-medium' : isCurrent ? 'text-[#38BDF8] font-semibold' : 'text-gray-500'}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {error ? (
          <div className="text-red-400 text-xs bg-red-950/40 p-3 rounded-lg border border-red-800/50">
            ⚠ {error}
          </div>
        ) : (
          <p className="text-[11px] text-gray-500 italic">
            Please wait while YOLOv8 and Road Intelligence execute...
          </p>
        )}
      </div>
    </div>
  );
}
