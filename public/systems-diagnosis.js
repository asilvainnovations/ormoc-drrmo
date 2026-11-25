/* =====================================================================
       1. DATA MODELS (100% grounded in Ormoc City Manual of Operations & IAT)
       ===================================================================== */

    const ARCHETYPES = {
      shifting: {
        id: `shifting`,
        code: `ARCHETYPE A`,
        title: `Shifting the Burden`,
        summary: `Rising operational disruptions trigger ad-hoc Executive Orders and reliance on temporary staffing (HRMO validation required) (Loop B1). While this relieves immediate crisis pressure, it erodes urgency for passing a JMC 2014-1 department ordinance and written SOPs (Loop B2) and drives Side-Effect Loop R1: institutional compliance decay (32.9% baseline).`,
        loops: [
          { id: `all`, label: `All Loops` },
          { id: `B1`, label: `B1 · Symptomatic Fix`, type: `B`, cx: 245, cy: 165, title: `Balancing Loop B1 (Symptomatic Relief)` },
          { id: `B2`, label: `B2 · Fundamental Reform`, type: `B`, cx: 525, cy: 165, title: `Balancing Loop B2 (Structural Ordinance)` },
          { id: `R1`, label: `R1 · Compliance Decay`, type: `R`, cx: 385, cy: 365, title: `Reinforcing Loop R1 (Addiction & Decay)` }
        ],
        nodes: [
          {
            id: `workload`, x: 385, y: 78, w: 196, h: 58,
            label: `Operational Workload\n& Crisis Disruptions`,
            role: `symptom`, roleLabel: `Trigger / Symptom`,
            desc: `Recurring typhoons, flood warnings, and daily OpCen monitoring demands place continuous strain on CDRRMO and partner offices.`,
            evidence: `October 2026 site observations recorded 24/7 duty monitoring alongside recurring hazard events across 85 barangays.`,
            chips: [`IAT A2`, `Ch. 4 Sec. 1.1`, `MR-04`]
          },
          {
            id: `adhoc`, x: 135, y: 175, w: 204, h: 62,
            label: `Ad-Hoc Fixes: Event EOs\n& 43 Casual/JO Staff`,
            role: `symptom`, roleLabel: `Symptomatic Fix`,
            desc: `Instead of codified procedures, emergencies are handled through event-specific Executive Orders, informal workarounds, and temporary job-order duty assignments.`,
            evidence: `Reported workforce of ~47 personnel includes only 4 permanent plantilla employees (temporary staffing). Pre-emptive evacuations and suspensions previously relied on ad-hoc issuances.`,
            chips: [`IAT A2.3 (Score 2)`, `HRMO validation pending Plantilla`, `MR-02`]
          },
          {
            id: `relief`, x: 135, y: 315, w: 196, h: 56,
            label: `Immediate Crisis\nStabilization`,
            role: `neutral`, roleLabel: `Short-Term Effect`,
            desc: `Events are managed in the moment, creating the appearance that informal coordination is sufficient ("we responded").`,
            evidence: `Routine and crisis monitoring absorb immediate disruption, temporarily relieving executive urgency for institutional reform.`,
            chips: [`Ch. 1 Sec. 5.4`, `Intro Sec. 1.2`]
          },
          {
            id: `urgency`, x: 525, y: 185, w: 196, h: 58,
            label: `Urgency for Permanent\nStructural Reform`,
            role: `neutral`, roleLabel: `Eroding Driver`,
            desc: `Political and administrative pressure to enact permanent institutional charters, plantilla staffing, and standardized SOPs.`,
            evidence: `Immediate crisis relief suppresses reform momentum, delaying enabling legislation.`,
            chips: [`Annex 1-A`, `Annex 1-C`, `Ch. 2 Sec. 8.4`]
          },
          {
            id: `ordinance`, x: 625, y: 315, w: 206, h: 62,
            label: `Dept Ordinance (JMC 2014-1)\n& Written Manual SOPs`,
            role: `lever`, roleLabel: `Fundamental Lever`,
            desc: `Enacting the permanent CDRRMO Institutionalization Ordinance (3 divisions), formal EOC EO, and validated MODE workflows.`,
            evidence: `Annex 1-A (Sangguniang Panlungsod) and Annex 1-C (City Mayor EO) formalize permanent divisions and authority gates.`,
            chips: [`IAT A1.1 (Score 2)`, `IAT B1.1 (Score 2)`, `MR-01`, `MR-02`]
          },
          {
            id: `decay`, x: 385, y: 418, w: 214, h: 60,
            label: `Compliance Decay &\nSystemic Vulnerability`,
            role: `compliance`, roleLabel: `Side Effect / Risk`,
            desc: `Over-reliance on temporary staff and unwritten procedures erodes institutional memory, leaving mandatory compliance at 32.9%.`,
            evidence: `IAT v1.7 records 32.9% Mandatory Compliance and 29 high-priority gaps across Parts A and B (18 Part A; 11 Part B).`,
            chips: [`32.9% Mandatory`, `1.98 / 4.00 IMI`, `29 High Gaps`]
          }
        ],
        edges: [
          { from: `workload`, to: `adhoc`, pol: `+`, delay: false, loops: [`B1`, `R1`], curve: -25, note: `Rising crisis pressure triggers rapid ad-hoc EOs and casual staff augmentation.` },
          { from: `adhoc`, to: `relief`, pol: `+`, delay: false, loops: [`B1`, `R1`], curve: -18, note: `Temporary fixes stabilize the immediate emergency event.` },
          { from: `relief`, to: `workload`, pol: `-`, delay: false, loops: [`B1`], curve: 75, note: `Immediate crisis resolution temporarily reduces perceived operational pressure.` },
          { from: `workload`, to: `urgency`, pol: `+`, delay: false, loops: [`B2`], curve: 25, note: `Unresolved operational strain builds pressure for permanent institutional reform.` },
          { from: `relief`, to: `urgency`, pol: `-`, delay: false, loops: [`R1`], curve: 18, note: `When ad-hoc fixes calm the immediate crisis, urgency to pass ordinances drops.` },
          { from: `urgency`, to: `ordinance`, pol: `+`, delay: true, loops: [`B2`, `R1`], curve: 20, note: `Legislative & HRMO plantilla approval requires sustained commitment across budget cycles (Delay).` },
          { from: `ordinance`, to: `workload`, pol: `-`, delay: false, loops: [`B2`], curve: 70, note: `Permanent divisions and clear SOPs systematically absorb recurring disruptions.` },
          { from: `adhoc`, to: `decay`, pol: `+`, delay: true, loops: [`R1`], curve: 20, note: `Continued casual staffing and unwritten workarounds erode compliance and continuity over time (Delay).` },
          { from: `decay`, to: `workload`, pol: `+`, delay: false, loops: [`R1`], curve: -65, note: `Higher institutional vulnerability amplifies future operational workload during the next disaster.` }
        ]
      },

      growth: {
        id: `growth`,
        code: `ARCHETYPE B`,
        title: `Growth & Underinvestment`,
        summary: `Ormoc City's DRRM responsibilities have expanded rapidly—covering RA 12287 anticipatory action, 85 barangay DRRM plans, and Geo-COP risk intelligence (Loop R1). Yet lagging investment in permanent technical staff (GIS, M&E) and alternate EOC continuity (Loop B3) hits a capacity ceiling (Loop B2), capping institutional maturity at 1.98 / 4.00.`,
        loops: [
          { id: `all`, label: `All Loops` },
          { id: `R1`, label: `R1 · Expanding Mandate`, type: `R`, cx: 240, cy: 155, title: `Reinforcing Loop R1 (Expanding Mandate Demand)` },
          { id: `B2`, label: `B2 · Capacity Ceiling`, type: `B`, cx: 240, cy: 335, title: `Balancing Loop B2 (Staffing & EOC Bottleneck)` },
          { id: `B3`, label: `B3 · Capacity Investment`, type: `B`, cx: 540, cy: 255, title: `Balancing Loop B3 (Delayed Plantilla & EOC Investment)` }
        ],
        nodes: [
          {
            id: `mandate`, x: 140, y: 80, w: 208, h: 58,
            label: `Expanding Statutory &\nRA 12287 Mandates`,
            role: `symptom`, roleLabel: `Growth Driver`,
            desc: `New statutory duties under RA 12287 (3–5 day anticipatory action), 85-barangay plan QA, and digital Geo-COP reporting expand service scope.`,
            evidence: `RA 12287 IRR (14 Sep 2026) adds PDRA, graduated 30%/70% AA tranches, and 45-day lifting reports.`,
            chips: [`RA 12287 IRR`, `85 Barangays`, `MR-16`]
          },
          {
            id: `effort`, x: 380, y: 80, w: 196, h: 58,
            label: `Coordination &\nOperational Effort`,
            role: `neutral`, roleLabel: `Activity Volume`,
            desc: `CDRRMO and EOC personnel stretch across planning, warning, PDRA, cluster coordination, and post-disaster reporting.`,
            evidence: `DILG VIII cut-offs (6 AM/PM White; 9 AM/7 PM Blue/Red) and 140 IAT indicators require continuous documentation.`,
            chips: [`DILG VIII`, `Ch. 4 Sec. 11.2`, `MR-07`]
          },
          {
            id: `perf`, x: 260, y: 245, w: 204, h: 58,
            label: `Institutional Performance\n& Readiness (1.98 IMI)`,
            role: `compliance`, roleLabel: `System Output`,
            desc: `Combined Institutional Maturity Index stands at 1.98 / 4.00 (Developing), while Part C cross-office interface lags at 1.41 / 4.00.`,
            evidence: `IAT v1.7 (11 Nov 2026) Dashboard after applying evidence-gated scoring across 15 indicators.`,
            chips: [`1.98 / 4.00 IMI`, `1.41 Interface`, `MR-13`]
          },
          {
            id: `strain`, x: 135, y: 400, w: 206, h: 60,
            label: `Technical & Alternate\nEOC Capacity Strain`,
            role: `symptom`, roleLabel: `Capacity Limit`,
            desc: `Shortage of permanent technical specialists (GIS, M&E, Research) and unrecorded alternate EOC / PSCP validation limit surge scaling.`,
            evidence: `MODE flags alternate EOC as not yet recorded; PSCP (SOP 3-07) and City-owned hosting require annual restore testing.`,
            chips: [`MR-10`, `SOP 3-07`, `IAT B2.7`]
          },
          {
            id: `need`, x: 615, y: 175, w: 204, h: 58,
            label: `Perceived Need to\nInvest in Capacity`,
            role: `neutral`, roleLabel: `Investment Signal`,
            desc: `Leadership recognition that permanent technical posts, paid City hosting, and EOC facilities require capital and plantilla budget.`,
            evidence: `When performance dips are masked by delays or lowered expectations, perceived need to invest weakens.`,
            chips: [`Ch. 2 Sec. 8.2`, `Ch. 10 Sec. 2`]
          },
          {
            id: `invest`, x: 615, y: 375, w: 210, h: 62,
            label: `Plantilla, Hosting &\nAlternate EOC Investment`,
            role: `lever`, roleLabel: `Fundamental Lever`,
            desc: `Multi-year budget allocation for permanent technical plantilla roles, verified alternate EOC facility, and City-owned MODE backups.`,
            evidence: `SOP HR-01 annual workforce review + SOP 3-07 PSCP + MR-10 quarterly restore tests.`,
            chips: [`SOP HR-01`, `SOP 10-01`, `MR-10`]
          }
        ],
        edges: [
          { from: `mandate`, to: `effort`, pol: `+`, delay: false, loops: [`R1`], curve: -18, note: `Expanded statutory scope increases coordination and reporting effort.` },
          { from: `effort`, to: `perf`, pol: `+`, delay: false, loops: [`R1`], curve: 18, note: `Greater operational effort drives visible field outputs and readiness gains.` },
          { from: `perf`, to: `mandate`, pol: `+`, delay: false, loops: [`R1`], curve: -22, note: `Demonstrated response capability attracts even higher expectations and new programs.` },
          { from: `effort`, to: `strain`, pol: `+`, delay: false, loops: [`B2`], curve: -80, note: `High workload rapidly saturates limited technical staff and single-EOC infrastructure.` },
          { from: `strain`, to: `perf`, pol: `-`, delay: false, loops: [`B2`, `B3`], curve: -20, note: `Bottlenecks in GIS, M&E, and alternate EOC readiness suppress overall maturity.` },
          { from: `perf`, to: `need`, pol: `-`, delay: false, loops: [`B3`], curve: -22, note: `Lower readiness scores signal a widening gap and increase perceived need to invest.` },
          { from: `need`, to: `invest`, pol: `+`, delay: true, loops: [`B3`], curve: 25, note: `Budget, HRMO, and DBM/CSC plantilla approvals create multi-quarter implementation delays (Delay).` },
          { from: `invest`, to: `strain`, pol: `-`, delay: false, loops: [`B3`], curve: 25, note: `Permanent technical staff and redundant EOC assets relieve systemic capacity constraints.` }
        ]
      },

      drifting: {
        id: `drifting`,
        code: `ARCHETYPE C`,
        title: `Drifting Goals ("We Responded" vs. Statutory Standard)`,
        summary: `Chapter 7 (Sec. 1 & 5.4) identifies Drifting Goals directly: at 32.9% mandatory compliance, informal norms settle at "we responded" rather than "we met the standard." Pressure from an unclosed compliance gap can either lower informal expectations (Loop B1) or drive corrective actions via the CAPA Register ME-F05 (Loop B2).`,
        loops: [
          { id: `all`, label: `All Loops` },
          { id: `B1`, label: `B1 · Eroding Standard`, type: `B`, cx: 245, cy: 255, title: `Balancing Loop B1 (Lowering the Working Standard)` },
          { id: `B2`, label: `B2 · PDCA & CAPA Fix`, type: `B`, cx: 525, cy: 255, title: `Balancing Loop B2 (Closing Gap via CAPA Register)` }
        ],
        nodes: [
          {
            id: `standard`, x: 165, y: 95, w: 210, h: 60,
            label: `Working Performance\nStandard ("We Responded")`,
            role: `symptom`, roleLabel: `Drifting Goal`,
            desc: `Informal operational benchmark that treats emergency activity or attendance as success instead of verified statutory compliance.`,
            evidence: `Ch. 7 Sec. 1 warns that with 32.9% Mandatory compliance, procedures without fixed measurement drift downward.`,
            chips: [`Ch. 7 Sec. 1`, `Ch. 7 Sec. 5.4`]
          },
          {
            id: `gap`, x: 385, y: 240, w: 204, h: 62,
            label: `Compliance & Evidence\nGap (32.9% Baseline)`,
            role: `compliance`, roleLabel: `Measured Gap`,
            desc: `The measurable shortfall between the 140-indicator IAT evidence rubric (target ≥ 3) and current verified office documentation.`,
            evidence: `FGD-only claims are capped at Score 2 until Vault documents prove operationalization (Table FM.4; MR-12).`,
            chips: [`MR-12 Evidence Gate`, `32.9% Mandatory`, `125 Parts A and B indicators; 15 Part C indicators reported separately`]
          },
          {
            id: `pressure`, x: 165, y: 390, w: 206, h: 58,
            label: `Pressure to Lower\nExpectations`,
            role: `symptom`, roleLabel: `Goal Erosion`,
            desc: `Friction from staffing shortages or missing forms creates pressure to accept informal compliance rather than enforce strict rubrics.`,
            evidence: `Ch. 7 establishes the rule "Against drifting goals": standards are set by the IAT rubric and law, never last year's practice.`,
            chips: [`Ch. 7 Anti-Drift Rule`, `IAT Rubric`]
          },
          {
            id: `capa`, x: 605, y: 390, w: 212, h: 62,
            label: `Corrective Action: PDCA\n& CAPA Register (ME-F05)`,
            role: `lever`, roleLabel: `Fundamental Lever`,
            desc: `SOP 7-04 After-Action Reviews and annual IAT reassessments convert every gap into an assigned corrective action with owner, due date, and proof of effect.`,
            evidence: `Recurring AAR findings across two events trigger mandatory escalation to the CDRRMC for staffing, issuance, or budget action.`,
            chips: [`SOP 7-04`, `Form ME-F05`, `MR-11`]
          },
          {
            id: `actual`, x: 605, y: 95, w: 206, h: 60,
            label: `Verified Operational\nCompliance & Readiness`,
            role: `lever`, roleLabel: `Target Outcome`,
            desc: `Demonstrable, document-verified compliance across mandatory indicators, drills, and after-action closures.`,
            evidence: `MODE keeps one operational entry feeding SitReps, DILG reports, and Gawad KALASAG evidence (Table FM.4 Efficiency).`,
            chips: [`MR-14 Traceability`, `Ch. 10 Recognition`]
          }
        ],
        edges: [
          { from: `standard`, to: `gap`, pol: `+`, delay: false, loops: [`B1`], curve: -20, note: `A higher statutory standard reveals a larger compliance gap until closed.` },
          { from: `gap`, to: `pressure`, pol: `+`, delay: false, loops: [`B1`], curve: -20, note: `Persistent gaps generate administrative pressure to relax internal expectations.` },
          { from: `pressure`, to: `standard`, pol: `-`, delay: false, loops: [`B1`], curve: -38, note: `Lowering the working benchmark reduces perceived gap without fixing root causes.` },
          { from: `gap`, to: `capa`, pol: `+`, delay: false, loops: [`B2`], curve: 20, note: `Mandatory IAT & AAR triggers log unclosed gaps into CAPA Register ME-F05.` },
          { from: `capa`, to: `actual`, pol: `+`, delay: true, loops: [`B2`], curve: 38, note: `Corrective actions take a drill, season, or IAT cycle to show measurable effect (Delay).` },
          { from: `actual`, to: `gap`, pol: `-`, delay: false, loops: [`B2`], curve: 20, note: `Verified operational improvements genuinely close the statutory compliance gap.` }
        ]
      },

      conflation: {
        id: `conflation`,
        code: `ARCHETYPE D`,
        title: `Fixes That Fail: ICS–EOC Mandate Conflation`,
        summary: `Captured in IAT B6.1 (Score 1, High Priority). As incident complexity climbs, demand for EOC coordination increases. Without a codified ICS–EOC boundary, the EOC risks usurping field tactical command (Loop R2: Escalation), creating chain-of-command confusion and resource misalignment. SOP 4-05 restores Balancing Loop B2.`,
        loops: [
          { id: `all`, label: `All Loops` },
          { id: `R2`, label: `R2 · Mandate Conflation`, type: `R`, cx: 380, cy: 195, title: `Reinforcing Loop R2 (Command Confusion Escalation)` },
          { id: `B2`, label: `B2 · SOP 4-05 Boundary`, type: `B`, cx: 380, cy: 360, title: `Balancing Loop B2 (Codified Coordination Support)` }
        ],
        nodes: [
          {
            id: `complexity`, x: 135, y: 120, w: 200, h: 58,
            label: `Emergency Incident\nComplexity & Scale`,
            role: `symptom`, roleLabel: `Escalating Driver`,
            desc: `Multi-barangay flooding, landslides, or simultaneous lifeline disruptions requiring multi-agency Incident Management Teams.`,
            evidence: `Cluster-based EOC activation switches on scenario modules without altering field command authority (Ch. 1 Fig. 1.3).`,
            chips: [`Ch. 4 Sec. 9.1`, `NDRRMC MC 4 s.2012`]
          },
          {
            id: `demand`, x: 385, y: 80, w: 196, h: 56,
            label: `Demand for EOC\nCoordination`,
            role: `neutral`, roleLabel: `Coordination Load`,
            desc: `Surge in requests for situation consolidation, cluster liaison, SitReps, and resource mobilization.`,
            evidence: `Triggered under SOP 4-04 (Blue/Red activation) and DILG VIII harmonized reporting.`,
            chips: [`SOP 4-04`, `EOC-ACT-01`, `MR-05`]
          },
          {
            id: `usurp`, x: 630, y: 120, w: 204, h: 60,
            label: `EOC Usurping Field\nIncident Command`,
            role: `symptom`, roleLabel: `Boundary Failure`,
            desc: `EOC personnel issue direct tactical orders to field teams rather than routing support through the Incident Commander.`,
            evidence: `Identified as a high-priority institutional gap: IAT B6.1 scored 1 (High Priority) due to undefined ICS–EOC interface.`,
            chips: [`IAT B6.1 (Score 1)`, `High Priority Gap`]
          },
          {
            id: `confusion`, x: 630, y: 270, w: 204, h: 58,
            label: `Confusion in Field\nChain of Command`,
            role: `symptom`, roleLabel: `Friction Node`,
            desc: `Conflicting directives between the on-scene Incident Commander (ICP) and off-site EOC desks stall tactical execution.`,
            evidence: `Ch. 4 Table 4.11 explicitly prohibits the EOC Manager from issuing tactical field orders unless separately appointed in ICS.`,
            chips: [`Ch. 4 Table 4.11`, `CP Form 11`]
          },
          {
            id: `misalign`, x: 135, y: 270, w: 206, h: 60,
            label: `Delayed Resource Execution\n& Dispatch Misalignment`,
            role: `compliance`, roleLabel: `Operational Impact`,
            desc: `Duplicated requests, unverified SitRep numbers, and misaligned logistics dispatches worsen field conditions.`,
            evidence: `Requires MODE Resource Request flow (requested → approved → mobilised → delivered → demobilised).`,
            chips: [`MR-08`, `ER-F02`, `SOP 4-07`]
          },
          {
            id: `sop405`, x: 385, y: 405, w: 224, h: 64,
            label: `Codified ICS–EOC Boundary\n(SOP 4-05 PR-ICS-INTERFACE)`,
            role: `lever`, roleLabel: `Fundamental Lever`,
            desc: `7-step protocol binding Incident Commander field command above the line and EOC resource/decision support below the line.`,
            evidence: `SOP 4-05 (Forms EOC-F03, EOC-F04, ER-F02) aligns IC objectives with EOC sections while elevating Mayor/CDRRMC policy decisions.`,
            chips: [`SOP 4-05`, `PR-ICS-INTERFACE`, `IAT A8.1`, `MR-05`]
          }
        ],
        edges: [
          { from: `complexity`, to: `demand`, pol: `+`, delay: false, loops: [`R2`, `B2`], curve: -18, note: `Complex incidents increase need for inter-agency EOC coordination.` },
          { from: `demand`, to: `usurp`, pol: `+`, delay: false, loops: [`R2`], curve: -18, note: `Without clear legal boundaries, higher coordination demand tempts EOC overreach into field tactics.` },
          { from: `usurp`, to: `confusion`, pol: `+`, delay: false, loops: [`R2`], curve: 18, note: `Dual command sources split authority at the Incident Command Post.` },
          { from: `confusion`, to: `misalign`, pol: `+`, delay: false, loops: [`R2`], curve: 25, note: `Unclear command lines delay fulfillment and misroute logistics assets.` },
          { from: `misalign`, to: `complexity`, pol: `+`, delay: false, loops: [`R2`], curve: -22, note: `Unmet field needs compound the emergency, escalating incident complexity.` },
          { from: `demand`, to: `sop405`, pol: `+`, delay: false, loops: [`B2`], curve: 18, note: `Notification of an incident triggers SOP 4-05 Step 1 (Confirm IC & ICP).` },
          { from: `sop405`, to: `usurp`, pol: `-`, delay: false, loops: [`B2`], curve: 48, note: `SOP 4-05 Step 3 codifies that the EOC supports and never commands field teams.` },
          { from: `sop405`, to: `misalign`, pol: `-`, delay: false, loops: [`B2`], curve: -48, note: `Tracked request routing (Step 5) and shift handovers (Step 7) eliminate dispatch delays.` }
        ]
      }
    };

    const LEVERAGE_POINTS = [
      {
        level: 1,
        power: 100,
        tier: `Level 1 · Highest Leverage`,
        name: `Mindsets & Paradigms`,
        headline: `Shift from Reactive Emergency Response to Risk-Informed Governance`,
        archetypes: [`drifting`, `shifting`, `growth`, `conflation`],
        targetGap: `Informal "we responded" culture tolerating 32.9% mandatory compliance and event-driven problem-solving.`,
        transformation: `Institutionalize Total Quality Management (TQM) and Plan–Do–Check–Act (PDCA) cycles across all 10 Manual of Operations chapters, enforced by evidence-gated scoring where FGD claims are capped at Score 2 until verified documents prove execution.`,
        meadowsRationale: `Changing the underlying paradigm—what the system considers "success"—reorients every division, budget review, and council resolution automatically without policing individual habits.`,
        sops: [
          { chapter: `Intro & Ch. 1–10`, code: `Table FM.4 / PDCA`, protocol: `All 10 Chapters`, forms: `Master Procedure Register (Annex A)`, authority: `CDRRMC / CDRRMO Head`, iat: `All 125 Parts A and B indicators; 15 Part C indicators reported separately`, mr: `MR-01, MR-12, MR-13` },
          { chapter: `Ch. 10 Sustainability`, code: `SOP 10-01`, protocol: `Annual Sustainability & Roadmap Review`, forms: `Annual Review Record`, authority: `CDRRMO Research & Planning`, iat: `A10, B7.6`, mr: `MR-11, MR-15` }
        ],
        milestones: [
          { id: `l1-m1`, text: `Adopt TQM & PDCA operating charter across all 10 Manual of Operations chapters` },
          { id: `l1-m2`, text: `Enforce SQL evidence gate capping undocumented FGD self-scores at Score 2 (MR-12)` },
          { id: `l1-m3`, text: `Publish annual Institutional Maturity Index & Compliance baseline report to CDRRMC` }
        ]
      },
      {
        level: 2,
        power: 84,
        tier: `Level 2 · High Leverage`,
        name: `System Rules & Legal Structures`,
        headline: `Enact Permanent CDRRMO Department Ordinance & Formal EOC Executive Order`,
        archetypes: [`shifting`, `growth`],
        targetGap: `CDRRMO operates under an EO with temporary staffing (HRMO validation required) out of 47 (IAT A2.3); no EOC-establishing EO exists (IAT B1.1, Score 2).`,
        transformation: `Pass the proposed CDRRMO Institutionalization Ordinance (Annex 1-A) creating the three JMC 2014-1 permanent divisions (Administration & Training, Research & Planning, Operations & Warning) and issue the City EOC Establishment EO (Annex 1-C) under NDRRMC Memo No. 131, s. 2018.`,
        meadowsRationale: `System rules define who holds lawful authority and permanent tenure. Replacing temporary event EOs with statutory structures breaks the Shifting the Burden addiction permanently.`,
        sops: [
          { chapter: `Ch. 1 Governance`, code: `Annex 1-A & 1-C`, protocol: `CDRRMO Ordinance & EOC Establishment EO`, forms: `GOV-F01 to GOV-F16`, authority: `Sangguniang Panlungsod / City Mayor`, iat: `A1.1 (Score 2), B1.1 (Score 2)`, mr: `MR-02, MR-05` },
          { chapter: `Ch. 2 Org & HR`, code: `ORG-SOP-01 / HR-01`, protocol: `Annual Workforce & Plantilla Review`, forms: `ORG-F01, ORG-F02, ORG-F08`, authority: `CDRRMO Head + HRMO + Budget`, iat: `A2.1–A2.3, B4`, mr: `MR-02, MR-09` },
          { chapter: `Ch. 4 Response`, code: `SOP 4-04`, protocol: `MODE EOC-ACT-01 (White/Blue/Red)`, forms: `EOC-F01, EOC-F02, EOC-F04`, authority: `Designated Official (Online Only)`, iat: `B1.2, B1.3`, mr: `MR-05` }
        ],
        milestones: [
          { id: `l2-m1`, text: `Submit Annex 1-A CDRRMO Institutionalization Ordinance (JMC 2014-1 divisions) to Sangguniang Panlungsod` },
          { id: `l2-m2`, text: `Issue Annex 1-C City EOC Establishment Executive Order under NDRRMC Memo 131, s. 2018` },
          { id: `l2-m3`, text: `Reconcile staffing status pending HRMO validation plantilla baseline with HRMO via ORG-SOP-01 and designate EOC alternates (ORG-F08)` }
        ]
      },
      {
        level: 3,
        power: 68,
        tier: `Level 3 · High-Medium Leverage`,
        name: `Boundary & Structural Clarification`,
        headline: `Codify the ICS–EOC Operational Interface & Institutional Separation`,
        archetypes: [`conflation`, `shifting`],
        targetGap: `Undefined ICS–EOC interface (IAT B6.1 = Score 1, High Priority) causes mandate conflation between EOC desks and on-scene Incident Commanders.`,
        transformation: `Codify SOP 4-05 (PR-ICS-INTERFACE) and Table 4.11: the Incident Commander / IMT retains exclusive tactical field command above the line, while the EOC operates below the line as a support, information, resource-tracking, and executive escalation hub.`,
        meadowsRationale: `Clarifying system boundaries eliminates self-reinforcing interference loops (Loop R2) where well-intentioned coordination turns into conflicting field directives.`,
        sops: [
          { chapter: `Ch. 4 Response`, code: `SOP 4-05`, protocol: `PR-ICS-INTERFACE (7-Step Protocol)`, forms: `EOC-F03, EOC-F04, ER-F02`, authority: `IC (Field) / EOC Manager (Hub)`, iat: `B6.1 (Score 1), A8.1, B1.4, B1.5`, mr: `MR-05, MR-08` },
          { chapter: `Ch. 1 Governance`, code: `Table 1.10 / Annex 1-B`, protocol: `CDRRMO–EOC–ICS Separation & CDRRMC EO`, forms: `Command & Liaison Register`, authority: `City Mayor / CDRRMC`, iat: `A1, B1.1`, mr: `MR-02, MR-05` }
        ],
        milestones: [
          { id: `l3-m1`, text: `Adopt SOP 4-05 (PR-ICS-INTERFACE) separating IC tactical command from EOC decision support` },
          { id: `l3-m2`, text: `Run joint ICS–EOC tabletop exercise recording step times & handover forms (EOC-F04)` },
          { id: `l3-m3`, text: `Validate ICS Executive Order & EOC–ICS interoperability with OCD Region VIII` }
        ]
      },
      {
        level: 4,
        power: 52,
        tier: `Level 4 · Medium-High Leverage`,
        name: `Information Flows & Timings`,
        headline: `Operationalize RA 12287 Anticipatory Action & Continuity Redundancy`,
        archetypes: [`growth`, `shifting`],
        targetGap: `Delayed resource mobilization waiting for post-impact State of Calamity QRF; unrecorded alternate EOC and untested backup restore.`,
        transformation: `Operationalize RA 12287 & 2026 IRR via SOP GOV-05 and SOP 6-05: shift fund release and pre-positioned relief into a 3-to-5-day pre-impact window (up to 10% of 70% LDRRMF; 30% tranche >3 days prior, 70% within 3 days) paired with SOP 3-07 PSCP & quarterly backup restore tests.`,
        meadowsRationale: `Adding timely, accurate information flows—moving triggers earlier before hazard impact—transforms system responsiveness before physical disruption overwhelms capacity.`,
        sops: [
          { chapter: `Ch. 1 & Ch. 6`, code: `SOP GOV-05 / SOP 6-05`, protocol: `PR-LIFT-REPORT & AA Fund Release`, forms: `FIN-F06, FIN-F08 (Framework)`, authority: `City Mayor on CDRRMC PDRA Rec.`, iat: `A4, A6, B1`, mr: `MR-16, MR-08` },
          { chapter: `Ch. 3 Planning`, code: `SOP 3-07`, protocol: `WF-SOP3-07 Public Service Continuity Plan`, forms: `Form 3-07 (BIA), Form 3-11`, authority: `Designated Continuity Executive`, iat: `A3.4, B2.7`, mr: `MR-03, MR-10` },
          { chapter: `Ch. 4 Warning`, code: `SOP 4-02`, protocol: `EOC-WARN-02 Warning-to-Action & Receipt`, forms: `EWR-F02, EWR-F03, ER-F04`, authority: `Approving Official / Focal`, iat: `A6.4`, mr: `MR-06` }
        ],
        milestones: [
          { id: `l4-m1`, text: `Configure MODE RA 12287 declaration guard & 30%/70% tranche limits (SOP 6-05 / FIN-F06)` },
          { id: `l4-m2`, text: `Record primary & alternate EOC coordinates/KML and test PSCP relocation (SOP 3-07)` },
          { id: `l4-m3`, text: `Execute quarterly City-owned database & Vault restore drill (MR-10)` }
        ]
      },
      {
        level: 5,
        power: 38,
        tier: `Level 5 · Medium Leverage`,
        name: `Feedback Loops & Self-Correction`,
        headline: `Institutionalize Single-Accountability RACI & Append-Only CAPA Register`,
        archetypes: [`drifting`, `growth`, `conflation`],
        targetGap: `Weakest system node is Part C cross-office interface (1.41 / 4.00); lessons from exercises and incidents fail to close recurring gaps.`,
        transformation: `Enforce Annex 1-F Master RACI (one Accountable owner per interface across CPDO, Engineering, CHO, CENRO, CSWDO, Budget) and SOP 7-04 After-Action Review with an append-only CAPA Register (Form ME-F05) that escalates recurring findings across two events directly to the CDRRMC.`,
        meadowsRationale: `Tightening corrective feedback loops prevents Drifting Goals by linking real exercise/incident evidence directly to accountable action owners and closure proof.`,
        sops: [
          { chapter: `Ch. 7 M&E / Learning`, code: `SOP 7-04`, protocol: `PR-AAR After-Action Review & CAPA`, forms: `ER-F06, ME-F03, ME-F04, ME-F05`, authority: `CDRRMO Head / CDRRMC Escalation`, iat: `A10.6, B7.3, B7.4`, mr: `MR-11, MR-04` },
          { chapter: `Ch. 1 & Ch. 8`, code: `Annex 1-F / Part C`, protocol: `Master RACI & Lead-Office Interface`, forms: `PTN-F01, LOG-F03, Part C Entry`, authority: `Lead Offices (CPDO/CEO/CHO/CSWDO)`, iat: `C1–C5 (1.41/4.00 Index)`, mr: `MR-17, MR-14` }
        ],
        milestones: [
          { id: `l5-m1`, text: `Obtain written focal-person acceptance from Part C lead offices (CPDO, CEO, CHO, CENRO, CSWDO)` },
          { id: `l5-m2`, text: `Open append-only CAPA Register (ME-F05) with owner, due date, and delay window per gap` },
          { id: `l5-m3`, text: `Activate 2-event recurrence rule escalating unresolved AAR findings to CDRRMC decision` }
        ]
      }
    ];

    const BOT_MODELS = {
      shifting: {
        name: `Shifting the Burden (Event EOs vs. JMC 2014-1 Ordinance)`,
        labels: {
          symptom: `Operational Disruptions`,
          fix: `Ad-Hoc EOs & Casual Staff`,
          fundamental: `Ordinance & SOP Capacity`,
          compliance: `Mandatory Compliance (%)`
        },
        phaseNotes: [
          { maxM: 5, text: `M0–M5 (Baseline Trap): Heavy reliance on temporary staffing (HRMO validation required) and event-by-event EOs masks structural gaps while mandatory compliance sits at 32.9%. Under MODE, Ordinance Annex 1-A and EOC EO Annex 1-C are drafted for validation.` },
          { maxM: 14, text: `M6–M14 (Policy Delay Window): Enacting the Ordinance and EOC EO triggers HRMO/Budget plantilla reviews. Because permanent hiring takes time (Delay ||), ad-hoc reliance stays elevated initially—the classic policy transition lag where patience is vital.` },
          { maxM: 30, text: `M15–M30 (Structural Crossover): Permanent division leads (Admin & Training, Research & Planning, Operations & Warning) take hold. Codified SOPs cut crisis improvisations, lifting Mandatory Compliance past 68% while status-quo drift falls toward 27%.` },
          { maxM: 60, text: `M31–M60 (Institutional Equilibrium): Permanent plantilla and automated MODE protocols dominate. Ad-hoc event fixes drop below 15%, and Mandatory Compliance reaches 92%+—eliminating the Shifting the Burden cycle.` }
        ],
        // Arrays at sample keyframes [M0, M6, M12, M18, M24, M36, M48, M60] interpolated smoothly
        mode: {
          symptom:     [78, 75, 64, 48, 36, 24, 19, 16],
          fix:         [74, 70, 56, 38, 26, 16, 12, 10],
          fundamental: [24, 34, 50, 66, 76, 86, 91, 94],
          compliance:  [32.9, 41.0, 54.5, 67.0, 76.5, 86.0, 90.5, 93.2]
        },
        statusquo: {
          symptom:     [78, 81, 83, 86, 88, 91, 93, 95],
          fix:         [74, 77, 80, 82, 85, 88, 90, 92],
          fundamental: [24, 23, 22, 21, 20, 19, 18, 17],
          compliance:  [32.9, 31.8, 30.2, 28.9, 27.6, 25.8, 24.5, 23.4]
        }
      },
      growth: {
        name: `Growth & Underinvestment (RA 12287 Demand vs. Technical Capacity)`,
        labels: {
          symptom: `Unmet Mandate Strain`,
          fix: `Overtime / Surge Stretching`,
          fundamental: `Technical & Alt-EOC Capacity`,
          compliance: `Mandatory Compliance (%)`
        },
        phaseNotes: [
          { maxM: 5, text: `M0–M5 (Capacity Ceiling): Expanding RA 12287 anticipatory duties and 85-barangay plan reviews hit a wall of permanent staffing capacity (HRMO validation required) and unrecorded alternate EOC readiness (1.98 / 4.00 IMI).` },
          { maxM: 14, text: `M6–M14 (Investment Commitment): City-owned MODE hosting with quarterly backup restore drills (MR-10) and PSCP (SOP 3-07) business impact analyses begin relieving digital continuity risks.` },
          { maxM: 30, text: `M15–M30 (Anticipatory Action Scaling): RA 12287 SOP 6-05 (30%/70% pre-impact tranches) and dedicated GIS/M&E roles turn reactive overtime into structured 3–5 day pre-impact staging.` },
          { maxM: 60, text: `M31–M60 (Resilient Capacity): Alternate EOC, 85-barangay QA, and technical staff scale smoothly with hazard demand, lifting compliance above 91% and eliminating capacity-led collapse.` }
        ],
        mode: {
          symptom:     [72, 68, 55, 42, 32, 22, 18, 15],
          fix:         [68, 63, 49, 35, 25, 16, 12, 10],
          fundamental: [28, 38, 54, 68, 78, 87, 92, 95],
          compliance:  [32.9, 42.5, 56.0, 68.5, 77.0, 85.5, 89.8, 92.4]
        },
        statusquo: {
          symptom:     [72, 76, 81, 85, 89, 93, 96, 97],
          fix:         [68, 73, 78, 82, 85, 89, 91, 93],
          fundamental: [28, 27, 26, 25, 24, 22, 21, 20],
          compliance:  [32.9, 31.5, 29.8, 28.0, 26.5, 24.4, 22.8, 21.5]
        }
      },
      drifting: {
        name: `Drifting Goals ("We Responded" vs. 32.9% Statutory Standard)`,
        labels: {
          symptom: `Unclosed Audit Gaps`,
          fix: `Informal Standard Erosion`,
          fundamental: `CAPA & Evidence Gate`,
          compliance: `Mandatory Compliance (%)`
        },
        phaseNotes: [
          { maxM: 5, text: `M0–M5 (Evidence Gate Shock): IAT v1.7 caps undocumented FGD claims at Score 2 (MR-12), exposing the 32.9% Mandatory Compliance reality behind the informal "we responded" norm.` },
          { maxM: 14, text: `M6–M14 (CAPA Register Activation): Every unclosed indicator and AAR finding enters append-only Form ME-F05 with named owners, delay timelines, and Vault document requirements.` },
          { maxM: 30, text: `M15–M30 (PDCA Locking): The two-event recurrence escalation rule forces root-cause CDRRMC decisions on persistent gaps, halting informal goal drift.` },
          { maxM: 60, text: `M31–M60 (Audited Standard Culture): Annual IAT cycles compare verified Vault records year-over-year, supporting sustained evidence-verified compliance (illustrative only) anchored to statutory law rather than memory.` }
        ],
        mode: {
          symptom:     [76, 69, 54, 40, 29, 20, 15, 12],
          fix:         [70, 58, 42, 28, 19, 12, 9, 7],
          fundamental: [25, 40, 58, 72, 82, 89, 93, 96],
          compliance:  [32.9, 44.0, 59.0, 71.5, 80.5, 88.0, 92.0, 94.5]
        },
        statusquo: {
          symptom:     [76, 78, 81, 83, 86, 89, 91, 93],
          fix:         [70, 74, 78, 82, 85, 89, 92, 94],
          fundamental: [25, 24, 23, 22, 21, 19, 18, 17],
          compliance:  [32.9, 31.2, 29.4, 27.9, 26.2, 24.0, 22.1, 20.8]
        }
      },
      conflation: {
        name: `Fixes That Fail (ICS–EOC Mandate Conflation vs. SOP 4-05)`,
        labels: {
          symptom: `Command Friction & Delays`,
          fix: `Direct EOC Field Overrides`,
          fundamental: `SOP 4-05 Interface Maturity`,
          compliance: `Mandatory Compliance (%)`
        },
        phaseNotes: [
          { maxM: 5, text: `M0–M5 (B6.1 Score 1 Baseline): Undefined ICS–EOC boundary creates risk of EOC personnel bypassing Incident Commanders during escalating events, delaying resource execution.` },
          { maxM: 14, text: `M6–M14 (SOP 4-05 & Drills): PR-ICS-INTERFACE (7 steps) and Table 4.11 are adopted; drills record step times and shift handovers (EOC-F04) to validate field-vs-hub boundaries.` },
          { maxM: 30, text: `M15–M30 (Cluster & IMT Interoperability): All resource requests route through EOC Logistics tracking (MR-08), eliminating duplicate dispatches while IC retains tactical control.` },
          { maxM: 60, text: `M31–M60 (High-Reliability Coordination): Joint annual exercises with OCD Region VIII and neighboring LGUs (SOP 8-02) sustain rapid, conflict-free incident mobilization.` }
        ],
        mode: {
          symptom:     [82, 68, 48, 34, 24, 17, 13, 11],
          fix:         [75, 56, 36, 22, 15, 10, 8, 6],
          fundamental: [20, 42, 62, 76, 84, 90, 94, 96],
          compliance:  [32.9, 45.0, 61.0, 73.0, 81.5, 88.5, 92.2, 94.0]
        },
        statusquo: {
          symptom:     [82, 84, 86, 88, 90, 92, 94, 95],
          fix:         [75, 78, 81, 83, 86, 88, 90, 91],
          fundamental: [20, 19, 19, 18, 17, 16, 15, 15],
          compliance:  [32.9, 32.0, 30.8, 29.5, 28.4, 26.8, 25.4, 24.2]
        }
      }
    };

    const ICEBERG_LAYERS = {
      1: {
        badge: `Layer 1 · Surface Events`,
        badgeClass: `role-tag--symptom`,
        title: `Events: Visible Emergency Responses & Ad-Hoc Directives`,
        desc: `Above the waterline, stakeholders observe acute typhoon/flood deployments (such as Typhoons Odette and TD Agaton), event-by-event class and work suspensions, and ad-hoc EOC duty activations.`,
        drivers: [
          `Immediate 24/7 monitoring at the OpCen mixed with crisis mobilization.`,
          `Issuing reactive resolutions or directives per hazard event instead of invoking standing triggers.`,
          `Visible response activity creates a false sense of institutional readiness despite compliance gaps.`
        ],
        remedy: `Standing local ordinances (Ord. No. 003 s. 2013; No. 135 s. 2023 as amended by No. 189 s. 2025) and MODE Warning-to-Action protocols (SOP 4-02) replace event-by-event improvisation.`,
        chips: [`Ch. 4 Sec. 1.1`, `SOP 4-02`, `Ord. 189 s.2025`]
      },
      2: {
        badge: `Layer 2 · Patterns & Trends`,
        badgeClass: `role-tag--lever`,
        title: `Patterns: Recurring Temporary Fixes & Compliance Lag`,
        desc: `Tracing events over time exposes recurring patterns: heavy reliance on temporary fixes, persistent mandatory compliance lag (32.9% baseline), and mixing routine office duties with activated EOC operations.`,
        drivers: [
          `Repeatedly plugging operational surges with casual/job-order hires rather than permanent posts.`,
          `Gaps in documented evidence capping self-reported maturity scores at Score 2 under IAT v1.7.`,
          `Weakest system link at the Part C cross-office interface (1.41 / 4.00 Maturity Index).`
        ],
        remedy: `Annual IAT assessment cycles (Ch. 7), automated MODE logbooks/SitReps, and Part C lead-office accountability (CPDO, CEO, CHO, CENRO, CSWDO) track trends transparently over time.`,
        chips: [`32.9% Mandatory`, `1.41 Interface`, `MR-11`, `MR-17`]
      },
      3: {
        badge: `Layer 3 · Underlying Structures`,
        badgeClass: `role-tag--compliance`,
        title: `Underlying Structures: Legal Charters, Staffing & Boundaries`,
        desc: `Beneath visible trends lie four structural gaps driving all four system archetypes: no enabling department ordinance, no formal EOC Executive Order, an undefined ICS–EOC boundary, and a staffing status pending HRMO validation permanent plantilla ratio.`,
        drivers: [
          `IAT A1.1 (Score 2): CDRRMO operates by Executive Order rather than a Sangguniang Panlungsod ordinance with JMC 2014-1 divisions.`,
          `IAT B1.1 (Score 2): Absence of a formal City EOC Establishment EO under NDRRMC Memo No. 131, s. 2018.`,
          `IAT B6.1 (Score 1, High): Undefined ICS–EOC command boundary risking tactical overreach.`,
          `IAT A2.3 (Score 2): 43 of 47 personnel reported as casual/job-order, creating succession & continuity risk.`
        ],
        remedy: `Enact Annex 1-A (CDRRMO Ordinance), Annex 1-C (EOC EO), SOP 4-05 (ICS–EOC Interface), and ORG-SOP-01 (Workforce Plan) alongside Annex 1-F Master RACI.`,
        chips: [`Annex 1-A`, `Annex 1-C`, `SOP 4-05`, `IAT B6.1`]
      },
      4: {
        badge: `Layer 4 · Mental Models`,
        badgeClass: `role-tag--neutral`,
        title: `Mental Models: Shifting from Reactive Crisis Command to Governance`,
        desc: `At the deepest level, institutional habits are shaped by two limiting mental models: viewing DRRM solely as reactive emergency response, and viewing the EOC as an alternative command post rather than a coordination hub.`,
        drivers: [
          `"We responded" paradigm equates effort during typhoons with statutory preparedness compliance.`,
          `Conflating executive authority, technical warning authority, field ICS command, and EOC support.`,
          `Assuming temporary staff and informal memory can substitute for audited, repeatable processes.`
        ],
        remedy: `Institutionalize TQM & PDCA across all 10 chapters, establish RA 12287 Anticipatory Action (3–5 day pre-impact staging), and embed City-owned digital continuity in MODE.`,
        chips: [`Table FM.4`, `RA 12287`, `SOP 6-05`, `Ch. 10`]
      }
    };

    const CHAPTER_MATRIX = [
      { ch: `Ch. 1`, subject: `Legal Mandate, DRRM Governance & Institutional Accountability`, sops: `GOV-04 (SoC), GOV-05 (Imminent Disaster), Annex 1-A/B/C/F`, iat: `A1, B1.1, C1–C5`, mr: `MR-01, MR-02, MR-16, MR-17` },
      { ch: `Ch. 2`, subject: `CDRRMO Organizational Structure, Staffing & HR Management`, sops: `ORG-SOP-01 to 05, HR-01, Forms ORG-F01 to F10`, iat: `A2, B4`, mr: `MR-02, MR-09` },
      { ch: `Ch. 3`, subject: `Risk Intelligence, Planning & Institutional Preparedness`, sops: `SOP 3-01 to 3-09 (WF-SOP3-07 PSCP, Forms 3-01 to 3-11)`, iat: `A3, A5, Part C`, mr: `MR-03, MR-04, MR-10` },
      { ch: `Ch. 4`, subject: `Early Warning, EOC Activation, ICS & Emergency Response`, sops: `SOP 4-02 (Warn), 4-04 (EOC-ACT-01), 4-05 (PR-ICS-INTERFACE), 4-09`, iat: `A6, A7, A8, B1.2–B1.5`, mr: `MR-05, MR-06, MR-07, MR-08` },
      { ch: `Ch. 5`, subject: `Recovery, Rehabilitation & Build Back Better`, sops: `SOP 5-01 Recovery Baseline, Scenarios, PDNA, REC-F01`, iat: `A9`, mr: `MR-11` },
      { ch: `Ch. 6`, subject: `DRRM Financing, Procurement & Resource Accountability`, sops: `SOP 6-04 (PR-QRF-USE), 6-05 (RA 12287 AA 30%/70%), 6-06, 6-07`, iat: `A4`, mr: `MR-08, MR-16` },
      { ch: `Ch. 7`, subject: `Monitoring, Evaluation, Knowledge & Continuous Improvement`, sops: `SOP 7-04 (PR-AAR), CAPA Register ME-F05, ME-F03/F04`, iat: `A5.4–A5.9, A10, B7`, mr: `MR-11, MR-12, MR-13, MR-14` },
      { ch: `Ch. 8`, subject: `Stakeholder Engagement & Institutional Partnerships`, sops: `SOP 8-01, SOP 8-02 (Mutual Aid), PTN-F01, PTN-F03, LOG-F03`, iat: `Part C Interfaces`, mr: `MR-08, MR-17` },
      { ch: `Ch. 9`, subject: `Public Awareness, Community Resilience & Capacity Development`, sops: `Community Drills, 85-Barangay QA & Inclusive Consultation`, iat: `A5, A10`, mr: `MR-04, MR-09` },
      { ch: `Ch. 10`, subject: `Institutional Sustainability, Deep Resilience & Recognition`, sops: `SOP 10-01 Annual Review, City-Owned Hosting, Gawad KALASAG`, iat: `A1.1, B3.3, B3.5, B7.6`, mr: `MR-10, MR-15, MR-18` }
    ];

    /* =====================================================================
       2. APPLICATION STATE (Synced with Gemini Notebook Shim API)
       ===================================================================== */
    let appState = {
      activeView: `cld`,
      activeArchetype: `shifting`,
      activeLoopFilter: `all`,
      selectedNodeId: `workload`,
      selectedLeverageLevel: 1,
      leverageArchFilter: `all`,
      leverageSearch: ``,
      checkedMilestones: {},
      botArchetype: `shifting`,
      botRegime: `compare`,
      botMonth: 0,
      selectedIcebergLayer: 1
    };

    let botAnimTimer = null;

    async function saveAppState() {
      if (window.notebookAppApi && typeof window.notebookAppApi.setAppState === `function`) {
        try {
          await window.notebookAppApi.setAppState(appState);
        } catch (err) {
          /* Ignore transient host serialization errors */
        }
      }
    }

    /* =====================================================================
       3. VIEW & NAVIGATION HANDLERS (Hoisted Function Declarations)
       ===================================================================== */
    function switchView(viewId) {
      const views = [`cld`, `leverage`, `bot`, `iceberg`];
      if (!views.includes(viewId)) return;
      appState.activeView = viewId;

      views.forEach((v) => {
        const panel = document.getElementById(`view-` + v);
        const tab = document.getElementById(`tab-` + v);
        if (panel) panel.classList.toggle(`is-active`, v === viewId);
        if (tab) tab.setAttribute(`aria-selected`, v === viewId ? `true` : `false`);
      });

      if (viewId === `bot`) renderBotChart();
      if (viewId === `cld`) renderCldDiagram();
      if (viewId === `leverage`) renderLeverageView();
      if (viewId === `iceberg`) renderIcebergDetail();

      saveAppState();
    }

    function showStatusBanner(msg) {
      const banner = document.getElementById(`status-banner`);
      const textEl = document.getElementById(`status-banner-text`);
      if (textEl) textEl.textContent = msg;
      if (banner) banner.classList.add(`is-visible`);
    }

    function hideStatusBanner() {
      const banner = document.getElementById(`status-banner`);
      if (banner) banner.classList.remove(`is-visible`);
    }

    /* =====================================================================
       4. MODULE 1: CAUSAL LOOP DIAGRAMS (CLD)
       ===================================================================== */
    function selectArchetype(archId) {
      if (!ARCHETYPES[archId]) return;
      appState.activeArchetype = archId;
      appState.activeLoopFilter = `all`;
      appState.selectedNodeId = ARCHETYPES[archId].nodes[0].id;

      [`shifting`, `growth`, `drifting`, `conflation`].forEach((id) => {
        const btn = document.getElementById(`arch-btn-` + id);
        if (btn) btn.classList.toggle(`is-selected`, id === archId);
      });

      renderCldDiagram();
      renderNodeInspector();
      saveAppState();
    }

    function setLoopFilter(loopId) {
      appState.activeLoopFilter = loopId;
      renderCldDiagram();
      saveAppState();
    }

    function selectCldNode(nodeId) {
      appState.selectedNodeId = nodeId;
      renderCldDiagram();
      renderNodeInspector();
      saveAppState();
    }

    function computeCurvePath(x1, y1, x2, y2, curveOffset) {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const cx = mx + nx * curveOffset;
      const cy = my + ny * curveOffset;

      // Trim endpoints slightly from node centers so arrows land visibly near boxes
      const tStart = 0.24;
      const tEnd = 0.76;
      const sx = (1 - tStart) * (1 - tStart) * x1 + 2 * (1 - tStart) * tStart * cx + tStart * tStart * x2;
      const sy = (1 - tStart) * (1 - tStart) * y1 + 2 * (1 - tStart) * tStart * cy + tStart * tStart * y2;
      const ex = (1 - tEnd) * (1 - tEnd) * x1 + 2 * (1 - tEnd) * tEnd * cx + tEnd * tEnd * x2;
      const ey = (1 - tEnd) * (1 - tEnd) * y1 + 2 * (1 - tEnd) * tEnd * cy + tEnd * tEnd * y2;

      const midX = 0.25 * x1 + 0.5 * cx + 0.25 * x2;
      const midY = 0.25 * y1 + 0.5 * cy + 0.25 * y2;

      return {
        d: `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`,
        midX,
        midY,
        nx,
        ny
      };
    }

    function renderCldDiagram() {
      const arch = ARCHETYPES[appState.activeArchetype];
      if (!arch) return;

      const summaryEl = document.getElementById(`cld-archetype-summary`);
      if (summaryEl) summaryEl.textContent = arch.summary;

      // Render Loop Filter Pills
      const pillsWrap = document.getElementById(`cld-loop-pills`);
      if (pillsWrap) {
        pillsWrap.innerHTML = arch.loops.map((lp) => {
          const active = appState.activeLoopFilter === lp.id ? ` is-active` : ``;
          return `<button type="button" class="loop-pill${active}" data-on-click="setLoopFilter" data-arg="${lp.id}">${lp.label}</button>`;
        }).join(``);
      }

      const edgesLayer = document.getElementById(`cld-edges-layer`);
      const loopsLayer = document.getElementById(`cld-loops-layer`);
      const nodesLayer = document.getElementById(`cld-nodes-layer`);
      if (!edgesLayer || !loopsLayer || !nodesLayer) return;

      const nodeMap = {};
      arch.nodes.forEach((n) => { nodeMap[n.id] = n; });

      // Draw Edges
      edgesLayer.innerHTML = arch.edges.map((edge, idx) => {
        const src = nodeMap[edge.from];
        const dst = nodeMap[edge.to];
        if (!src || !dst) return ``;

        const geom = computeCurvePath(src.x, src.y, dst.x, dst.y, edge.curve || 0);
        const loopMatches = appState.activeLoopFilter === `all` || edge.loops.includes(appState.activeLoopFilter);
        const nodeMatches = !appState.selectedNodeId || edge.from === appState.selectedNodeId || edge.to === appState.selectedNodeId;
        const dimmed = (appState.activeLoopFilter !== `all` && !loopMatches) || (appState.activeLoopFilter === `all` && !nodeMatches);

        const strokeColor = edge.pol === `+` ? `var(--accent-blue)` : `var(--accent-orange)`;
        const marker = edge.pol === `+` ? `url(#arrow-plus)` : `url(#arrow-minus)`;
        const badgeBg = edge.pol === `+` ? `var(--accent-blue-tint)` : `var(--accent-orange-tint)`;
        const badgeText = edge.pol === `+` ? `var(--accent-blue-ink)` : `var(--accent-orange-ink)`;
        const polSymbol = edge.pol === `+` ? `+` : `−`;

        let delayMarkup = ``;
        if (edge.delay) {
          const d1x = geom.midX - geom.nx * 9 - 4;
          const d1y = geom.midY - geom.ny * 9 - 4;
          delayMarkup = `
            <g transform="translate(${d1x.toFixed(1)}, ${d1y.toFixed(1)})">
              <rect x="-10" y="-9" width="20" height="18" rx="3" fill="var(--navy-tint)" stroke="var(--outline)" stroke-width="1.2"></rect>
              <text x="0" y="4" text-anchor="middle" font-family="var(--font-label)" font-size="10" font-weight="700" fill="var(--on-surface)">||</text>
            </g>`;
        }

        const badgeX = edge.delay ? geom.midX + geom.nx * 14 : geom.midX;
        const badgeY = edge.delay ? geom.midY + geom.ny * 14 : geom.midY;

        return `
          <g class="cld-edge${dimmed ? ` cld-is-dimmed` : ``}" data-edge-idx="${idx}">
            <path d="${geom.d}" fill="none" stroke="${strokeColor}" stroke-width="${dimmed ? 1.8 : 2.6}" marker-end="${marker}"></path>
            ${delayMarkup}
            <circle cx="${badgeX.toFixed(1)}" cy="${badgeY.toFixed(1)}" r="11" fill="${badgeBg}" stroke="${strokeColor}" stroke-width="1.5"></circle>
            <text x="${badgeX.toFixed(1)}" y="${(badgeY + 4).toFixed(1)}" text-anchor="middle" font-family="var(--font-label)" font-size="13" font-weight="700" fill="${badgeText}">${polSymbol}</text>
          </g>
        `;
      }).join(``);

      // Draw Feedback Loop Medallions (B1, B2, R1, R2)
      loopsLayer.innerHTML = arch.loops.filter((l) => l.id !== `all`).map((lp) => {
        const isActive = appState.activeLoopFilter === lp.id;
        const isDimmed = appState.activeLoopFilter !== `all` && !isActive;
        const ringColor = lp.type === `B` ? `var(--accent-blue)` : `var(--accent-orange)`;
        const fillCol = isActive ? `var(--primary)` : `var(--surface-container-low)`;
        const txtCol = isActive ? `var(--on-primary)` : (lp.type === `B` ? `var(--accent-blue-ink)` : `var(--accent-orange-ink)`);
        return `
          <g class="cld-node${isDimmed ? ` cld-is-dimmed` : ``}" role="button" tabindex="0" aria-label="${lp.title}" data-on-click="setLoopFilter" data-arg="${lp.id}" data-on-activate="setLoopFilter" data-arg="${lp.id}">
            <circle cx="${lp.cx}" cy="${lp.cy}" r="22" fill="${fillCol}" stroke="${ringColor}" stroke-width="2.2" stroke-dasharray="4 2"></circle>
            <text x="${lp.cx}" y="${lp.cy + 5}" text-anchor="middle" font-family="var(--font-metric)" font-size="16" font-weight="700" fill="${txtCol}">${lp.id}</text>
          </g>
        `;
      }).join(``);

      // Draw Nodes
      nodesLayer.innerHTML = arch.nodes.map((node) => {
        const isSelected = appState.selectedNodeId === node.id;
        const x = node.x - node.w / 2;
        const y = node.y - node.h / 2;
        let stroke = `var(--outline-variant)`;
        let fill = `var(--surface-container-low)`;
        let accentBar = `var(--outline)`;

        if (node.role === `symptom`) {
          accentBar = `var(--accent-orange)`;
          stroke = isSelected ? `var(--accent-orange)` : `var(--outline-variant)`;
          fill = isSelected ? `var(--accent-orange-tint)` : `var(--surface-container-low)`;
        } else if (node.role === `lever`) {
          accentBar = `var(--accent-blue)`;
          stroke = isSelected ? `var(--accent-blue)` : `var(--outline-variant)`;
          fill = isSelected ? `var(--accent-blue-tint)` : `var(--surface-container-low)`;
        } else if (node.role === `compliance`) {
          accentBar = `var(--positive)`;
          stroke = isSelected ? `var(--positive)` : `var(--outline-variant)`;
          fill = isSelected ? `var(--positive-tint)` : `var(--surface-container-low)`;
        } else {
          stroke = isSelected ? `var(--primary)` : `var(--outline-variant)`;
          fill = isSelected ? `var(--navy-tint)` : `var(--surface-container-low)`;
        }

        const lines = node.label.split(`\n`);
        const lineY1 = lines.length === 2 ? node.y - 5 : node.y + 4;
        const lineY2 = node.y + 13;

        return `
          <g class="cld-node" role="button" tabindex="0" aria-label="${node.label.replace(/\n/g, ` `)}" data-on-click="selectCldNode" data-arg="${node.id}" data-on-mouseenter="previewCldNode" data-arg="${node.id}" data-on-activate="selectCldNode" data-arg="${node.id}">
            <rect class="node-box" x="${x}" y="${y}" width="${node.w}" height="${node.h}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="${isSelected ? 2.8 : 1.5}"></rect>
            <rect x="${x}" y="${y}" width="6" height="${node.h}" rx="3" fill="${accentBar}"></rect>
            <text x="${node.x + 3}" y="${lineY1}" text-anchor="middle" font-family="var(--font-body)" font-size="12.5" font-weight="700" fill="var(--on-surface)">${lines[0]}</text>
            ${lines[1] ? `<text x="${node.x + 3}" y="${lineY2}" text-anchor="middle" font-family="var(--font-body)" font-size="12" font-weight="600" fill="var(--on-surface-variant)">${lines[1]}</text>` : ``}
          </g>
        `;
      }).join(``);
    }

    function previewCldNode(nodeId) {
      if (appState.selectedNodeId === nodeId) return;
      appState.selectedNodeId = nodeId;
      renderCldDiagram();
      renderNodeInspector();
    }

    function renderNodeInspector() {
      const arch = ARCHETYPES[appState.activeArchetype];
      if (!arch) return;
      const node = arch.nodes.find((n) => n.id === appState.selectedNodeId) || arch.nodes[0];
      if (!node) return;

      const roleBadge = document.getElementById(`insp-role-badge`);
      const archCode = document.getElementById(`insp-arch-code`);
      const titleEl = document.getElementById(`insp-title`);
      const descEl = document.getElementById(`insp-desc`);
      const linksEl = document.getElementById(`insp-links`);
      const evTextEl = document.getElementById(`insp-evidence-text`);
      const chipsEl = document.getElementById(`insp-chips`);

      if (roleBadge) {
        roleBadge.textContent = node.roleLabel;
        roleBadge.className = `role-tag role-tag--` + node.role;
      }
      if (archCode) archCode.textContent = arch.code + ` · ` + arch.title;
      if (titleEl) titleEl.textContent = node.label.replace(/\n/g, ` `);
      if (descEl) descEl.textContent = node.desc;
      if (evTextEl) evTextEl.textContent = node.evidence;

      if (chipsEl) {
        chipsEl.innerHTML = node.chips.map((c) => `<span class="code-chip">${c}</span>`).join(``);
      }

      if (linksEl) {
        const nodeMap = {};
        arch.nodes.forEach((n) => { nodeMap[n.id] = n.label.replace(/\n/g, ` `); });

        const related = arch.edges.filter((e) => e.from === node.id || e.to === node.id);
        linksEl.innerHTML = related.map((e) => {
          const isOut = e.from === node.id;
          const peer = isOut ? nodeMap[e.to] : nodeMap[e.from];
          const dirLabel = isOut ? `Drives →` : `← Driven by`;
          const polClass = e.pol === `+` ? `pol-plus` : `pol-minus`;
          const polTxt = e.pol === `+` ? `+` : `−`;
          const delayTag = e.delay ? ` [Delay ||]` : ``;
          return `
            <li class="causal-item">
              <span class="pol-badge ${polClass}" aria-hidden="true">${polTxt}</span>
              <div>
                <strong>${dirLabel} ${peer}</strong><span class="dossier-meta">${delayTag}</span>
                <div style="color: var(--on-surface-variant); margin-top: 2px;">${e.note}</div>
              </div>
            </li>
          `;
        }).join(``);
      }
    }

    function jumpToLeverageForArchetype() {
      appState.leverageArchFilter = appState.activeArchetype;
      const sel = document.getElementById(`lev-arch-filter`);
      if (sel) sel.value = appState.activeArchetype;
      const firstMatch = LEVERAGE_POINTS.find((lp) => lp.archetypes.includes(appState.activeArchetype));
      if (firstMatch) appState.selectedLeverageLevel = firstMatch.level;
      switchView(`leverage`);
    }

    function jumpToBotForArchetype() {
      appState.botArchetype = appState.activeArchetype;
      const sel = document.getElementById(`bot-arch-select`);
      if (sel) sel.value = appState.activeArchetype;
      switchView(`bot`);
    }

    /* =====================================================================
       5. MODULE 2: MEADOWS LEVERAGE POINTS -> SOP MAPPING
       ===================================================================== */
    function filterLeveragePoints() {
      const searchEl = document.getElementById(`lev-search`);
      const filterEl = document.getElementById(`lev-arch-filter`);
      appState.leverageSearch = searchEl ? searchEl.value.trim().toLowerCase() : ``;
      appState.leverageArchFilter = filterEl ? filterEl.value : `all`;
      renderLeverageView();
      saveAppState();
    }

    function selectLeverageLevel(lvl) {
      appState.selectedLeverageLevel = lvl;
      renderLeverageView();
      saveAppState();
    }

    function toggleMilestone(milestoneId) {
      appState.checkedMilestones[milestoneId] = !appState.checkedMilestones[milestoneId];
      renderLeverageView();
      saveAppState();
    }

    function resetMilestones(btn) {
      if (btn.dataset.armed !== `true`) {
        btn.dataset.armed = `true`;
        btn.innerHTML = `<i data-lucide="alert-circle" aria-hidden="true"></i><span>Click again to confirm reset</span>`;
        if (window.lucide) window.lucide.createIcons();
        return;
      }
      btn.dataset.armed = `false`;
      btn.innerHTML = `<i data-lucide="rotate-ccw" aria-hidden="true"></i><span>Reset Milestones</span>`;
      appState.checkedMilestones = {};
      renderLeverageView();
      saveAppState();
      showStatusBanner(`Verification milestones reset to initial baseline.`);
      if (window.lucide) window.lucide.createIcons();
    }

    function renderLeverageView() {
      const stackEl = document.getElementById(`ladder-stack`);
      const detailEl = document.getElementById(`leverage-detail`);
      const progressBadge = document.getElementById(`checklist-progress-badge`);
      if (!stackEl || !detailEl) return;

      const totalMilestones = LEVERAGE_POINTS.reduce((acc, l) => acc + l.milestones.length, 0);
      const checkedCount = LEVERAGE_POINTS.reduce((acc, l) => acc + l.milestones.filter((m) => appState.checkedMilestones[m.id]).length, 0);
      if (progressBadge) progressBadge.textContent = `${checkedCount} / ${totalMilestones} Milestones Verified`;

      const filtered = LEVERAGE_POINTS.filter((lp) => {
        const archMatch = appState.leverageArchFilter === `all` || lp.archetypes.includes(appState.leverageArchFilter);
        if (!archMatch) return false;
        if (!appState.leverageSearch) return true;
        const haystack = [
          lp.name, lp.headline, lp.targetGap, lp.transformation,
          ...lp.sops.map((s) => `${s.chapter} ${s.code} ${s.protocol} ${s.forms} ${s.iat} ${s.mr}`)
        ].join(` `).toLowerCase();
        return haystack.includes(appState.leverageSearch);
      });

      if (filtered.length === 0) {
        stackEl.innerHTML = `
          <div class="evidence-box">
            <p class="field-label">No Matching Leverage Levels</p>
            <p style="margin: var(--space-xs) 0 0;">No leverage points match your current search or archetype filter. Clear the filter to inspect all 5 levels.</p>
          </div>
        `;
        detailEl.innerHTML = `<p style="margin:0;">Adjust your search query or archetype filter on the left.</p>`;
        return;
      }

      if (!filtered.some((f) => f.level === appState.selectedLeverageLevel)) {
        appState.selectedLeverageLevel = filtered[0].level;
      }

      stackEl.innerHTML = filtered.map((lp) => {
        const isSel = lp.level === appState.selectedLeverageLevel;
        const done = lp.milestones.filter((m) => appState.checkedMilestones[m.id]).length;
        return `
          <button type="button" class="ladder-card${isSel ? ` is-selected` : ``}" data-on-click="selectLeverageLevel" data-arg="${lp.level}" data-arg-type="number">
            <div class="ladder-top">
              <span class="ladder-level">${lp.tier}</span>
              <span class="code-chip">${done}/${lp.milestones.length} Verified</span>
            </div>
            <strong style="font-size: 1rem; color: var(--on-surface);">${lp.name}</strong>
            <span style="font-size: 0.85rem; color: var(--on-surface-variant);">${lp.headline}</span>
            <div class="power-bar" aria-hidden="true"><div class="power-fill" style="width: ${lp.power}%;"></div></div>
          </button>
        `;
      }).join(``);

      const active = filtered.find((f) => f.level === appState.selectedLeverageLevel) || filtered[0];

      detailEl.innerHTML = `
        <div class="inspector-kicker">
          <span class="role-tag role-tag--lever">${active.tier}</span>
          <span class="dossier-meta">Target Archetypes: ${active.archetypes.map((a) => ARCHETYPES[a].code).join(` · `)}</span>
        </div>

        <div>
          <h3 class="inspector-title" style="font-size: 1.3rem;">${active.name}: ${active.headline}</h3>
          <p class="inspector-desc" style="margin-top: var(--space-xs); color: var(--on-surface-variant);">${active.meadowsRationale}</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: var(--space-md);">
          <div class="evidence-box">
            <p class="field-label">Baseline Vulnerability</p>
            <p style="margin: var(--space-xs) 0 0;">${active.targetGap}</p>
          </div>
          <div class="evidence-box" style="border-left-color: var(--positive);">
            <p class="field-label">Manual of Operations Transformation</p>
            <p style="margin: var(--space-xs) 0 0;">${active.transformation}</p>
          </div>
        </div>

        <div>
          <p class="field-label" style="margin-bottom: var(--space-xs);">Controlling Manual of Operations Instruments &amp; Traceability</p>
          <div class="table-wrap">
            <table class="dossier-table">
              <thead>
                <tr>
                  <th>Chapter</th>
                  <th>SOP / Annex</th>
                  <th>MODE Protocol &amp; Forms</th>
                  <th>Authority</th>
                  <th>IAT &amp; MR Links</th>
                </tr>
              </thead>
              <tbody>
                ${active.sops.map((s) => `
                  <tr>
                    <td><strong>${s.chapter}</strong></td>
                    <td><span class="code-chip">${s.code}</span></td>
                    <td>${s.protocol}<br><span style="font-size:0.8rem; color: var(--on-surface-variant);">${s.forms}</span></td>
                    <td>${s.authority}</td>
                    <td><span style="font-family: var(--font-label); font-size: 0.78rem;">${s.iat}<br>${s.mr}</span></td>
                  </tr>
                `).join(``)}
              </tbody>
            </table>
          </div>
        </div>

        <div class="checklist-box">
          <p class="field-label">Institutionalization Verification Milestones (Saved Automatically)</p>
          ${active.milestones.map((m) => {
            const checked = !!appState.checkedMilestones[m.id];
            return `
              <label class="check-row">
                <input type="checkbox" ${checked ? `checked` : ``} data-on-change="toggleMilestone" data-arg="${m.id}">
                <span style="font-size: 0.88rem; ${checked ? `text-decoration: line-through; color: var(--on-surface-variant);` : `color: var(--on-surface);`}">${m.text}</span>
              </label>
            `;
          }).join(``)}
        </div>
      `;
    }

    /* =====================================================================
       6. MODULE 3: BEHAVIOR OVER TIME (BOT) SIMULATOR
       ===================================================================== */
    const KEYFRAME_MONTHS = [0, 6, 12, 18, 24, 36, 48, 60];

    function interpolateSeries(arr, month) {
      const m = Math.max(0, Math.min(60, Number(month)));
      for (let i = 0; i < KEYFRAME_MONTHS.length - 1; i++) {
        const m0 = KEYFRAME_MONTHS[i];
        const m1 = KEYFRAME_MONTHS[i + 1];
        if (m >= m0 && m <= m1) {
          const t = (m - m0) / (m1 - m0);
          return arr[i] + (arr[i + 1] - arr[i]) * t;
        }
      }
      return arr[arr.length - 1];
    }

    function setBotArchetype(archId) {
      if (!BOT_MODELS[archId]) return;
      appState.botArchetype = archId;
      renderBotChart();
      saveAppState();
    }

    function setBotRegime(regime) {
      appState.botRegime = regime;
      renderBotChart();
      saveAppState();
    }

    function onScrubberInput(val) {
      appState.botMonth = Math.max(0, Math.min(60, parseInt(val, 10) || 0));
      renderBotChart();
      saveAppState();
    }

    function setTimelineMonth(month) {
      appState.botMonth = Math.max(0, Math.min(60, parseInt(month, 10) || 0));
      const slider = document.getElementById(`bot-scrubber`);
      if (slider) slider.value = appState.botMonth;
      renderBotChart();
      saveAppState();
    }

    function toggleBotPlayback() {
      const btnLabel = document.getElementById(`bot-play-label`);
      if (botAnimTimer) {
        clearInterval(botAnimTimer);
        botAnimTimer = null;
        if (btnLabel) btnLabel.textContent = `Animate Timeline`;
        return;
      }
      if (appState.botMonth >= 60) appState.botMonth = 0;
      if (btnLabel) btnLabel.textContent = `Pause Timeline`;
      botAnimTimer = setInterval(() => {
        if (appState.botMonth >= 60) {
          clearInterval(botAnimTimer);
          botAnimTimer = null;
          if (btnLabel) btnLabel.textContent = `Animate Timeline`;
          saveAppState();
          return;
        }
        setTimelineMonth(appState.botMonth + 1);
      }, 90);
    }

    function buildSvgLine(seriesArr, xScale, yScale) {
      const pts = [];
      for (let m = 0; m <= 60; m += 2) {
        const val = interpolateSeries(seriesArr, m);
        pts.push(`${xScale(m).toFixed(1)},${yScale(val).toFixed(1)}`);
      }
      return pts.join(` `);
    }

    function renderBotChart() {
      const svg = document.getElementById(`bot-svg`);
      const model = BOT_MODELS[appState.botArchetype];
      if (!svg || !model) return;

      const padL = 56, padR = 24, padT = 24, padB = 42;
      const W = 840, H = 360;
      const plotW = W - padL - padR;
      const plotH = H - padT - padB;

      const xScale = (m) => padL + (m / 60) * plotW;
      const yScale = (v) => padT + ((100 - v) / 100) * plotH;

      // Gridlines
      const yTicks = [0, 25, 50, 75, 100];
      const gridMarkup = yTicks.map((t) => {
        const y = yScale(t);
        return `
          <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--outline-variant)" stroke-width="${t === 0 ? 1.5 : 1}"></line>
          <text x="${padL - 10}" y="${y + 4}" text-anchor="end" font-family="var(--font-label)" font-size="11" fill="var(--on-surface-variant)">${t}</text>
        `;
      }).join(``);

      const xTicks = [0, 12, 24, 36, 48, 60];
      const xAxisMarkup = xTicks.map((m) => {
        const x = xScale(m);
        const yrLabel = m === 0 ? `M0 (2026)` : `M${m} (Yr ${m / 12})`;
        return `
          <line x1="${x}" y1="${padT}" x2="${x}" y2="${H - padB}" stroke="var(--outline-variant)" stroke-dasharray="3 3" stroke-width="1"></line>
          <text x="${x}" y="${H - 16}" text-anchor="middle" font-family="var(--font-label)" font-size="11" fill="var(--on-surface-variant)">${yrLabel}</text>
        `;
      }).join(``);

      // Baseline reference line at 32.9% Mandatory Compliance
      const baseY = yScale(32.9);
      const baselineMarkup = `
        <line x1="${padL}" y1="${baseY.toFixed(1)}" x2="${W - padR}" y2="${baseY.toFixed(1)}" stroke="var(--data-context)" stroke-dasharray="6 4" stroke-width="1.3"></line>
        <text x="${W - padR - 4}" y="${(baseY - 5).toFixed(1)}" text-anchor="end" font-family="var(--font-label)" font-size="10.5" fill="var(--on-surface-variant)">32.9% IAT Baseline</text>
      `;

      // Lines
      let linesMarkup = ``;
      const showSq = appState.botRegime === `statusquo` || appState.botRegime === `compare`;
      const showMode = appState.botRegime === `mode` || appState.botRegime === `compare`;

      if (showSq) {
        const op = appState.botRegime === `compare` ? `0.42` : `1`;
        const dash = appState.botRegime === `compare` ? `stroke-dasharray="6 4"` : ``;
        linesMarkup += `
          <polyline fill="none" stroke="var(--data-1)" stroke-width="2.2" ${dash} opacity="${op}" points="${buildSvgLine(model.statusquo.symptom, xScale, yScale)}"></polyline>
          <polyline fill="none" stroke="var(--data-2)" stroke-width="2" stroke-dasharray="4 4" opacity="${op}" points="${buildSvgLine(model.statusquo.fix, xScale, yScale)}"></polyline>
          <polyline fill="none" stroke="var(--data-3)" stroke-width="2.2" ${dash} opacity="${op}" points="${buildSvgLine(model.statusquo.fundamental, xScale, yScale)}"></polyline>
          <polyline fill="none" stroke="var(--data-4)" stroke-width="2.5" ${dash} opacity="${op}" points="${buildSvgLine(model.statusquo.compliance, xScale, yScale)}"></polyline>
        `;
      }

      if (showMode) {
        linesMarkup += `
          <polyline fill="none" stroke="var(--data-1)" stroke-width="3" points="${buildSvgLine(model.mode.symptom, xScale, yScale)}"></polyline>
          <polyline fill="none" stroke="var(--data-2)" stroke-width="2.4" stroke-dasharray="6 4" points="${buildSvgLine(model.mode.fix, xScale, yScale)}"></polyline>
          <polyline fill="none" stroke="var(--data-3)" stroke-width="3" points="${buildSvgLine(model.mode.fundamental, xScale, yScale)}"></polyline>
          <polyline fill="none" stroke="var(--data-4)" stroke-width="3.2" points="${buildSvgLine(model.mode.compliance, xScale, yScale)}"></polyline>
        `;
      }

      // Active Scrubber Vertical Marker
      const activeSet = appState.botRegime === `statusquo` ? model.statusquo : model.mode;
      const curM = appState.botMonth;
      const sx = xScale(curM);
      const valSym = interpolateSeries(activeSet.symptom, curM);
      const valFix = interpolateSeries(activeSet.fix, curM);
      const valFun = interpolateSeries(activeSet.fundamental, curM);
      const valCom = interpolateSeries(activeSet.compliance, curM);

      const markerMarkup = `
        <line x1="${sx.toFixed(1)}" y1="${padT}" x2="${sx.toFixed(1)}" y2="${H - padB}" stroke="var(--primary)" stroke-width="2"></line>
        <circle cx="${sx.toFixed(1)}" cy="${yScale(valSym).toFixed(1)}" r="5.5" fill="var(--data-1)" stroke="var(--surface-container-low)" stroke-width="2"></circle>
        <circle cx="${sx.toFixed(1)}" cy="${yScale(valFix).toFixed(1)}" r="5" fill="var(--data-2)" stroke="var(--surface-container-low)" stroke-width="2"></circle>
        <circle cx="${sx.toFixed(1)}" cy="${yScale(valFun).toFixed(1)}" r="5.5" fill="var(--data-3)" stroke="var(--surface-container-low)" stroke-width="2"></circle>
        <circle cx="${sx.toFixed(1)}" cy="${yScale(valCom).toFixed(1)}" r="6" fill="var(--data-4)" stroke="var(--surface-container-low)" stroke-width="2"></circle>
      `;

      // Interactive Clickable Scrubbing Overlay
      const hitRect = `<rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="transparent" style="cursor: crosshair;" data-on-click="handleChartClick" data-arg-from="event"></rect>`;

      svg.innerHTML = gridMarkup + xAxisMarkup + baselineMarkup + linesMarkup + markerMarkup + hitRect;

      // Update Telemetry Readouts
      const yearNum = (2026 + Math.floor((10 + curM) / 12));
      const monthNames = [`Jan`, `Feb`, `Mar`, `Apr`, `May`, `Jun`, `Jul`, `Aug`, `Sep`, `Oct`, `Nov`, `Dec`];
      const calMonth = monthNames[(10 + curM) % 12];

      const mrEl = document.getElementById(`bot-month-readout`);
      if (mrEl) mrEl.textContent = `M${curM} (${calMonth} ${yearNum})`;

      const ts = document.getElementById(`tel-symptom`);
      const tsn = document.getElementById(`tel-symptom-note`);
      const tf = document.getElementById(`tel-fix`);
      const tfn = document.getElementById(`tel-fix-note`);
      const tfu = document.getElementById(`tel-fund`);
      const tfun = document.getElementById(`tel-fund-note`);
      const tc = document.getElementById(`tel-comp`);

      if (ts) ts.textContent = Math.round(valSym);
      if (tsn) tsn.textContent = model.labels.symptom;
      if (tf) tf.textContent = Math.round(valFix);
      if (tfn) tfn.textContent = model.labels.fix;
      if (tfu) tfu.textContent = Math.round(valFun);
      if (tfun) tfun.textContent = model.labels.fundamental;
      if (tc) tc.textContent = valCom.toFixed(1) + `%`;

      const phaseEl = document.getElementById(`bot-phase-note`);
      if (phaseEl) {
        const note = model.phaseNotes.find((p) => curM <= p.maxM) || model.phaseNotes[model.phaseNotes.length - 1];
        phaseEl.textContent = note.text;
      }
    }

    function handleChartClick(evt) {
      const svg = document.getElementById(`bot-svg`);
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const relX = ((evt.clientX - rect.left) / rect.width) * 840;
      const m = Math.round(((relX - 56) / (840 - 56 - 24)) * 60);
      setTimelineMonth(m);
    }

    /* =====================================================================
       7. MODULE 4: ICEBERG MODEL & 10-CHAPTER MATRIX
       ===================================================================== */
    function selectIcebergLayer(layerNum) {
      appState.selectedIcebergLayer = layerNum;
      [1, 2, 3, 4].forEach((n) => {
        const btn = document.getElementById(`ice-btn-` + n);
        if (btn) btn.classList.toggle(`is-selected`, n === layerNum);
      });
      renderIcebergDetail();
      saveAppState();
    }

    function renderIcebergDetail() {
      const box = document.getElementById(`iceberg-detail`);
      const layer = ICEBERG_LAYERS[appState.selectedIcebergLayer];
      if (!box || !layer) return;

      box.innerHTML = `
        <div class="inspector-kicker">
          <span class="role-tag ${layer.badgeClass}">${layer.badge}</span>
          <span class="dossier-meta">CResT Systems Diagnosis</span>
        </div>
        <h3 class="inspector-title">${layer.title}</h3>
        <p class="inspector-desc">${layer.desc}</p>
        <div>
          <p class="field-label">Observed Ormoc City Evidence</p>
          <ul class="causal-list">
            ${layer.drivers.map((d) => `<li class="causal-item"><span>&bull;</span><span>${d}</span></li>`).join(``)}
          </ul>
        </div>
        <div class="evidence-box" style="border-left-color: var(--accent-blue);">
          <p class="field-label">Manual of Operations Structural Remedy</p>
          <p style="margin: var(--space-xs) 0 0;">${layer.remedy}</p>
          <div class="chip-row">${layer.chips.map((c) => `<span class="code-chip">${c}</span>`).join(``)}</div>
        </div>
      `;
    }

    function renderChapterMatrix() {
      const tbody = document.getElementById(`chapters-table-body`);
      if (!tbody) return;
      tbody.innerHTML = CHAPTER_MATRIX.map((row) => `
        <tr>
          <td><strong>${row.ch}</strong></td>
          <td>${row.subject}</td>
          <td style="font-size: 0.82rem;">${row.sops}</td>
          <td><span class="code-chip">${row.iat}</span></td>
          <td style="font-family: var(--font-label); font-size: 0.78rem;">${row.mr}</td>
        </tr>
      `).join(``);
    }

    /* =====================================================================
       8. CSV EXPORT VIA NOTEBOOK APP API
       ===================================================================== */
    function exportActionPlanCsv() {
      const rows = [
        [`Leverage Level`, `Meadows Principle`, `Manual of Operations SOP / Annex`, `Target Archetypes`, `Milestone`, `Verified`]
      ];
      LEVERAGE_POINTS.forEach((lp) => {
        const sopStr = lp.sops.map((s) => s.code).join(`; `);
        const archStr = lp.archetypes.join(`; `);
        lp.milestones.forEach((m) => {
          rows.push([
            `Level ${lp.level}`,
            lp.name,
            sopStr,
            archStr,
            m.text,
            appState.checkedMilestones[m.id] ? `VERIFIED` : `PENDING`
          ]);
        });
      });

      const csv = rows.map((r) => r.map((cell) => `"` + String(cell).replace(/"/g, `""`) + `"`).join(`,`)).join(`\n`);

      if (window.notebookAppApi && typeof window.notebookAppApi.triggerFileDownload === `function`) {
        window.notebookAppApi.triggerFileDownload({
          content: csv,
          contentType: `text/csv`,
          encoding: `UTF-8`,
          filename: `ormoc-mode-leverage-action-plan.csv`
        });
        showStatusBanner(`Exported ormoc-mode-leverage-action-plan.csv with current verification milestones.`);
      } else {
        const blob = new Blob([csv], { type: `text/csv;charset=utf-8;` });
        const url = URL.createObjectURL(blob);
        const link = document.createElement(`a`);
        link.href = url;
        link.download = `ormoc-mode-leverage-action-plan.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showStatusBanner(`Downloaded ormoc-mode-leverage-action-plan.csv.`);
      }
    }

    /* =====================================================================
       9. INITIALIZATION & HOST HYDRATION
       ===================================================================== */
    async function initApp() {
      if (window.notebookAppApi && typeof window.notebookAppApi.getAppState === `function`) {
        try {
          const saved = await window.notebookAppApi.getAppState();
          if (saved && typeof saved === `object`) {
            appState = Object.assign({}, appState, saved);
          }
        } catch (err) {
          /* Start cleanly with defaults if state unavailable */
        }
      }

      // Sync UI controls from restored state
      const levSearch = document.getElementById(`lev-search`);
      if (levSearch) levSearch.value = appState.leverageSearch || ``;
      const levFilter = document.getElementById(`lev-arch-filter`);
      if (levFilter) levFilter.value = appState.leverageArchFilter || `all`;
      const botArchSel = document.getElementById(`bot-arch-select`);
      if (botArchSel) botArchSel.value = appState.botArchetype || `shifting`;
      const botRegSel = document.getElementById(`bot-regime-select`);
      if (botRegSel) botRegSel.value = appState.botRegime || `compare`;
      const scrubber = document.getElementById(`bot-scrubber`);
      if (scrubber) scrubber.value = appState.botMonth || 0;

      // Render all views cleanly
      selectArchetype(appState.activeArchetype || `shifting`);
      renderLeverageView();
      renderBotChart();
      selectIcebergLayer(appState.selectedIcebergLayer || 1);
      renderChapterMatrix();
      switchView(appState.activeView || `cld`);

      if (window.lucide && typeof window.lucide.createIcons === `function`) {
        window.lucide.createIcons();
      }

      if (window.notebookAppApi && typeof window.notebookAppApi.notifyAppReady === `function`) {
        window.notebookAppApi.notifyAppReady();
      }
    }

    document.addEventListener(`DOMContentLoaded`, initApp);

/* Event delegation: inline handlers are blocked by the site's security policy
   (script-src 'self'), so markup names the handler in data-on-<event>. */
(function () {
  function argOf(el, ev) {
    var from = el.getAttribute('data-arg-from');
    if (from === 'value') return [el.value];
    if (from === 'this') return [el];
    if (from === 'event') return [ev];
    if (!el.hasAttribute('data-arg')) return [];
    var a = el.getAttribute('data-arg');
    return [el.getAttribute('data-arg-type') === 'number' ? Number(a) : a];
  }
  function run(el, name, ev) {
    var fn = window[name];
    if (typeof fn !== 'function') { console.error('Missing handler: ' + name); return; }
    fn.apply(el, argOf(el, ev));
  }
  ['click', 'change', 'input'].forEach(function (type) {
    document.addEventListener(type, function (ev) {
      var el = ev.target.closest && ev.target.closest('[data-on-' + type + ']');
      if (el) run(el, el.getAttribute('data-on-' + type), ev);
    });
  });
  document.addEventListener('mouseenter', function (ev) {
    var el = ev.target;
    if (el.getAttribute && el.hasAttribute('data-on-mouseenter')) run(el, el.getAttribute('data-on-mouseenter'), ev);
  }, true);
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    var el = ev.target.closest && ev.target.closest('[data-on-activate]');
    if (!el) return;
    ev.preventDefault();
    run(el, el.getAttribute('data-on-activate'), ev);
  });
})();
