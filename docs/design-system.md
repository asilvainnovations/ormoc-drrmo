# Design system

The platform is used at 2 a.m. in a dark EOC, in sunlight at an evacuation centre, and on low-cost Android phones. Every choice here serves reading speed and the avoidance of mistakes. Decision records: [ADR-007](adr/007-design-system.md) (system) and [ADR-008](adr/008-city-identity.md) (City identity, v1.1).

Sources of truth: `src/styles/tokens.css` (values), `tailwind.config.ts` (names), `src/components/ui.tsx` (primitives). Screens use these. They do not add hex values, arbitrary sizes or local copies of a primitive.

## 1. Principles

1. **State before content.** The status band says what level the EOC is at, whether a declaration is in force, and whether this device's data is current, on every screen.
2. **Colour has a meaning or it is not used.** EOC levels and statuses have reserved colours. The City palette (light blue, gray, orange) carries identity and selection, never status.
3. **One action per moment.** Each sheet or page has one primary button, labelled with the verb that happens ("Start protocol", "Submit for validation").
4. **Say why.** A disabled control or a refused save shows its reason in plain words, taken from the server when the server refused.
5. **Nothing unexplained.** Every button, tab, card, link and field has a tooltip saying what it does or is for, and every cited law or guideline opens a short note (section 7).
6. **Thumb-first.** All tap targets are at least 44 px. Primary actions sit at the bottom of sheets on phones. Navigation is a bottom tab bar on phones and a side rail from `lg`.

## 2. Colour tokens

Tokens are RGB triplets so Tailwind can apply opacity (`bg-sky-soft/70`). Each has a dark-mode value under `prefers-color-scheme: dark`. Every text and control pair is checked for WCAG 2.1 AA in both modes.

| Token | Light | Use |
|---|---|---|
| `paper` | #EEF5FB light blue | Page background |
| `surface` | #FFFFFF | Cards, sheets, inputs, the White-level band |
| `sunken` | #E3EBF2 gray-blue | Wells, meter tracks |
| `ink` | #13283D navy | Text (13.7:1 on paper) |
| `muted` | #51606E gray | Secondary text (5.9:1 on paper) |
| `line` | #C9D5E0 | Dividers, input borders |
| `action` / `on-action` | #0F3D66 navy / white | Primary buttons (11:1) |
| `sky`, `sky-soft` | #2F86C8, #DCEEFB | Light-blue brand: icons, meters, selected rows and hover fills |
| `accent` | #D66812 orange | Active marks: current tab, active nav item, selected card border (3:1+ on white) |
| `accent-bright` | #F07A1A orange | Decoration only: seal rings, banner stripe, reference-note edge. Never text |
| `accent-ink` | #A84A05 | Orange text when orange must be read (5.8:1) |
| `focus` | #D1600C orange | Focus ring, 3 px with 2 px offset |
| `ok`, `warn`, `bad`, `info` (+ `-soft`) | green, ochre, red, blue | Status only. Always with text, and an icon where space allows. `warn` is ochre so it is never confused with the brand orange |
| `on-strong` | white (dark: navy) | Text on solid status fills |
| `lvl-white`, `lvl-blue`, `lvl-red` / `on-level` | white, #1E3FC2 royal blue, #B11E16 | **EOC levels only** |
| `mat-0` … `mat-4` | light-to-dark blue | Maturity heat and chart fills (magnitude, not status) |
| `scrim` | navy | Dialog backdrop at 40% |
| `banner` | #022A4D | Letterbox colour behind the banner artwork (sign-in only) |

Rules:

- `lvl-*` appear only in the status band, the EOC board and level controls. The EOC Blue is a vivid royal blue, deliberately apart from the brand navy and light blue, and the band always names the level in words.
- Orange marks what is active or focused. It is not used for status: warnings are ochre.
- Status fills in dark mode are light, so their text is `on-strong`, which flips to dark. Do not write `text-white` on a status fill.

