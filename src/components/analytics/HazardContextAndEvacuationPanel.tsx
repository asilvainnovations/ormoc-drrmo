// src/components/analytics/HazardContextAndEvacuationPanel.tsx
import { useEffect, useState } from 'react';
import { getHazardContext, getEvacuationSitesStatus } from '../../db/analytics';
import { MapPin, AlertTriangle, Building2 } from 'lucide-react';

export default function HazardContextAndEvacuationPanel() {
  const [hazard, setHazard] = useState<any>(null);
  const [evac, setEvac] = useState<any>(null);

  useEffect(() => {
    getHazardContext().then(setHazard);
    getEvacuationSitesStatus().then(setEvac);
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* DDRiVE Hazard Context */}
      <div className="rounded-xl border border-[#3B82F6]/20 bg-[#0A1628]/60 backdrop-blur-md p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#3B82F6]" />
            <h3 className="text-lg font-semibold text-white">Hazard Context</h3>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 bg-slate-800 px-2 py-1 rounded">
            Decision Support Only (ADR-024)
          </span>
        </div>
        {hazard ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div>
                <div className="text-sm font-medium text-red-200">Unreported High-Risk Barangays</div>
                <div className="text-xs text-slate-400">No report in last 12h</div>
              </div>
              <div className="text-2xl font-bold text-red-400">{hazard.unreportedCount} <span className="text-sm text-slate-500">/ {hazard.totalHighRisk}</span></div>
            </div>
            {hazard.unreportedCount > 0 && (
              <div className="text-sm text-slate-300">
                Examples: <span className="text-white font-medium">{hazard.unreportedNames.join(', ')}</span>
              </div>
            )}
            <p className="text-xs text-slate-500 italic mt-2">
              * Cross-referenced with DDRiVE 2026-11-09 flood susceptibility layers. Not an automatic trigger.
            </p>
          </div>
        ) : <div className="text-slate-500 text-sm">Loading hazard cross-reference...</div>}
      </div>

      {/* Evacuation Sites Status (LDRRMP / CDP) */}
      <div className="rounded-xl border border-[#3B82F6]/20 bg-[#0A1628]/60 backdrop-blur-md p-5">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-semibold text-white">Evacuation Centers (LDRRMP/CDP)</h3>
        </div>
        {evac ? (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Total Registered Sites</span>
              <span className="text-white font-bold">{evac.total}</span>
            </div>
            {evac.atRisk > 0 ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-medium text-amber-200">{evac.atRisk} Sites Require Attention</span>
                </div>
                <ul className="text-xs text-slate-300 space-y-1 ml-6 list-disc">
                  {evac.atRiskNames.map((name: string, i: number) => (
                    <li key={i}>{name} <span className="text-slate-500">(e.g., high-liquefaction / pending retrofit)</span></li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-sm text-emerald-400 flex items-center gap-2">
                <Building2 className="w-4 h-4" /> All registered sites cleared for current hazard profile.
              </div>
            )}
          </div>
        ) : <div className="text-slate-500 text-sm">Loading LDRRMP/CDP site data...</div>}
      </div>
    </div>
  );
}
