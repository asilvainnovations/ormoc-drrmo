export const DOC_STATUS: Record<string, string> = { draft: 'Draft', in_review: 'For validation', approved: 'Approved', superseded: 'Superseded', rejected: 'Returned' };
/** 1.12: short kind labels for the Library rows (chapters carry no chip — the Part/Area header already says what they are). */
export const DOC_KIND: Record<string, string> = { sop: 'SOP', form: 'Form', annex: 'Annex', area: 'Area' };
export const LIB_TABS = [
  { to: '/library', label: 'Manuals', end: true, tip: 'Sections of the CDRRMO Manual of Operations and the EOC Manual, with their versions' },
  { to: '/library/trace', label: 'Traceability', tip: 'Which manual sections answer each assessment indicator' },
  { to: '/library/requirements', label: 'Requirements', tip: 'The 18 master requirements the manuals and this platform must meet' },
  { to: '/library/crosswalk', label: 'Frameworks', tip: 'How the indicators map to the UNDRR Scorecard and the RA 12287 IRR' },
];
