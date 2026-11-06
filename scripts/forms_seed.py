"""1.9.0 forms and DRRM workflows (ADR-016). Forms come from the Manual's forms and registers (GOV-F.., HR-F..,
EOC-GIS-..) and the EOC Module's SOP 6-GIS-01. Every protocol and workflow step has a form: the Manual's form
where one exists, otherwise STEP-RECORD (one tap: done as written or done with changes).

Privacy (RA 10173): forms hold institutional records and aggregate counts only, never the names of affected
persons, evacuees, patients or informants. Loaded as drafts; the CDRRMO Head approves each in the app."""

HAZARD_OPTS = ['Tropical cyclone', 'Storm surge', 'Riverine flood', 'Flash flood', 'Rain-induced landslide', 'Drought (El Nino)',
               'Extreme heat', 'Earthquake', 'Tsunami', 'Industrial / geothermal incident', 'Disease outbreak', 'Other']
CLUSTER_OPTS = ['Food and Non-Food Items', 'Camp Coordination and Camp Management', 'Protection', 'Health (WASH, nutrition, MHPSS)',
                'Logistics', 'Emergency Telecommunications', 'Education', 'Search, Rescue and Retrieval', 'Law and Order',
                'Management of the Dead and Missing']
STREAMS = ['City Traffic Monitoring', 'Public Safety', 'Emergency Monitoring']
LOC_STATUS = ['Reported', 'Preliminary', 'Field-verified', 'Official']


def f(key, label, type_, required=False, options=None, hint=None, **extra):
    d = dict(key=key, label=label, type=type_, required=required)
    if options: d['options'] = options
    if hint: d['hint'] = hint
    d.update(extra)
    return d


