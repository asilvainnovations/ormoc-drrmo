import { PageHeader, Tabs } from '@/components/ui';

export const DRRM_TABS = [
  { to: '/drrm', label: 'Workflows', end: true, tip: 'Management cycles by thematic area: planning, budget, CDRRMC, designations, continuity, partnerships and learning' },
  { to: '/drrm/protocols', label: 'Protocols', tip: 'Point-of-action procedures by thematic area: duty, warning, anticipatory action, EOC, reporting, recovery' },
  { to: '/drrm/forms', label: 'Forms', tip: 'The form each step is recorded on, by thematic area. The CDRRMO Head approves forms' },
];

/** The DRRM module (1.9, ADR-016): every workflow and protocol step is recorded on a form. */
export function DrrmHeader() {
  return <>
    <PageHeader title="DRRM Workflows, Protocols and Forms"
      subtitle="Step-by-step procedures from the Manual of Operations and the EOC Manual, grouped by the four DRRM thematic areas. Each step is recorded on its form, with who closed it and when." />
    <Tabs items={DRRM_TABS} />
  </>;
}
