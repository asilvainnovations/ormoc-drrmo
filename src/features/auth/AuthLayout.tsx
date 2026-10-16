import type { ReactNode } from 'react';
import { BrandLockup } from '@/components/Brand';

/** The City banner beside (desktop) or above (phone) the account forms. */
export function AuthLayout({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[minmax(0,1.35fr)_minmax(24rem,1fr)]">
      {/* The City banner. Navy behind it matches the artwork's edges when it is letterboxed. */}
      <div className="relative overflow-hidden bg-banner lg:sticky lg:top-0 lg:flex lg:h-dvh lg:items-center">
        <div aria-hidden className="absolute inset-0 hidden scale-110 bg-cover bg-center opacity-40 blur-2xl lg:block" style={{ backgroundImage: "url('/brand/app-banner-800.webp')" }} />
        <picture className="relative block w-full">
          <source type="image/webp" srcSet="/brand/app-banner-800.webp 800w, /brand/app-banner-1600.webp 1600w" sizes="(min-width: 1024px) 58vw, 100vw" />
          <img src="/brand/app-banner-800.jpg" srcSet="/brand/app-banner-800.jpg 800w, /brand/app-banner-1600.jpg 1600w" sizes="(min-width: 1024px) 58vw, 100vw"
            alt="DRRM and Emergency Operations Platform: prepare before, respond together, recover stronger, build safer communities"
            width={1600} height={916} className="block h-auto w-full lg:max-h-dvh lg:object-contain" fetchPriority="high" />
        </picture>
        <div className="h-1.5 w-full bg-accent-bright lg:absolute lg:inset-y-0 lg:right-0 lg:h-auto lg:w-1.5" aria-hidden />
      </div>

      <main className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-8 lg:py-12">
        <BrandLockup size={52} />
        <h1 className="mt-6 text-3xl font-extrabold">{title}</h1>
        {intro && <div className="mt-2 text-muted">{intro}</div>}
        {children}
        <p className="mt-8 text-sm text-muted">Data is held by the City Government of Ormoc under the Data Privacy Act of 2012 (RA 10173). Do not enter the names of affected persons or informants.</p>
      </main>
    </div>
  );
}

export const formCard = 'mt-8 space-y-5 rounded-sheet border border-line bg-surface p-5 shadow-raised';