# code, title, purpose, Manual document code, fields
FORMS = [
    ('STEP-RECORD', 'Step record', 'One-tap record that a step was carried out, with any change from the written step.', 'MOO Ch.1', [
        f('outcome', 'Outcome', 'select', True, ['Done as written', 'Done with changes']),
        f('remarks', 'Remarks or changes', 'textarea', hint='What was done differently, and why. No names of affected persons.'),
        f('evidence_ref', 'Record or file reference', 'text', hint='Logbook entry, memo, photo or Vault reference')]),
    ('HR-F04', 'Duty handover checklist', 'Annex 2-E: what the outgoing duty team hands over.', 'MOO Ch.2', [
        f('shift', 'Shift', 'select', True, ['06:00-14:00', '14:00-22:00', '22:00-06:00', 'Other']),
        f('streams', 'Monitoring streams covered', 'multiselect', True, STREAMS),
        f('active_warnings', 'Warnings and bulletins in force', 'textarea', True),
        f('open_incidents', 'Open incidents', 'integer', True, min=0),
        f('pending_requests', 'Pending resource requests', 'integer', True, min=0),
        f('radio_check', 'Radio net check', 'select', True, ['All stations answered', 'Some stations did not answer', 'Not done']),
        f('missing_stations', 'Stations that did not answer', 'textarea'),
        f('equipment', 'Generator, UPS and backup internet', 'select', True, ['All working', 'Issue noted']),
        f('equipment_issue', 'Equipment issue', 'textarea'),
        f('incoming_ack', 'Incoming duty officer has read and accepted the handover', 'checkbox', True)]),
    ('EOC-WARN-01', 'Bulletin and advisory log', 'Each hazard bulletin received, as the first step of warning dissemination.', 'EOC Ch.2', [
        f('issuer', 'Issuer', 'select', True, ['PAGASA', 'PHIVOLCS', 'MGB', 'NDRRMC / OCD', 'Other']),
        f('bulletin_no', 'Bulletin or advisory number', 'text', True),
        f('issued_at', 'Time issued', 'datetime', True),
        f('hazard', 'Hazard', 'select', True, HAZARD_OPTS),
        f('areas', 'Areas affected', 'textarea', True)]),
    ('EOC-WARN-02', 'Warning receipt confirmation', 'Barangays notified and confirmed, by channel.', 'EOC Ch.2', [
        f('barangays_notified', 'Barangays notified', 'integer', True, min=0),
        f('barangays_confirmed', 'Barangays that confirmed receipt', 'integer', True, min=0),
        f('channels', 'Channels used', 'multiselect', True, ['Cell broadcast / SMS', 'Radio', 'Social media', 'Barangay officials', 'Public address']),
        f('unconfirmed', 'Barangays still to confirm', 'textarea')]),
    ('EOC-ACT-01', 'EOC activation record', 'Level, authority and contingency plan for an activation.', 'EOC Ch.2', [
        f('level', 'Level', 'select', True, ['Blue', 'Red']),
        f('authority_ref', 'Authority (memo or instruction)', 'text', True),
        f('plan_code', 'Contingency plan activated', 'text', hint='For example CP-FLOOD-LUNOP'),
        f('reason', 'Reason', 'textarea', True)]),
    ('EOC-GIS-06', 'Evacuation centre and route status', 'EOC Module form EOC-GIS-06: centres open, capacity and access.', 'EOC Ch.6', [
        f('centres_open', 'Evacuation centres open', 'integer', True, min=0),
        f('capacity_persons', 'Total capacity (persons)', 'integer', min=0),
        f('occupancy_persons', 'Current occupancy (persons)', 'integer', min=0),
        f('route_issues', 'Access routes blocked or limited', 'textarea'),
        f('location_status', 'Reliability of this information', 'select', True, LOC_STATUS)]),
    ('EOC-SITREP-01', 'SitRep submission record', 'DILG VIII cut-offs: which SitRep went where and when.', 'EOC Ch.6', [
        f('sitrep_no', 'SitRep number', 'text', True),
        f('period_end', 'End of reporting period', 'datetime', True),
        f('barangays_reporting', 'Barangays reporting', 'integer', True, min=0),
        f('sent_at', 'Time sent to OCD VIII and the Province', 'datetime', True),
        f('cut_off_met', 'Sent before the cut-off', 'checkbox')]),
    ('GOV-F09', 'PDRA summary', 'Annex 1-G GOV-F09: the PDRA decision and its basis.', 'MOO Ch.1', [
        f('hazard', 'Hazard', 'select', True, HAZARD_OPTS),
        f('forecast_source', 'Forecast source and number', 'text', True),
        f('expected_impact_at', 'Expected impact', 'datetime', True),
        f('lead_time_hours', 'Lead time left (hours)', 'number', True, min=0),
        f('impact_class', 'Projected impact', 'select', True, ['Minor', 'Moderate', 'Severe']),
        f('decision', 'Decision', 'select', True, ['Monitor', 'City early action', 'Request a State of Imminent Disaster']),
        f('basis', 'Basis of the decision', 'textarea', True)]),
    ('GOV-F10', 'Request to RDRRMC VIII', 'Annex 1-G GOV-F10: the City request and its acknowledgment.', 'MOO Ch.1', [
        f('cdrrmc_resolution', 'CDRRMC resolution endorsing the request', 'text', True),
        f('sent_at', 'Time sent', 'datetime', True),
        f('channel', 'Channel', 'select', True, ['Email', 'Courier', 'Hand-carried', 'Other']),
        f('acknowledgment_ref', 'Acknowledgment reference', 'text')]),
    ('GOV-F11', 'Mayor\'s Executive Order record', 'Annex 1-G GOV-F11: the declaration as issued.', 'MOO Ch.1', [
        f('eo_number', 'Executive Order number', 'text', True),
        f('declared_at', 'Time of declaration', 'datetime', True),
        f('areas', 'Areas covered', 'textarea', True),
        f('validity', 'Validity', 'text', True)]),
    ('GOV-F07', 'State of Calamity technical assessment', 'Annex 1-G GOV-F07: RDANA-based assessment for the CDRRMC.', 'MOO Ch.1', [
        f('rdana_ref', 'RDANA report reference', 'text', True),
        f('affected_barangays', 'Affected barangays', 'integer', True, min=0),
        f('affected_families', 'Affected families', 'integer', min=0),
        f('displaced_persons', 'Displaced persons', 'integer', min=0),
        f('damage_estimate_php', 'Estimated damage (PHP)', 'number', min=0),
        f('criteria_basis', 'Criteria met and basis', 'textarea', True)]),
    ('GOV-F08', 'State of Calamity recommendation and resolution', 'Annex 1-G GOV-F08, with the declaration every QRF resolution must cite (A1.6).', 'MOO Ch.1', [
        f('cdrrmc_resolution', 'CDRRMC recommendation (resolution number)', 'text', True),
        f('sp_resolution', 'Sangguniang Panlungsod resolution number', 'text', True),
        f('declared_on', 'Date declared', 'date', True),
        f('qrf_declaration_ref', 'Declaration cited for QRF use', 'text', True, hint='SP resolution or Proclamation number and date')]),
    ('GOV-F12', 'Lifting record', 'Annex 1-G GOV-F12: ground and basis for lifting.', 'MOO Ch.1', [
        f('lifting_ground', 'Ground', 'select', True, ['Hazard occurred', 'Projected impacts not met']),
        f('basis', 'Basis (advisory, incident report or latest PDRA)', 'textarea', True),
        f('lifted_at', 'Time lifted', 'datetime', True)]),
    ('GOV-F13', 'Post-lifting 45-day report', 'Annex 1-G GOV-F13: report to OCD within 45 days.', 'MOO Ch.1', [
        f('report_ref', 'Report reference', 'text', True),
        f('submitted_on', 'Date submitted', 'date', True),
        f('aa_funds_used_php', 'Anticipatory action funds used (PHP)', 'number', min=0),
        f('costs_minimized', 'Estimated costs minimized', 'textarea')]),
    ('EOC-FF-01', 'Flash flood early action record', 'Reading, threshold and actions for a short-lead hazard.', 'EOC Ch.2', [
        f('source', 'Gauge or source', 'text', True),
        f('reading', 'Reading and threshold reached', 'text', True),
        f('barangays_alerted', 'Barangays alerted', 'integer', True, min=0),
        f('families_moved', 'Families moved pre-emptively', 'integer', min=0)]),
    ('GOV-F03', 'CDRRMC attendance and minutes', 'Annex 1-G GOV-F03: quorum, presiding officer and decisions.', 'MOO Ch.1', [
        f('meeting_date', 'Meeting date', 'date', True),
        f('meeting_type', 'Meeting', 'select', True, ['Regular (quarterly)', 'Special']),
        f('members_present', 'Members present', 'integer', True, min=0),
        f('quorum_met', 'Quorum met', 'checkbox', True),
        f('presiding_designation', 'Written designation of the presiding officer (if not the Chair)', 'text'),
        f('resolutions', 'Resolutions adopted (numbers)', 'textarea')]),
    ('BUD-F01', 'LDRRMF thematic split', 'MOO Ch.1 sec. 1.4 and Ch.2 sec. 2.16.2: how the investment plan splits across thematic areas.', 'MOO Ch.2', [
        f('fiscal_year', 'Fiscal year', 'integer', True, min=2020),
        f('total_php', 'Total LDRRMF (PHP)', 'number', True, min=0),
        f('prevention_pct', 'Prevention and mitigation (% of the 70%)', 'number', True, min=0),
        f('preparedness_pct', 'Preparedness (% of the 70%)', 'number', True, min=0),
        f('response_pct', 'Response (% of the 70%)', 'number', True, min=0),
        f('recovery_pct', 'Recovery and rehabilitation (% of the 70%)', 'number', True, min=0),
        f('aa_line_php', 'Anticipatory action line (PHP)', 'number', min=0),
        f('tagged', 'Every line tagged to an LDRRMP/CDP PPA', 'checkbox', True)]),
    ('BUD-F02', 'Quarterly results-and-finance report', 'Ch.2 sec. 2.16.2 step 7: one report that every division feeds.', 'MOO Ch.2', [
        f('quarter', 'Quarter', 'select', True, ['Q1', 'Q2', 'Q3', 'Q4']),
        f('obligation_rate_pct', 'Obligation rate (%)', 'number', True, min=0),
        f('results', 'Results against the LDRRMP', 'textarea', True),
        f('issues', 'Issues and proposed realignments', 'textarea')]),
    ('CL-F01', 'Contingency plan activation', 'MOO Ch.1 sec. 6.3: plan, level and authority for cluster activation.', 'MOO Ch.1', [
        f('plan_code', 'Contingency plan', 'select', True, ['CP-FLOOD-LUNOP', 'CP-EARTHQUAKE', 'CP-FLASHFLOOD', 'CP-LANDSLIDE',
                                                             'CP-DROUGHT', 'CP-DISEASE', 'CP-INDUSTRIAL']),
        f('level', 'EOC level', 'select', True, ['Blue', 'Red']),
        f('authority_ref', 'Authority (memo or instruction)', 'text', True)]),
    ('CL-F02', 'Cluster roll-call', 'Clusters notified and focal persons confirmed.', 'MOO Ch.1', [
        f('notified', 'Clusters notified', 'multiselect', True, CLUSTER_OPTS),
        f('confirmed', 'Clusters that confirmed a focal person', 'multiselect', True, CLUSTER_OPTS),
        f('unreachable', 'Clusters not yet reached, and follow-up', 'textarea')]),
    ('CL-F03', 'Cluster coordination meeting', 'Needs, gaps and requests from the clusters.', 'MOO Ch.1', [
        f('meeting_at', 'Meeting time', 'datetime', True),
        f('priority_needs', 'Priority needs', 'textarea', True),
        f('gaps', 'Gaps and constraints', 'textarea'),
        f('requests_raised', 'Resource requests raised', 'integer', min=0)]),
    ('CL-F04', 'Cluster stand-down', 'Clusters stood down and why.', 'MOO Ch.1', [
        f('stood_down', 'Clusters stood down', 'multiselect', True, CLUSTER_OPTS),
        f('reason', 'Reason', 'textarea', True)]),
    ('HR-F05', 'EOC designation review', 'Annex 2-D: quarterly check that key EOC positions are covered two deep.', 'MOO Ch.2', [
        f('positions_total', 'Key positions', 'integer', True, min=0),
        f('positions_two_deep', 'Positions covered two deep', 'integer', True, min=0),
        f('gaps', 'Positions to fill, and offices asked', 'textarea', True)]),
    ('HR-F06', 'Designee briefing record', 'Orientation of newly approved designees.', 'MOO Ch.2', [
        f('briefing_date', 'Briefing date', 'date', True),
        f('designees_briefed', 'Designees briefed', 'integer', True, min=0),
        f('topics', 'Topics covered', 'multiselect', True, ['Activation and call-out', 'Position checklist', 'Communications', 'Safety and welfare', 'Records'])]),
    ('EOC-GIS-REF', 'EOC geospatial reference check', 'SOP 6-GIS-01 step 1: confirm the reference point on the ground.', 'EOC Ch.6', [
        f('point_code', 'Reference point', 'text', True, hint='For example EOC or EOC-ALT'),
        f('result', 'Result', 'select', True, ['Matches the facility entrance', 'Needs correction', 'Not yet surveyed']),
        f('survey_date', 'Survey date', 'date'),
        f('method', 'Method', 'text', hint='Handheld GPS, survey-grade GNSS, orthophoto')]),
    ('EOC-GIS-01', 'Geospatial data inventory', 'EOC-GIS-01: map layers, custodians, sources and update status.', 'EOC Ch.6', [
        f('layers_listed', 'Layers listed', 'integer', True, min=0),
        f('custodians_confirmed', 'Custodian confirmed for every layer', 'checkbox', True),
        f('missing', 'Layers still missing', 'textarea')]),
    ('EOC-GIS-02', 'Geospatial data validation sheet', 'EOC-GIS-02: coordinate system, date, completeness and validation.', 'EOC Ch.6', [
        f('layer_code', 'Layer', 'text', True),
        f('crs', 'Coordinate reference system', 'text', True, hint='EPSG:4326 for longitude/latitude'),
        f('issued_on', 'Date of issue or collection', 'date'),
        f('completeness', 'Completeness', 'select', True, ['Complete', 'Partial', 'Unknown']),
        f('validation_status', 'Validation status', 'select', True, LOC_STATUS),
        f('issues', 'Issues found', 'textarea')]),
    ('EOC-GIS-03', 'Incident georeferencing', 'EOC-GIS-03: where an incident is, and how reliable that is.', 'EOC Ch.6', [
        f('incident_ref', 'Incident or report reference', 'text', True),
        f('barangay', 'Barangay', 'text', True),
        f('lat', 'Latitude', 'number', hint='Decimal degrees, for example 11.0139'),
        f('lng', 'Longitude', 'number', hint='Decimal degrees, for example 124.6043'),
        f('location_status', 'Reliability', 'select', True, LOC_STATUS)]),
    ('EOC-GIS-04', 'Map product and dissemination register', 'EOC-GIS-04: maps produced, sources, verification and release.', 'EOC Ch.6', [
        f('map_title', 'Map title', 'text', True),
        f('prepared_at', 'Prepared', 'datetime', True),
        f('sources', 'Data sources', 'textarea', True),
        f('verification', 'Verification status shown on the map', 'select', True, LOC_STATUS),
        f('audience', 'Released to', 'multiselect', True, ['EOC', 'Executive', 'Partners', 'Public']),
        f('release_approved', 'Release approved by the EOC Manager or authorized information officer', 'checkbox', True)]),
]

