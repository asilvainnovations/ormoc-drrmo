/**
 * User Guide configuration constants.
 * Centralized to ensure consistent labeling, tooltips, and routing 
 * across all features (Today, Tools, Settings, etc.).
 */
const BASE_URL = import.meta.env.BASE_URL || '/';

export const USER_GUIDE_URL = `${BASE_URL}mode-user-guide.html`;
export const USER_GUIDE_LABEL = 'MODE User Guide';
export const USER_GUIDE_TIP = 'Opens the plain-language MODE User Guide for CDRRMO and EOC staff. Works offline once loaded.';
