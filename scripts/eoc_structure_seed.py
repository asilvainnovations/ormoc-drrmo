"""1.9.0 City EOC structure seed (operational file 06): response clusters, contingency plans and their
activation sets, EOC positions, barangay clusters and the EOC reference point.

Sources: MOO Ch.1 Draft 1.2 sec. 6.3 (Figures 1.3-1.4, Table 1.4) and Ch.2 Draft 1.2 sec. 10 (Figure 2.5,
Table 2.4); CDRRMC Res. Nos. 2-A and 2-B s. 2021 (contingency plans); EO s. 2022 on the CCCM Team; the KML
supplied for the Manual. Everything here is a draft for the 1-4 December 2026 validation workshop and is
edited in the app afterwards; the seed never overwrites a row once loaded."""

# code, name, national lead, City lead office code, mandate
CLUSTERS = [
    ('FNFI', 'Food and Non-Food Items', 'DSWD', 'CSWDO', 'Prepositioning and distribution of family food packs and non-food items.'),
    ('CCCM', 'Camp Coordination and Camp Management', 'DSWD', 'CSWDO', 'Evacuation centre management; City CCCM Team (EO s. 2022).'),
    ('PROT', 'Protection', 'DSWD', 'CSWDO', 'Protection of women, children, older persons and persons with disability in evacuation.'),
    ('HEALTH', 'Health (WASH, nutrition, MHPSS)', 'DOH', 'CHO', 'Medical, public health, WASH, nutrition and mental health and psychosocial support.'),
    ('LOG', 'Logistics', 'OCD', 'GSO', 'Warehousing, transport, fuel and supply chain.'),
    ('ETC', 'Emergency Telecommunications', 'OCD / DICT', 'CDRRMO', 'Radio, satellite and data links for the EOC, field teams and barangays.'),
    ('EDUC', 'Education', 'DepEd', 'DEPED-SDO', 'School safety, use of schools as evacuation centres and learning continuity.'),
    ('SRR', 'Search, Rescue and Retrieval', 'AFP', 'CDRRMO', 'CDRRMO rescue team with BFP and partners.'),
    ('LAO', 'Law and Order', 'PNP', 'PNP', 'Security of evacuation centres, traffic and relief convoys.'),
    ('MDM', 'Management of the Dead and Missing', 'DILG', 'CHO', 'MDM cluster protocol (CDRRMC Res. No. 06 s. 2021, to be widened to all hazards).'),
]

MODULES = ['operations', 'planning', 'pdra_aa_desk', 'logistics', 'finance_admin', 'cluster_desks', 'barangay_liaison', 'building_assessment_mdm']
BLUE_MODULES = {'planning', 'pdra_aa_desk', 'logistics'}   # seated from Blue; the rest from Red

# code, title, hazard, scenario, warning time, triggers, status, adopted_ref, adopted_on, valid_until, vault key,
# modules {module: state}, clusters {cluster: state}, min level for everything ('red' unless slow onset)
PLANS = [
    ('CP-FLOOD-LUNOP', 'Enhanced Contingency Plan for flood-affected barangays ("Oplan Lunop")', 'flood',
     'Typhoon with flood and storm surge', '1-3 days (PAGASA)',
     'Blue on forecast landfall; Red at Tropical Cyclone Wind Signal No. 2 or a flood or storm-surge warning. RA 12287 path when the lead time is 72 hours or more.',
     'adopted', 'CDRRMC Res. No. 2-A, s. 2021', '2021-05-03', None, 'cdrrmc-res-2a-2021',
     {m: 'on' for m in MODULES if m != 'building_assessment_mdm'},
     dict(FNFI='on', CCCM='on', PROT='on', HEALTH='on', LOG='on', ETC='on', SRR='on', LAO='on', EDUC='standby', MDM='standby'), 'red'),
    ('CP-EARTHQUAKE', 'Enhanced Contingency Plan for Earthquake (2020-2025)', 'earthquake',
     'Earthquake on the Philippine Fault, with liquefaction, landslides and local tsunami', 'None',
     'Red automatically on strong shaking or a PHIVOLCS bulletin; staff report without being called. Move to the alternate EOC if the primary is damaged.',
     'expired', 'CDRRMC Res. No. 2-B, s. 2021', '2021-05-03', '2025-12-31', 'cdrrmc-res-2b-2021',
     {m: 'on' for m in MODULES if m != 'pdra_aa_desk'},
     dict(SRR='on', HEALTH='on', MDM='on', LOG='on', CCCM='on', FNFI='on', ETC='on', LAO='on', PROT='on', EDUC='standby'), 'red'),
    ('CP-FLASHFLOOD', 'Contingency plan for flash floods (Anilao-Malbasag system)', 'flash_flood',
     'Flash flood', 'Hours', 'Red straight from an orange or red heavy-rainfall warning; usually below the 72-hour declaration floor, so city early action applies.',
     'to_prepare', None, None, None, None,
     dict(operations='on', planning='on', logistics='on', cluster_desks='lead'),
     dict(SRR='on', CCCM='on', HEALTH='standby', FNFI='standby'), 'red'),
    ('CP-LANDSLIDE', 'Contingency plan for landslides in the uplands', 'rain_landslide',
     'Landslide, uplands (rain or earthquake)', 'Hours to none', 'Blue on rainfall thresholds; Red if there are mass casualties or barangays are cut off. The IMT leads on site.',
     'to_prepare', None, None, None, None,
     dict(operations='on', planning='on', logistics='on', cluster_desks='lead'),
     dict(SRR='lead', HEALTH='lead', LOG='standby'), 'red'),
    ('CP-DROUGHT', 'Contingency plan for El Nino / drought', 'drought',
     'El Nino / drought', 'Months', 'White or Blue only; the El Nino Task Force (EO No. 2023-0042) coordinates. No Red.',
     'to_prepare', None, None, None, None,
     dict(planning='on', cluster_desks='lead'), dict(HEALTH='lead', FNFI='standby'), 'blue'),
    ('CP-DISEASE', 'Contingency plan for emerging and re-emerging diseases', None,
     'Disease outbreak', 'Days to weeks', 'Blue; Red at the Health Cluster\'s request. Plan still to be written (CDP PPA 2.15).',
     'to_prepare', None, None, None, None,
     dict(planning='on', logistics='on', finance_admin='on', cluster_desks='lead'), dict(HEALTH='lead', LOG='standby'), 'blue'),
    ('CP-INDUSTRIAL', 'Contingency plan for industrial or geothermal incidents, fire and planned events', 'industrial',
     'Industrial or geothermal incident, fire, planned event', 'None, or scheduled', 'Blue as needed; IMT under CDRRMC Res. No. 09 s. 2024.',
     'to_prepare', None, None, None, None,
     dict(operations='on', planning='on', cluster_desks='lead'), dict(LAO='lead', SRR='lead', HEALTH='standby'), 'red'),
]

