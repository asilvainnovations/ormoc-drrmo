-- =============================================================================
-- 1.9.0 (6 Nov 2026) - Geospatial common operating picture (Geo-COP) foundation (ADR-015).
--
-- From the EOC Module recommendations (SOP 6-GIS-01, forms EOC-GIS-01 to -06):
-- 1. geo_reference_points: the EOC, alternate EOC, OpCen, incident command posts and
--    staging areas. The EOC point comes from the KML supplied for the Manual
--    (11.013896 N, 124.604287 E) and stays "pending field validation" until the
--    CDRRMO Head or EOC Manager records a field check. A verified point is fixed:
--    a moved or corrected point is a new row that supersedes it.
-- 2. geo_layers: every map layer with the metadata the safeguards require (source,
--    custodian office, issue date, coordinate reference system, scale, validation
--    status, update frequency, access level). Files live in the private "geo" bucket
--    and are superseded, never overwritten (the GeoJSON made on the device and the
--    original KML/KMZ are both kept).
-- 3. A City-hosted basemap: a public "basemap" bucket for the PMTiles extract, fonts
--    and sprites (OpenStreetMap data, not sensitive). Only an administrator uploads.
-- 4. incidents: a location and how reliable it is (reported, preliminary,
--    field-verified, official). No household points are stored anywhere: aggregate
--    barangay data only (RA 10173).
--
-- Supports MR-10 (information management), MR-14 (data privacy).
-- Indicators B5.x (information management), B2.1 (site), A5.7 (shared data).
-- Safe to run again.
-- =============================================================================