## 3. Typography

Three self-hosted families (Latin subsets; they work offline and pass the CSP), each with one job:

| Family | Class | Job |
|---|---|---|
| Montserrat (variable) | `font-display` | Headings, page titles, sheet and note titles. 700 to 800 |
| Poppins 400 / 500 / 600 | `font-sans` (default) | Reading text, buttons, fields, lists |
| Roboto Condensed (variable) | `font-data` | Compact data: the status band, badges, times, counts, indicator IDs, the phone tab bar |

Montserrat is the standard ("classic") cut; there is no separate font by the name "Montserrat Classic".

Modular scale 1.2 on a 16 px base:

| Class | Size / line | Use |
|---|---|---|
| `text-xs` | 13 / 20 | Chart labels |
| `text-sm` | 15 / 22 | Meta lines, hints, table cells, tooltips |
| `text-base` | 16 / 24 | Body, inputs (16 px stops iOS zoom) |
| `text-lg` | 19 / 26 | Indicator statements, large buttons, deadline lines |
| `text-xl` | 23 / 30 | Section headings |
| `text-2xl` | 28 / 34 | Page titles (phone) |
| `text-3xl` | 33 / 38 | Page titles (`lg`) |

Weights: 400 body, 600 labels and list titles, 700 to 800 headings. Sentence case everywhere except the EOC level in the status band (section 8). Body text is limited to `max-w-prose` (68ch). Figures use tabular numerals.

### City identity

- **Seals.** The City of Ormoc seal and the CDRRMO seal always appear as circles with an orange ring (`Seal`, `Seals`, `BrandLockup` in `src/components/Brand.tsx`). They are cut from the official artwork by `scripts/brand_assets.py` into `public/brand/`. They appear on the sign-in screen, in the desktop rail, on the home screen on phones, and as the app icon.
- **Banner.** The City banner leads the sign-in screen and sits behind every signed-in screen as a backdrop at about 9% strength, under a veil that keeps the page wash dominant. Content surfaces stay opaque, so text contrast is the same as on plain paper.
- The original files in `public/` are kept for print. The app ships compressed copies, and the originals are left out of the offline bundle.

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
| `Button` | `primary`, `secondary`, `quiet`, `danger`; `size` md (44 px) or lg (52 px); `icon`; `busy`; `full`; **`tip` (required)** | One `primary` per view. `danger` only for irreversible steps (stop a run, lift a declaration) |
| `ButtonLink` | same variants; **`tip` (required)** | Navigation styled as a button |
| `TextLink` | `size` base or sm; **`tip` (required)** | Always underlined |
| `Field` | label, hint, error | Label above the control. Hint and error are tied by `aria-describedby`. Fields are required unless marked "(optional)". The field's tooltip defaults to its hint, then its label |
| `Input`, `Textarea`, `Select` | — | 44 px min height, 16 px text |
| `ChoiceGroup` | options with `disabled` + reason | Radio cards for scores and decisions. A disabled option shows why |
| `Checkbox` | **`tip` (required)** | Card-style, 44 px |
| `PageHeader` | title, subtitle, back, action | One per page |
| `Section` | title, action | `h2` with optional right-side action |
| `List` / `ListRow` | to / onClick, meta, leading, trailing, tone, `tip` | Rows are at least 52 px. A chevron shows when the row opens something. Clickable rows need a `tip` |
| `Badge` | tone | Short status words from label maps, never raw enum values |
| `Notice` | tone, title, action | Inline message with icon |
| `EmptyState` | title, body, action | Full pages with nothing yet |
| `Meter` | value, max, label | Progress with an accessible name |
| `Tabs` | items with `tip` | Section tabs as links with `aria-current`; the active tab is underlined in orange |
| `KeyValue` | items | Definition list |
| `Loading` | — | One loading treatment everywhere |
| `Sheet` | title, footer | Native `<dialog>`. Bottom sheet on phones, centred from `sm` |
| `Toast` | ok, bad, info | At most three. `bad` stays 8 s and is announced as an alert |
| `RefText` | text, context | Turns a reference field into tappable citations with plain-language notes |
| `Seal`, `Seals`, `BrandLockup` | size | The two seals as circles, with the office name |

