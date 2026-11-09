# ADR-023: The Radix/shadcn component kit in City tokens; Light, Dark or device appearance; search palette (v1.11.0)

Status: Accepted, 8 Nov 2026. Amends ADR-007 and ADR-008 (presentation only).

## Context
The City uploaded a component kit (51 files in `src/components/ui`, plus `theme-provider.tsx`) to give the screens more range than the in-house primitives in `components/ui.tsx`. Release 1.10.0 removed the kit for three reasons: its dependencies were not installed, it imported a missing `@/lib/utils`, and it used shadcn colour names that are not in the City tokens. That was the wrong call. On 8 Nov 2026 the City asked for the kit to be kept and used.

## Decision
1. **The kit stays.**
   - Its dependencies are pinned in `package.json`: Radix primitives, cmdk, vaul, sonner, recharts, embla, react-day-picker 8, input-otp, react-resizable-panels, react-hook-form, class-variance-authority, tailwind-merge and tailwindcss-animate.
   - `src/lib/utils.ts` (`cn`), `src/hooks/use-toast.ts` and `src/hooks/use-mobile.tsx` are added.
2. **One colour system.** A one-time codemod rewrote the kit's shadcn names to City tokens:

   | shadcn name | City token |
   |---|---|
   | primary | action |
   | secondary, muted (background) | sunken |
   | muted-foreground | muted |
   | accent | sky-soft |
   | destructive | bad |
   | card, popover, background | surface |
   | foreground | ink |
   | border, input | line |
   | ring | focus |

   Raw palette classes (green, yellow, red) became the status tokens. The kit therefore passes the same WCAG AA pairs as the rest of the app, in light and dark.
3. **Appearance.** `ThemeProvider` puts `.light` or `.dark` on `<html>` and remembers the choice on the device in local storage (`theme`).
   - `tokens.css` applies the dark values when the class is `.dark`, or when there is no `.light` class and the device prefers dark.
   - Tailwind's `dark:` variant follows the same rule.
   - The map follows the class too.
   - The appearance switch is in the rail, on Today, in Settings and on the public pages.
4. **Where the kit is used:**
   - **Search palette** (Ctrl+K / ⌘K) on every workspace screen: screens, manual sections, workflows and protocols (by code, SOP or owner) and forms. It reads the device copy, so it works offline.
   - **Today:** cards, progress bars, skeletons, a glass header and a Manual readiness panel.
   - **DRRM:** summary cards and a find field. The template sheet has tabs (Steps, SOP control, When and who), and form previews open on hover.
   - **Assessment results:** a radar profile beside the bars.
   - **Library:** breadcrumbs.
   - **Public pages:** a banner hero, a "How it works" cycle, feature cards, an FAQ accordion, alerts, breadcrumbs, a policy side menu, and a mobile menu.
   - **Settings:** Error reports (a table with collapsible details; the screen was linked but missing) and Interface components, a live gallery of every component with what it does and where MODE uses it.
5. **Rules that do not change:**
   - Every control carries a `data-tip` (the tooltip e2e check covers the kit too).
   - Status is never shown by colour alone.
   - The EOC level colours stay reserved for the band and the board.
   - `components/ui.tsx` remains the default for forms and lists. The kit is used where it adds something those primitives lack.
   - The kit's `SidebarProvider` would set a cookie, so it is not used.
6. **Bundle.** The reference catalogue (about 1.8 MB) is now loaded on demand by `bootstrapReference`, so the main chunk fell from about 2 MB to about 370 kB. Recharts loads only with the assessment and the gallery.

## Consequences
- More dependencies to keep updated. They are pinned exactly; update them together and run the axe and tooltip suites.
- A new kit component must be added to the gallery with its purpose and use.
