"""1.10.0 SOP registry (ADR-019): one consistent record for every SOP the platform runs.

Every protocol and workflow carries the same five elements the Manual gives each SOP:
  sop_ref        the controlling SOP text in the Manual (Library)
  process_owner  the office accountable for the result (a position or office, never a person)
  policy_refs    the legal and policy basis (shown with "The official text governs")
  indicator_ids  the IAT indicators the SOP serves (must exist in iat_indicators)
  kind           'protocol' (incident, point of action) or 'workflow' (management cycle over days or weeks)
plus, per step, the form the step is closed on (forms_seed.STEP_FORMS / the step tuple).

Chapter 3 v1.0 (8 Nov 2026) adds nine workflows WF-SOP3-01..09 and the Chapter 3 forms F3-01..F3-11
(Annexes 3-B to 3-L). Privacy (RA 10173): forms hold institutional records and aggregate counts only.
"""
from forms_seed import f

PROTOCOL_CATEGORIES = {'daily_operations', 'warning', 'eoc', 'anticipatory_action', 'reporting', 'recovery'}
# Everything else is a workflow (normal-operations management cycle).

META = {  # code -> (sop_ref, process_owner, policy_refs, indicator_ids)
    'PR-DUTY-HANDOVER': ('MOO Ch.2 Annex 2-E (HR-F04)', 'CDRRMO Operations and Warning Division (duty officer on shift)',
                         ['RA 10121 Sec. 12(c)', 'NDRRMC Memo 131 s. 2018'], ['A2.5', 'B4.3']),
    'PR-WARNING-DISSEM': ('EOC Manual Ch.2 (warning)', 'CDRRMO Operations and Warning Division',
                          ['RA 10121 Sec. 12(c)', 'DILG VIII Disaster Response Reporting SOP (RDRRMC8 Res. 12-006)'],
                          ['A6.1', 'A6.2', 'A6.3', 'A6.4', 'B5.6']),
    'PR-EOC-ACTIVATE': ('EOC Manual Ch.2 (activation)', 'EOC Manager',
                        ['NDRRMC Memo 131 s. 2018', 'DILG VIII Disaster Response Reporting SOP (RDRRMC8 Res. 12-006)'],
                        ['B1.2', 'B1.3', 'B4.1', 'B4.2']),
    'PR-PDRA': ('EOC Manual Ch.2 (PDRA)', 'EOC Manager with the PDRA core group', ['RA 12287 and its IRR (2026)'], ['A8.6', 'A8.8']),
    'PR-SOID-REQUEST': ('SOP GOV-05 (Annex 1-F)', 'CDRRMO Head as CDRRMC secretariat', ['RA 12287 and its IRR (2026), Rules III and IV'],
                        ['A1.8', 'A4.6', 'A6.7']),
    'PR-SOC-DECLARE': ('SOP GOV-04 (Annex 1-E)', 'CDRRMO Head as CDRRMC secretariat', ['RA 10121 Sec. 16'], ['A1.6']),
    'PR-FLASHFLOOD-EARLY': ('EOC Manual Ch.2 (short-lead hazards)', 'CDRRMO Operations and Warning Division',
                            ['RA 10121 Sec. 12(c)', 'RA 12287 IRR (2026) Rule IV'], ['A6.1', 'A6.2', 'A8.8']),
    'PR-SITREP-CYCLE': ('EOC Manual Ch.6 (reporting)', 'EOC Planning Section',
                        ['DILG VIII Harmonized Disaster Response Reporting Template and SOP', 'NDRRMC Memo 131 s. 2018'],
                        ['B5.1', 'B5.2', 'A10.3']),
    'PR-CDRRMC-MEETING': ('MOO Ch.1 (CDRRMC secretariat)', 'CDRRMO as CDRRMC secretariat', ['RA 10121 Sec. 11'], ['A1.3', 'A1.4']),
    'PR-LIFT-REPORT': ('MOO Ch.7 (lifting and reporting)', 'CDRRMO Head', ['RA 12287 and its IRR (2026)'], ['A10.8']),
    'WF-BUDGET-CYCLE': ('MOO Ch.2 sec. 2.16.2', 'CDRRMO Research and Planning (formulation); Administration and Training (execution)',
                        ['RA 10121 Sec. 21', 'NDRRMC-DBM-DILG JMC 2013-1'], ['A3.5', 'A4.1', 'A4.2', 'A4.4']),
    'WF-CP-ACTIVATION': ('MOO Ch.1 sec. 6.3', 'EOC Manager', ['NDRRMC Memo 131 s. 2018'], ['A8.5', 'B1.4', 'B4.4']),
    'WF-EOC-DESIGNATION': ('MOO Ch.2 Annex 2-D', 'CDRRMO Head', ['NDRRMC Memo 131 s. 2018', 'EOC Capability Assessment Checklist'],
                           ['B4.1', 'B4.2']),
    'WF-GEO-COP': ('SOP 6-GIS-01 (EOC Manual Ch.6)', 'EOC Planning Section (GIS custodian)', ['NDRRMC Memo 131 s. 2018', 'RA 10173'],
                   ['A5.6', 'A5.7', 'B5.3']),
}