## 7. Tooltips and reference notes

**Tooltips.** One layer (`src/components/Tooltip.tsx`) serves every element with a `data-tip` attribute; spread `tip('…')` onto raw elements, or pass `tip` to a primitive.

- **Mouse:** the tip shows after a 450 ms hover.
- **Keyboard:** it shows at once on focus.
- **Touch:** a long press (500 ms) shows it without triggering the element.
- **Accessibility (WCAG 1.4.13):** Escape dismisses the tip; it stays while the pointer is on it; the focused element is described by it for screen readers.
- **Writing:** a tip says what happens or what something is for, in one sentence. Add who may do it or what it needs ("needs a connection") when that is not obvious.
- **Coverage:** `e2e/tooltips.spec.ts` fails if any visible link, button, tab, field or checkbox on a main screen has no tip.

**Reference notes.** `RefText` reads fields such as "RA 10121 Sec. 21; JMC 2013-1" and makes each recognized law, rule or guideline a dotted-underlined button. Tapping it opens a note with:

- the official title and what the instrument governs;
- the cited section, where its subject is well established;
- for RA 12287 IRR rules and UNDRR Scorecard items, the subject from the verified IAT crosswalk;
- "The official text governs."

Sub-items such as "Sec. 12(c)(8)" are not paraphrased; the note sends the reader to the official text. The catalogue is `src/data/references.ts`. Its unit test lists the few phrases left as plain text.

## 8. Signature element: the status band

The band sits at the top of every signed-in screen.

- **Level.** White (normal), Blue or Red, with the time it was raised. It fills the band in the level colour and uses `on-level` text. The level name is set in Roboto Condensed capitals: the one place capitals are used, as signage.
- **Declaration.** Shown if one is in force. The name of the next legal deadline links to the declaration.
- **Sync.** "Synced 5 min ago", "3 waiting", "Offline, 3 waiting" or "2 need attention" (conflicts or refusals). It links to Settings → Sync.

On phones it takes two lines with short labels. It is never truncated mid-word.

## 9. Writing

- Name things in CDRRMO vocabulary: "logbook", "SitRep", "PDRA", "EO", "barangay", "LDRRMF".
- Buttons say what happens. The toast echoes the same verb ("Submit for validation" → "A1.1 submitted for validation").
- Errors say what happened and what to do. They do not apologise.
- Times show in Manila time (`Asia/Manila`) as "15 Oct 2026, 14:05" and "in 3 h 20 min".
- Screens that accept free text remind users not to type names of affected persons.

## 10. Accessibility

WCAG 2.1 AA, checked by axe in the e2e suite on every main screen, in phone and desktop sizes and in dark mode:

- Contrast: 4.5:1 for text, 3:1 for UI.
- Visible focus.
- Labels on every control.
- Landmarks and one `h1` per page.
- Live regions for toasts and sync state.
- Status is never shown by colour alone.
- Wide tables scroll sideways in a focusable region, so keyboard users can scroll them.

## 11. Intentional variations

These look like drift but are deliberate. Keep them:

- **Empty states.** Dashboard panels (Today, EOC board) use one muted line ("None running.") so the panel grid keeps its shape. Full pages use `EmptyState` with an action.
- **Action plan rows.** The row title is the link and is not underlined. The whole row is the target, as in `ListRow`.
- **Status band level in capitals.** See section 8.
- **Maturity chart.** The data bar ends in a 4 px radius on the value end only, anchored square at the baseline, so the end reads as the value.
- **Declaration banner on Today.** It uses a 2 px `bad` border and soft fill rather than `Notice`. It is the one element allowed to dominate the home screen while a declaration is in force.
