// src/components/analytics/LastShiftStrip.tsx
import { useEffect, useState } from 'react';
import { getShiftDelta } from '../../db/analytics';
import { ArrowUpRight, FileText, Radio, Package, ClipboardCheck, AlertTriangle } from 'lucide-react';

export default function LastShiftStrip() {
  const [delta, setDelta] = useState<any>(null);

  useEffect(() => {
    const lastVisit = Number(localStorage.getItem('lastTodayVisit') || Date.now() - 28800000); // Default 8h
    getShiftDelta(lastVisit).then(setDelta);
    localStorage.setItem('lastTodayVisit', Date.now().toString());
  }, []);

  if (!delta) return <div className="h-16 bg-[#0A1628]/50 rounded-xl animate-pulse" />;

  const metrics = [
    { label: 'Logbook Entries', value: delta.newLogs, icon: FileText },
    { label: 'Barangay Reports', value: delta.newReports, icon: Radio },
    { label: 'Requests Opened/Closed', value: `${delta.openedReqs}/${delta.closedReqs}`, icon: Package },
    { label: 'SitReps Submitted', value: delta.newSitReps, icon: ClipboardCheck },
    { label: 'EOC Level Changes', value: delta.eocChanges, icon: AlertTriangle, highlight: delta.eocChanges > 0 },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      {metrics.map((m, i) => (
        <div key={i} className={`relative overflow-hidden rounded-xl border border-[#3B82F6]/20 bg-[#0A1628]/60 backdrop-blur-md p-4 ${m.highlight ? 'ring-1 ring-red-500/50' : ''}`}>
          <div className="flex items-center justify-between mb-2">
            <m.icon className={`w-4 h-4 ${m.highlight ? 'text-red-400' : 'text-[#3B82F6]'}`} />
            <ArrowUpRight className="w-3 h-3 text-slate-500" />
          </div>
          <div className="text-2xl font-bold text-white">{m.value}</div>
          <div className="text-xs text-slate-400 mt-1">{m.label}</div>
        </div>
      ))}
    </div>
  );
}
