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
    # 1.11: owner as in MOO Ch.2 v1.2 (SOP register, HR-05); the handover itself is done by the duty officer on shift
    # (Operations Center staff, Warning and Monitoring Section in the 2026 structure chart).
    'PR-DUTY-HANDOVER': ('SOP HR-05 (MOO Ch.2, Annex 2-K; checklist Annex 2-E, form HR-F04)',
                         'CDRRMO Head / division leads (SOP HR-05); handover done by the duty officer on shift',
                         ['RA 10121 Sec. 12(c)', 'NDRRMC Memo 131 s. 2018'], ['A2.5', 'B4.3']),
    'PR-WARNING-DISSEM': ('SOP 4-02 (MOO Ch.4 v1.1)',
                          'CDRRMO Head / warning and public information focal person; decisions stay with the competent official',
                          ['RA 10121 Sec. 12(c)', 'DILG VIII Disaster Response Reporting SOP (RDRRMC8 Res. 12-006)'],
                          ['A6.1', 'A6.2', 'A6.3', 'A6.4', 'B5.6']),
    'PR-EOC-ACTIVATE': ('SOP 4-04 (MOO Ch.4 v1.1)', 'Official designated in the EOC EO authorises; EOC Manager implements',
                        ['NDRRMC Memo 131 s. 2018', 'DILG VIII Disaster Response Reporting SOP (RDRRMC8 Res. 12-006)'],
                        ['B1.2', 'B1.3', 'B4.1', 'B4.2']),
    'PR-PDRA': ('SOP 4-03 (MOO Ch.4 v1.1); SOP GOV-05 when a State of Imminent Disaster is considered',
                'CDRRMO Head; Research and Planning with Operations and Warning coordinate',
                ['RA 12287 and its IRR (2026)', 'NDRRMC-OCD Contingency Planning Guidebook (2020)'], ['A8.6', 'A8.8', 'B1.2']),
    'PR-SOID-REQUEST': ('SOP GOV-05 (MOO Ch.1, Annex 1-E)', 'CDRRMO Head as CDRRMC secretariat', ['RA 12287 and its IRR (2026), Rules III and IV'],
                        ['A1.8', 'A4.6', 'A6.7']),
    'PR-SOC-DECLARE': ('SOP GOV-04 (MOO Ch.1, Annex 1-D)', 'CDRRMO Head as CDRRMC secretariat', ['RA 10121 Sec. 16'], ['A1.6']),
    'PR-FLASHFLOOD-EARLY': ('SOP 4-02 (MOO Ch.4 v1.1, short-lead hazards, sec. 6.3)', 'CDRRMO Operations and Warning (OpCen duty officer)',
                            ['RA 10121 Sec. 12(c)', 'RA 12287 IRR (2026) Rule IV'], ['A6.1', 'A6.2', 'A8.8']),
    'PR-SITREP-CYCLE': ('SOP 4-08 (MOO Ch.4 v1.1)', 'EOC Planning / situation unit; approval by the official in the reporting route',
                        ['DILG VIII Harmonized Disaster Response Reporting Template and SOP', 'NDRRMC Memo 131 s. 2018'],
                        ['B5.1', 'B5.2', 'B1.5', 'A10.3']),
    'PR-CDRRMC-MEETING': ('MOO Ch.1 (CDRRMC secretariat)', 'CDRRMO as CDRRMC secretariat', ['RA 10121 Sec. 11'], ['A1.3', 'A1.4']),
    'PR-LIFT-REPORT': ('SOP GOV-05 (MOO Ch.1, Annex 1-E): lifting and the 45-day report', 'CDRRMO Head as CDRRMC secretariat',
                       ['RA 12287 and its IRR (2026)'], ['A10.8']),
    'WF-BUDGET-CYCLE': ('MOO Ch.2 sec. 2.16.2', 'CDRRMO Research and Planning (formulation); Administration and Training (execution)',
                        ['RA 10121 Sec. 21', 'NDRRMC-DBM-DILG JMC 2013-1'], ['A3.5', 'A4.1', 'A4.2', 'A4.4']),
    'WF-CP-ACTIVATION': ('MOO Ch.1 sec. 6.3', 'EOC Manager', ['NDRRMC Memo 131 s. 2018'], ['A8.5', 'B1.4', 'B4.4']),
    # 1.11: owner as in MOO Ch.2 v1.2 (HR-06): the EOC Manager proposes and keeps the designations; the Head approves.
    'WF-EOC-DESIGNATION': ('SOP HR-06 (MOO Ch.2, Annex 2-L; register Annex 2-D)',
                           'CDRRMO Head / EOC Manager (SOP HR-06): EOC Manager proposes and maintains; CDRRMO Head approves',
                           ['NDRRMC Memo 131 s. 2018', 'EOC Capability Assessment Checklist'],
                           ['B4.1', 'B4.2']),
    'WF-GEO-COP': ('SOP 6-GIS-01 (proposed EOC Module SOP; Library draft)', 'EOC Planning Section (GIS custodian)', ['NDRRMC Memo 131 s. 2018', 'RA 10173'],
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
        ['RA 10121 Sec. 12(c)', 'NDRRMC-OCD Contingency Planning Guidebook (2020)'], ['A3.3', 'A3.6'],
        [('Rank the hazards and select the one to plan for (CP Form 1, hazard analysis), using CDRA evidence', True, False, None, None),
         ('Confirm the CP working group and the controlling guidance (CP Guidebook, 2020)', True, False, None, None),
         ('Describe the hazard and build the worst-case scenario (CP Forms 2, 3A or 3B)', True, False, None, None),
         ('Project the affected and displaced population, aggregated and disaggregated (CP Forms 4A, 4B; RA 10173)', True, False, None, None),
         ('Organise the response clusters and their activities (CP Forms 5, 6)', True, False, None, None),
         ('Inventory resources, project needs and summarise gaps (CP Forms 7, 8, 9)', True, False, None, None),
         ('Set the EOC and ICS arrangements and their interoperability with the clusters (CP Forms 10, 11)', True, False, None, None),
         ('Draw the activation and deactivation flow with its triggers (PDRA, RDANA, reports); the IC recommends termination', True, False, None, None),
         ('Complete protection and inclusion arrangements', True, False, None, 'F3-10'),
         ('Validate, endorse and approve through the City route', True, False, None, None),
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

# ---------------------------------------------------------------- Chapter 4 (v1.1, 8 Nov 2026)
# Chapter 4 "Early Warning, Activation, Incident Management and Emergency Response" holds SOPs 4-01 to 4-09.
# Four existing protocols now carry SOPs 4-02, 4-03, 4-04 and 4-08 (META above); five new protocols carry the rest.
# Chapter 4 form codes that already had a platform form keep the platform code (records exist under it):
#   EWR-F01 = EOC-WARN-01, EWR-F03 = EOC-WARN-02, EWR-F04 = GOV-F09, EOC-F01 = EOC-ACT-01, EOC-F05 = EOC-SITREP-01.
# EWR-F02 (the warning-to-action matrix) is a controlled register (Annex 4-C), not a step form.
CH4_FORM_ALIASES = {'EWR-F01': 'EOC-WARN-01', 'EWR-F03': 'EOC-WARN-02', 'EWR-F04': 'GOV-F09',
                    'EOC-F01': 'EOC-ACT-01', 'EOC-F05': 'EOC-SITREP-01'}
LEVELS = ['White', 'Blue', 'Red']
CH4_FORMS = [
    ('EOC-F02', 'EOC opening and operational readiness checklist', 'Chapter 4 EOC-F02 (SOP 4-04 step 5).', 'MOO Ch.4', [
        f('level', 'Alert status in force', 'select', True, LEVELS),
        f('checked', 'Checked and ready', 'multiselect', True, ['Facility and safety', 'Power and backup', 'Communications (primary and backup)',
          'Roster and alternates', 'Equipment and supplies', 'Maps and data', 'Records and logbook', 'Shift plan', 'Briefing held']),
        f('gaps', 'Gaps and the office fixing each', 'textarea'), f('operational_period', 'First operational period', 'text', True)]),
    ('EOC-F03', 'Initial incident coordination and ICS interface record', 'Chapter 4 EOC-F03 (SOP 4-05).', 'MOO Ch.4', [
        f('incident', 'Incident and location', 'text', True),
        f('ic_position', 'Incident Commander / IMT (position and agency)', 'text', True, hint='Position and agency, not a personal name'),
        f('command_post', 'Command post and contact channel', 'text', True),
        f('objectives', 'Incident objectives received and operational period', 'textarea', True),
        f('eoc_support', 'EOC support objectives and decisions needed', 'textarea', True),
        f('liaison', 'Liaison arrangement and escalation route', 'textarea')]),
    ('EOC-F04', 'Incident briefing and shift handover', 'Chapter 4 EOC-F04 (SOP 4-05 steps 6-7; SOP 4-04 step 6).', 'MOO Ch.4', [
        f('situation', 'Situation, source and time', 'textarea', True), f('objectives', 'Objectives', 'textarea', True),
        f('open_tasks', 'Open tasks, requests and decisions', 'textarea', True), f('risks', 'Risks and constraints', 'textarea'),
        f('next_review', 'Next briefing or handover time', 'text', True)]),
    ('ER-F01', 'Evacuation coordination and monitoring sheet', 'Chapter 4 ER-F01 (SOP 4-06). Counts only; no names.', 'MOO Ch.4', [
        f('decision_ref', 'Authorised decision or order (reference)', 'text', True, hint='Who decided under which issuance'),
        f('areas', 'Barangays or puroks covered', 'textarea', True),
        f('families_moved', 'Families moved (aggregate)', 'integer'), f('persons_moved', 'Persons moved (aggregate)', 'integer'),
        f('centres_open', 'Evacuation centres open', 'integer'), f('transport_access', 'Transport and access issues', 'textarea'),
        f('unmet_needs', 'Unmet needs and the office handling each', 'textarea')]),
    ('ER-F02', 'Response deployment and safety coordination record', 'Chapter 4 ER-F02.', 'MOO Ch.4', [
        f('requesting_authority', 'Requesting authority', 'text', True), f('task', 'Task and location', 'textarea', True),
        f('lead_agency', 'Lead agency', 'text', True), f('check_in', 'Check-in time', 'time'),
        f('safety', 'Safety briefing and hazards noted', 'textarea', True), f('status', 'Status', 'select', True, ['Deployed', 'On task', 'Completed', 'Withdrawn'])]),
    ('ER-F03', 'Shelter and CCCM service coordination summary', 'Chapter 4 ER-F03; JMC No. 2 s. 2021 (CCCM). Aggregates only; DAFAC stays with the CSWDO.', 'MOO Ch.4', [
        f('facility', 'Evacuation centre or site', 'text', True),
        f('families', 'Families in the centre (aggregate)', 'integer'), f('persons', 'Persons in the centre (aggregate)', 'integer'),
        f('services', 'Services in place', 'multiselect', False, ['Camp manager assigned', 'Registration (DAFAC) by CSWDO', 'Food and NFI', 'WASH',
          'Health', 'Protection and child-friendly space', 'Women-friendly space', 'Accessibility for PWD and older persons', 'Security']),
        f('issues', 'Issues and referrals (no names)', 'textarea'), f('closure', 'Closure or decampment status', 'text')]),
    ('ER-F04', 'Public information verification and correction log', 'Chapter 4 ER-F04 (sec. 10.5).', 'MOO Ch.4', [
        f('claim', 'Claim or rumour', 'textarea', True), f('source', 'Where it was seen', 'text', True),
        f('verification', 'Verification status', 'select', True, ['Unverified', 'Verified true', 'Verified false', 'Partly true']),
        f('approved_message', 'Approved message issued', 'textarea'), f('feedback', 'Feedback received', 'textarea')]),
    ('EOC-F06', 'Resource request referral and status sheet', 'Chapter 4 EOC-F06 (SOP 4-07). Expenditure follows Chapter 5.', 'MOO Ch.4', [
        f('request_ref', 'Resource request reference', 'text', True), f('priority', 'Priority', 'select', True, ['Life-safety', 'Urgent', 'Routine']),
        f('owner', 'Asset owner or office', 'text', True), f('approval_route', 'Approval route and decision', 'textarea', True),
        f('dispatch', 'Dispatch, receipt and custody', 'textarea'), f('closeout', 'Closeout: used, returned, outstanding', 'textarea')]),
    ('ER-F05', 'Demobilisation and transition handover register entry', 'Chapter 4 ER-F05 (SOP 4-09 step 4).', 'MOO Ch.4', [
        f('item', 'Outstanding task, resource or information', 'textarea', True), f('receiving_office', 'Receiving office', 'text', True),
        f('due', 'Due date', 'date', True), f('acknowledged', 'Receipt acknowledged by the receiving office', 'checkbox', True)]),
    ('ER-F06', 'After-action and corrective action record', 'Chapter 4 ER-F06 (SOP 4-09 step 6); feeds Chapter 7.', 'MOO Ch.4', [
        f('finding', 'Finding and evidence', 'textarea', True), f('cause', 'Root or contributing cause', 'textarea', True),
        f('action', 'Corrective action', 'textarea', True), f('owner', 'Accountable office', 'text', True), f('due', 'Due date', 'date', True),
        f('verification', 'Verification evidence', 'text'), f('closure', 'Closure', 'select', False, ['Open', 'Closed', 'Escalated'])]),
]


def _pr(code, sop, title, category, role, purpose, trigger, owner, refs, inds, steps):
    """A Chapter 4 protocol. Steps: (instruction, critical, needs note, minutes, form)."""
    return dict(code=code, title=f'SOP {sop} {title}', category=category, owner_role=role, doc='MOO Ch.4', purpose=purpose,
                trigger=trigger, steps=steps, meta=(f'SOP {sop} (MOO Ch.4 v1.1)', owner, refs, inds))


CH4_PROTOCOLS = [
    _pr('PR-WARNING-RECEIPT', '4-01', 'Official warning receipt, verification and escalation', 'warning', 'duty_officer',
        'Authenticate, time-stamp and interpret each official product within its source limits, and escalate it to the right decision-maker.',
        'On receipt of an official warning product or a significant local report.',
        'CDRRMO Operations and Warning (OpCen duty officer); escalation to the CDRRMO Head',
        ['RA 10121 Sec. 12(c)', 'DILG VIII Disaster Response Reporting SOP (RDRRMC8 Res. 12-006)'], ['A6.1', 'B4.3'],
        [('Receive through the approved channel; keep the original file or link; note issue time and receipt time', True, False, 0, 'EOC-WARN-01'),
         ('Authenticate: issuing agency, product number and title, issue time, validity, coverage, update or cancellation', True, False, 5, None),
         ('Classify: official warning, verified observation, partner report or unverified report; label uncertainty', True, True, 10, None),
         ('Assess local relevance: places, exposed people and assets, dependencies, the relevant contingency plan', True, True, 15, None),
         ('Escalate to the CDRRMO Head or duty supervisor under the escalation matrix; for life-safety, use urgent channels first', True, True, 20, None),
         ('Record superseding or cancelled products and tell recipients of material changes', False, True, None, None)]),
    _pr('PR-ICS-INTERFACE', '4-05', 'Initial incident coordination and EOC–ICS interface', 'eoc', 'eoc_manager',
        'Build a shared operational picture and support the Incident Commander without duplicating field command.',
        'On notification of an incident that needs EOC coordination.',
        'EOC Manager; the Incident Commander / IMT keeps field command',
        ['NDRRMC Memo 131 s. 2018', 'NDRRMC MC No. 4 s. 2012 (ICS)'], ['A8.1', 'B6.1', 'B1.4', 'B1.5'],
        [('Confirm the incident, location, Incident Commander / IMT, command post and contact method', True, False, 0, 'EOC-F03'),
         ('Collect time-stamped reports with source and validation status; map the affected area; list gaps', True, True, 15, None),
         ('Receive the incident objectives and operational period; set EOC support objectives and decisions needed', True, True, 30, 'EOC-F03'),
         ('Seat only the EOC sections and cluster or liaison desks the incident needs; confirm leads', True, False, 30, None),
         ('Route resource and service requests to their owners; track decision and fulfilment', True, True, None, 'ER-F02'),
         ('Brief the Mayor / CDRRMC and the Incident Commander as the arrangement requires', True, True, None, 'EOC-F04'),
         ('Hand over status, requests, decisions, risks and tasks to the next period or shift', True, True, None, 'EOC-F04')]),
    _pr('PR-EVACUATION', '4-06', 'Evacuation coordination and monitoring', 'eoc', 'eoc_manager',
        'Coordinate an authorised evacuation and monitor it safely, accessibly and accountably. The MOO creates no power to order evacuation.',
        'When an official warning, PDRA or incident report indicates people may need to move.',
        'Decision: official or body named by law and City issuance; CDRRMO coordinates; CSWDO leads camp management (JMC No. 2 s. 2021)',
        ['RA 10121 Sec. 12(c)', 'RA 12076', 'RA 10821', 'DSWD-DILG-DOH-DepEd JMC No. 2 s. 2021 (CCCM)'], ['A6.2', 'A7.4', 'A7.6', 'A7.9'],
        [('Assess need: official warning, impact, lead time, exposure, vulnerable groups, routes and facility suitability', True, True, 0, None),
         ('Prepare options and route them to the competent authority; record scope, timing, sites and instruction', True, True, None, 'ER-F01'),
         ('Issue the approved message through approved channels and barangay relays, in accessible formats', True, False, None, 'EOC-WARN-02'),
         ('Coordinate transport, traffic, receiving sites, health, protection, WASH, security and camp management with lead offices', True, True, None, 'ER-F03'),
         ('Monitor aggregate barangay and centre status, access issues, unmet needs and safety incidents (counts only)', True, False, None, 'ER-F01'),
         ('Route continuation, change or return to the competent authority; record the safety check and support', True, True, None, None)]),
    _pr('PR-RESOURCE-REQUEST', '4-07', 'Resource request coordination and mutual-aid escalation', 'eoc', 'eoc_manager',
        'Move each operational request from receipt to fulfilment or referral, with financial and property controls.',
        'On receipt of a resource or service request during an activation.',
        'EOC Manager / Logistics; approval and expenditure stay with the competent offices (Chapter 5)',
        ['RA 10121 Sec. 21', 'RA 12009 and its IRR'], ['B6.2', 'A8.3', 'A7.5'],
        [('Log the request: requester, incident, item or service, quantity, location, purpose, priority, time needed', True, False, 0, 'EOC-F06'),
         ('Check completeness: purpose, specification, delivery point and requesting authority', True, True, 10, None),
         ('Check availability with the asset owner or Logistics: stock, condition, location, commitments', True, False, 20, None),
         ('Refer expenditure, procurement, transfer or release to the authorised office under Chapter 5', True, True, None, None),
         ('Record dispatch, carrier, expected arrival, receipt, partial fulfilment and custody', True, False, None, None),
         ('Request mutual aid or higher-level support through the approved route when local resources fall short', False, True, None, None),
         ('Close and reconcile: use, return, demobilisation, balance, damage and replenishment', True, True, None, 'EOC-F06')]),
    _pr('PR-EOC-DEACTIVATE', '4-09', 'EOC deactivation, transition and after-action review', 'eoc', 'eoc_manager',
        'Close the activation in a controlled way and hand unresolved work to permanent, recovery and continuity arrangements.',
        'When the incident has stabilised and the Incident Commander recommends termination.',
        'Deactivation: official designated in the EOC EO; EOC Manager coordinates handover and closeout',
        ['NDRRMC Memo 131 s. 2018', 'NDRRMC-OCD Contingency Planning Guidebook (2020)', 'NEDA Disaster Rehabilitation and Recovery Planning Guide'],
        ['B1.3', 'B7.4', 'A10.6'],
        [('Review stabilisation: threat, activities, outstanding needs, service status, commitments and reporting duties', True, True, 0, None),
         ('Prepare the recommendation and obtain the authorised deactivation decision', True, True, None, 'EOC-ACT-01'),
         ('Notify EOC staff, clusters, barangays, partners and reporting recipients', True, False, None, None),
         ('Transfer outstanding tasks, requests, monitoring, public information, continuity and recovery tasks to named offices', True, True, None, 'ER-F05'),
         ('Close the records: logbook index, SitReps, decisions, resources, maps and evidence', True, False, None, None),
         ('Hold the hotwash or AAR; identify system causes; agree corrective actions', True, True, None, 'ER-F06'),
         ('Send revisions of plans, contacts, training and procedures through document control', False, True, None, None)]),
]
for p_ in CH4_PROTOCOLS:
    META[p_['code']] = p_.pop('meta')