# code, title, section, min level, cluster
POSITIONS = [
    ('EOC-MGR', 'EOC Manager', 'command', 'blue', None),
    ('CMD-PIO', 'Public Information Officer', 'command_staff', 'red', None),
    ('CMD-LIAISON', 'Liaison Officer', 'command_staff', 'red', None),
    ('CMD-SAFETY', 'Safety Officer', 'command_staff', 'red', None),
    ('OPS-CHIEF', 'Operations Section Chief', 'operations', 'red', None),
    ('PLAN-CHIEF', 'Planning Section Chief', 'planning', 'red', None),
    ('PLAN-SIT', 'Situation Unit (SitReps)', 'planning', 'blue', None),
    ('PLAN-PDRA', 'PDRA and Anticipatory Action Desk', 'planning', 'blue', None),
    ('PLAN-GIS', 'GIS and Information Management (Geo-COP)', 'planning', 'blue', None),
    ('LOG-CHIEF', 'Logistics Section Chief', 'logistics', 'blue', None),
    ('FIN-CHIEF', 'Finance and Administration Section Chief', 'finance_admin', 'red', None),
] + [(f'DESK-{c[0]}', f'{c[1]} cluster desk', 'cluster_desk', 'red', c[0]) for c in CLUSTERS] \
  + [(f'BRGY-D{i}', f'Barangay Liaison Desk, cluster D{i}', 'barangay_desk', 'red', None) for i in range(1, 7)]

# Barangay clusters from the internal proposal (MOO Ch.2 sec. 10.2). Pilot: D1 and D3, June-November 2027.
BRGY_CLUSTERS = [
    ('D1', 'East: uplands and city fringe', True), ('D2', 'Western plain', False), ('D3', 'West coast by the poblacion', True),
    ('D4', 'Southeast coast and hills', False), ('D5', 'Northwest', False), ('D6', 'City center', False),
]
# Hazard tags recorded in the proposal (only the tagged barangays are named there). Source noted on each row;
# condition 2 of Table 2.4 replaces them with tags from the updated CDRA.
BRGY_TAGS = {
    'D1': {'landslide': ['Cabaon-an', 'Cabintan', 'Danao', 'Gaas', 'Liberty', 'Milagro', 'Nueva Vista', 'Tongonan']},
    'D2': {'storm_surge': ['San Juan'], 'landslide': ['Domonar', 'Manlilinao', 'San Vicente']},
    'D3': {'flood': ['Linao', 'Naungan', 'Punta', 'Tambulilid'], 'storm_surge': ['Alegria', 'Batuan', 'Linao', 'Naungan', 'Punta']},
    'D4': {'storm_surge': ['Bantigue', 'Camp Downes', 'Can-adieng', 'Danhug', 'Ipil', 'Macabug', 'San Antonio'],
           'landslide': ['Hugpa', 'Mabini', 'Mahayahay', 'Quezon Jr.']},
    'D5': {'landslide': ['Alta Vista']},
    'D6': {'flood': ['North', 'San Isidro'], 'storm_surge': ['East', 'South'], 'landslide': ['Mahayag']},
}
TAG_SOURCE = 'Cluster proposal (CDRRMO internal paper, 2026); replace with the updated CDRA (MOO Ch.2 Table 2.4, condition 2)'

EOC_POINT = dict(code='EOC', name='Ormoc City EOC', kind='eoc', lat=11.01389600057808, lng=124.6042871572453,
                 altitude_m=7.471268260529933,
                 source='KML placemark 0A9E71EA9142E2E2B044 (Google Earth) supplied for MOO development, 6 Nov 2026',
                 note='Initial Geo-COP reference. Not the verified facility footprint; confirm the entrance and building '
                      'by field survey (EOC Module safeguard 1).', vault='eoc-kml')
