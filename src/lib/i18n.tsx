import { useCallback, useEffect, useState } from 'react';

/** 1.17 (ADR-031): Cebuano (Bisaya) for the app chrome — navigation, dashboard, settings.
 * The manual, legal citations, tooltips and protocols stay in English so citations remain exact
 * (the same reasoning as keeping tooltips English). Add a key to BOTH languages; the parity test
 * (src/lib/i18n.test.ts) fails the build if they drift. */
export type Lang = 'en' | 'ceb';
export type StringKey = keyof typeof STRINGS.en;

const STORAGE_KEY = 'mode.lang';

export const STRINGS = {
  en: {
    'nav.today': 'Today', 'nav.assess': 'Assess', 'nav.protocols': 'Protocols', 'nav.eoc': 'EOC',
    'nav.library': 'Library', 'nav.vault': 'Vault', 'nav.tools': 'Tools', 'nav.hazardmaps': 'Hazard maps',
    'greet.morning': 'Good morning', 'greet.afternoon': 'Good afternoon', 'greet.evening': 'Good evening',
    'today.hero': 'Everything that needs your attention today, in one place.',
    'today.pareto.title': 'Priority indicators',
    'today.pareto.about': 'The 23 indicators that carry most of the readiness gain, tracked live from the current assessment.',
    'today.pareto.tier1': 'Tier 1 — basics first', 'today.pareto.tier2': 'Tier 2 — EOC and planning',
    'today.pareto.tier3': 'Tier 3 — audit, learning, recovery',
    'today.pareto.met': 'met', 'today.pareto.unmet': 'needs work', 'today.pareto.none': 'No assessment cycle yet.',
    'library.pillars': 'The four DRRM pillars',
    'library.pillars.about': 'Every chapter and manual file sits under one pillar, from prevention to recovery.',
    'pillar.prevention': 'Prevention & Mitigation', 'pillar.preparedness': 'Preparedness',
    'pillar.response': 'Response', 'pillar.recovery': 'Recovery & Rehabilitation',
    'library.chapters': 'Manual of Operations: chapters', 'library.areas': 'Functional areas',
    'common.open': 'Open',
    'settings.language': 'Language', 'settings.language.about': 'Navigation and dashboard in Cebuano (Bisaya) or English. The manual and legal texts stay in English.',
    'lang.en': 'English', 'lang.ceb': 'Cebuano (Bisaya)',
  },
  ceb: {
    'nav.today': 'Karon', 'nav.assess': 'Pagtimbang-timbang', 'nav.protocols': 'Mga Protocol', 'nav.eoc': 'EOC',
    'nav.library': 'Librarya', 'nav.vault': 'Vault', 'nav.tools': 'Mga Hinagiban', 'nav.hazardmaps': 'Mga Mapa sa Peligro',
    'greet.morning': 'Maayong buntag', 'greet.afternoon': 'Maayong hapon', 'greet.evening': 'Maayong gabii',
    'today.hero': 'Tanang kinahanglan nimong atimanon karon, sa usa ka lugar.',
    'today.pareto.title': 'Mga prayoridad nga indikador',
    'today.pareto.about': 'Ang 23 ka indikador nga nagdala sa kadaghanan sa readiness gain, gihisgutan live gikan sa kasamtangan nga assessment.',
    'today.pareto.tier1': 'Tier 1 — una ang mga basihan', 'today.pareto.tier2': 'Tier 2 — EOC ug pag-plano',
    'today.pareto.tier3': 'Tier 3 — audit, pagkat-on, pag-ayo',
    'today.pareto.met': 'natuman', 'today.pareto.unmet': 'kinahanglan pang buhaton', 'today.pareto.none': 'Wala pa\'y assessment cycle.',
    'library.pillars': 'Ang upat ka DRRM pillar',
    'library.pillars.about': 'Ang matag kapitulo ug file sa manual naa sa usa ka pillar, gikan sa pagpugong hangtod sa pag-ayo.',
    'pillar.prevention': 'Pangpugong & Mitigasyon', 'pillar.preparedness': 'Pag-andam',
    'pillar.response': 'Pagtubag', 'pillar.recovery': 'Pag-ayo & Rehabilitasyon',
    'library.chapters': 'Manual sa Operasyon: mga kapitulo', 'library.areas': 'Mga functional area',
    'common.open': 'Abrihi',
    'settings.language': 'Pinulongan', 'settings.language.about': 'Nabigasyon ug dashboard sa Cebuano (Bisaya) o English. Ang manual ug mga legal nga teksto magpabilin sa English.',
    'lang.en': 'English', 'lang.ceb': 'Sinugboanon (Bisaya)',
  },
} as const;

function read(): Lang {
  try { return localStorage.getItem(STORAGE_KEY) === 'ceb' ? 'ceb' : 'en'; } catch { return 'en'; }
}

/** [language, setLanguage]. Persisted per device; broadcasts a 'mode:lang' window event so open tabs re-render. */
export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLang] = useState<Lang>(read);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY || e.key === null) setLang(read()); };
    const onLocal = () => setLang(read());
    window.addEventListener('storage', onStorage);
    window.addEventListener('mode:lang', onLocal);
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('mode:lang', onLocal); };
  }, []);
  const set = useCallback((l: Lang) => {
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* private mode: session-only */ }
    setLang(l);
    window.dispatchEvent(new Event('mode:lang'));
  }, []);
  return [lang, set];
}

/** Bound translator for the current language: const t = useT(); t('nav.today'). */
export function useT(): (k: StringKey) => string {
  const [lang] = useLang();
  return useCallback((k: StringKey) => STRINGS[lang][k], [lang]);
}
