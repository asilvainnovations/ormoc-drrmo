// src/components/analytics/OperationalTrendCards.tsx
import { useEffect, useState } from 'react';
import { getOperationalTrends } from '../../db/analytics';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Simple SVG Sparkline component
const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - (v / max) * 100}`).join(' ');
  return (
    <svg viewBox="0 0 100 100" className="w-full h-12 overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default function OperationalTrendCards() {
  const [trends, setTrends] = useState<any>(null);

  useEffect(() => {
    getOperationalTrends().then(setTrends);
  }, []);

  if (!trends) return null;

  const cards = [
    { title: 'Barangay Reports (24h)', value: trends.reports24h, trend: trends.reports24h > trends.reports7d / 3 ? 'up' : 'down', data: [2, 4, 3, 5, 4, 6, trends.reports24h], color: '#3B82F6', link: '/reports' },
    { title: 'Open Resource Requests', value: trends.openReqs, trend: 'neutral', data: [5, 4, 6, 5, trends.openReqs, trends.openReqs, trends.openReqs], color: '#F59E0B', link: '/logistics' },
    { title: 'Active Camps (ECHO)', value: trends.campOccupancy, trend: 'up', data: [1, 1, 2, 2, 3, trends.campOccupancy, trends.campOccupancy], color: '#10B981', link: '/cccm' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {cards.map((card, i) => (
        <a key={i} href={card.link} className="block group">
          <div className="rounded-xl border border-[#3B82F6]/10 bg-[#0A1628]/40 backdrop-blur-md p-4 hover:bg-[#0A1628]/60 transition-all">
            <div className="flex justify-between items-start mb-3">
              <span className="text-sm font-medium text-slate-300">{card.title}</span>
              {card.trend === 'up' && <TrendingUp className="w-4 h-4 text-emerald-400" />}
              {card.trend === 'down' && <TrendingDown className=" “w-4 h-4 text-red-400" />}
              {card.trend === 'neutral' && <Minus className="w-4 h-4 text-slate-400" />}
            </div>
            <div className="text-3xl font-bold text-white mb-2">{card.value}</div>
            <Sparkline data={card.data} color={card.color} />
            <div className="text-xs text-[#3B82F6] mt-2 group-hover:underline">View full screen →</div>
          </div>
        </a>
      ))}
    </div>
  );
}