create table if not exists public.geo_reference_points (
  id                   uuid primary key default gen_random_uuid(),
  code                 text not null check (code ~ '^[A-Z][A-Z0-9-]{1,30}$'),
  name                 text not null,
  kind                 text not null check (kind in ('eoc','alternate_eoc','opcen','icp','staging','evacuation_hub','other')),
  lat                  double precision not null check (lat between -90 and 90),
  lng                  double precision not null check (lng between -180 and 180),
  altitude_m           double precision,
  source               text not null,
  verification_status  text not null default 'pending_field_validation'
                       check (verification_status in ('pending_field_validation','field_verified','superseded')),
  verified_by          uuid references public.profiles(id),
  verified_at          timestamptz,
  superseded_by        uuid references public.geo_reference_points(id),
  vault_document_id    uuid references public.vault_documents(id),
  note                 text,
  created_by           uuid default auth.uid() references public.profiles(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  version              integer not null default 1
);
create unique index if not exists geo_point_one_current_code on public.geo_reference_points (code)
  where verification_status <> 'superseded';
select app.track('public.geo_reference_points');

create or replace function app.guard_geo_point() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then
    if new.verification_status <> 'pending_field_validation' then
      raise exception 'A new point starts as pending field validation' using errcode = '42501';
    end if;
    new.created_by := auth.uid(); new.verified_by := null; new.verified_at := null;
    return new;
  end if;
  new.created_by := old.created_by;
  if old.verification_status = 'superseded' then
    raise exception 'A superseded point is kept as a record' using errcode = '42501';
  end if;
  if old.verification_status = 'field_verified' and row(new.lat, new.lng, new.code, new.kind)
       is distinct from row(old.lat, old.lng, old.code, old.kind) then
    raise exception 'A verified point is fixed. Add the corrected point and mark this one superseded.' using errcode = '42501';
  end if;
  if new.verification_status = 'field_verified' and old.verification_status <> 'field_verified' then
    if not app.has_any_role(array['cdrrmo_head','eoc_manager']::public.app_role[]) then
      raise exception 'Only the CDRRMO Head or EOC Manager records a field verification' using errcode = '42501';
    end if;
    new.verified_by := auth.uid(); new.verified_at := now();
  else
    new.verified_by := old.verified_by; new.verified_at := old.verified_at;
  end if;
  return new;
end $$;
drop trigger if exists guard_geo_point on public.geo_reference_points;
create trigger guard_geo_point before insert or update on public.geo_reference_points
  for each row execute function app.guard_geo_point();

create table if not exists public.geo_layers (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null check (code ~ '^[a-z][a-z0-9_-]{1,40}$'),
  title              text not null check (length(btrim(title)) between 3 and 200),
  layer_group        text not null check (layer_group in ('eoc_facilities','admin_boundaries','hazard','incident','evacuation',
                                                          'critical_facilities','population_exposure','resources','lifelines')),
  source             text not null,
  custodian_office_id uuid references public.offices(id),
  issued_on          date,
  crs                text not null default 'EPSG:4326',
  scale              text,
  validation_status  text not null default 'preliminary' check (validation_status in ('reported','preliminary','field_verified','official')),
  update_frequency   text,
  access_class       text not null default 'internal' check (access_class in ('internal','restricted')),
  storage_path       text,          -- geo/<layer id>/<file>.geojson (made on the device)
  original_path      text,          -- geo/<layer id>/<original>.kml|.kmz|.geojson
  file_name          text,
  feature_count      integer check (feature_count is null or feature_count >= 0),
  bbox               double precision[] check (bbox is null or cardinality(bbox) = 4),
  status             text not null default 'current' check (status in ('current','superseded')),
  superseded_by      uuid references public.geo_layers(id),
  note               text,
  uploaded_by        uuid default auth.uid() references public.profiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  version            integer not null default 1,
  check (storage_path is null or storage_path like id::text || '/%'),
  check (original_path is null or original_path like id::text || '/%')
);
create unique index if not exists geo_layer_one_current_code on public.geo_layers (code) where status = 'current';
comment on table public.geo_layers is
  'Geo-COP map layers with source, custodian, CRS, validation status and access level. Aggregate data only: no household or personal points.';
select app.track('public.geo_layers');

create or replace function app.can_read_geo(p_class text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select app.is_active_user() and (p_class = 'internal'
    or app.has_any_role(array['cdrrmo_head','eoc_manager','eoc_staff','duty_officer']::public.app_role[]))
$$;
grant execute on function app.can_read_geo(text) to authenticated;

create or replace function app.guard_geo_layer() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then new.uploaded_by := auth.uid(); return new; end if;
  new.uploaded_by := old.uploaded_by;
  if (old.storage_path is not null and new.storage_path is distinct from old.storage_path)
     or (old.original_path is not null and new.original_path is distinct from old.original_path) then
    raise exception 'A layer''s files cannot be replaced' using errcode = '42501',
      hint = 'Upload the new data as a new layer and mark this one superseded.';
  end if;
  if old.status = 'superseded' then
    raise exception 'A superseded layer is kept as a record' using errcode = '42501';
  end if;
  if new.validation_status = 'official' and old.validation_status <> 'official'
     and not app.has_any_role(array['cdrrmo_head']::public.app_role[]) then
    raise exception 'Only the CDRRMO Head marks a layer as the official dataset' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists guard_geo_layer on public.geo_layers;
create trigger guard_geo_layer before insert or update on public.geo_layers
  for each row execute function app.guard_geo_layer();

-- ---------------------------------------------------------------- incidents
alter table public.incidents add column if not exists lat double precision check (lat is null or lat between -90 and 90);
alter table public.incidents add column if not exists lng double precision check (lng is null or lng between -180 and 180);
alter table public.incidents add column if not exists location_status text not null default 'reported';
do $$ begin
  alter table public.incidents add constraint incidents_location_status_chk
    check (location_status in ('reported','preliminary','field_verified','official'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.incidents add constraint incidents_latlng_pair_chk check ((lat is null) = (lng is null));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- RLS
alter table public.geo_reference_points enable row level security;
alter table public.geo_layers enable row level security;
drop policy if exists geo_points_read on public.geo_reference_points;
drop policy if exists geo_points_insert on public.geo_reference_points;
drop policy if exists geo_points_update on public.geo_reference_points;
create policy geo_points_read on public.geo_reference_points for select to authenticated using (app.is_active_user());
create policy geo_points_insert on public.geo_reference_points for insert to authenticated
  with check (app.has_any_role(array['cdrrmo_head','eoc_manager','eoc_staff']::public.app_role[]));
create policy geo_points_update on public.geo_reference_points for update to authenticated
  using (app.has_any_role(array['cdrrmo_head','eoc_manager','eoc_staff']::public.app_role[]))
  with check (app.has_any_role(array['cdrrmo_head','eoc_manager','eoc_staff']::public.app_role[]));
drop policy if exists geo_layers_read on public.geo_layers;
drop policy if exists geo_layers_insert on public.geo_layers;
drop policy if exists geo_layers_update on public.geo_layers;
create policy geo_layers_read on public.geo_layers for select to authenticated using (app.can_read_geo(access_class));
create policy geo_layers_insert on public.geo_layers for insert to authenticated
  with check (app.has_any_role(array['cdrrmo_head','eoc_manager','eoc_staff','assessor']::public.app_role[]));
create policy geo_layers_update on public.geo_layers for update to authenticated
  using (app.can_read_geo(access_class) and (uploaded_by = auth.uid() or app.has_any_role(array['cdrrmo_head','eoc_manager']::public.app_role[])))
  with check (app.has_any_role(array['cdrrmo_head','eoc_manager','eoc_staff','assessor']::public.app_role[]));
revoke delete, truncate on public.geo_reference_points, public.geo_layers from authenticated, anon;
grant select, insert, update on public.geo_reference_points, public.geo_layers to authenticated;
do $$ declare t text; begin
  foreach t in array array['geo_reference_points','geo_layers'] loop
    execute format('drop trigger if exists aa0_block_oauth_client_writes on public.%1$s', t);
    execute format('create trigger aa0_block_oauth_client_writes before insert or update or delete on public.%1$s
                    for each row execute function app.block_oauth_client_writes()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('geo', 'geo', false, 52428800,
        array['application/geo+json','application/json','application/vnd.google-earth.kml+xml',
              'application/vnd.google-earth.kmz','application/zip','text/xml','application/octet-stream'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
-- The City-hosted basemap: OpenStreetMap-derived PMTiles, glyphs and sprites. Public read, admin upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('basemap', 'basemap', true, 524288000,
        array['application/octet-stream','application/vnd.pmtiles','application/x-protobuf','application/json','image/png'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists geo_objects_read on storage.objects;
drop policy if exists geo_objects_insert on storage.objects;
drop policy if exists basemap_objects_insert on storage.objects;
drop policy if exists basemap_objects_update on storage.objects;
create policy geo_objects_read on storage.objects for select to authenticated
  using (bucket_id = 'geo' and exists (
    select 1 from public.geo_layers l where l.id::text = (storage.foldername(name))[1] and app.can_read_geo(l.access_class)));
create policy geo_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'geo' and exists (
    select 1 from public.geo_layers l where l.id::text = (storage.foldername(name))[1] and l.status = 'current'
      and (l.uploaded_by = auth.uid() or app.has_any_role(array['cdrrmo_head','eoc_manager']::public.app_role[]))));
create policy basemap_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'basemap' and app.has_role('admin'));
create policy basemap_objects_update on storage.objects for update to authenticated
  using (bucket_id = 'basemap' and app.has_role('admin')) with check (bucket_id = 'basemap' and app.has_role('admin'));

do $$ declare t text; begin
  foreach t in array array['geo_reference_points','geo_layers'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;
