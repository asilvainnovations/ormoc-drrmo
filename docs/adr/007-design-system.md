# ADR-007: Token-based design system with a status band and reserved level colours

Status: Accepted, 15 Oct 2026

## Context
Users read the app at 2 a.m., under stress, on cheap phones in sunlight or a dark EOC. The EOC levels (White, Blue, Red) have fixed meanings in NDRRMC practice and must never be confused with decoration or with good/bad status.

## Decision
- Colours are CSS custom properties (RGB triplets) consumed by Tailwind, with a dark-mode set. No hex values in components.
- White, Blue and Red are reserved for EOC levels. Status uses ok / warn / bad / info, each with a soft fill and with text and an icon, never colour alone.
- The signature element is the status band at the top of every screen: EOC level, active declaration and its next deadline, sync state.
- Atkinson Hyperlegible Next, self-hosted, on a 1.2 modular scale from 16 px. 44 px minimum tap targets.
- Shared primitives in `src/components/ui.tsx`; screens do not restyle them.
- WCAG 2.1 AA, checked by axe in the e2e suite in light and dark mode.

Details: [docs/design-system.md](../design-system.md).