# ---------------------------------------------------------------- Chapter 3 forms (Annexes 3-B to 3-L)
USE = ['Internal screening', 'Public information', 'CLUP/CDP planning layer', 'Regulatory use']
STATUS_BP = ['Not submitted', 'Submitted', 'Under review', 'Returned for revision', 'Technically accepted', 'Approved', 'Tested', 'Due for update']
CH3_FORMS = [
    ('F3-01', 'Risk information and map request', 'Annex 3-B. Opens SOP 3-1: who needs what map, for which decision.', 'MOO Ch.3', [
        f('requesting_office', 'Requesting office', 'text', True, hint='Office and position, not a personal name'),
        f('decision_purpose', 'Decision purpose', 'select', True, ['Screening', 'Public information', 'CLUP/CDP planning', 'Technical review', 'Other']),
        f('hazard', 'Hazard', 'text', True), f('geography', 'Barangay(s) or area', 'textarea', True),
        f('scale_format', 'Required scale and format', 'text', True), f('required_by', 'Required by', 'date', True),
        f('source_product', 'Source product (agency, title, version or date)', 'textarea'),
        f('limitations', 'Known limitations', 'textarea')]),
    ('F3-02', 'Dataset metadata and quality checklist', 'Annex 3-C. A dataset is not released until this is complete.', 'MOO Ch.3', [
        f('dataset_id', 'Dataset ID', 'text', True), f('source_agency', 'Source agency and original product', 'text', True),
        f('source_date', 'Source date', 'date', True), f('scale', 'Scale or resolution', 'text', True),
        f('crs', 'Coordinate reference system', 'text', True, hint='For example EPSG:4326'),
        f('method', 'Method, scenario, baseline and time horizon', 'textarea'),
        f('geometry_ok', 'Geometry, attributes and legend checked', 'checkbox', True),
        f('limitations', 'Limitations and prohibited uses', 'textarea', True),
        f('access_class', 'Access class', 'select', True, ['Public', 'Internal', 'Confidential', 'Personal or sensitive']),
        f('approved_use', 'Approved use', 'select', True, USE)]),
    ('F3-03', 'CDRA hazard-impact scoping matrix', 'Annex 3-D. One entry per hazard-sector pathway.', 'MOO Ch.3', [
        f('hazard', 'Hazard or climate stressor', 'text', True), f('source_scenario', 'Source, scenario and horizon', 'text', True),
        f('sectors', 'Affected sectors', 'multiselect', True, ['Population', 'Urban use areas', 'Natural resource production', 'Critical point facilities', 'Lifelines', 'Ecosystems']),
        f('impact_chain', 'Impact chain and area', 'textarea', True), f('data_gap', 'Data gap or uncertainty', 'textarea'),
        f('validation_owner', 'Validation owner (office)', 'text', True)]),
    ('F3-04', 'CDRA Major Decision Area register entry', 'Annex 3-E.', 'MOO Ch.3', [
        f('mda_id', 'MDA ID and location', 'text', True), f('finding', 'Evidence and risk finding', 'textarea', True),
        f('affected', 'Affected groups, assets or systems', 'textarea', True),
        f('decision', 'Policy or investment decision required', 'textarea', True), f('lead_office', 'Lead office', 'text', True),
        f('indicator', 'Indicator, target and review date', 'text')]),
    ('F3-05', 'Critical facilities and dependency register entry', 'Annex 3-F.', 'MOO Ch.3', [
        f('asset_id', 'Asset ID and name', 'text', True), f('owner', 'Owner or operator (office or utility)', 'text', True),
        f('service', 'Service, capacity and users', 'textarea', True), f('exposure', 'Hazard exposure and condition', 'textarea', True),
        f('dependencies', 'Dependencies', 'multiselect', True, ['Power', 'Water', 'Telecommunications', 'Road access', 'Fuel', 'Staff', 'ICT']),
        f('backup', 'Backup, redundancy and restoration estimate', 'textarea'), f('validated_on', 'Validated with owner on', 'date')]),
    ('F3-06', 'Contingency plan quality and exercise record', 'Annex 3-G.', 'MOO Ch.3', [
        f('plan_code', 'Contingency plan', 'text', True, hint='For example CP-FLOOD-LUNOP'),
        f('areas_ok', 'Control areas found complete', 'multiselect', True, ['Scenario and assumptions', 'Objectives and concept of operations',
          'Roles and tasking', 'Triggers and warning', 'Operations and protection', 'Resources and logistics', 'Information management']),
        f('exercise_type', 'Exercise', 'select', False, ['None yet', 'Walk-through', 'Tabletop', 'Functional', 'Full-scale']),
        f('exercise_date', 'Exercise date', 'date'), f('findings', 'Findings', 'textarea'),
        f('corrective_actions', 'Corrective actions (owner and due date)', 'textarea')]),
    ('F3-07', 'Essential functions inventory and BIA entry', 'Annex 3-H. Recovery priorities come from the BIA; no generic times.', 'MOO Ch.3', [
        f('department', 'Department or service', 'text', True), f('function', 'Essential function and legal basis', 'textarea', True),
        f('minimum_level', 'Service users and minimum level', 'textarea', True), f('key_posts', 'Key posts and alternates (positions)', 'textarea'),
        f('dependencies', 'Dependencies and suppliers', 'textarea'), f('impact_over_time', 'Impact over time and priority', 'textarea', True),
        f('strategy', 'Recovery strategy and owner', 'textarea', True)]),
    ('F3-08', 'Barangay DRRM plan review status', 'Annex 3-I. One entry per barangay (85).', 'MOO Ch.3', [
        f('barangay', 'Barangay (official name)', 'text', True), f('plan_period', 'Plan period and version', 'text'),
        f('approval_evidence', 'Approval evidence', 'text'), f('review_tool', 'Quality tool and review date', 'text'),
        f('status', 'Status', 'select', True, STATUS_BP), f('corrections', 'Required corrections and due date', 'textarea')]),
    ('F3-09', 'DRR/CCA project screening', 'Annex 3-J. Before an investment proposal is prioritized.', 'MOO Ch.3', [
        f('project', 'Project, proponent office and site', 'text', True), f('exposure', 'Hazard and climate exposure (map, source, date)', 'textarea', True),
        f('affected', 'People and services affected; inclusion', 'textarea', True), f('siting', 'Siting, design and ecosystem implications', 'textarea'),
        f('treatment', 'Risk treatment and residual risk', 'textarea', True),
        f('reviewers', 'Technical reviewers', 'multiselect', True, ['CPDO', 'Engineering', 'OBO', 'Zoning', 'CENRO', 'CDRRMO']),
        f('decision', 'Planning or budget decision', 'select', True, ['Proceed', 'Proceed with conditions', 'Return for redesign', 'Specialist assessment needed'])]),
    ('F3-10', 'Consultation and inclusion validation record', 'Annex 3-K. Groups and organizations, not individuals.', 'MOO Ch.3', [
        f('group', 'Consulted group or organization', 'text', True), f('date_method', 'Date and accessible method', 'text', True),
        f('issue', 'Risk or access issue raised', 'textarea', True), f('response', 'Plan or design response', 'textarea', True),
        f('owner', 'Responsible office and due date', 'text')]),
    ('F3-11', 'Corrective action and document revision register entry', 'Annex 3-L.', 'MOO Ch.3', [
        f('finding', 'Finding and source', 'textarea', True, hint='IAT, exercise, event or audit'), f('root_cause', 'Root cause', 'textarea'),
        f('action', 'Corrective action', 'textarea', True), f('owner', 'Accountable office', 'text', True), f('due', 'Due date', 'date', True),
        f('verification', 'Verification evidence', 'text'), f('closure', 'Closure', 'select', False, ['Open', 'Closed', 'Escalated'])]),
]

