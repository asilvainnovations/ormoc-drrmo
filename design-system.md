# Design system

The platform is used at 2 a.m. in a dark EOC, in sunlight at an evacuation centre, and on low-cost Android phones. Every choice here serves reading speed and the avoidance of mistakes. Decision record: [ADR-007](adr/007-design-system.md).

Sources of truth: `src/styles/tokens.css` (values), `tailwind.config.ts` (names), `src/components/ui.tsx` (primitives). Screens use these. They do not add hex values, arbitrary sizes or local copies of a primitive.

## 1. Principles

1. **State before content.** The status band says what level the EOC is at, whether a declaration is in force, and whether this device's data is current, on every screen.
2. **Colour has a meaning or it is not used.** EOC levels and statuses have reserved colours. Everything else is ink on paper.
3. **One action per moment.** Each sheet or page has one primary button, labelled with the verb that happens ("Start protocol", "Submit for validation").
4. **Say why.** A disabled control or a refused save shows its reason in plain words, taken from the server when the server refused.
5. **Thumb-first.** All tap targets are at least 44 px. Primary actions sit at the bottom of sheets on phones. Navigation is a bottom tab bar on phones and a side rail from `lg`.

## 2. Colour tokens

Tokens are RGB triplets so Tailwind can apply opacity (`bg-sunken/60`). Each has a dark-mode value under `prefers-color-scheme: dark`.

| Token | Light | Use |
|---|---|---|
| `paper` | #F5F7F6 | App background |
| `surface` | #FFFFFF | Cards, sheets, inputs |
| `sunken` | #ECF0EE | Wells, hover fills, meter tracks |
| `ink` | #173039 | Text, primary actions |
| `muted` | #54686E | Secondary text (AA on paper and surface) |
| `line` | #D3DBD8 | Dividers, input borders |
| `action` / `on-action` | ink / white | Primary button |
| `focus` | #1E4FBF | Focus ring (3 px, 2 px offset) |
| `ok`, `warn`, `bad`, `info` (+ `-soft`) | green, amber, red, blue | Status only. Always with text, and an icon where space allows |
| `on-strong` | white (dark: near-black) | Text on solid status fills |
| `lvl-white`, `lvl-blue`, `lvl-red` / `on-level` | — | **EOC levels only** |
| `mat-0` … `mat-4` | one-hue ramp | Maturity heat and chart fills |
| `scrim` | black | Dialog backdrop, used at 40% |

Rules:

- `lvl-*` appear only in the status band, the EOC board and level controls. Never use red for "bad" by borrowing `lvl-red`, or blue for links by borrowing `lvl-blue`.
- Status fills in dark mode are light, so their text is `on-strong`, which flips to dark. Do not write `text-white` on a status fill.
- Charts use the `mat` ramp for magnitude and `ink` for the data mark. They never use status colours for series.

## 3. Typography

Atkinson Hyperlegible Next (variable, self-hosted, Latin subset) is designed for low-vision readers. Its distinct letterforms (Il1, 0O) matter for EO numbers, PSGC codes and times.

Modular scale 1.2 on a 16 px base:

| Class | Size / line | Use |
|---|---|---|
| `text-xs` | 13 / 20 | Badges, chart labels |
| `text-sm` | 15 / 22 | Meta lines, hints, table cells |
| `text-base` | 16 / 24 | Body, inputs (16 px stops iOS zoom) |
| `text-lg` | 19 / 26 | Indicator statements, large buttons, deadline lines |
| `text-xl` | 23 / 30 | Section headings |
| `text-2xl` | 28 / 34 | Page titles (phone) |
| `text-3xl` | 33 / 38 | Page titles (`lg`) |

Weights: 400 body, 600 labels and list titles, 700 headings and the status band. Sentence case everywhere. No all-caps labels. Body text is limited to `max-w-prose` (68ch).

## 4. Layout and spacing

- Tailwind's 4 px scale. Page gutter is `px-4` on phones. Content is limited to `max-w-page` (72 rem).
- Vertical rhythm: header to body `mb-6`, between sections `gap-8 lg:gap-10`, inside a section `space-y-3`.
- Dashboard pages put two columns from `lg` (`lg:grid-cols-2`). Detail pages use main column + 22 rem side column.
- Bottom padding includes `safe-b` (the iPhone home indicator).

