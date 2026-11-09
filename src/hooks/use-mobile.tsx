import * as React from 'react';

// Phones and small tablets: the same breakpoint as the bottom tab bar (below `lg` is phone layout for the sidebar).
const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT);
  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    mql.addEventListener('change', onChange);
    onChange();
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}
