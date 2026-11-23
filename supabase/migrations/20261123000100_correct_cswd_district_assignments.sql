-- Correct and complete CSWD district assignments from the official
-- "DISTRICT Clusters.pdf" (City DRRMO / CSWD, pp. 1–2).
-- This is a separate dimension from barangays.cluster_id (CDRRMO operational clusters).
-- Safe to re-run: only names explicitly matched below are updated.

begin;

comment on column public.barangays.district_id is
  'CSWD social-welfare district (1-6), per the official Ormoc City CSWD district list; distinct from CDRRMO operational cluster_id.';

with district_map(normalized_name, district_id) as (
  values
    ('bagong', 1),
    ('biliboy', 1),
    ('cabaonan', 1),
    ('cabintan', 1),
    ('danao', 1),
    ('dayhagan', 1),
    ('dolores', 1),
    ('gaas', 1),
    ('liberty', 1),
    ('luna', 1),
    ('magaswe', 1),
    ('milagro', 1),
    ('nuevavista', 1),
    ('salvacion', 1),
    ('sanpablo', 1),
    ('stonino', 1),
    ('tongonan', 1),
    ('airport', 2),
    ('curva', 2),
    ('domonar', 2),
    ('esperanza', 2),
    ('greenvalley', 2),
    ('lao', 2),
    ('leondoni', 2),
    ('libertad', 2),
    ('licuma', 2),
    ('liloan', 2),
    ('mabato', 2),
    ('manlilinao', 2),
    ('margen', 2),
    ('masin', 2),
    ('nuevasociedad', 2),
    ('rmtan', 2),
    ('sanjuan', 2),
    ('sanvicente', 2),
    ('alegria', 3),
    ('batuan', 3),
    ('linao', 3),
    ('naungan', 3),
    ('punta', 3),
    ('tambulilid', 3),
    ('bantigue', 4),
    ('doncarlosrivillaboroc', 4),
    ('campdownes', 4),
    ('canadieng', 4),
    ('canuntog', 4),
    ('danhug', 4),
    ('hugpa', 4),
    ('ipil', 4),
    ('mabini', 4),
    ('macabug', 4),
    ('mahayahay', 4),
    ('quezonjr', 4),
    ('sanantonio', 4),
    ('sumangga', 4),
    ('drhermenigildoseraficabayog', 5),
    ('cabulihan', 5),
    ('cagbuhangin', 5),
    ('catmon', 5),
    ('concepcion', 5),
    ('donpotencianolarrazabal', 5),
    ('guintiguian', 5),
    ('hibunaon', 5),
    ('juaton', 5),
    ('kadaohan', 5),
    ('labrador', 5),
    ('maticaa', 5),
    ('monterico', 5),
    ('nasunogan', 5),
    ('sabangbao', 5),
    ('sanjose', 5),
    ('valencia', 5),
    ('altavista', 5),
    ('bagongbuhay', 6),
    ('cogon', 6),
    ('donfelipelarrazabal', 6),
    ('donafelizazmejia', 6),
    ('donghol', 6),
    ('east', 6),
    ('mahayag', 6),
    ('north', 6),
    ('patag', 6),
    ('sanisidro', 6),
    ('south', 6),
    ('west', 6),
    ('magaswi', 1),
    ('santonino', 1),
    ('rufinamtan', 2),
    ('borok', 4),
    ('hibunawon', 5),
    ('bayog', 5),
    ('cogoncombado', 6),
    ('barangayeast', 6),
    ('barangaynorth', 6),
    ('barangaysouth', 6),
    ('barangaywest', 6)
),
matched as (
  select
    b.psgc,
    dm.district_id
  from public.barangays b
  join district_map dm
    on regexp_replace(
         regexp_replace(
           translate(lower(b.name), 'ñáéíóúü', 'naeiouu'),
           '^barangay[[:space:]]+', ''
         ),
         '[^a-z0-9]', '', 'g'
       ) = dm.normalized_name
)
update public.barangays b
set district_id = matched.district_id
from matched
where b.psgc = matched.psgc
  and b.district_id is distinct from matched.district_id;

-- The field is nullable to preserve compatibility with incomplete legacy
-- imports; the application explicitly surfaces any unmatched records.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'barangays_district_id_range_check'
      and conrelid = 'public.barangays'::regclass
  ) then
    alter table public.barangays
      add constraint barangays_district_id_range_check
      check (district_id between 1 and 6) not valid;
  end if;
end
$$;

alter table public.barangays
  validate constraint barangays_district_id_range_check;

create index if not exists barangays_district_id_idx
  on public.barangays (district_id);

commit;
