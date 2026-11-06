import { PageHeader, Tabs } from '@/components/ui';

export const DRRM_TABS = [
  { to: '/drrm', label: 'Workflows', end: true, tip: 'Management cycles: CDRRMC, budget, EOC designations, contingency plans and maps' },
  { to: '/drrm/protocols', label: 'Protocols', tip: 'Operational procedures: duty, warning, EOC, anticipatory action, reporting' },
  { to: '/drrm/forms', label: 'Forms', tip: 'The form each step is recorded on. The CDRRMO Head approves forms' },
];

/** The DRRM module (1.9, ADR-016): every workflow and protocol step is recorded on a form. */
export function DrrmHeader() {
  return <>
    <PageHeader title="DRRM Workflows and Protocols"
      subtitle="Step-by-step procedures from the Manual of Operations and the EOC Manual. Each step is recorded on its form, with who closed it and when." />
    <Tabs items={DRRM_TABS} />
  </>;
}
