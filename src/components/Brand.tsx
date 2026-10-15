// The City of Ormoc seal and the CDRRMO seal, always as circles. The files in /brand
// are cut from the official artwork with transparent corners (see scripts/brand_assets.py).
import clsx from 'clsx';
import { tip } from './Tooltip';

type SealKind = 'city' | 'cdrrmo';
const SEAL: Record<SealKind, { file: string; alt: string; tip: string }> = {
  city: { file: 'ormoc-city-seal', alt: 'Official seal of the City of Ormoc', tip: 'Official seal of the City Government of Ormoc' },
  cdrrmo: { file: 'cdrrmo-seal', alt: 'Seal of the Ormoc City Disaster Risk Reduction and Management Office', tip: 'Ormoc City Disaster Risk Reduction and Management Office (CDRRMO)' },
};

/** One seal in a circle with an orange ring. `size` is the rendered diameter in px. */
export function Seal({ kind, size = 40, ring = true, className }: { kind: SealKind; size?: number; ring?: boolean; className?: string }) {
  const s = SEAL[kind];
  const px = size <= 40 ? 128 : size <= 96 ? 256 : 512;   // 2–3× for sharp edges on phones
  return (
    <span {...tip(s.tip)} tabIndex={-1} className={clsx('inline-block shrink-0 rounded-full bg-white', ring && 'ring-2 ring-accent-bright ring-offset-2 ring-offset-surface', className)}
      style={{ width: size, height: size }}>
      <img src={`/brand/${s.file}-${px}.webp`} alt={s.alt} width={size} height={size} decoding="async" className="h-full w-full rounded-full" />
    </span>
  );
}

/** City seal and CDRRMO seal side by side. */
export function Seals({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center', size >= 56 ? 'gap-4' : 'gap-2.5', className)}>
      <Seal kind="city" size={size} />
      <Seal kind="cdrrmo" size={size} />
    </span>
  );
}

/** Seals with the office name: rail header, sign-in, About. */
export function BrandLockup({ size = 40, stacked = false }: { size?: number; stacked?: boolean }) {
  return (
    <div className={clsx('flex', stacked ? 'flex-col items-start gap-3' : 'items-center gap-3')}>
      <Seals size={size} />
      <div className="min-w-0">
        <p className="font-display text-base font-bold leading-5">City of Ormoc</p>
        <p className="font-data text-sm leading-5 text-muted">CDRRMO and Emergency Operations Center</p>
      </div>
    </div>
  );
}
