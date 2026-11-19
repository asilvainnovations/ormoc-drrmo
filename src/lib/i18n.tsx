import { useCallback, useEffect, useState } from 'react';

/** 1.17 (ADR-031): Ormocanon (Bisaya) and Filipino (Tagalog), besides English, for the app chrome — navigation, dashboard, settings.
 * The manual, legal citations, tooltips and protocols stay in English so citations remain exact
 * (the same reasoning as keeping tooltips English). Add a key to ALL THREE languages; the parity test
 * (src/lib/i18n.test.ts) fails the build if they drift. */
/** 'ceb' is the stored code for Ormocanon (Bisaya); the code is kept so a saved choice still works. */
export type Lang = 'en' | 'ceb' | 'fil';
export type StringKey = keyof typeof STRINGS.en;

const STORAGE_KEY = 'mode.lang';

export const STRINGS = {
  en: {
    'nav.today': 'Today', 'nav.assess': 'Assess', 'nav.protocols': 'DRRM', 'nav.eoc': 'EOC',
    'nav.library': 'Library', 'nav.vault': 'Vault', 'nav.tools': 'Tools', 'nav.hazardmaps': 'Hazard maps', 'nav.governance': 'Validation',
    'greet.morning': 'Good morning', 'greet.afternoon': 'Good afternoon', 'greet.evening': 'Good evening',
    'today.hero': 'Everything that needs your attention today, in one place.',
    'today.pareto.title': 'Priority indicators',
    'today.pareto.about': 'The 23 indicators that carry most of the readiness gain, tracked live from the current assessment.',
    'today.pareto.tier1': 'Tier 1 — basics first', 'today.pareto.tier2': 'Tier 2 — EOC and planning',
    'today.pareto.tier3': 'Tier 3 — audit, learning, recovery',
    'today.pareto.met': 'met', 'today.pareto.unmet': 'needs work', 'today.pareto.unscored': 'not yet scored', 'today.pareto.none': 'No assessment cycle yet.',
    'library.pillars': 'The four DRRM pillars',
    'library.pillars.about': 'Every chapter and manual file sits under one pillar, from prevention to recovery.',
    'pillar.prevention': 'Prevention & Mitigation', 'pillar.preparedness': 'Preparedness',
    'pillar.response': 'Response & Early Recovery', 'pillar.recovery': 'Rehabilitation & Recovery',
    'library.chapters': 'Manual of Operations: chapters', 'library.areas': 'Functional areas',
    'common.open': 'Open',
    'settings.language': 'Language', 'settings.language.about': 'Navigation and dashboard in Ormocanon (Bisaya), Filipino (Tagalog) or English. The manual and legal texts stay in English.',
    'lang.en': 'English', 'lang.ceb': 'Ormocanon (Bisaya)', 'lang.fil': 'Filipino (Tagalog)',
  },
  ceb: {
    'nav.today': 'Karon', 'nav.assess': 'Pagtimbang-timbang', 'nav.protocols': 'DRRM', 'nav.eoc': 'EOC',
    'nav.library': 'Librarya', 'nav.vault': 'Vault', 'nav.tools': 'Mga Hinagiban', 'nav.hazardmaps': 'Mga Mapa sa Peligro', 'nav.governance': 'Pagpamatuod',
    'greet.morning': 'Maayong buntag', 'greet.afternoon': 'Maayong hapon', 'greet.evening': 'Maayong gabii',
    'today.hero': 'Tanang kinahanglan nimong atimanon karon, sa usa ka lugar.',
    'today.pareto.title': 'Mga prayoridad nga indikador',
    'today.pareto.about': 'Ang 23 ka indikador nga nagdala sa kadaghanan sa readiness gain, gihisgutan live gikan sa kasamtangan nga assessment.',
    'today.pareto.tier1': 'Tier 1 — una ang mga basihan', 'today.pareto.tier2': 'Tier 2 — EOC ug pag-plano',
    'today.pareto.tier3': 'Tier 3 — audit, pagkat-on, pag-ayo',
    'today.pareto.met': 'natuman', 'today.pareto.unmet': 'kinahanglan pang buhaton', 'today.pareto.unscored': 'wala pa ma-score', 'today.pareto.none': 'Wala pa\'y assessment cycle.',
    'library.pillars': 'Ang upat ka DRRM pillar',
    'library.pillars.about': 'Ang matag kapitulo ug file sa manual naa sa usa ka pillar, gikan sa pagpugong hangtod sa pag-ayo.',
    'pillar.prevention': 'Pangpugong & Mitigasyon', 'pillar.preparedness': 'Pag-andam',
    'pillar.response': 'Pagtubag', 'pillar.recovery': 'Pag-ayo & Rehabilitasyon',
    'library.chapters': 'Manual sa Operasyon: mga kapitulo', 'library.areas': 'Mga functional area',
    'common.open': 'Abrihi',
    'settings.language': 'Pinulongan', 'settings.language.about': 'Nabigasyon ug dashboard sa Ormocanon (Bisaya), Filipino (Tagalog) o English. Ang manual ug mga legal nga teksto magpabilin sa English.',
    'lang.en': 'English', 'lang.ceb': 'Ormocanon (Bisaya)', 'lang.fil': 'Filipino (Tagalog)',
  },
  fil: {
    'nav.today': 'Ngayon', 'nav.assess': 'Pagtatasa', 'nav.protocols': 'DRRM', 'nav.eoc': 'EOC',
    'nav.library': 'Aklatan', 'nav.vault': 'Vault', 'nav.tools': 'Mga Kasangkapan', 'nav.hazardmaps': 'Mga Mapa ng Panganib', 'nav.governance': 'Pagpapatunay',
    'greet.morning': 'Magandang umaga', 'greet.afternoon': 'Magandang hapon', 'greet.evening': 'Magandang gabi',
    'today.hero': 'Lahat ng kailangan mong tutukan ngayon, sa iisang lugar.',
    'today.pareto.title': 'Mga indikador na prayoridad',
    'today.pareto.about': 'Ang 23 indikador na may pinakamalaking ambag sa kahandaan, sinusubaybayan nang live mula sa kasalukuyang pagtatasa.',
    'today.pareto.tier1': 'Tier 1 — mga batayan muna', 'today.pareto.tier2': 'Tier 2 — EOC at pagpaplano',
    'today.pareto.tier3': 'Tier 3 — audit, pagkatuto, pagbangon',
    'today.pareto.met': 'natugunan', 'today.pareto.unmet': 'kailangang gawin', 'today.pareto.unscored': 'hindi pa nai-score', 'today.pareto.none': 'Wala pang assessment cycle.',
    'library.pillars': 'Ang apat na haligi ng DRRM',
    'library.pillars.about': 'Ang bawat kabanata at file ng manwal ay nasa ilalim ng isang haligi, mula sa pag-iwas hanggang sa pagbangon.',
    'pillar.prevention': 'Pag-iwas at Pagpapagaan', 'pillar.preparedness': 'Paghahanda',
    'pillar.response': 'Pagtugon', 'pillar.recovery': 'Pagbangon at Rehabilitasyon',
    'library.chapters': 'Manwal ng Operasyon: mga kabanata', 'library.areas': 'Mga functional area',
    'common.open': 'Buksan',
    'settings.language': 'Wika', 'settings.language.about': 'Nabigasyon at dashboard sa Ormocanon (Bisaya), Filipino (Tagalog) o English. Ang manwal at mga legal na teksto ay mananatili sa English.',
    'lang.en': 'English', 'lang.ceb': 'Ormocanon (Bisaya)', 'lang.fil': 'Filipino (Tagalog)',
  },
} as const;

function read(): Lang {
  try { const v = localStorage.getItem(STORAGE_KEY); return v === 'ceb' || v === 'fil' ? v : 'en'; } catch { return 'en'; }
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
