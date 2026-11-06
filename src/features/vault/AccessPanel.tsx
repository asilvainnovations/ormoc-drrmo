import { useState } from 'react';
import { useAuth, ROLE_LABEL } from '@/lib/auth';
import { updateOnline } from '@/lib/store';
import { Badge, Button, Checkbox, ChoiceGroup, Notice, Section } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import type { Role, VaultDocument } from '@/types';
import { RESTRICTABLE_ROLES } from './access';

/** Who may open a Vault document (1.9, RBAC). Personnel records and internal staff papers are restricted. */
export function AccessPanel({ d }: { d: VaultDocument }) {
  const { has } = useAuth();
  const toast = useToast();
  const isHead = has('cdrrmo_head');
  const restricted = d.access_class === 'restricted';
  const [open, setOpen] = useState(false);
  const [cls, setCls] = useState<'standard' | 'restricted'>(d.access_class ?? 'standard');
  const [roles, setRoles] = useState<Role[]>(d.allowed_roles ?? []);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (cls === 'restricted' && roles.length === 0) { setProblem('Choose at least one role besides the CDRRMO Head.'); return; }
    setBusy(true);
    try {
      await updateOnline('vault_documents', d, { access_class: cls, allowed_roles: cls === 'restricted' ? roles : [] }, 'Changing who may open a document');
      setOpen(false); toast(cls === 'restricted' ? 'Access restricted' : 'Open to all Vault users');
    } catch (e) { setProblem((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Section title="Who may open it">
      {restricted ? <>
        <Badge tone="warn">Restricted</Badge>
        <p className="mt-2 text-sm">CDRRMO Head{(d.allowed_roles ?? []).length ? `, ${(d.allowed_roles ?? []).map((r) => ROLE_LABEL[r]).join(', ')}` : ''}. Other Vault users do not see this document.</p>
      </> : <p className="text-sm">Everyone who uses the Vault.</p>}
      {isHead && <Button tip="Change who may open this document (CDRRMO Head; needs a connection)" variant="secondary" className="mt-3"
        onClick={() => { setCls(d.access_class ?? 'standard'); setRoles(d.allowed_roles ?? []); setProblem(null); setOpen(true); }}>Change access</Button>}
      <Sheet open={open} onClose={() => setOpen(false)} title="Who may open this document"
        footer={<><Button tip="Go back without changing access" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button tip="Save who may open this document" disabled={busy} onClick={save}>Save access</Button></>}>
        <ChoiceGroup legend="Access" value={cls} onChange={setCls} options={[
          { value: 'standard', label: 'All Vault users', detail: 'Assessors, validators, CDRRMO and EOC staff', tip: 'Everyone who uses the Vault can open it' },
          { value: 'restricted', label: 'Restricted', detail: 'Personnel information, designations, internal staff papers', tip: 'Only the CDRRMO Head and the roles you tick' },
        ]} />
        {cls === 'restricted' && (
          <fieldset className="space-y-2">
            <legend className="font-semibold">Also open to</legend>
            <div className="flex flex-wrap gap-2">
              {RESTRICTABLE_ROLES.map((r) => <Checkbox key={r} tip={`Let ${ROLE_LABEL[r]} open this document`} checked={roles.includes(r)}
                onChange={() => setRoles((x) => (x.includes(r) ? x.filter((y) => y !== r) : [...x, r]))}>{ROLE_LABEL[r]}</Checkbox>)}
            </div>
          </fieldset>
        )}
        {problem && <Notice tone="bad">{problem}</Notice>}
      </Sheet>
    </Section>
  );
}
