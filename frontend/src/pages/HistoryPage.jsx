import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Eye, Clock, Filter, Search, AlertCircle, MapPin, MapPinOff, ChevronDown, FileText
} from 'lucide-react';
import { api } from '../services/api';
import { LoadingState, EmptyState, ErrorState } from '../components/States';
import { SeverityBadge, RiskBadge, PriorityCodeBadge } from '../components/Badges';
import ReportModal from '../components/ReportModal';
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

  // Report modal state
  const [selectedReportInspection, setSelectedReportInspection] = useState(null);

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

  const filtered = inspections.filter(row => {
    if (!search.trim()) return true;
    return String(row.id).includes(search.trim());
  });

  const hasMore = inspections.length < total;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#1F2937] pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Inspection History</h1>
          <p className="text-sm text-gray-400">All historical road inspection records enriched with AI Risk Scores & Dispatch Plans.</p>
        </div>
        <div className="text-xs text-gray-400 font-mono">
          Total Records: <strong className="text-white">{total}</strong>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search inspection ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#1F2937] border border-[#374151] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#38BDF8]"
          />
        </div>

        {/* Severity filter */}
        <div className="flex items-center gap-1.5">
          <Filter size={14} className="text-gray-500" />
          {['ALL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'].map(s => (
            <button
              key={s}
              onClick={() => setFilterSeverity(s)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                filterSeverity === s
                  ? 'bg-[#38BDF8] text-slate-950 font-bold'
                  : 'bg-[#1F2937] text-gray-300 hover:bg-[#374151]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* GPS filter */}
        <div className="flex items-center gap-1.5">
          <MapPin size={14} className="text-gray-500" />
          {[
            { id: 'ALL', label: 'All' },
            { id: 'WITH_GPS', label: 'GPS' },
            { id: 'WITHOUT_GPS', label: 'No GPS' }
          ].map(g => (
            <button
              key={g.id}
              onClick={() => setFilterGps(g.id)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                filterGps === g.id
                  ? 'bg-[#38BDF8] text-slate-950 font-bold'
                  : 'bg-[#1F2937] text-gray-300 hover:bg-[#374151]'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <button
          onClick={refresh}
          disabled={refreshing}
          className="p-2 bg-[#1F2937] hover:bg-[#374151] text-gray-300 rounded-lg transition"
          title="Refresh History"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <LoadingState message="Loading inspection records…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : total === 0 ? (
        <EmptyState title="No inspection records" description="Analyze a road image to create the first record." />
      ) : filtered.length === 0 ? (
        <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-8 text-center text-gray-400 text-xs">
          No records matching current filter and search criteria.
        </div>
      ) : (
        <div className="bg-[#111827] border border-[#1F2937] rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-gray-300">
              <thead className="bg-[#1F2937] text-gray-400 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Defects</th>
                  <th className="py-3 px-4">Risk Score</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Est. Cost</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2937]">
                {filtered.map(row => {
                  const hasGps = row.latitude != null && row.longitude != null;
                  const rec = row.maintenance_recommendation || {};
                  return (
                    <tr key={row.id} className="hover:bg-[#1F2937]/50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-[#38BDF8]">#{row.id}</td>
                      <td className="py-3 px-4 text-gray-400">{formatDate(row.created_at)}</td>
                      <td className="py-3 px-4 font-semibold text-white">{row.detection_count}</td>
                      <td className="py-3 px-4">
                        <RiskBadge score={row.risk_score} level={row.risk_level} />
                      </td>
                      <td className="py-3 px-4">
                        <PriorityCodeBadge code={rec.priority_code} label={rec.priority_label} />
                      </td>
                      <td className="py-3 px-4">
                        <SeverityBadge value={row.overall_severity} />
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#22C55E]">
                        {formatCost(row.total_estimated_cost)}
                      </td>
                      <td className="py-3 px-4">
                        {hasGps ? (
                          <span className="text-emerald-400 font-medium flex items-center gap-1">
                            <MapPin size={12} /> Geotagged
                          </span>
                        ) : (
                          <span className="text-gray-500 flex items-center gap-1">
                            <MapPinOff size={12} /> No GPS
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right flex justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedReportInspection(row)}
                          className="p-1.5 bg-[#1F2937] hover:bg-[#374151] text-[#38BDF8] rounded-md transition"
                          title="Generate Report"
                        >
                          <FileText size={14} />
                        </button>
                        <button
                          onClick={() => { setSelectedId(row.id); setPage('detail'); }}
                          className="p-1.5 bg-[#1F2937] hover:bg-[#374151] text-white rounded-md transition"
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="p-4 border-t border-[#1F2937] text-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-4 py-2 bg-[#1F2937] hover:bg-[#374151] text-[#38BDF8] text-xs font-bold rounded-lg transition inline-flex items-center gap-2"
              >
                {loadingMore ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-t-current border-r-transparent rounded-full animate-spin"></span>
                    Loading remaining records…
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} /> Load More ({total - inspections.length} remaining)
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Report Modal */}
      {selectedReportInspection && (
        <ReportModal
          inspection={selectedReportInspection}
          onClose={() => setSelectedReportInspection(null)}
        />
      )}
    </div>
  );
}