## 5. Shape, elevation, motion

- Radius: `rounded-control` (8 px) for buttons, inputs and rows; `rounded-sheet` (16 px) for sheets and the declaration banner; `rounded-full` for badges and meters.
- Elevation: `shadow-raised` for toasts; `shadow-sheet` for bottom sheets. Lists and sections are flat and separated by `line`.
- Motion: none decorative. Nothing animates on its own; hover fills change instantly. Under `prefers-reduced-motion` all transitions and animations are cut to 0.01 ms, including any added later.

## 6. Primitives (`src/components/ui.tsx`)

| Primitive | Variants / props | Notes |
|---|---|---|
| `Button` | `primary`, `secondary`, `quiet`, `danger`; `size` md (44 px) or lg (52 px); `icon`; `busy`; `full` | One `primary` per view. `danger` only for irreversible steps (stop a run, lift a declaration) |
| `ButtonLink` | same variants | Navigation styled as a button |
| `TextLink` | `size` base or sm | Always underlined |
| `Field` | label, hint, error | Label above the control. Hint and error are tied by `aria-describedby`. Fields are required unless marked "(optional)" |
| `Input`, `Textarea`, `Select` | — | 44 px min height, 16 px text |
| `ChoiceGroup` | options with `disabled` + reason | Radio cards for scores and decisions. A disabled option shows why |
| `Checkbox` | — | Card-style, 44 px |
| `PageHeader` | title, subtitle, back, action | One per page |
| `Section` | title, action | `h2` with optional right-side action |
| `List` / `ListRow` | to / onClick, meta, leading, trailing, tone | Rows are at least 52 px. A chevron shows when the row opens something |
| `Badge` | tone | Short status words from label maps, never raw enum values |
| `Notice` | tone, title, action | Inline message with icon |
| `EmptyState` | title, body, action | Full pages with nothing yet |
| `Meter` | value, max, label | Progress with an accessible name |
| `Tabs` | — | Section tabs (EOC) as links with `aria-current` |
| `KeyValue` | items | Definition list |
| `Loading` | — | One loading treatment everywhere |
| `Sheet` | title, footer | Native `<dialog>`. Bottom sheet on phones, centred from `sm` |
| `Toast` | ok, bad, info | At most three. `bad` stays 8 s and is announced as an alert |

## 7. Signature element: the status band

The band sits at the top of every signed-in screen.

- **Level.** White (normal), Blue or Red, with the time it was raised. It fills the band in the level colour and uses `on-level` text.
- **Declaration.** Shown if one is in force. The name of the next legal deadline links to the declaration.
- **Sync.** "Synced 5 min ago", "3 waiting", "Offline, 3 waiting" or "2 need attention" (conflicts or refusals). It links to Settings → Sync.

On phones it takes two lines with short labels. It is never truncated mid-word.

## 8. Writing

- Name things in CDRRMO vocabulary: "logbook", "SitRep", "PDRA", "EO", "barangay", "LDRRMF".
- Buttons say what happens. The toast echoes the same verb ("Submit for validation" → "A1.1 submitted for validation").
- Errors say what happened and what to do. They do not apologise.
- Times show in Manila time (`Asia/Manila`) as "15 Oct 2026, 14:05" and "in 3 h 20 min".
- Screens that accept free text remind users not to type names of affected persons.

## 9. Accessibility

WCAG 2.1 AA, checked by axe in the e2e suite on every main screen, in phone and desktop sizes and in dark mode:

- Contrast: 4.5:1 for text, 3:1 for UI.
- Visible focus.
- Labels on every control.
- Landmarks and one `h1` per page.
- Live regions for toasts and sync state.
- Status is never shown by colour alone.

## 10. Intentional variations

These look like drift but are deliberate. Keep them:

- **Empty states.** Dashboard panels (Today, EOC board) use one muted line ("None running.") so the panel grid keeps its shape. Full pages use `EmptyState` with an action.
- **Action plan rows.** The row title is the link and is not underlined. The whole row is the target, as in `ListRow`.
- **Maturity chart.** The data bar ends in a 4 px radius on the value end only, anchored square at the baseline, so the end reads as the value.
- **Declaration banner on Today.** It uses a 2 px `bad` border and soft fill rather than `Notice`. It is the one element allowed to dominate the home screen while a declaration is in force.
