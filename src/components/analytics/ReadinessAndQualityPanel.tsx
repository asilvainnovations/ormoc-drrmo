// src/components/analytics/ReadinessAndQualityPanel.tsx
import { useEffect, useState } from 'react';
import { getReadinessTrend, getDataQualityFlags } from '../../db/analytics';
import { ShieldCheck, AlertCircle, Database, Clock } from 'lucide-react';

export default function ReadinessAndQualityPanel() {
  const [readiness, setReadiness] = useState<any>(null);
  const [quality, setQuality] = useState<any>(null);

  useEffect(() => {
    getReadinessTrend().then(setReadiness);
    getDataQualityFlags().then(setQuality);
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      {/* Readiness Trend */}
      <div className="rounded-xl border border-[#3B82F6]/20 bg-[#0A1628]/60 backdrop-blur-md p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-[#3B82F6]" />
          <h3 className="text-lg font-semibold text-white">IAT Readiness Trend</h3>
        </div>
        {readiness ? (
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <div>
                <div className="text-sm text-slate-400">Current Maturity Index</div>
                <div className="text-3xl font-bold text-white">{readiness.currentScore.toFixed(2)} <span className="text-sm text-slate-500">/ 4.0</span></div>
              </div>
              <div className={`text-sm font-medium px-2 py-1 rounded ${readiness.delta >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                {readiness.delta >= 0 ? '+' : ''}{readiness.delta.toFixed(2)} vs last cycle
              </div>
            </div>
            <div className="text-sm text-slate-400">
              {readiness.metItemsDelta > 0 ? `+${readiness.metItemsDelta}` : readiness.metItemsDelta} mandatory items met since last assessment.
            </div>
          </div>
        ) : <div className="text-slate-500 text-sm">Awaiting historical IAT data...</div>}
      </div>

      {/* Data Quality Flags */}
      <div className="rounded-xl border border-red-500/20 bg-[#0A1628]/60 backdrop-blur-md p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-semibold text-white">Data Quality & Staleness</h3>
        </div>
        {quality ? (
          <ul className="space-y-3 text-sm">
            {quality.staleBarangays > 0 && (
              <li className="flex items-center gap-2 text-amber-200">
                <Clock className="w-4 h-4" /> {quality.staleBarangays} barangays with no report in &gt;12h
              </li>
            )}
            {quality.oldestOutbox && (
              <li className="flex items-center gap-2 text-red-300">
                <Database className="w-4 h-4" /> Oldest unsent outbox item: {new Date(quality.oldestOutbox).toLocaleTimeString()}
              </li>
            )}
            {quality.syncConflicts > 0 && (
              <li className="flex items-center gap-2 text-red-300">
                <AlertCircle className="w- is-4 h-4" /> {quality.syncConflicts} unresolved sync conflicts
              </li>
            )}
            {quality.unconfirmedIAT > 0 && (
              <li className="flex items-center gap-2 text-slate-300">
                <ShieldCheck className="w-4 h-4" /> {quality.unconfirmedIAT} pre-filled EOC assessment answers unconfirmed
              </li>
            )}
            {quality.staleBarangays === 0 && !quality.oldestOutbox && quality.syncConflicts === 0 && (
              <li className="text-emerald-400 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> All systems nominal. Data is fresh.</li>
            )}
          </ul>
        ) : <div className="text-slate-500 text-sm">Scanning local data integrity...</div>}
      </div>
    </div>
  );
}