# Specific forms on existing protocol steps (code, seq) -> form. Every other step gets STEP-RECORD.
STEP_FORMS = {
    ('PR-DUTY-HANDOVER', 6): 'HR-F04',
    ('PR-WARNING-DISSEM', 1): 'EOC-WARN-01', ('PR-WARNING-DISSEM', 6): 'EOC-WARN-02',
    ('PR-EOC-ACTIVATE', 1): 'EOC-ACT-01', ('PR-EOC-ACTIVATE', 3): 'HR-F05',
    ('PR-PDRA', 5): 'GOV-F09',
    ('PR-SOID-REQUEST', 2): 'GOV-F09', ('PR-SOID-REQUEST', 5): 'GOV-F10', ('PR-SOID-REQUEST', 8): 'GOV-F11',
    ('PR-SOC-DECLARE', 3): 'GOV-F07', ('PR-SOC-DECLARE', 6): 'GOV-F08',
    ('PR-FLASHFLOOD-EARLY', 1): 'EOC-FF-01', ('PR-FLASHFLOOD-EARLY', 4): 'EOC-GIS-06',
    ('PR-SITREP-CYCLE', 5): 'EOC-SITREP-01',
    ('PR-CDRRMC-MEETING', 2): 'GOV-F03',
    ('PR-LIFT-REPORT', 1): 'GOV-F12', ('PR-LIFT-REPORT', 6): 'GOV-F13',
}

