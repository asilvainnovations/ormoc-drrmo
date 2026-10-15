# ADR-008: City identity: seals, banner, palette and type (v1.1)

Status: Accepted, 16 Oct 2026. Amends the colour and typeface parts of [ADR-007](007-design-system.md); its other decisions stand.

## Context
The City asked for its official identity across the platform:
- the City of Ormoc and CDRRMO seals as circles;
- the City banner as the app background;
- Montserrat, Poppins and Roboto Condensed;
- light blue, gray and orange.

It also asked for tooltips on every control, notes on every cited law or guideline, and a Document Vault.

## Decision
- **Seals.** Seals are cut to true circles from the official artwork by `scripts/brand_assets.py`, and shown with an orange ring. The CDRRMO seal is the app icon.
- **Banner.** The banner leads the sign-in screen. Behind signed-in screens it is a faint, veiled backdrop, so contrast is unchanged.
- **Colour roles:**
  - light blue for the page and selection;
  - navy for text and primary actions;
  - gray for structure;
  - orange for active marks and focus.
- **Status and level colours stay apart from the brand.** Warnings move from amber to ochre, so they are not read as brand orange. The EOC Blue level becomes a vivid royal blue, so it is not read as the brand blue.
- **Typefaces.** Montserrat for headings, Poppins for reading and controls, Roboto Condensed for compact data. All three are self-hosted.
- **Tooltips.** One accessible tooltip layer covers the whole app. The primitives make a tooltip compulsory, and an end-to-end test checks coverage on every main screen.
- **Reference notes.** These come from a reference catalogue with conservative content rules: official titles, well-established section subjects, crosswalk-sourced IRR and Scorecard topics, and no paraphrase of sub-items.

## Consequences
- **Low-vision legibility.** Atkinson Hyperlegible Next was chosen for low-vision legibility, and it is replaced. Poppins at 16 px with AA contrast stays readable, but it is wider and its I, l and 1 are less distinct. Codes and IDs are therefore set in Roboto Condensed and in context.
- **Download size.** The offline bundle grows by the fonts and the banner (about 0.4 MB). The large originals are excluded.
- **Validation.** The reference notes are orientation, not legal advice; every note says the official text governs. The CDRRMO should validate them with the City Legal Office.