# ---------------------------------------------------------------- Chapter 3 workflows (SOP 3-1 to 3-9)
def _wf(no, title, category, purpose, trigger, owner, refs, inds, steps):
    return dict(code=f'WF-SOP3-{no:02d}', title=f'SOP 3-{no} {title}', category=category, owner_role='cdrrmo_head', doc='MOO Ch.3',
                purpose=purpose, trigger=trigger, steps=steps,
                meta=(f'SOP 3-{no} (MOO Ch.3 v1.0)', owner, refs, inds))

CH3_WORKFLOWS = [
    _wf(1, 'Hazard data acquisition, validation and map release', 'risk_information',
        'Obtain authoritative, current and fit-for-purpose hazard information and control its use.',
        'A request for risk information or a map; a new or revised product from a source agency.',
        'CDRRMO Research and Planning (GIS custodian)', ['RA 10121 Sec. 12(c)(3)', 'DHSUD MC 2025-004'], ['A5.1', 'A5.6', 'C1.4'],
        [('Open and scope the request: purpose, hazard, area, scale, deadline and decision', True, False, None, 'F3-01'),
         ('Acquire the current product from the source agency; keep the original file and metadata', True, False, None, None),
         ('Check metadata and integrity: date, scale, CRS, units, geometry, legend, coverage', True, False, None, 'F3-02'),
         ('Resolve discrepancies with the source agency; never average or redraw uncertain boundaries', False, True, None, None),
         ('Prepare the controlled overlay on approved barangay boundaries; record processing', False, False, None, None),
         ('Technical validation by the relevant office (and CPDO/Zoning/Engineering for planning use)', True, False, None, None),
         ('Classify and approve the use: internal, public, planning layer or regulatory', True, False, None, None),
         ('Publish with date, source, scale, legend, limitations and version; archive the old version', True, False, None, None)]),
    _wf(2, 'Risk information and geospatial repository maintenance', 'risk_information',
        'Maintain a controlled, auditable City risk information base.',
        'A new dataset; quarterly review; after a major event or a source-agency revision.',
        'CDRRMO Head (designated data custodian)', ['RA 10121 Sec. 12(c)(3) and (5)', 'RA 10173'], ['A5.4', 'A5.5', 'A5.6', 'A5.7'],
        [('Register the dataset: ID, source owner, custodian, date, scale, CRS, update cycle, access class', True, False, None, 'F3-02'),
         ('Apply data governance: lawful purpose, access rights, retention and sharing conditions', True, False, None, None),
         ('Validate the update against the current version; note maps and plans affected', False, False, None, None),
         ('Release the controlled version with its approval status and effective date', True, False, None, None),
         ('Review on the cycle and archive superseded versions with the reason', False, False, None, 'F3-11')]),
    _wf(3, 'City climate and disaster risk assessment', 'risk_planning',
        'Produce a method-compliant CDRA that supports CLUP and development decisions.',
        'CDRA update with the CLUP/CDP revision; material change in hazard, exposure or climate information; new DHSUD issuance.',
        'CPDO (CDRA process) with the CDRRMO coordinating DRRM evidence',
        ['DHSUD MC 2025-004 (Enhanced CDRA)', 'RA 9729 as amended by RA 10174', 'RA 10121 Sec. 12(c)(3)'], ['A5.2', 'A5.3', 'C1.1', 'C1.3'],
        [('Approve the assessment protocol: scope, horizon, hazards, sectors, team, tools, consultation plan', True, False, None, None),
         ('Step 1: collect and organize hazard and climate information; register data gaps', True, False, None, None),
         ('Step 2: scope potential impacts by hazard and sector', True, False, None, 'F3-03'),
         ('Step 3: develop the exposure database (aggregated; RA 10173)', True, False, None, None),
         ('Step 4: conduct the risk assessment with the prescribed DHSUD method', True, False, None, None),
         ('Step 5: summarize findings into Major Decision Areas', True, False, None, 'F3-04'),
         ('Step 6: compile the CDRA package; correct inconsistencies (including Naval/Biliran labels)', True, True, None, None),
         ('Step 7: mainstream into the CLUP through CPDO', False, False, None, None),
         ('Step 8: set the M&E matrix and update triggers', False, False, None, None),
         ('Step 9: communicate results; record consultation', False, False, None, 'F3-10')]),
    _wf(4, 'Critical facilities and dependency/failure-chain analysis', 'risk_information',
        'Identify critical service dependencies and inform protection and restoration priorities.',
        'Yearly; after a change to a critical asset; before a contingency plan or PSCP update.',
        'CDRRMO (coordination); asset owners accountable for asset data', ['RA 12287 IRR (2026) Rule I Sec. 5(b),(d)'], ['A5.8'],
        [('Define the asset scope and owners with department heads, utilities and agencies', True, False, None, None),
         ('Inventory each asset and its exposure', True, False, None, 'F3-05'),
         ('Map dependencies: inputs, upstream services, downstream users, access routes', True, False, None, None),
         ('Develop failure chains for priority scenarios; mark unverified links as assumptions', False, True, None, None),
         ('Validate with operators; record unknowns', True, False, None, None),
         ('Prioritize protection and restoration with documented criteria', False, False, None, None),
         ('Transfer actions to the PSCP, contingency plans and AIP/LDIP; monitor', False, False, None, 'F3-11')]),
    _wf(5, 'LDRRMP and DRR/CCA mainstreaming interface', 'risk_planning',
        'Ensure risk evidence is converted into plans, programmes and budget decisions.',
        'Yearly planning and budget cycle (AIP, LDRRMFIP); LDRRMP review; each investment proposal.',
        'CDRRMO (LDRRMP); CPDO (development-plan integration)',
        ['RA 10121 Sec. 2 and 12(c)(6)', 'RA 7160', 'RA 9729 as amended by RA 10174', 'NDRRMC-DBM-DILG JMC 2013-1'],
        ['A3.1', 'A3.2', 'C1.1', 'C1.2', 'C1.4'],
        [('Compile the planning evidence pack: CDRA, maps, MDA register, losses, dependencies', True, False, None, None),
         ('CPDO convenes the planning review with the LDC and sector offices', True, False, None, None),
         ('Set objectives and interventions with measurable outputs and responsible offices', False, False, None, None),
         ('Screen spatial and investment proposals', True, False, None, 'F3-09'),
         ('Prioritize and resource through the planning and budget processes', False, False, None, None),
         ('Approve, implement and monitor; record corrective action', False, False, None, 'F3-11')]),
    _wf(6, 'Hazard-specific contingency plan development and control', 'contingency_planning',
        'Prepare and maintain tested plans for priority hazard scenarios.',
        'A priority hazard without a current plan; a plan past its validity; after an exercise or event; yearly review.',
        'CDRRMO (coordinating process owner); hazard and sector leads (technical owners)',
        ['RA 10121 Sec. 12(c)', 'OCD/NDRRMC contingency-planning manual (current edition to be obtained)'], ['A3.3', 'A3.6'],
        [('Select the priority scenario from the CDRA, agency products and history', True, False, None, None),
         ('Confirm the planning team and the controlling guidance', True, False, None, None),
         ('Build the scenario and assumptions from authoritative evidence', True, False, None, None),
         ('Set objectives and the concept of operations (EOC/ICS interface)', True, False, None, None),
         ('Assign tasks, triggers and resources; validate contacts', True, False, None, None),
         ('Complete protection and inclusion arrangements', True, False, None, 'F3-10'),
         ('Validate and approve through the City route', True, False, None, None),
         ('Exercise and correct; update the plan version', True, False, None, 'F3-06'),
         ('Review and maintain; update the contingency-plan register in MODE', False, False, None, 'F3-11')]),
    _wf(7, 'Public service continuity planning', 'continuity',
        'Protect essential City functions during disruption.',
        'Mayor\'s directive; yearly review; after a disruption or exercise.',
        'City continuity executive (to be designated); department heads for their services', ['NDRRMC-OCD PSCP Guidebook'], ['A3.4', 'B2.7'],
        [('Establish governance: continuity executive, coordinators, custodian, activation authority', True, False, None, None),
         ('Inventory essential functions and conduct the BIA', True, False, None, 'F3-07'),
         ('Analyze dependencies and single points of failure', True, False, None, None),
         ('Select continuity strategies (alternate site, manual workarounds, succession)', True, False, None, None),
         ('Prepare department continuity plans', False, False, None, None),
         ('Integrate city-wide; coordinate with the alternate EOC', True, False, None, None),
         ('Approve and exercise', True, False, None, None),
         ('Review and update; close corrective actions', False, False, None, 'F3-11')]),
    _wf(8, 'Barangay DRRM plan review and quality assurance', 'risk_planning',
        'Maintain a verified, quality-assured city-wide BDRRMP status for the 85 barangays.',
        'Yearly BDRRMP cycle; DILG call for plans; a new plan period.',
        'BDRRMC/Barangay Development Council (plan owner); CDRRMO (city reviewer)',
        ['RA 10121 Sec. 12(c)(6)', 'DILG MC 2025-035 (Listo si KAP)'], ['A3.7'],
        [('Confirm the master list (85 barangays, PSA PSGC) and the 110-to-85 crosswalk', True, False, None, None),
         ('Call for current plans with the official template and tool', True, False, None, None),
         ('Screen completeness', False, False, None, None),
         ('Conduct the quality assessment with the official tool', True, False, None, None),
         ('Return with itemized comments and support revision', False, False, None, None),
         ('Verify corrections and record status', True, False, None, 'F3-08'),
         ('Consolidate and report to the CDRRMC and DILG', False, False, None, None),
         ('Coordinate plan testing and updates', False, False, None, None)]),
    _wf(9, 'Inclusive risk assessment and ecosystem monitoring interface', 'risk_information',
        'Embed inclusion and protective-ecosystem evidence in risk intelligence and preparedness.',
        'Each CDRA or plan update; yearly monitoring.',
        'CDRRMO (coordination); sector offices and CENRO/DENR (technical owners)',
        ['RA 9710', 'RA 7277 as amended', 'RA 10821', 'RA 8371', 'RA 10173', 'RA 9729 as amended by RA 10174'],
        ['A5.3', 'A5.5', 'A7.6', 'C3.1', 'C3.2'],
        [('Set the participation and data protocol', True, False, None, None),
         ('Collect disaggregated evidence lawfully; minimize personal data', True, False, None, None),
         ('Validate lived experience and access barriers with sector groups', True, False, None, 'F3-10'),
         ('Assess ecosystem services with CENRO/DENR', False, False, None, None),
         ('Integrate findings into CDRA impact chains, MDAs and plans', True, False, None, None),
         ('Monitor and report; record corrective action', False, False, None, 'F3-11')]),
]
for w in CH3_WORKFLOWS:
    META[w['code']] = w.pop('meta')
