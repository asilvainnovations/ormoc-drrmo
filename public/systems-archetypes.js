/* Systems Archetype Explorer for Ormoc City DRRM (MODE).
 *
 * Follows the method of "Systems Archetype Basics: From Story to Structure" (D. H. Kim and V. Anderson,
 * Pegasus Communications; thesystemsthinker.com): for each of the eight archetypes, a story, the general
 * storyline, the behavior over time, the structure (causal loop diagram with R/B loops and delays) and
 * management guidelines. Template wording is paraphrased; the Ormoc stories are illustrations for the
 * validation workshop, not findings. The curves are illustrative shapes, not measured data.
 *
 * Runs under the site CSP (script-src 'self'): no inline handlers; everything is wired with listeners.
 * Mounts into every element with [data-archetype-explorer].
 */
(function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var M = 60; // months on the illustrative time axis
  var COLORS = { orange: '#D66812', blue: '#2F86C8', navy: '#13283D', green: '#1A7A4C', red: '#B42318', violet: '#6B4FA3' };

  // ---------------------------------------------------------------- curve helpers (t = month 0..60)
  function clamp(v) { return Math.max(0, Math.min(100, v)); }
  function ramp(t, a, b) { return t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a); }
  function logistic(t, mid, k) { return 1 / (1 + Math.exp(-k * (t - mid))); }
  function pulses(t, every, width) { var p = t % every; return p < width ? 1 - p / width : 0; }

  // ---------------------------------------------------------------- the eight archetypes
  var A = [
    {
      id: 'fixes', no: 1, name: 'Fixes That Fail', signature: 'A balancing loop, then a reinforcing loop',
      question: 'What will this fix do to us later, after the delay?',
      storyline: 'A problem shows up and a quick fix makes it go away for a while. The fix has a side effect that arrives later and makes the original problem return, often worse, which calls for the fix again.',
      story: [
        'During multi-barangay floods, incident complexity rises and field teams report delays. The quickest relief is for EOC staff to direct field units themselves, so the friction eases for that operational period.',
        'But each override blurs who commands in the field. Incident Commanders wait for the EOC, dispatches are duplicated, and the next event starts with more confusion than the last. IAT B6.1 (score 1, high priority) records that the ICS–EOC boundary is not yet codified.'
      ],
      look: 'The symptom dips each time the fix is applied, then comes back higher. Over time the trend rises.',
      nodes: [
        { id: 'p', x: 360, y: 80, t: 'Problem symptom', o: 'Command friction and delays', d: 'Delays and conflicting instructions in multi-agency response, felt at the EOC and in the field.' },
        { id: 'f', x: 150, y: 300, t: 'Fix', o: 'Direct EOC overrides of field tactics', d: 'EOC staff instruct field units directly to speed things up during an operational period.' },
        { id: 'u', x: 570, y: 300, t: 'Unintended consequence', o: 'Blurred ICS–EOC boundary', d: 'Incident Commanders lose authority, dispatches duplicate and handovers break down in the next event.' }
      ],
      links: [
        { f: 'p', t: 'f', s: '+', bend: -40 }, { f: 'f', t: 'p', s: '−', bend: -40 },
        { f: 'f', t: 'u', s: '+', delay: true, bend: 40 }, { f: 'u', t: 'p', s: '+', bend: 30 }
      ],
      loops: [
        { id: 'B1', type: 'B', x: 225, y: 175, links: [0, 1], t: 'Quick fix relieves the symptom', o: 'Override eases friction for now' },
        { id: 'R2', type: 'R', x: 470, y: 225, links: [2, 3, 0], t: 'Side effect revives the symptom', o: 'Confusion grows event after event' }
      ],
      bot: {
        series: [
          { key: 'symptom', label: 'Problem symptom', color: COLORS.orange,
            sq: function (t) { return clamp(38 + t * 0.75 - 22 * pulses(t + 3, 12, 6)); },
            lv: function (t) { return clamp(60 - 38 * ramp(t, 6, 30) - 10 * pulses(t + 3, 12, 6) * (1 - ramp(t, 6, 24))); } },
          { key: 'fix', label: 'Fix applied', color: COLORS.navy,
            sq: function (t) { return clamp(15 + 70 * pulses(t + 3, 12, 4)); },
            lv: function (t) { return clamp((15 + 70 * pulses(t + 3, 12, 4)) * (1 - ramp(t, 4, 20))); } }
        ]
      },
      guidelines: [
        'Write the symptom down apart from any solution, so the fix is not mistaken for the goal.',
        'Ask what the fix will cause later, and map those side effects before using it again.',
        'Where the pattern already runs, keep the quick fix only as long as it takes to build the lasting one.'
      ],
      manual: [
        { ref: 'SOP 4-05', text: 'Initial incident coordination and the EOC–ICS interface (PR-ICS-INTERFACE): the EOC supports; the IC commands.' },
        { ref: 'SOP 9-03', text: 'Annual exercise programme: drill the interface and time the handovers.' },
        { ref: 'SOP 7-04', text: 'After-action review: record overrides as findings, not as good practice.' }
      ]
    },
    {
      id: 'shifting', no: 2, name: 'Shifting the Burden', signature: 'Two balancing loops and a reinforcing side effect',
      question: 'Is a quick fix taking the place of the lasting solution?',
      storyline: 'A symptomatic solution relieves the problem quickly. A fundamental solution would solve it, but it takes longer. As the quick solution keeps working, the pressure for the fundamental one fades, and a side effect weakens the capacity to carry it out.',
      story: [
        'Rising workload and disruptions are met with event-by-event Executive Orders and casual or job-order staff. Each order works for that event.',
        'The lasting answer, an ordinance-based CDRRMO structure with plantilla positions under DBM-CSC-DILG JMC No. 2014-1, takes a Sanggunian process and a budget cycle. Every event the orders handle makes the ordinance look less urgent, and the City comes to rely on temporary arrangements.'
      ],
      look: 'The symptomatic solution rises unevenly while the fundamental solution declines: the two lines form an "X".',
      nodes: [
        { id: 'p', x: 360, y: 205, t: 'Problem symptom', o: 'Operational disruptions and workload', d: 'Peaks during events; carried by a small core staff.' },
        { id: 's', x: 360, y: 55, t: 'Symptomatic solution', o: 'Event-by-event EOs and casual staff', d: 'Fast and familiar; renewed for each event.' },
        { id: 'fs', x: 360, y: 355, t: 'Fundamental solution', o: 'Ordinance and plantilla (JMC 2014-1)', d: 'A permanent structure for the CDRRMO with funded positions.' },
        { id: 'se', x: 610, y: 205, t: 'Side effect', o: 'Less urgency for the ordinance', d: 'Temporary arrangements look sufficient, so the ordinance stalls.' }
      ],
      links: [
        { f: 'p', t: 's', s: '+', bend: -45 }, { f: 's', t: 'p', s: '−', bend: -45 },
        { f: 'p', t: 'fs', s: '+', bend: 45 }, { f: 'fs', t: 'p', s: '−', delay: true, bend: 45 },
        { f: 's', t: 'se', s: '+', bend: 20 }, { f: 'se', t: 'fs', s: '−', bend: 20 }
      ],
      loops: [
        { id: 'B1', type: 'B', x: 250, y: 130, links: [0, 1], t: 'Symptomatic relief', o: 'Orders handle each event' },
        { id: 'B2', type: 'B', x: 250, y: 285, links: [2, 3], t: 'Fundamental correction (delayed)', o: 'Ordinance solves it for good' },
        { id: 'R3', type: 'R', x: 500, y: 205, links: [4, 5, 3, 0], t: 'Dependence on the quick fix', o: 'Reliance on temporary arrangements' }
      ],
      bot: {
        series: [
          { key: 'sym', label: 'Symptomatic solution', color: COLORS.orange,
            sq: function (t) { return clamp(30 + 0.9 * t + 6 * Math.sin(t / 2)); },
            lv: function (t) { return clamp(35 + 18 * ramp(t, 0, 10) - 40 * ramp(t, 14, 42) + 4 * Math.sin(t / 2)); } },
          { key: 'fund', label: 'Fundamental solution', color: COLORS.blue,
            sq: function (t) { return clamp(70 - 0.85 * t); },
            lv: function (t) { return clamp(35 + 55 * logistic(t, 22, 0.18)); } },
          { key: 'symptom', label: 'Problem symptom', color: COLORS.red,
            sq: function (t) { return clamp(55 + 0.3 * t + 12 * Math.sin(t / 3)); },
            lv: function (t) { return clamp(60 - 30 * ramp(t, 10, 40) + 8 * Math.sin(t / 3) * (1 - ramp(t, 10, 40))); } }
        ]
      },
      guidelines: [
        'Keep the short-term relief, but put effort into the fundamental solution at the same time.',
        'Taper the quick fix as the lasting solution takes hold, and say when it will stop.',
        'When the pattern has become a habit, ask what need the habit is meeting.'
      ],
      manual: [
        { ref: 'Chapter 1', text: 'Legal mandate and the ordinance-based structure of the CDRRMO.' },
        { ref: 'Chapter 2', text: 'Organization, staffing and plantilla under JMC No. 2014-1.' },
        { ref: 'SOP 10-01', text: 'Annual sustainability review: SUS-F01 flags any instrument stalled for more than a year.' }
      ]
    },
    {
      id: 'limits', no: 3, name: 'Limits to Success', signature: 'A reinforcing loop, then a balancing loop',
      question: 'Are past efforts now giving less each year?',
      storyline: 'Effort produces results, and results encourage more effort. Growth slows because a limit starts to act, usually after a delay. Pushing harder on the effort does not help; the limit has to be found and addressed.',
      story: [
        'Barangay drills and public awareness sessions work: barangays that drill ask for more, and their example draws others in.',
        'The CDRRMO has a small training staff. As more barangays join, trainer time per barangay falls and refreshers lapse, so drill quality and readiness level off even though the number of sessions keeps rising.'
      ],
      look: 'Performance grows quickly, then levels off or slips in an S-shape, while effort keeps rising.',
      nodes: [
        { id: 'e', x: 120, y: 205, t: 'Efforts', o: 'Drills and awareness sessions', d: 'Sessions run by the CDRRMO with BDRRMCs and schools.' },
        { id: 'pf', x: 365, y: 205, t: 'Performance', o: 'Barangays with tested warning and drills', d: 'Barangays that have drilled and tested their warning arrangements.' },
        { id: 'la', x: 605, y: 205, t: 'Limiting action', o: 'Less trainer time per barangay', d: 'Lapsed refreshers and thinner coaching per barangay.' },
        { id: 'c', x: 605, y: 55, t: 'Constraint', o: 'CDRRMO training staff and budget', d: 'The size of the training team and its LDRRMFIP line.' }
      ],
      links: [
        { f: 'e', t: 'pf', s: '+', bend: -40 }, { f: 'pf', t: 'e', s: '+', bend: -40 },
        { f: 'pf', t: 'la', s: '+', delay: true, bend: -40 }, { f: 'la', t: 'pf', s: '−', bend: -40 },
        { f: 'c', t: 'la', s: '−', bend: 0 }
      ],
      loops: [
        { id: 'R1', type: 'R', x: 242, y: 205, links: [0, 1], t: 'Engine of growth', o: 'Success draws more barangays in' },
        { id: 'B2', type: 'B', x: 487, y: 205, links: [2, 3], t: 'Limiting process (delayed)', o: 'Trainer time runs out' }
      ],
      bot: {
        series: [
          { key: 'perf', label: 'Performance', color: COLORS.blue,
            sq: function (t) { return clamp(10 + 62 * logistic(t, 16, 0.25) - 10 * ramp(t, 34, 60)); },
            lv: function (t) { return clamp(10 + 80 * logistic(t, 22, 0.15)); } },
          { key: 'effort', label: 'Efforts', color: COLORS.orange,
            sq: function (t) { return clamp(12 + 1.3 * t); },
            lv: function (t) { return clamp(12 + 0.9 * t); } }
        ]
      },
      guidelines: [
        'Look for the limit before you reach it; assume there is one.',
        'Once growth stalls, do not push harder on the effort. Work on the limit instead.',
        'Invest in removing the limit early, while there is still time to do it.'
      ],
      manual: [
        { ref: 'SOP 9-01', text: 'Training needs analysis, skills inventory (CAP-F01) and the annual training plan.' },
        { ref: 'SOP 9-02', text: 'Training delivery and the refresher cycle (CAP-F03).' },
        { ref: 'SOP 9-06', text: 'Tiered BDRRMC support, with mentoring by higher-tier barangays to widen the limit.' }
      ]
    },
    {
      id: 'drifting', no: 4, name: 'Drifting Goals', signature: 'Two balancing loops around a goal',
      question: 'Are our standards slipping over time?',
      storyline: 'A gap between the goal and the actual condition can be closed in two ways: take corrective action, which takes time, or lower the goal, which is quick. When the goal is lowered again and again, performance slides with it.',
      story: [
        'The Institutional Assessment Tool shows mandatory compliance at about one-third (IAT v1.7). Closing that gap takes corrective actions that run for months.',
        'Meanwhile an informal standard settles in: "we responded". Each event that ends without a disaster makes the lower standard feel acceptable, and the statutory standard quietly stops being the measure.'
      ],
      look: 'The goal line drifts down toward the actual condition, which stays flat or slips too.',
      nodes: [
        { id: 'a', x: 125, y: 80, t: 'Actual condition', o: 'Mandatory compliance (IAT)', d: 'About one-third of mandatory indicators met at baseline (IAT v1.7).' },
        { id: 'g', x: 595, y: 80, t: 'Goal', o: 'Statutory standard', d: 'What RA 10121, RA 12287 and the Manual require.' },
        { id: 'gap', x: 360, y: 210, t: 'Gap', o: 'Compliance gap', d: 'Difference between the standard and what is in place.' },
        { id: 'ca', x: 125, y: 345, t: 'Corrective action', o: 'CAPA register actions', d: 'Corrective and preventive actions with owners and dates.' },
        { id: 'pr', x: 595, y: 345, t: 'Pressure to lower the goal', o: 'Informal norm: "we responded"', d: 'The working standard drifts to what was done last time.' }
      ],
      links: [
        { f: 'g', t: 'gap', s: '+', bend: 15 }, { f: 'gap', t: 'pr', s: '+', bend: 15 }, { f: 'pr', t: 'g', s: '−', bend: 30 },
        { f: 'gap', t: 'ca', s: '+', bend: 15 }, { f: 'ca', t: 'a', s: '+', delay: true, bend: 30 }, { f: 'a', t: 'gap', s: '−', bend: 15 }
      ],
      loops: [
        { id: 'B1', type: 'B', x: 215, y: 210, links: [3, 4, 5], t: 'Corrective action (delayed)', o: 'Close the gap with CAPA' },
        { id: 'B2', type: 'B', x: 505, y: 210, links: [0, 1, 2], t: 'Lowering the goal', o: 'Settle for "we responded"' }
      ],
      bot: {
        series: [
          { key: 'goal', label: 'Goal', color: COLORS.navy,
            sq: function (t) { return clamp(95 - 32 * ramp(t, 4, 50)); },
            lv: function (t) { return 95; } },
          { key: 'actual', label: 'Actual condition', color: COLORS.orange,
            sq: function (t) { return clamp(33 + 4 * Math.sin(t / 5) - 4 * ramp(t, 20, 60)); },
            lv: function (t) { return clamp(33 + 52 * logistic(t, 24, 0.14)); } }
        ]
      },
      guidelines: [
        'Name what is drifting and check whether goals compete with each other.',
        'Find out what really sets the goal: an outside standard, or past performance.',
        'Look at how gaps are corrected, and restate the standard each cycle so it cannot slide.'
      ],
      manual: [
        { ref: 'SOP 7-05', text: 'Corrective and preventive action (CAPA register): every gap has an owner and a date.' },
        { ref: 'SOP 7-01', text: 'LDRRMP monitoring and the annual results report against fixed targets.' },
        { ref: 'SOP 10-01', text: 'Annual sustainability review restates the standard (SUS-F02).' }
      ]
    },
    {
      id: 'underinvestment', no: 5, name: 'Growth and Underinvestment', signature: 'Limits to Success with an investment decision',
      question: 'Would investing earlier have kept the limit away?',
      storyline: 'Growth pushes demand up. Capacity is needed to keep performance up, but investment waits until the shortfall is obvious, and new capacity takes time to arrive. Performance drops, demand falls back, and the drop is taken as proof the investment was not needed.',
      story: [
        'The City has taken on new work: anticipatory action under RA 12287, plans for 85 barangays and a geospatial common operating picture.',
        'GIS, information management and M&E capacity grows only after shortfalls become visible, and positions take a budget cycle to fill. Service slows, requests drop, and the slower demand is read as a sign that the extra capacity can wait.'
      ],
      look: 'Demand and capacity move in cycles, with capacity lagging. Investment comes late and in steps.',
      nodes: [
        { id: 'ge', x: 115, y: 70, t: 'Growth effort', o: 'New mandates taken on', d: 'RA 12287 anticipatory action, barangay plans, Geo-COP.' },
        { id: 'd', x: 360, y: 70, t: 'Demand', o: 'Demand for technical DRRM services', d: 'Maps, risk analysis, SitReps and plan reviews requested of the CDRRMO.' },
        { id: 'pf', x: 360, y: 225, t: 'Performance', o: 'Service quality and timeliness', d: 'How fast and how well requests are met.' },
        { id: 'pn', x: 605, y: 225, t: 'Perceived need to invest', o: 'Felt need for GIS, IM and M&E staff', d: 'Recognised only when the shortfall shows.' },
        { id: 'cap', x: 605, y: 70, t: 'Capacity', o: 'Permanent technical capacity', d: 'Plantilla positions, systems and EOC equipment.' },
        { id: 'std', x: 605, y: 365, t: 'Performance standard', o: 'Required standard (IRR, Manual)', d: 'The service level the City has committed to.' }
      ],
      links: [
        { f: 'ge', t: 'd', s: '+', bend: -30 }, { f: 'd', t: 'ge', s: '+', bend: -30 },
        { f: 'd', t: 'pf', s: '−', bend: -30 }, { f: 'pf', t: 'd', s: '+', delay: true, bend: -30 },
        { f: 'pf', t: 'pn', s: '−', bend: 0 }, { f: 'pn', t: 'cap', s: '+', delay: true, bend: 0 }, { f: 'cap', t: 'pf', s: '+', bend: 0 },
        { f: 'std', t: 'pn', s: '+', bend: 0 }
      ],
      loops: [
        { id: 'R1', type: 'R', x: 237, y: 70, links: [0, 1], t: 'Engine of growth', o: 'New mandates raise demand' },
        { id: 'B2', type: 'B', x: 360, y: 147, links: [2, 3], t: 'Limit: capacity strain', o: 'Slow service dampens demand' },
        { id: 'B3', type: 'B', x: 520, y: 160, links: [4, 5, 6], t: 'Capacity investment (delayed)', o: 'Late hiring and equipment' }
      ],
      bot: {
        series: [
          { key: 'demand', label: 'Demand', color: COLORS.orange,
            sq: function (t) { return clamp(25 + 1.45 * Math.min(t, 24) - 20 * ramp(t, 24, 34) + 0.9 * Math.max(0, t - 34)); },
            lv: function (t) { return clamp(25 + 1.05 * t); } },
          { key: 'capacity', label: 'Capacity', color: COLORS.blue,
            sq: function (t) { return clamp(35 + 14 * ramp(t, 28, 32) + 12 * ramp(t, 50, 54)); },
            lv: function (t) { return clamp(35 + 10 * ramp(t, 2, 6) + 12 * ramp(t, 16, 20) + 14 * ramp(t, 30, 34) + 14 * ramp(t, 44, 48)); } },
          { key: 'need', label: 'Perceived need to invest', color: COLORS.violet,
            sq: function (t) { return clamp(15 + 55 * ramp(t, 12, 26) - 45 * ramp(t, 30, 40)); },
            lv: function (t) { return clamp(30 + 8 * Math.sin(t / 4)); } },
          { key: 'invest', label: 'Capacity investment', color: COLORS.green,
            sq: function (t) { return clamp(8 + 50 * pulses(t - 26, 100, 5) * (t >= 26 ? 1 : 0) + 40 * pulses(t - 48, 100, 5) * (t >= 48 ? 1 : 0)); },
            lv: function (t) { return clamp(8 + 35 * pulses(t, 14, 4)); } }
        ]
      },
      guidelines: [
        'Spot the likely limit early and decide what capacity growth will need.',
        'Check the assumptions behind each investment decision, and shorten the time it takes to see a shortfall.',
        'When demand falls, ask whether the market fell or the City\'s own service drove it away.'
      ],
      manual: [
        { ref: 'SOP 6-01', text: 'LDRRMF budget cycle: put capacity lines in the LDRRMFIP before the shortfall shows.' },
        { ref: 'SOP 7-01', text: 'Annual monitoring shortens the delay in seeing the gap.' },
        { ref: 'SOP 10-03', text: 'Digital continuity: backup, restore tests and access review for the systems the work runs on.' }
      ]
    },
    {
      id: 'success', no: 6, name: 'Success to the Successful', signature: 'Two reinforcing loops competing for one resource',
      question: 'Is a fixed resource being shared as if one side must win?',
      storyline: 'Two activities draw on the same limited resource. The one that does a little better early on gets more of it, which makes it do better still, while the other gets less and falls behind.',
      story: [
        'Barangays with active BDRRMCs run drills, file reports on time and win recognition. They are easy to work with, so they get the next training slots, equipment and visits.',
        'Barangays that start weaker get less attention and fall further behind. The gap between the two groups widens each year, though the weaker ones may be the more exposed.'
      ],
      look: 'The two lines diverge: one rises as the other falls.',
      nodes: [
        { id: 'al', x: 360, y: 210, t: 'Allocation to A instead of B', o: 'Support goes to active barangays', d: 'Training slots, equipment and staff time.' },
        { id: 'ra', x: 125, y: 70, t: 'Resources to A', o: 'Support to active BDRRMCs', d: '' },
        { id: 'sa', x: 595, y: 70, t: 'Success of A', o: 'Drills, reports, recognition (A)', d: '' },
        { id: 'rb', x: 125, y: 350, t: 'Resources to B', o: 'Support to weaker BDRRMCs', d: '' },
        { id: 'sb', x: 595, y: 350, t: 'Success of B', o: 'Readiness of weaker barangays (B)', d: '' }
      ],
      links: [
        { f: 'al', t: 'ra', s: '+', bend: -15 }, { f: 'ra', t: 'sa', s: '+', bend: -15 }, { f: 'sa', t: 'al', s: '+', bend: -15 },
        { f: 'al', t: 'rb', s: '−', bend: 15 }, { f: 'rb', t: 'sb', s: '+', bend: 15 }, { f: 'sb', t: 'al', s: '−', bend: 15 }
      ],
      loops: [
        { id: 'R1', type: 'R', x: 360, y: 105, links: [0, 1, 2], t: 'Success of A breeds resources', o: 'Active barangays get more' },
        { id: 'R2', type: 'R', x: 360, y: 315, links: [3, 4, 5], t: 'Decline of B justifies A', o: 'Weaker barangays fall behind' }
      ],
      bot: {
        series: [
          { key: 'a', label: 'Success of A', color: COLORS.blue,
            sq: function (t) { return clamp(52 + 35 * ramp(t, 0, 50)); },
            lv: function (t) { return clamp(52 + 25 * ramp(t, 0, 50)); } },
          { key: 'b', label: 'Success of B', color: COLORS.orange,
            sq: function (t) { return clamp(45 - 30 * ramp(t, 0, 50)); },
            lv: function (t) { return clamp(45 + 30 * ramp(t, 6, 50)); } }
        ]
      },
      guidelines: [
        'Look at how the allocation decision is made and what counts as success.',
        'List what each party can do, so early winners are not mistaken for the only capable ones.',
        'Decide what result is wanted overall, then allocate to reach it rather than to reward.'
      ],
      manual: [
        { ref: 'SOP 9-06', text: 'BDRRMC functionality assessment (CAP-F06) and tiered support, low tier first.' },
        { ref: 'SOP 9-01', text: 'Training plan built from measured needs, not from who asks first.' },
        { ref: 'SOP 10-05', text: 'Recognition systems: use results to find gaps, not only to reward.' }
      ]
    },
    {
      id: 'escalation', no: 7, name: 'Escalation', signature: 'Two balancing loops that form one reinforcing loop',
      question: 'Are the parties reading each other\'s moves as threats?',
      storyline: 'Each party acts to stay ahead of the other. Every move makes the other feel threatened, so it responds, which prompts a further response. Neither side meant to escalate, but together they do.',
      story: [
        'After an event, relief is shared out according to reported needs. If one barangay believes another reported high to get a larger share, it may report high too.',
        'Each round of higher reports makes the others look short-changed, and the figures drift away from verified needs. This is a pattern to check during validation, not a finding.'
      ],
      look: 'Both parties\' activity climbs in alternating steps; neither stays ahead for long.',
      nodes: [
        { id: 'aa', x: 125, y: 75, t: 'Activity by A', o: 'Needs reported by barangay A', d: '' },
        { id: 'ra', x: 125, y: 340, t: 'Results of A', o: 'Relief allocated to A', d: '' },
        { id: 'rel', x: 360, y: 210, t: 'Results of A relative to B', o: 'A\'s share relative to B', d: 'What each side watches.' },
        { id: 'rb', x: 595, y: 340, t: 'Results of B', o: 'Relief allocated to B', d: '' },
        { id: 'ab', x: 595, y: 75, t: 'Activity by B', o: 'Needs reported by barangay B', d: '' }
      ],
      links: [
        { f: 'aa', t: 'ra', s: '+', bend: 25 }, { f: 'ra', t: 'rel', s: '+', bend: 15 }, { f: 'rel', t: 'aa', s: '−', bend: 15 },
        { f: 'ab', t: 'rb', s: '+', bend: -25 }, { f: 'rb', t: 'rel', s: '−', bend: -15 }, { f: 'rel', t: 'ab', s: '+', bend: -15 }
      ],
      loops: [
        { id: 'B1', type: 'B', x: 215, y: 210, links: [0, 1, 2], t: 'A acts when it falls behind', o: 'A reports higher' },
        { id: 'B2', type: 'B', x: 505, y: 210, links: [3, 4, 5], t: 'B acts when it falls behind', o: 'B reports higher' }
      ],
      bot: {
        series: [
          { key: 'a', label: 'Activity by A', color: COLORS.blue,
            sq: function (t) { return clamp(20 + 12 * Math.floor((t + 6) / 12) + 6 * ramp((t + 6) % 12, 0, 3)); },
            lv: function (t) { return clamp(Math.min(20 + 12 * Math.floor((t + 6) / 12) + 6 * ramp((t + 6) % 12, 0, 3), 38)); } },
          { key: 'b', label: 'Activity by B', color: COLORS.orange,
            sq: function (t) { return clamp(20 + 12 * Math.floor(t / 12) + 6 * ramp(t % 12, 0, 3)); },
            lv: function (t) { return clamp(Math.min(20 + 12 * Math.floor(t / 12) + 6 * ramp(t % 12, 0, 3), 35)); } }
        ]
      },
      guidelines: [
        'One side can stop the spiral by not responding in kind; that removes the threat the other reacts to.',
        'Change what is compared: move the contest to a shared measure, such as verified needs met.',
        'Check whether incentives reward outdoing others, and set a common goal both sides serve.'
      ],
      manual: [
        { ref: 'SOP 4-08', text: 'SitRep cycle: one validated set of figures for all users.' },
        { ref: 'SOP 5-02', text: 'Damage and needs assessment: RDANA figures verified before allocation.' },
        { ref: 'SOP 4-07', text: 'Resource requests through one EOC queue with stated priorities.' }
      ]
    },
    {
      id: 'commons', no: 8, name: 'Tragedy of the Commons', signature: 'Reinforcing activity loops with a delayed shared limit',
      question: 'Who governs the shared resource?',
      storyline: 'Several users each gain from drawing on a shared resource. Each one\'s use looks small, so all keep increasing it. The combined use outruns what the resource can supply, and after a delay everyone\'s gain falls, sometimes suddenly.',
      story: [
        'During an activation, many offices and clusters draw on the same pool of response assets: vehicles, boats, fuel and the EOC\'s own staff time. Each request makes sense for that office\'s mission.',
        'Taken together, the requests outrun the pool. Assets are tied up, fuel runs short and urgent tasks wait. Without one queue and agreed priorities, each office asks for more to be safe, which drains the pool faster.'
      ],
      look: 'Total use rises while the resource holds, then the resource falls slowly, then quickly; use collapses with it.',
      nodes: [
        { id: 'na', x: 125, y: 60, t: 'Net gains for A', o: 'Office A\'s mission met', d: '' },
        { id: 'ua', x: 380, y: 60, t: 'A\'s activity', o: 'Requests by office A', d: '' },
        { id: 'nb', x: 125, y: 360, t: 'Net gains for B', o: 'Office B\'s mission met', d: '' },
        { id: 'ub', x: 380, y: 360, t: 'B\'s activity', o: 'Requests by office B', d: '' },
        { id: 'tot', x: 610, y: 210, t: 'Total activity', o: 'All requests on the pool', d: '' },
        { id: 'res', x: 380, y: 210, t: 'Resource available', o: 'Shared pool of response assets', d: 'Vehicles, boats, fuel, EOC staff time.' },
        { id: 'gpa', x: 125, y: 210, t: 'Gain per activity', o: 'What each request achieves', d: '' }
      ],
      links: [
        { f: 'na', t: 'ua', s: '+', bend: -22 }, { f: 'ua', t: 'na', s: '+', bend: -22 },
        { f: 'nb', t: 'ub', s: '+', bend: 22 }, { f: 'ub', t: 'nb', s: '+', bend: 22 },
        { f: 'ua', t: 'tot', s: '+', bend: 0 }, { f: 'ub', t: 'tot', s: '+', bend: 0 },
        { f: 'tot', t: 'res', s: '−', delay: true, bend: 0 }, { f: 'res', t: 'gpa', s: '+', bend: 0 },
        { f: 'gpa', t: 'na', s: '+', bend: 0 }, { f: 'gpa', t: 'nb', s: '+', bend: 0 }
      ],
      loops: [
        { id: 'R1', type: 'R', x: 252, y: 60, links: [0, 1], t: 'A gains, so A does more', o: 'A asks for more' },
        { id: 'R2', type: 'R', x: 252, y: 360, links: [2, 3], t: 'B gains, so B does more', o: 'B asks for more' },
        { id: 'B5', type: 'B', x: 300, y: 135, links: [4, 6, 7, 8, 0], t: 'Shared limit on A (delayed)', o: 'Pool runs down for A' },
        { id: 'B6', type: 'B', x: 300, y: 285, links: [5, 6, 7, 9, 2], t: 'Shared limit on B (delayed)', o: 'Pool runs down for B' }
      ],
      bot: {
        phases: [{ at: 0, label: 'I. Stable' }, { at: 22, label: 'II. Gradual decline' }, { at: 40, label: 'III. Rapid decline' }],
        series: [
          { key: 'res', label: 'Resource available', color: COLORS.green,
            sq: function (t) { return clamp(90 - 18 * ramp(t, 22, 40) - 55 * ramp(t, 40, 52)); },
            lv: function (t) { return clamp(90 - 15 * ramp(t, 22, 36) + 8 * ramp(t, 36, 50)); } },
          { key: 'tot', label: 'Total activity', color: COLORS.orange,
            sq: function (t) { return clamp(20 + 55 * ramp(t, 0, 44) - 50 * ramp(t, 48, 58)); },
            lv: function (t) { return clamp(20 + 40 * ramp(t, 0, 30)); } },
          { key: 'gpa', label: 'Gain per activity', color: COLORS.blue,
            sq: function (t) { return clamp(75 - 15 * ramp(t, 20, 40) - 45 * ramp(t, 40, 52)); },
            lv: function (t) { return clamp(75 - 10 * ramp(t, 20, 34) + 5 * ramp(t, 34, 50)); } }
        ]
      },
      guidelines: [
        'Find out what each user gains, and how quickly, since fast rewards are the hardest to give up.',
        'Estimate how long the resource will last and make the future loss visible now.',
        'Agree, with all users, what the commons is and its limits; then set up a way to govern its use.'
      ],
      manual: [
        { ref: 'SOP 6-12', text: 'Resource inventory and pre-arranged commitments (LOG-F03): know the size of the pool.' },
        { ref: 'SOP 4-07', text: 'Resource requests through one EOC queue; the EOC Manager sets priorities.' },
        { ref: 'SOP 8-02', text: 'Mutual aid widens the pool before it runs out.' }
      ]
    }
  ];

  // ---------------------------------------------------------------- DOM helpers
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === 'text') el.textContent = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) el.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  function s(tag, attrs, kids) {
    var el = document.createElementNS(SVGNS, tag);
    for (var k in attrs || {}) { if (k === 'text') el.textContent = attrs[k]; else el.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { if (c) el.appendChild(c); });
    return el;
  }
  function wrap(label, max) {
    var words = label.split(' '), lines = [''];
    words.forEach(function (w) {
      var cur = lines[lines.length - 1];
      if ((cur + ' ' + w).trim().length > max && cur) lines.push(w); else lines[lines.length - 1] = (cur + ' ' + w).trim();
    });
    return lines;
  }

  // ---------------------------------------------------------------- causal loop diagram
  var NW = 176, NH = 58; // node box
  function edgePoint(c, toward) { // where the ray from the centre c toward a point leaves the box
    var dx = toward.x - c.x, dy = toward.y - c.y;
    if (!dx && !dy) return { x: c.x, y: c.y };
    var tx = dx ? (NW / 2 + 4) / Math.abs(dx) : Infinity, ty = dy ? (NH / 2 + 4) / Math.abs(dy) : Infinity, k = Math.min(tx, ty);
    return { x: c.x + dx * k, y: c.y + dy * k };
  }
  function linkGeom(a, b, bend) {
    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    var cp = { x: mx - (dy / len) * bend * 2, y: my + (dx / len) * bend * 2 };
    var p0 = edgePoint(a, cp), p2 = edgePoint(b, cp);
    function at(t) { var u = 1 - t; return { x: u * u * p0.x + 2 * u * t * cp.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * cp.y + t * t * p2.y }; }
    function tan(t) { var x = 2 * (1 - t) * (cp.x - p0.x) + 2 * t * (p2.x - cp.x), y = 2 * (1 - t) * (cp.y - p0.y) + 2 * t * (p2.y - cp.y), l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; }
    return { d: 'M' + p0.x + ',' + p0.y + ' Q' + cp.x + ',' + cp.y + ' ' + p2.x + ',' + p2.y, at: at, tan: tan };
  }

  function drawCld(arch, svg, state, onSelect) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var uid = 'ax-arrow-' + arch.id;
    svg.appendChild(s('defs', {}, [s('marker', { id: uid, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' },
      [s('path', { d: 'M0,0 L10,5 L0,10 z', fill: '#425B73' })])]));
    var pos = {}; arch.nodes.forEach(function (n) { pos[n.id] = n; });
    var active = state.loop ? arch.loops.filter(function (l) { return l.id === state.loop; })[0] : null;
    var hotLinks = active ? active.links : [];
    var selNode = state.node;
    var gLinks = s('g'), gLoops = s('g'), gNodes = s('g');
    arch.links.forEach(function (ln, i) {
      var g = linkGeom(pos[ln.f], pos[ln.t], ln.bend || 0);
      var cls = 'ax-link';
      if (active) cls += hotLinks.indexOf(i) >= 0 ? (active.type === 'R' ? ' is-hot' : ' is-hot-B') : ' ax-dim';
      else if (selNode) cls += (ln.f === selNode || ln.t === selNode) ? ' is-hot' : ' ax-dim';
      var grp = s('g', { class: cls });
      grp.appendChild(s('path', { class: 'ax-edge', d: g.d, 'marker-end': 'url(#' + uid + ')' }));
      var p = g.at(0.84), tg = g.tan(0.84), side = (ln.bend || 0) >= 0 ? 1 : -1;
      grp.appendChild(s('text', { class: 'ax-pol', x: p.x - tg.y * 13 * side, y: p.y + tg.x * 13 * side + 5, 'text-anchor': 'middle', text: ln.s }));
      if (ln.delay) {
        var m = g.at(0.5), t2 = g.tan(0.5), n = { x: -t2.y, y: t2.x };
        [-4, 4].forEach(function (off) {
          var cx = m.x + t2.x * off, cy = m.y + t2.y * off;
          grp.appendChild(s('line', { class: 'ax-delay', x1: cx - n.x * 9, y1: cy - n.y * 9, x2: cx + n.x * 9, y2: cy + n.y * 9 }));
        });
        grp.appendChild(s('title', { text: 'Delay' }));
      }
      gLinks.appendChild(grp);
    });
    arch.loops.forEach(function (lp) {
      var dim = active && active.id !== lp.id;
      var g = s('g', { class: 'ax-loop ax-loop--' + lp.type + (dim ? ' ax-dim' : ''), tabindex: '0', role: 'button',
        'aria-label': lp.id + ': ' + (state.labels === 'ormoc' ? lp.o : lp.t), 'data-loop': lp.id });
      g.appendChild(s('path', { d: 'M' + (lp.x + 17) + ',' + (lp.y - 6) + ' A18,18 0 1,1 ' + (lp.x + 10) + ',' + (lp.y - 15) }));
      g.appendChild(s('path', { d: 'M' + (lp.x + 10) + ',' + (lp.y - 15) + ' l7,-2 M' + (lp.x + 10) + ',' + (lp.y - 15) + ' l1,7' }));
      g.appendChild(s('text', { x: lp.x, y: lp.y + 5, 'text-anchor': 'middle', text: lp.id }));
      g.appendChild(s('title', { text: lp.id + ' (' + (lp.type === 'R' ? 'reinforcing' : 'balancing') + '): ' + (state.labels === 'ormoc' ? lp.o : lp.t) }));
      gLoops.appendChild(g);
    });
    arch.nodes.forEach(function (n) {
      var label = state.labels === 'ormoc' ? n.o : n.t;
      var lines = wrap(label, 20);
      var g = s('g', { class: 'ax-node' + (selNode === n.id ? ' is-selected' : '') + (active && !active.links.some(function (i) { return arch.links[i].f === n.id || arch.links[i].t === n.id; }) ? ' ax-dim' : ''),
        tabindex: '0', role: 'button', 'aria-label': label, 'data-node': n.id });
      g.appendChild(s('rect', { x: n.x - NW / 2, y: n.y - NH / 2, width: NW, height: NH, rx: 12 }));
      lines.forEach(function (l, i) {
        g.appendChild(s('text', { x: n.x, y: n.y + 4 + (i - (lines.length - 1) / 2) * 15, 'text-anchor': 'middle', text: l }));
      });
      gNodes.appendChild(g);
    });
    svg.appendChild(gLinks); svg.appendChild(gLoops); svg.appendChild(gNodes);
    svg.onclick = null;
    function pick(ev) {
      var t = ev.target.closest && ev.target.closest('[data-node],[data-loop]');
      if (!t) return;
      if (ev.type === 'keydown') { if (ev.key !== 'Enter' && ev.key !== ' ') return; ev.preventDefault(); }
      onSelect(t.getAttribute('data-node'), t.getAttribute('data-loop'));
    }
    if (!svg._axBound) { svg.addEventListener('click', function (e) { svg._axPick(e); }); svg.addEventListener('keydown', function (e) { svg._axPick(e); }); svg._axBound = true; }
    svg._axPick = pick;
  }

  // ---------------------------------------------------------------- behavior over time
  var BW = 640, BH = 300, PL = 44, PR = 14, PT = 26, PB = 34;
  function xOf(m) { return PL + (m / M) * (BW - PL - PR); }
  function yOf(v) { return PT + (1 - v / 100) * (BH - PT - PB); }
  function drawBot(arch, svg, state) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    [0, 25, 50, 75, 100].forEach(function (v) {
      svg.appendChild(s('line', { class: 'ax-gridline', x1: PL, x2: BW - PR, y1: yOf(v), y2: yOf(v) }));
      svg.appendChild(s('text', { class: 'ax-axis', x: PL - 6, y: yOf(v) + 4, 'text-anchor': 'end', text: v === 0 ? 'Low' : v === 100 ? 'High' : '' }));
    });
    [0, 12, 24, 36, 48, 60].forEach(function (m) {
      svg.appendChild(s('text', { class: 'ax-axis', x: xOf(m), y: BH - 12, 'text-anchor': 'middle', text: m === 0 ? 'Now' : m / 12 + ' yr' }));
    });
    (arch.bot.phases || []).forEach(function (ph) {
      svg.appendChild(s('line', { class: 'ax-gridline', x1: xOf(ph.at), x2: xOf(ph.at), y1: PT - 6, y2: BH - PB, 'stroke-dasharray': '2 4' }));
      svg.appendChild(s('text', { class: 'ax-phase', x: xOf(ph.at) + 4, y: PT - 10, text: ph.label }));
    });
    var upto = Math.round(state.month);
    arch.bot.series.forEach(function (se) {
      if (state.hidden[se.key]) return;
      var fn = state.leverage ? se.lv : se.sq, pts = [];
      for (var m = 0; m <= (state.reveal ? upto : M); m++) pts.push(xOf(m).toFixed(1) + ',' + yOf(fn(m)).toFixed(1));
      if (pts.length > 1) svg.appendChild(s('polyline', { class: 'ax-series', points: pts.join(' '), stroke: se.color }));
      if (state.leverage && !state.reveal) { // faint status-quo line for comparison
        var q = []; for (var k = 0; k <= M; k++) q.push(xOf(k).toFixed(1) + ',' + yOf(se.sq(k)).toFixed(1));
        svg.appendChild(s('polyline', { class: 'ax-series', points: q.join(' '), stroke: se.color, opacity: '0.28', 'stroke-dasharray': '5 4' }));
      }
    });
    svg.appendChild(s('line', { class: 'ax-cursor', x1: xOf(upto), x2: xOf(upto), y1: PT - 4, y2: BH - PB }));
    arch.bot.series.forEach(function (se) {
      if (state.hidden[se.key]) return;
      var fn = state.leverage ? se.lv : se.sq;
      svg.appendChild(s('circle', { cx: xOf(upto), cy: yOf(fn(upto)), r: 4.5, fill: se.color, stroke: '#fff', 'stroke-width': 1.5 }));
    });
  }

  // ---------------------------------------------------------------- one explorer
  function mount(root) {
    root.classList.add('ax-root');
    var state = { i: 0, labels: 'ormoc', loop: null, node: null, leverage: false, month: 60, hidden: {}, reveal: false, timer: null };
    var startId = (location.hash.match(/archetype=([a-z]+)/) || [])[1];
    A.forEach(function (a, i) { if (a.id === startId) state.i = i; });

    var intro = h('div', { class: 'ax-intro' }, [
      h('p', { text: 'Eight systems archetypes, each read from story to structure: the story, the general storyline, the behavior over time, the causal loop structure, and how to manage it. Ormoc stories are illustrations to test at the validation workshop; curves show shapes, not measured data.' }),
      h('ol', { class: 'ax-method', 'aria-label': 'Method' }, ['Story', 'Storyline', 'Behavior over time', 'Structure', 'Guidelines'].map(function (t) { return h('li', { text: t }); }))
    ]);
    var tabs = h('div', { class: 'ax-tabs', role: 'tablist', 'aria-label': 'Systems archetypes' });
    A.forEach(function (a, i) {
      tabs.appendChild(h('button', { type: 'button', class: 'ax-tab', role: 'tab', id: root.id + '-tab-' + a.id, 'aria-selected': 'false', 'data-i': String(i), tabindex: '-1' }, [
        h('span', { class: 'ax-tab-no', text: 'Archetype ' + a.no }), h('span', { class: 'ax-tab-name', text: a.name }), h('span', { class: 'ax-tab-sig', text: a.signature })
      ]));
    });
    var panel = h('section', { class: 'ax-card', role: 'tabpanel', 'aria-live': 'polite' });
    root.appendChild(intro); root.appendChild(tabs); root.appendChild(panel);
    root.appendChild(h('p', { class: 'ax-sources' }, [
      'Method and archetype templates: D. H. Kim and V. Anderson, ',
      h('a', { href: 'https://thesystemsthinker.com/wp-content/uploads/2016/03/Systems-Archetypes-Basics-WB002E.pdf', target: '_blank', rel: 'noopener noreferrer', text: 'Systems Archetype Basics: From Story to Structure' }),
      ' (Pegasus Communications). Wording here is paraphrased. Ormoc illustrations and Manual references: MODE, Consolidated Draft 1.0.'
    ]));

    tabs.addEventListener('click', function (e) { var b = e.target.closest('.ax-tab'); if (b) select(+b.getAttribute('data-i'), true); });
    tabs.addEventListener('keydown', function (e) {
      var d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (e.key === 'Home') d = -state.i; if (e.key === 'End') d = A.length - 1 - state.i;
      if (d === undefined) return;
      e.preventDefault(); select((state.i + d + A.length) % A.length, true);
    });

    function select(i, focus) {
      stop();
      state.i = i; state.loop = null; state.node = null; state.leverage = false; state.month = 60; state.hidden = {}; state.reveal = false;
      Array.prototype.forEach.call(tabs.children, function (b, k) {
        b.setAttribute('aria-selected', k === i ? 'true' : 'false'); b.setAttribute('tabindex', k === i ? '0' : '-1');
        if (k === i && focus) b.focus();
      });
      panel.setAttribute('aria-labelledby', root.id + '-tab-' + A[i].id);
      render();
    }
    function stop() { if (state.timer) { clearInterval(state.timer); state.timer = null; } }

    function render() {
      var a = A[state.i];
      while (panel.firstChild) panel.removeChild(panel.firstChild);
      var badges = h('div', { class: 'ax-badges' }, a.loops.map(function (l) { return h('span', { class: 'ax-badge ax-badge--' + l.type, text: l.id + ' ' + (l.type === 'R' ? 'reinforcing' : 'balancing') }); })
        .concat(a.links.some(function (l) { return l.delay; }) ? [h('span', { class: 'ax-badge', text: '‖ delay' })] : []));
      panel.appendChild(h('div', { class: 'ax-head' }, [
        h('div', {}, [h('h3', { text: 'Archetype ' + a.no + ': ' + a.name }), h('p', { class: 'ax-question', text: 'Key question: ' + a.question })]), badges
      ]));

      var left = h('div', { class: 'ax-step' }, [
        h('h4', { class: 'ax-step-title' }, [h('span', { text: '1' }), 'Story: An Ormoc Illustration']),
        h('p', { class: 'ax-hyp', text: 'Hypothesis for the validation workshop, not a finding' })
      ].concat(a.story.map(function (p) { return h('p', { text: p }); })).concat([
        h('h4', { class: 'ax-step-title' }, [h('span', { text: '2' }), 'Storyline']),
        h('p', { text: a.storyline })
      ]));

      // 3. behavior over time
      var legend = h('div', { class: 'ax-legend', role: 'group', 'aria-label': 'Show or hide a variable' });
      a.bot.series.forEach(function (se) {
        legend.appendChild(h('button', { type: 'button', 'aria-pressed': state.hidden[se.key] ? 'false' : 'true', 'data-key': se.key },
          [h('span', { class: 'ax-swatch', style: 'background:' + se.color }), se.label]));
      });
      var seg = h('div', { class: 'ax-seg', role: 'group', 'aria-label': 'Scenario' }, [
        h('button', { type: 'button', 'aria-pressed': String(!state.leverage), 'data-lev': '0', text: 'Pattern as is' }),
        h('button', { type: 'button', 'aria-pressed': String(state.leverage), 'data-lev': '1', text: 'With leverage action' })
      ]);
      var play = h('button', { type: 'button', class: 'ax-chip', text: 'Play' });
      var bot = s('svg', { class: 'ax-svg', viewBox: '0 0 ' + BW + ' ' + BH, role: 'img', 'aria-label': 'Behavior over time: ' + a.bot.series.map(function (x) { return x.label; }).join(', ') });
      var scrub = h('input', { class: 'ax-scrub', type: 'range', min: '0', max: String(M), step: '1', value: String(state.month), 'aria-label': 'Time' });
      var readout = h('div', { class: 'ax-readout', 'aria-live': 'polite' });
      var right = h('div', { class: 'ax-step' }, [
        h('h4', { class: 'ax-step-title' }, [h('span', { text: '3' }), 'Behavior Over Time']),
        h('p', { text: a.look }),
        h('div', { class: 'ax-toolbar' }, [seg, play]), legend, bot, scrub, readout,
        h('p', { class: 'ax-note', text: 'Illustrative shapes over five years. Drag the slider or move over the chart to read values. "With leverage action" shows the intended shape, with the pattern as is dashed behind it.' })
      ]);
      function redrawBot() {
        drawBot(a, bot, state);
        var m = Math.round(state.month);
        while (readout.firstChild) readout.removeChild(readout.firstChild);
        readout.appendChild(h('span', {}, [h('b', { text: m === 0 ? 'Now' : 'Month ' + m })]));
        a.bot.series.forEach(function (se) {
          if (state.hidden[se.key]) return;
          readout.appendChild(h('span', {}, [se.label + ': ', h('b', { text: String(Math.round((state.leverage ? se.lv : se.sq)(m))) })]));
        });
      }
      seg.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; state.leverage = b.getAttribute('data-lev') === '1'; Array.prototype.forEach.call(seg.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); }); redrawBot(); });
      legend.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; var k = b.getAttribute('data-key'); state.hidden[k] = !state.hidden[k]; b.setAttribute('aria-pressed', String(!state.hidden[k])); redrawBot(); });
      scrub.addEventListener('input', function () { stop(); state.reveal = false; play.textContent = 'Play'; state.month = +scrub.value; redrawBot(); });
      bot.addEventListener('pointermove', function (e) {
        if (state.timer) return;
        var r = bot.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * BW;
        state.month = Math.max(0, Math.min(M, Math.round((x - PL) / (BW - PL - PR) * M))); scrub.value = String(state.month); redrawBot();
      });
      play.addEventListener('click', function () {
        if (state.timer) { stop(); play.textContent = 'Play'; return; }
        state.reveal = true; state.month = 0; play.textContent = 'Pause';
        state.timer = setInterval(function () {
          state.month += 1; scrub.value = String(state.month); redrawBot();
          if (state.month >= M) { stop(); state.reveal = false; play.textContent = 'Play'; redrawBot(); }
        }, 60);
      });

      // 4. structure
      var labelSeg = h('div', { class: 'ax-seg', role: 'group', 'aria-label': 'Labels' }, [
        h('button', { type: 'button', 'aria-pressed': String(state.labels === 'template'), 'data-l': 'template', text: 'Template' }),
        h('button', { type: 'button', 'aria-pressed': String(state.labels === 'ormoc'), 'data-l': 'ormoc', text: 'Ormoc' })
      ]);
      var loopChips = h('div', { class: 'ax-toolbar', role: 'group', 'aria-label': 'Trace a loop' }, a.loops.map(function (l) {
        return h('button', { type: 'button', class: 'ax-chip ax-chip--' + l.type, 'aria-pressed': 'false', 'data-loop': l.id, text: l.id });
      }));
      var cld = s('svg', { class: 'ax-svg', viewBox: '0 0 720 420', role: 'group', 'aria-label': 'Causal loop diagram of ' + a.name });
      var detail = h('div', { class: 'ax-detail', 'aria-live': 'polite' });
      function showDetail() {
        while (detail.firstChild) detail.removeChild(detail.firstChild);
        if (state.loop) {
          var l = a.loops.filter(function (x) { return x.id === state.loop; })[0];
          detail.appendChild(h('strong', { text: l.id + ' · ' + (l.type === 'R' ? 'Reinforcing' : 'Balancing') + ' loop' }));
          detail.appendChild(h('span', { text: 'Template: ' + l.t + '. In Ormoc: ' + l.o + '.' }));
        } else if (state.node) {
          var n = a.nodes.filter(function (x) { return x.id === state.node; })[0];
          detail.appendChild(h('strong', { text: n.t + ' → ' + n.o }));
          var ins = a.links.filter(function (l) { return l.t === n.id; }).map(function (l) { return nodeName(l.f) + ' (' + l.s + (l.delay ? ', delayed' : '') + ')'; });
          var outs = a.links.filter(function (l) { return l.f === n.id; }).map(function (l) { return nodeName(l.t) + ' (' + l.s + (l.delay ? ', delayed' : '') + ')'; });
          if (n.d) detail.appendChild(h('span', { text: n.d + ' ' }));
          detail.appendChild(h('span', { text: 'Driven by: ' + (ins.join('; ') || 'outside the diagram') + '. Drives: ' + (outs.join('; ') || 'nothing shown') + '.' }));
        } else {
          detail.appendChild(h('span', { text: 'Select a variable or a loop marker to trace it. "+" means the two move the same way; "−" means they move in opposite ways; ‖ marks a delay.' }));
        }
      }
      function nodeName(id) { var n = a.nodes.filter(function (x) { return x.id === id; })[0]; return state.labels === 'ormoc' ? n.o : n.t; }
      function redrawCld() {
        drawCld(a, cld, state, function (node, loop) {
          if (loop) { state.loop = state.loop === loop ? null : loop; state.node = null; }
          else { state.node = state.node === node ? null : node; state.loop = null; }
          Array.prototype.forEach.call(loopChips.children, function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-loop') === state.loop)); });
          redrawCld();
        });
        showDetail();
      }
      labelSeg.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; state.labels = b.getAttribute('data-l'); Array.prototype.forEach.call(labelSeg.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); }); redrawCld(); });
      loopChips.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var id = b.getAttribute('data-loop'); state.loop = state.loop === id ? null : id; state.node = null;
        Array.prototype.forEach.call(loopChips.children, function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-loop') === state.loop)); });
        redrawCld();
      });
      var structure = h('div', { class: 'ax-step' }, [
        h('h4', { class: 'ax-step-title' }, [h('span', { text: '4' }), 'Structure: Causal Loop Diagram']),
        h('div', { class: 'ax-toolbar' }, [labelSeg, loopChips]), cld, detail
      ]);

      // 5. guidelines
      var guide = h('div', { class: 'ax-step' }, [
        h('h4', { class: 'ax-step-title' }, [h('span', { text: '5' }), 'Management Guidelines']),
        h('ul', { class: 'ax-list' }, a.guidelines.map(function (g) { return h('li', { text: g }); })),
        h('h4', { text: 'Where the Manual Acts' }),
        h('ul', { class: 'ax-list' }, a.manual.map(function (m) { return h('li', {}, [h('span', { class: 'ax-ref', text: m.ref }), ' ' + m.text]); })),
        h('details', { class: 'ax-activity' }, [
          h('summary', { text: 'Your Turn: Map an Ormoc Story' }),
          h('ol', {}, [
            ['Summarise the theme in one sentence.', 'theme'], ['Name the key variables (nouns that can rise or fall).', 'vars'],
            ['Sketch how they behave over time.', 'bot'], ['Draw the loops: which are R, which are B, where are the delays?', 'loops']
          ].map(function (q) { var id = root.id + '-' + a.id + '-' + q[1]; return h('li', {}, [h('label', { for: id, text: q[0] }), h('textarea', { id: id })]); })),
          h('p', { class: 'ax-note', text: 'Notes stay on this screen only; nothing is saved or sent.' })
        ])
      ]);

      panel.appendChild(h('div', { class: 'ax-grid' }, [left, right]));
      panel.appendChild(h('div', { class: 'ax-grid', style: 'margin-top:1rem' }, [structure, guide]));
      redrawBot(); redrawCld();
      if (history.replaceState && root.hasAttribute('data-hash')) history.replaceState(null, '', '#archetype=' + a.id);
    }
    select(state.i, false);
  }

  function init() {
    var roots = document.querySelectorAll('[data-archetype-explorer]');
    Array.prototype.forEach.call(roots, function (r, i) { if (!r.id) r.id = 'ax' + i; mount(r); });
  }
  window.SystemsArchetypes = { list: A.map(function (a) { return { id: a.id, no: a.no, name: a.name }; }) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
