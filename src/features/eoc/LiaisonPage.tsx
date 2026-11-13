import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { currentLevel } from '@/domain/eoc';
import { clusterStatus } from '@/domain/structure';
import { fmtDate, relative } from '@/lib/time';
import { Badge, Button, ButtonLink, EmptyState, List, ListRow, Notice, PageHeader, Section, Tabs } from '@/components/ui';
import { EOC_TABS, HAZARD_TAG } from './labels';

/** Barangay Liaison Desk (EOC Module, Brief Assessment): six barangay clusters, who has reported and who is silent. */
export function LiaisonPage() {
  const [openCode, setOpenCode] = useState<string | null>(null);
  const data = useLiveQuery(async () => {
    const { activation } = currentLevel(await db.eoc_activations.toArray());
    const clusters = await db.barangay_clusters.toArray();
    const barangays = await db.barangays.toArray();
    const reports = activation ? await db.barangay_reports.toArray() : [];
    // 1.21.0 (ADR-039): DDRiVE priority ranks, so the desk calls the high-risk silent barangays first.
    const priority = new Map((await db.ddrive_priority.toArray()).map((p) => [p.psgc, p.priority_rank]));
    return { activation, rows: clusterStatus(clusters, barangays, reports, activation?.id ?? null), barangays, priority, unassigned: barangays.filter((b) => !b.cluster_id).length };
  }, []);
  if (!data) return null;
  const totalSilent = data.rows.reduce((s, r) => s + r.silent, 0);

  return (
    <div className="page">
      <PageHeader title="Barangay Liaison Desk" subtitle="Reporting by barangay cluster in the current activation. A silent barangay has not reported since the EOC was raised. Counts only, no names of persons." />
      <Tabs items={EOC_TABS} />
      {!data.activation && <Notice tone="info" title="The EOC is at White level">Cluster reporting starts when the EOC is raised to Blue or Red. The clusters and their barangays are shown below.</Notice>}
      {data.activation && totalSilent > 0 && <Notice tone="warn" title={`${totalSilent} barangay${totalSilent === 1 ? '' : 's'} not yet reporting`}>Call the cluster desk or the barangay directly, then record the report on the Barangays tab.</Notice>}
      {data.unassigned > 0 && data.rows.length > 0 && <Notice tone="info">{data.unassigned} barangays are not yet in a cluster. The barangay list in Settings sets the cluster.</Notice>}
      {data.rows.length === 0 ? <EmptyState title="No barangay clusters yet" body="They arrive with the EOC structure data (operational file 06)." /> : (
        <Section title="Clusters">
          <List>
            {data.rows.map((r) => (
              <ListRow key={r.cluster.id} tip="Show the barangays in this cluster" onClick={() => setOpenCode(openCode === r.cluster.code ? null : r.cluster.code)}
                title={`${r.cluster.code} ${r.cluster.name}`}
                meta={data.activation
                  ? `${r.reporting} of ${r.barangays} reporting. ${r.affected} affected. ${r.personsEvacuated.toLocaleString('en-PH')} persons evacuated.${r.lastReportAt ? ` Last report ${relative(r.lastReportAt)}.` : ''}`
                  : `${r.barangays} barangays.${r.cluster.is_pilot ? ` Coordinator pilot ${fmtDate(r.cluster.pilot_from)} to ${fmtDate(r.cluster.pilot_to)}.` : ''}`}
                trailing={<span className="flex gap-1.5">
                  {r.cluster.is_pilot && <Badge tone="info">Pilot</Badge>}
                  {data.activation && <Badge tone={r.silent ? 'warn' : 'ok'}>{r.silent ? `${r.silent} silent` : 'All reporting'}</Badge>}
                </span>} />
            ))}
          </List>
        </Section>
      )}
      {openCode && (() => {
        const r = data.rows.find((x) => x.cluster.code === openCode)!;
        // Silent barangays first, highest DDRiVE priority first (decision support, never a trigger);
        // reporting barangays follow alphabetically.
        const members = data.barangays.filter((b) => b.cluster_id === r.cluster.id).sort((a, b) => {
          const sa = data.activation && r.silentNames.includes(a.name) ? 0 : 1;
          const sb = data.activation && r.silentNames.includes(b.name) ? 0 : 1;
          if (sa !== sb) return sa - sb;
          if (sa === 0) return (data.priority.get(a.psgc) ?? Infinity) - (data.priority.get(b.psgc) ?? Infinity) || a.name.localeCompare(b.name);
          return a.name.localeCompare(b.name);
        });
        return (
          <Section title={`${r.cluster.code} barangays`} action={<Button tip="Hide this list" variant="quiet" onClick={() => setOpenCode(null)}>Close</Button>}>
            {r.cluster.note && <p className="mb-2 text-sm text-muted">{r.cluster.note}</p>}
            {data.activation && r.silent > 0 && <p className="mb-2 text-sm text-muted">Silent barangays are listed in DDRiVE priority order: call the high-risk ones first (B5.2, B3.2).</p>}
            <ul className="grid gap-2 sm:grid-cols-2">
              {members.map((b) => (
                <li key={b.psgc} className="rounded-control border border-line bg-surface px-3 py-2">
                  <span className="font-semibold">{b.name}</span>
                  {data.activation && r.silentNames.includes(b.name) && <Badge tone="warn" className="ml-2">Silent</Badge>}
                  {data.activation && r.silentNames.includes(b.name) && data.priority.get(b.psgc) != null && <Badge tone="info" className="ml-2">DDRiVE #{data.priority.get(b.psgc)}</Badge>}
                  {(b.hazard_tags ?? []).length > 0 && <span className="mt-1 block text-xs text-muted">{(b.hazard_tags ?? []).map((t) => HAZARD_TAG[t] ?? t).join(' · ')}</span>}
                </li>
              ))}
            </ul>
            <div className="mt-3"><ButtonLink tip="Record a barangay's status report" to="/eoc/barangays">Record a report</ButtonLink></div>
          </Section>
        );
      })()}
    </div>
  );
}
