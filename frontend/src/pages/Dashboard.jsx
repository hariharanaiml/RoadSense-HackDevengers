import { useState, useEffect, useCallback } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, IndianRupee,
  RefreshCw, Eye, Clock, Cpu, MapPin, ShieldAlert, Flame, Zap
} from 'lucide-react';
import { api } from '../services/api';
import { useHealth } from '../hooks/useHealth';
import { LoadingState, EmptyState, ErrorState } from '../components/States';
import { SeverityBadge, RiskBadge, PriorityCodeBadge } from '../components/Badges';
import { formatDate, formatCost } from '../utils/format';

const DEFECT_COLORS = [
  '#EF4444', '#F59E0B', '#8B5CF6', '#06B6D4',
  '#22C55E', '#F97316', '#3B82F6'
];

export default function Dashboard({ setPage, setSelectedId }) {
  const { health, loading: healthLoading } = useHealth();
  const [stats, setStats] = useState(null);
  const [priorityQueue, setPriorityQueue] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [statsData, historyData, queueData, hotspotData] = await Promise.all([
        api.getStats(),
        api.getInspectionHistory(8),
        api.getPriorityQueue(5).catch(() => ({ items: [] })),
        api.getHotspots(0.5).catch(() => ({ hotspots: [] }))
      ]);
      setStats(statsData);
      setRecent(Array.isArray(historyData) ? historyData : (historyData?.inspections || []));
      setPriorityQueue(queueData?.items || []);
      setHotspots(hotspotData?.hotspots || []);
    } catch (e) {
      setError(e.message || 'Failed to load command center data');
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

  // Metrics from backend
  const totalInspections = stats?.total_inspections ?? 0;
  const totalDetections = stats?.total_detections ?? 0;
  const totalCost = stats?.total_estimated_cost ?? 0;
  const criticalRoads = stats?.critical_roads_count ?? (stats?.severity_distribution?.HIGH ?? 0);
  const avgRisk = stats?.average_risk_score ?? 0;
  const activeHotspotsCount = stats?.active_hotspots_count ?? hotspots.length;

  const defectEntries = Object.entries(stats?.defect_frequency || {}).sort((a, b) => b[1] - a[1]);
  const maxCount = defectEntries[0]?.[1] || 1;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none text-9xl">🛣️</div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8] animate-ping"></span>
              <span className="text-xs font-mono tracking-widest text-[#38BDF8] uppercase font-bold">
                RoadSense Intelligence Platform
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              AI ROAD MAINTENANCE COMMAND CENTER
            </h1>
            <p className="text-sm text-gray-400 mt-1 max-w-xl">
              Automated defect detection, risk evaluation, geographic hotspot clustering, and repair prioritization.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage('inspect')}
              className="px-4 py-2.5 bg-[#38BDF8] hover:bg-[#0284C7] text-slate-950 font-bold text-sm rounded-lg shadow-lg transition flex items-center gap-2"
            >
              <span>📷</span> Start New Inspection
            </button>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="p-2.5 bg-[#1F2937] hover:bg-[#374151] text-gray-300 rounded-lg transition"
              title="Refresh Command Center"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Inspections"
          value={totalInspections}
          sub="Stored in database"
          icon={<Activity size={18} />}
          iconBg="rgba(56, 189, 248, 0.15)"
          iconColor="#38BDF8"
        />
        <StatCard
          label="Defects Identified"
          value={totalDetections}
          sub="Across all road networks"
          icon={<AlertTriangle size={18} />}
          iconBg="rgba(245, 158, 11, 0.15)"
          iconColor="#F59E0B"
        />
        <StatCard
          label="Critical Road Sites"
          value={criticalRoads}
          sub="Requires urgent action"
          icon={<ShieldAlert size={18} />}
          iconBg="rgba(239, 68, 68, 0.15)"
          iconColor="#EF4444"
        />
        <StatCard
          label="Est. Total Repair Cost"
          value={formatCost(totalCost)}
          sub="Municipal budget estimate"
          icon={<IndianRupee size={18} />}
          iconBg="rgba(34, 197, 94, 0.15)"
          iconColor="#22C55E"
        />
      </div>

      {/* AI Network Status Bar */}
      {!healthLoading && health && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-[#38BDF8]/10 text-[#38BDF8] rounded-lg">
              <Zap size={18} />
            </div>
            <div>
              <div className="text-xs text-gray-400">Network Avg. Risk</div>
              <div className="mt-0.5">
                <RiskBadge score={avgRisk} level={avgRisk >= 81 ? 'CRITICAL' : (avgRisk >= 61 ? 'HIGH' : (avgRisk >= 31 ? 'MODERATE' : 'LOW'))} />
              </div>
            </div>
          </div>

          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-lg">
              <Flame size={18} />
            </div>
            <div>
              <div className="text-xs text-gray-400">Active Hotspot Zones</div>
              <div className="text-sm font-bold text-white mt-0.5">
                {activeHotspotsCount} Geographic Cluster{activeHotspotsCount !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 text-cyan-500 rounded-lg">
              <MapPin size={18} />
            </div>
            <div>
              <div className="text-xs text-gray-400">GPS Geotag Coverage</div>
              <div className="text-sm font-bold text-white mt-0.5">
                {stats?.gps_coverage?.with_gps ?? 0} Geotagged Sites
              </div>
            </div>
          </div>

          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-lg">
              <Cpu size={18} />
            </div>
            <div>
              <div className="text-xs text-gray-400">YOLOv8 Engine Status</div>
              <div className="text-sm font-bold text-emerald-400 mt-0.5">
                ✓ Ready ({health.classes?.length || 7} classes)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feature #3 — MAINTENANCE PRIORITY QUEUE */}
      <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#1F2937] pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="text-red-500" size={20} />
              <h2 className="text-lg font-bold text-white tracking-tight">
                MAINTENANCE PRIORITY QUEUE
              </h2>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              High-priority sites requiring immediate municipal dispatch ordered by Risk & Cost.
            </p>
          </div>
          <button
            onClick={() => setPage('history')}
            className="text-xs text-[#38BDF8] hover:underline font-medium"
          >
            View Full Queue →
          </button>
        </div>

        {priorityQueue.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">
            No high-priority maintenance items in queue. All road sections clear!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {priorityQueue.map((item) => {
              const rec = item.maintenance_recommendation || {};
              return (
                <div
                  key={item.id}
                  className="bg-[#1F2937]/50 border border-[#374151] rounded-xl p-4 hover:border-[#38BDF8] transition cursor-pointer flex flex-col justify-between"
                  onClick={() => { setSelectedId(item.id); setPage('detail'); }}
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <PriorityCodeBadge code={rec.priority_code} label={rec.priority_label} />
                      <RiskBadge level={item.risk_level} score={item.risk_score} />
                    </div>
                    <h3 className="text-sm font-bold text-white truncate mb-1">
                      {item.road_name || `Inspection #${item.id}`}
                    </h3>
                    <p className="text-xs text-gray-300 line-clamp-2 mb-3">
                      {rec.action || 'Schedule maintenance repair.'}
                    </p>
                  </div>

                  <div className="border-t border-[#374151] pt-3 flex justify-between items-center text-xs">
                    <span className="text-gray-400">
                      {item.detection_count} Defect{item.detection_count !== 1 ? 's' : ''}
                    </span>
                    <span className="font-bold text-[#22C55E]">
                      ₹{(item.total_estimated_cost || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Content Grid: Recent Inspections & Defect Frequencies */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Inspections Table */}
        <div className="lg:col-span-2 bg-[#111827] border border-[#1F2937] rounded-xl shadow-xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#1F2937] flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Recent Inspections</h2>
              <p className="text-xs text-gray-400">Latest road scan submissions</p>
            </div>
            <button
              className="text-xs text-[#38BDF8] hover:underline font-medium"
              onClick={() => setPage('history')}
            >
              History Page →
            </button>
          </div>

          {loading ? (
            <LoadingState message="Loading inspection records…" />
          ) : error ? (
            <ErrorState message={error} />
          ) : recent.length === 0 ? (
            <EmptyState
              title="No inspections recorded"
              description="Upload a road image to trigger YOLOv8 AI detection"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-gray-300">
                <thead className="bg-[#1F2937] text-gray-400 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">Defects</th>
                    <th className="py-3 px-4">Risk Score</th>
                    <th className="py-3 px-4">Severity</th>
                    <th className="py-3 px-4">Cost</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2937]">
                  {recent.map((row) => (
                    <tr key={row.id} className="hover:bg-[#1F2937]/50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-[#38BDF8]">#{row.id}</td>
                      <td className="py-3 px-4 text-gray-400">{formatDate(row.created_at)}</td>
                      <td className="py-3 px-4 font-semibold text-white">{row.detection_count}</td>
                      <td className="py-3 px-4">
                        <RiskBadge score={row.risk_score} level={row.risk_level} />
                      </td>
                      <td className="py-3 px-4">
                        <SeverityBadge value={row.overall_severity} />
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#22C55E]">
                        {formatCost(row.total_estimated_cost)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => { setSelectedId(row.id); setPage('detail'); }}
                          className="p-1.5 bg-[#1F2937] hover:bg-[#374151] text-[#38BDF8] rounded-md transition"
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Defect Frequency Panel */}
        <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white mb-1">Defect Frequency Distribution</h2>
            <p className="text-xs text-gray-400 mb-4">Total occurrences by class</p>

            {defectEntries.length === 0 ? (
              <EmptyState title="No defect statistics" />
            ) : (
              <div className="space-y-3">
                {defectEntries.map(([name, count], i) => (
                  <div key={name} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="capitalize text-gray-200">{name}</span>
                      <span className="font-mono text-gray-400">{count}</span>
                    </div>
                    <div className="w-full h-2 bg-[#1F2937] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(count / maxCount) * 100}%`,
                          backgroundColor: DEFECT_COLORS[i % DEFECT_COLORS.length]
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-[#1F2937] text-center">
            <button
              onClick={() => setPage('map')}
              className="w-full py-2 bg-[#1F2937] hover:bg-[#374151] text-[#38BDF8] font-medium text-xs rounded-lg transition flex items-center justify-center gap-2"
            >
              <span>🗺️</span> View Hotspots on GIS Map
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon, iconBg, iconColor }) {
  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
        <div className="p-2.5 rounded-lg" style={{ backgroundColor: iconBg, color: iconColor }}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-black text-white tracking-tight">{value ?? '—'}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}
