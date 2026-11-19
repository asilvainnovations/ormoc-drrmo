-- City evacuation centres from the CDRRMO list "Ormoc City Evacuation Center" (2 pages, received 19 Nov 2026).
-- Adds the four listed centres to the ECHO inventory (evacuation_centers) as PENDING FIELD VALIDATION, with their points.
-- Nothing here certifies a centre as safe or compliant; capacity, area, WASH counts and the RA 12076 items stay blank
-- (not reported) until the field survey. Run in the Supabase SQL editor as the project owner. Safe to run again: a centre
-- whose code is already in the inventory is left as it is (a field verification is never overwritten).
--
-- Data checks made on the list (for the field team):
--   * Curva: the list gives 10.038759, 124.533791, a point in the sea about 100 km south of Ormoc. 11.038759 falls inside
--     Curva on the PSGC boundary file and beside the Ormoc-Merida-Isabel-Palompon road shown in the list's image, so
--     11.038759 is used. Confirm on site.
--   * Danhug: the point (10.962224, 124.649089) falls about 90 m inside Macabug on the PSGC boundary file, and the map card
--     in the list reads "Macabug". The list and the DPWH groundbreaking (Jan 2018) name Barangay Danhug, so the centre is
--     recorded in Danhug. Confirm the barangay and the point on site.
--   * Dolores: the point comes from the map card in the list (11.093532, 124.634764), near the NHA site. This is the
--     "Ormoc City Evacuation Center Station 1" at the NHA site in Dolores (turned over 10 Mar 2023). Confirm the building.
--   * Margen: the pinned building (11.016927, 124.530208) is beside the barangay health centre, Margen Elementary School
--     and Margen Covered Court. Confirm which building is the evacuation centre; the school is a last resort (RA 10821).
begin;

insert into public.evacuation_centers (code, name, barangay_psgc, kind, lat, lng, verification_status, note)
select v.code, v.name, v.psgc, 'other', v.lat, v.lng, 'pending_field_validation', v.note
from (values
  ('EC-DANHUG-01', 'Danhug Evacuation Center', '0803738107', 10.962224::double precision, 124.649089::double precision,
   'From the CDRRMO list of City evacuation centres (19 Nov 2026). DPWH-built (groundbreaking Jan 2018). The point falls about 90 m inside Macabug on the PSGC boundary file and the list''s map card reads "Macabug": confirm the barangay and the point on site. Capacity, area and WASH counts to be surveyed.'),
  ('EC-MARGEN-01', 'Margen Evacuation Center', '0803738067', 11.016927, 124.530208,
   'From the CDRRMO list of City evacuation centres (19 Nov 2026). Pinned building beside the barangay health centre, Margen Elementary School and Margen Covered Court on the Isabel-Palompon road: confirm which building is the centre. Capacity, area and WASH counts to be surveyed.'),
  ('EC-CURVA-01', 'Curva Evacuation Center', '0803738018', 11.038759, 124.533791,
   'From the CDRRMO list of City evacuation centres (19 Nov 2026). The list gives latitude 10.038759 (a point in the sea); 11.038759 falls in Curva beside the Ormoc-Merida-Isabel-Palompon road and is used here: confirm on site. Curva also holds one of the seven City storage facilities (DRRM 10-Year Plan). Capacity, area and WASH counts to be surveyed.'),
  ('EC-DOLORES-01', 'Dolores Evacuation Center (Ormoc City Evacuation Center Station 1)', '0803738049', 11.093532, 124.634764,
   'From the CDRRMO list of City evacuation centres (19 Nov 2026); point from the list''s map card, near the NHA site. Turned over 10 Mar 2023 as Ormoc City Evacuation Center Station 1 at the NHA site, Dolores; management body ENRO, CDRRMO, CSWD, GSD and CHD (EV Mail). Confirm the building. Capacity, area and WASH counts to be surveyed.')
) as v(code, name, psgc, lat, lng, note)
where exists (select 1 from public.barangays b where b.psgc = v.psgc)
  and not exists (select 1 from public.evacuation_centers e where e.code = v.code);

commit;

-- Check: expect four rows, all pending field validation, each with a point.
select code, name, barangay_psgc, lat, lng, verification_status from public.evacuation_centers
where code in ('EC-DANHUG-01', 'EC-MARGEN-01', 'EC-CURVA-01', 'EC-DOLORES-01') order by code;
