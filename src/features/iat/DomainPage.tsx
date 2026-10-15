import { useParams } from 'react-router-dom';
import { Badge, List, ListRow, Loading, PageHeader } from '@/components/ui';
import { gapPriorityScore, priorityBand } from '@/domain/scoring';
import { useCycleData } from './data';
import { RESPONSE_STATUS } from './labels';

export function DomainPage() {
  const { cycleId, domain } = useParams();
  const data = useCycleData(cycleId);
  if (!data) return <Loading />;
  const d = data.domains.find((x) => x.code === domain);
  if (!d) return <div className="page"><PageHeader title="Domain not found" back={`/assess/${cycleId}`} /></div>;
  const r = data.results.domains[d.code]!;
  const items = data.indicators.filter((i) => i.domain === d.code);
  return (
    <div className="page">
      <PageHeader title={`${d.code} ${d.name}`} back={`/assess/${cycleId}`}
        subtitle={<>{d.scope}<br />{r.maturityIndex === null ? 'Not scored yet' : `Maturity ${r.maturityIndex.toFixed(2)} (${r.band}). ${r.scored} of ${r.indicators} scored.`}</>} />
      <List>
        {items.map((i) => {
          const resp = data.byIndicator.get(i.id);
          const gps = resp && !resp.is_na ? gapPriorityScore(resp.score, i.weight, i.type, d.part) : null;
          const pr = priorityBand(gps);
          return (
            <ListRow key={i.id} to={`/assess/${cycleId}/i/${encodeURIComponent(i.id)}`}
              leading={<span className="inline-flex h-10 w-10 items-center justify-center rounded-control bg-sunken text-lg font-bold" aria-label={resp?.is_na ? 'Not applicable' : resp?.score != null ? `Score ${resp.score}` : 'Not scored'}>
                {resp?.is_na ? 'NA' : resp?.score ?? '–'}</span>}
              title={<span><span className="mr-2 text-muted">{i.id}</span>{i.statement}</span>}
              meta={<span className="flex flex-wrap gap-1.5 pt-1">
                <Badge>{d.part === 'C' ? 'Interface' : i.type === 'M' ? 'Mandatory' : 'Good practice'}</Badge>
                <Badge>Weight {i.weight}</Badge>
                {resp && <Badge tone={resp.status === 'validated' ? 'ok' : 'neutral'}>{RESPONSE_STATUS[resp.status]}</Badge>}
                {pr && pr !== 'Low' && <Badge tone={pr === 'High' ? 'bad' : 'warn'}>{pr} priority</Badge>}
                {i.lead_office && <Badge tone="info">{i.lead_office}</Badge>}
              </span>} />
          );
        })}
      </List>
    </div>
  );
}
