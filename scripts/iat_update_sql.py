#!/usr/bin/env python3
"""Write supabase/seed/operational/07_iat_v1_7_update.sql (1.14.0).

Brings a database that was loaded from the earlier baseline seed (cycle "2026 Baseline (IAT v1.1)") to IAT v1.7
WITHOUT a reset: nothing an assessor did in the app is lost. It compares the operational seed files that production
was loaded from (git ref, default origin/main) with the current ones and writes guarded statements:
  - the cycle is renamed and re-labelled v1.7;
  - a note, action or evidence text changes only where it still equals what the earlier seed loaded (md5 match);
  - a score changes only where it still equals the earlier seed's score;
  - an evidence note dropped from the workbook is removed only if it still equals the import and has no file;
  - validated responses (and their evidence) are never touched;
  - the last query lists any score its evidence does not support (expect no rows).

    python3 scripts/iat_update_sql.py [git-ref]
"""
import hashlib
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OP = ROOT / 'supabase/seed/operational'
REF = sys.argv[1] if len(sys.argv) > 1 else 'origin/main'
UUID = r"'([0-9a-f-]{36})'::uuid"


def old(name: str) -> str:
    return subprocess.run(['git', 'show', f'{REF}:supabase/seed/operational/{name}'], cwd=ROOT, check=True,
                          capture_output=True, text=True).stdout


def new(name: str) -> str:
    return (OP / name).read_text(encoding='utf-8')


def sql_fields(row: str) -> list:
    """Split one VALUES tuple body into fields (SQL literals, E'' strings, casts kept as text)."""
    out, i, n = [], 0, len(row)
    while i < n:
        while i < n and row[i] in ' ,':
            i += 1
        if i >= n:
            break
        j = i
        if row[i] == 'E' and i + 1 < n and row[i + 1] == "'":
            j += 1
        if row[j] == "'":
            j += 1
            while j < n:
                if row[j] == '\\' and row[i] == 'E':
                    j += 2; continue
                if row[j] == "'":
                    if j + 1 < n and row[j + 1] == "'":
                        j += 2; continue
                    break
                j += 1
            j += 1
            while j < n and row[j] not in ',':
                j += 1
        else:
            while j < n and row[j] != ',':
                j += 1
        out.append(row[i:j].strip()); i = j + 1
    return out


def unquote(lit: str):
    if lit == 'null':
        return None
    lit = re.sub(r"::[\w.]+$", '', lit)
    if lit.startswith("E'"):
        body = lit[2:-1].replace("''", "'")
        return body.encode('latin-1', 'backslashreplace').decode('unicode_escape') if '\\' in body else body
    return lit[1:-1].replace("''", "'")


def rows(text: str, table: str) -> dict:
    a = text.index(f'insert into public.{table}')
    out = {}
    for m in re.finditer(r"^\(('[0-9a-f-]{36}'::uuid, .*)\),?$", text[a:], re.M):
        f = sql_fields(m.group(1))
        out[unquote(f[0])] = f
    return out


def scores(text: str) -> dict:
    a = text.index('update public.responses r set score'); b = text.index(') as v', a)
    return dict(re.findall(UUID + r", (\d+|null)\)", text[a:b]))


md5 = lambda s: hashlib.md5(s.encode('utf-8')).hexdigest()
lit = lambda s: 'null' if s is None else "'" + s.replace("'", "''") + "'"

o_resp, n_resp = rows(old('01_iat_baseline_responses.sql'), 'responses'), rows(new('01_iat_baseline_responses.sql'), 'responses')
o_ev = {**rows(old('02_iat_baseline_evidence.sql'), 'evidence'), **rows(old('02b_iat_baseline_evidence.sql'), 'evidence')}
n_ev = {**rows(new('02_iat_baseline_evidence.sql'), 'evidence'), **rows(new('02b_iat_baseline_evidence.sql'), 'evidence')}
o_sc, n_sc = scores(old('03_iat_baseline_scores_actions.sql')), scores(new('03_iat_baseline_scores_actions.sql'))
cycle = re.search(r"values \(" + UUID, new('01_iat_baseline_responses.sql')).group(1)
cyc_new = re.search(r"insert into public.assessment_cycles[^\n]*\nvalues \((.*?)\)\non conflict \(id\) do nothing;", new('01_iat_baseline_responses.sql'), re.S).group(1)
cf = sql_fields(cyc_new)

# responses: (id, cycle_id, indicator_id, is_na, na_justification, gap_remarks, recommended_action, status)
txt = []
for rid, f in n_resp.items():
    of = o_resp.get(rid)
    if not of:
        continue
    g0, a0, g1, a1 = unquote(of[5]), unquote(of[6]), unquote(f[5]), unquote(f[6])
    if (g0, a0) != (g1, a1):
        txt.append((rid, unquote(f[2]), g0, a0, g1, a1))
sc = [(rid, o_sc.get(rid), v) for rid, v in n_sc.items() if o_sc.get(rid) != v]
# evidence: (id, response_id, kind, strength, title, source, note)
ev_changed = [(eid, unquote(o_ev[eid][6]), unquote(f[6]), unquote(f[4]), unquote(f[5])) for eid, f in n_ev.items()
              if eid in o_ev and (unquote(o_ev[eid][6]), unquote(o_ev[eid][4]), unquote(o_ev[eid][5])) != (unquote(f[6]), unquote(f[4]), unquote(f[5]))]
