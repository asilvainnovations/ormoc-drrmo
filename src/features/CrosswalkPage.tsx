import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { PageHeader, Section, Tabs } from '@/components/ui';
import { LIB_TABS } from './labels';

export function CrosswalkPage() {
  const rows = useLiveQuery(() => db.framework_crosswalk.orderBy('sort').toArray(), [], []);
  const table = (fw: 'UNDRR DRSC' | 'RA 12287 IRR', head: string) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <thead><tr className="border-b border-line text-left"><th className="py-2 pr-3">{head}</th><th className="py-2 pr-3">Subject</th><th className="py-2 pr-3">Treatment</th><th className="py-2 pr-3">IAT indicators</th><th className="py-2">Note</th></tr></thead>
        <tbody>{rows.filter((r) => r.framework === fw).map((r) => (
          <tr key={r.sort} className="border-b border-line align-top"><td className="py-2 pr-3 font-semibold">{r.ref}</td><td className="py-2 pr-3">{r.subject}</td>
            <td className="py-2 pr-3">{r.treatment}</td><td className="py-2 pr-3">{r.indicators}</td><td className="py-2 text-muted">{r.note}</td></tr>))}</tbody>
      </table>
    </div>
  );
  return (
    <div className="page">
      <PageHeader title="Frameworks" subtitle="How the IAT covers the UNDRR Disaster Resilience Scorecard and the IRR of RA 12287." />
      <Tabs items={LIB_TABS} />
      <Section title="UNDRR Disaster Resilience Scorecard (detailed level)">{table('UNDRR DRSC', 'Criterion')}</Section>
      <Section title="IRR of RA 12287">{table('RA 12287 IRR', 'Provision')}</Section>
    </div>
  );
}