# New DRRM workflows (normal operations and cluster activation). Steps: (instruction, critical, note, minutes, form).
WORKFLOWS = [
    dict(code='WF-BUDGET-CYCLE', title='LDRRMF budget cycle (formulation to quarterly report)', category='budget', owner_role='cdrrmo_head',
         doc='MOO Ch.2', purpose='Research and Planning leads formulation, Administration leads execution, the Head approves and the CDRRMC endorses (Ch.2 sec. 2.16.2).',
         trigger='Each budget call, and every quarter for the results-and-finance report.',
         steps=[('Baseline: CDRA, LDRRMP results and last year\'s utilization (Research and Planning)', True, False, None, None),
                ('Collect division needs and proposals (each division)', False, False, None, None),
                ('Draft the LDRRMFIP: prioritized, tagged to LDRRMP/CDP PPAs and thematic areas, 70/30, AA line (Research and Planning)', True, False, None, 'BUD-F01'),
                ('Cost it and prepare the PPMP/APP and procurement plan (Administration)', True, False, None, None),
                ('CDRRMC approval, then SP adoption (Secretariat)', True, False, None, 'GOV-F03'),
                ('Execute: obligation, procurement and disbursement (Administration with Budget, Accounting and BAC)', False, False, None, None),
                ('Quarterly results-and-finance report to the CDRRMC (Research and Planning with Administration)', True, False, None, 'BUD-F02'),
                ('Realign or reallocate when needed, with CDRRMC approval and SP concurrence (Research and Planning)', False, False, None, None)]),
    dict(code='WF-CP-ACTIVATION', title='Contingency plan activation and response clustering', category='response_clusters', owner_role='eoc_manager',
         doc='MOO Ch.1', purpose='Switch on the clusters and EOC modules the activated contingency plan needs, and stand them down when needs are met (Ch.1 sec. 6.3).',
         trigger='When the EOC goes to Blue or Red for a hazard covered by a contingency plan.',
         steps=[('Confirm the hazard and the matching contingency plan; record the level and authority', True, False, 0, 'CL-F01'),
                ('Activate the plan in the EOC screen so its clusters and modules are set (needs a connection)', True, False, 5, None),
                ('Notify each cluster lead office and confirm a focal person for every activated cluster', True, False, 30, 'CL-F02'),
                ('Seat the cluster desks and the Barangay Liaison Desk from the designation register', True, False, 60, None),
                ('Hold the first cluster coordination meeting: needs, gaps and resource requests', True, False, 120, 'CL-F03'),
                ('Stand clusters down as their needs are met; record each', False, False, None, 'CL-F04')]),
    dict(code='WF-EOC-DESIGNATION', title='EOC designation review (quarterly)', category='workforce', owner_role='cdrrmo_head',
         doc='MOO Ch.2', purpose='Keep every key EOC position covered by a primary and two alternates (Annex 2-D; IAT B4.2).',
         trigger='Every quarter, and after any staff movement.',
         steps=[('List the positions not covered two deep (EOC designation register)', True, False, None, 'HR-F05'),
                ('Ask the participating offices for nominations', False, False, None, None),
                ('Enter the nominations as proposals in the register', True, False, None, None),
                ('CDRRMO Head approves the designations (needs a connection)', True, False, None, None),
                ('Brief the new designees and record the orientation', False, False, None, 'HR-F06')]),
    dict(code='WF-GEO-COP', title='Geospatial common operating picture (SOP 6-GIS-01)', category='geospatial', owner_role='eoc_staff',
         doc='EOC Ch.6', purpose='Keep a consistent, validated map of incidents, affected areas, facilities and resources for the EOC.',
         trigger='Maintained in normal operations; run in full whenever the EOC is activated.',
         steps=[('Establish the reference: register the EOC point and verify it on the ground', True, False, None, 'EOC-GIS-REF'),
                ('Acquire base maps, hazard layers, boundaries and critical facilities from their custodians', False, False, None, 'EOC-GIS-01'),
                ('Validate each layer: source, date, coordinate system, geometry and completeness', True, False, None, 'EOC-GIS-02'),
                ('Integrate the approved layers in the Geo-COP with agreed names and symbols', False, False, None, None),
                ('Plot incident information from barangays, field teams and agencies', True, False, None, 'EOC-GIS-03'),
                ('Verify material locations and access constraints in the field', True, False, None, None),
                ('Update the incident, evacuation, resource and infrastructure layers as information is validated', False, False, None, 'EOC-GIS-06'),
                ('Share approved map products by access level; mark preliminary information clearly', True, False, None, 'EOC-GIS-04'),
                ('Archive map versions and their records for reporting and after-action review', False, False, None, None)]),
]