ev_removed = [(eid, unquote(f[6])) for eid, f in o_ev.items() if eid not in n_ev]
ev_added = [f for eid, f in n_ev.items() if eid not in o_ev]

L = ["-- GENERATED by scripts/iat_update_sql.py (1.14.0, 12 Nov 2026). Do not edit by hand.",
     "-- Updates the 2026 baseline cycle in place to IAT v1.7 (workbook file v1-7). No reset: a value changes only where",
     "-- it still equals what the earlier seed loaded, validated responses are never touched, and nothing an assessor",
     "-- entered in the app is changed. Safe to run again. Run in the Supabase SQL editor as the project owner.",
     f"-- Changes: cycle label; {len(txt)} notes; {len(sc)} scores; {len(ev_changed)} evidence texts; "
     f"{len(ev_removed)} evidence notes retracted; {len(ev_added)} added.", "begin;", "",
     "-- 1. The cycle: name, version and notes (the cycle keeps its id, so every response and action stays linked).",
     f"update public.assessment_cycles set name = {cf[1]}, iat_version = {cf[3]}, notes = {cf[7]}",
     f"  where id = '{cycle}'::uuid and name like '2026 Baseline (IAT v1.%' and status not in ('final', 'archived');", ""]
if txt:
    L += ["-- 2. Notes and recommended actions, where unchanged since the import and not validated.",
          "update public.responses r set gap_remarks = v.gap, recommended_action = v.action", "from (values"]
    L += [",\n".join(f"/* {ind} */ ('{rid}'::uuid, {lit(g1)}, {lit(a1)}, '{md5(g0 or '')}', '{md5(a0 or '')}')" for rid, ind, g0, a0, g1, a1 in txt)]
    L += [") as v(id, gap, action, old_gap, old_action)",
          "where r.id = v.id and r.status <> 'validated'",
          "  and md5(coalesce(r.gap_remarks, '')) = v.old_gap and md5(coalesce(r.recommended_action, '')) = v.old_action;", ""]
if sc:
    L += ["-- 3. Scores, only where the score is still the one the earlier seed set.", "update public.responses r set score = v.score::smallint from (values",
          ",\n".join(f"('{rid}'::uuid, {s1}, {s0})" for rid, s0, s1 in sc),
          ") as v(id, score, old) where r.id = v.id and r.status <> 'validated' and r.score is not distinct from v.old::smallint;", ""]
else:
    L += ["-- 3. Scores: none to change. The 140 scores the earlier seed loaded already equal workbook v1-7.", ""]
if ev_changed:
    L += ["-- 4. Evidence texts revised in the workbook, where unchanged since the import.", "update public.evidence e set note = v.note, title = v.title, source = v.source from (values",
          ",\n".join(f"('{eid}'::uuid, {lit(n1)}, {lit(t)}, {lit(s)}, '{md5(n0 or '')}')" for eid, n0, n1, t, s in ev_changed),
          ") as v(id, note, title, source, old_note)",
          "where e.id = v.id and md5(coalesce(e.note, '')) = v.old_note",
          "  and not exists (select 1 from public.responses r where r.id = e.response_id and r.status = 'validated');", ""]
if ev_removed:
    L += ["-- 5. Evidence notes retracted in the workbook: removed only if unchanged, without a file, and not validated.",
          "--    (A8.5: the October 2026 site observation was re-attributed; the score of 3 rests on three approved documents.)",
          "delete from public.evidence e using (values",
          ",\n".join(f"('{eid}'::uuid, '{md5(n0 or '')}')" for eid, n0 in ev_removed),
          ") as v(id, old_note)", "where e.id = v.id and e.storage_path is null and md5(coalesce(e.note, '')) = v.old_note",
          "  and not exists (select 1 from public.responses r where r.id = e.response_id and r.status = 'validated');", ""]
if ev_added:
    raise SystemExit('new evidence rows found: re-run 02/02b instead (they insert missing rows)')
L += ["commit;", "",
      "-- 6. Check (read-only): every score must be supported by its evidence (Methodology 5.2). Expect no rows.",
      "select c.name, r.indicator_id, r.score, coalesce(max(public.evidence_cap(e.strength)), 0) as evidence_allows",
      "from public.responses r join public.assessment_cycles c on c.id = r.cycle_id",
      "left join public.evidence e on e.response_id = r.id",
      f"where r.cycle_id = '{cycle}'::uuid and r.score is not null and not r.is_na",
      "group by c.name, r.indicator_id, r.score",
      "having r.score > coalesce(max(public.evidence_cap(e.strength)), 0)",
      "order by r.indicator_id;", ""]
out = OP / '07_iat_v1_7_update.sql'
out.write_text("\n".join(L), encoding='utf-8')
print(f'{out.name}: {len(txt)} notes, {len(sc)} scores, {len(ev_changed)} evidence texts, {len(ev_removed)} retracted')
