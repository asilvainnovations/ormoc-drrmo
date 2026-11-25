/**
 * Systems Diagnosis page: a static page in /public, opened in a new tab (like the User Guide)
 * so the workspace keeps its state. One place for the URL, label and tooltip.
 */
const BASE_URL = import.meta.env.BASE_URL || '/';

export const SYSTEMS_DIAGNOSIS_URL = `${BASE_URL}systems-diagnosis.html`;
export const SYSTEMS_DIAGNOSIS_LABEL = 'Systems Diagnosis';
export const SYSTEMS_DIAGNOSIS_TIP =
  'Opens the Systems Diagnosis in a new tab: systems archetypes with causal loop and behavior-over-time diagrams, leverage points and the IAT baseline.';
