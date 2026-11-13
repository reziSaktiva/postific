# Design Tokens

This document is the **Source of Truth for visual tokens** for UI implementation in
`apps/web` (shadcn/ui CSS variables + Tailwind token bridge, ADR-097).

The final token values evolve **iteratively and co-equally** between this document and the
Postific design artifact (ADR-140, replacing ADR-056) — there is no longer a
"waiting for the designer to join" gate: this project will not hire an
external designer, the role is permanently replaced by King Rezi himself through the Postific
design artifact (ADR-140; ADR-057 remains the basis of the designer role, an amendment to
ADR-038 & ADR-041). Feature implementation uses the
Stone theme tokens (ADR-087, mapped to shadcn/ui since ADR-097) and does not
wait for the final tokens.
Screenshots are not a reference for final values; the `design/` folder (the designer handoff package)
has been removed and **will not be recreated** (ADR-045, ADR-057).

| Field                | Value                                                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SoT location         | This document, co-equal with the Postific design artifact for token values (ADR-038, ADR-140) — values evolve iteratively, not locked once                       |
| Code implementation  | `apps/web` (shadcn/ui CSS variables + Tailwind token bridge, ADR-097)                                                                                            |
| UX / screen structure | Stays in `../04-ux/` — **not** replaced by this document                                                                                                        |
| Designer role        | Permanently replaced by King Rezi via the design artifact — there is no external designer (ADR-057); pointer in `../../context/ctx-design.md`                    |

---

# PM Guide — locking a token set

This lock checklist is run whenever King Rezi (acting as the designer
via the design artifact) considers a token set stable — there is **no**
"external designer joins" gate (ADR-057). During feature development,
use the Stone theme tokens (ADR-087, mapped to shadcn/ui since ADR-097);
do not fill in temporary brand values or block screen implementation
because the table is still `TBD`.

## Step 1 — Review & approve in the design artifact

The Postific design artifact replaces Figma as the design handoff tool (ADR-042, later
moved from Claude Design to the artifact by ADR-140) — the `Postific` artifact and the
`Postific Design Review` gallery, read and written through the `Artifact` tool. See
`../../context/ctx-design.md` for the full pointer.

Make sure the design result aligns with the UX Baseline (`../04-ux/`):

- Primary nav: Home → Publish → Engage → Analyze → Start Page
- Publish default: Calendar
- No Approval Workflow in the MVP
- No built-in AI in the UI (ADR-138)
- 6 content statuses + `Failed` clearly readable

If the design artifact changes the flow/IA, **stop** — discuss first (a UX update + ADR is needed). Do not "lock tokens" from a design that conflicts with the UX. Synchronization between this baseline and the design artifact is manual/on-request (ADR-140) — not automatic.

## Step 2 — Fill in the token table in this document

Copy the final values from the design artifact (`project/tokens.json` / `project/tokens.css`) or the style guide into the tables below:

1. Typography (display + UI fonts)
2. Color — brand (primary, secondary, …)
3. Color — neutral (canvas, surface, text, border)
4. Color — content status (6 statuses + failed)
5. Color — feedback (success, warning, danger, info)
6. Spacing / radius / elevation (brief)
7. Theme mode (light-only MVP vs dark)

Replace every `TBD` with a concrete value (hex/HSL or font name). Fill in the **Notes** column where needed.

## Step 3 — Change the document status

In the metadata at the top:

- Status → **Locked — ready for implementation**
- Record the approval date + the design artifact link (optional, in Related)

## Step 4 — Record in Project OS

- Add/update an ADR in `../../project-os/DECISIONS.md` if the brand/theme values have a broad impact (or a short amendment to ADR-038 that the values have been filled in).
- Update `../../project-os/CHANGELOG.md`.
- Update `../../project-os/PROJECT_STATE.md` if this becomes a completed next-task / unlocks the UI shell.

## Step 5 — Mirror to code (M8)

Engineering maps the tokens → implementation:

| Token in this document   | Code target (example)                                                              |
| ------------------------ | ---------------------------------------------------------------------------------- |
| Brand / neutral / status | shadcn/ui CSS variables in `apps/web`                                              |
| Type / spacing scale     | shadcn/ui CSS variables + Tailwind token bridge                                    |
| UI components            | shadcn/ui components and selective wrappers using the same semantic tokens         |

**Do not** fill in hex values only in the design artifact or only in a screenshot without updating this document.

## What is not done

- Making a PDF brief or another design document the SoT for colors/fonts
- Pasting many screenshots into `04-ux/` as a substitute for tokens
- Changing the IA/nav in the design artifact and assuming the repo follows automatically

---

# Locked Decisions (process)

| ID     | Topic                                  | Decision                                                                                                                                                                                                                                                                   |
| ------ | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DT-D01 | Token SoT location                     | `product-discovery/06-engineering/design-tokens.md`                                                                                                                                                                                                                        |
| DT-D02 | When it is filled in                   | Iterative, co-equal with the design artifact (ADR-140); locked whenever King Rezi considers it stable — there is no "designer joins" gate (ADR-057); use the Stone theme tokens (ADR-087)                                                                                  |
| DT-D03 | Relationship with designer handoff     | There is no external designer, permanently (ADR-057); the `design/` folder is removed and not recreated (ADR-045); final tokens still **must** go into this document                                                                                                       |
| DT-D04 | Relationship with the UX Baseline      | `04-ux/` governs flows & functional zones; this document is only visual tokens                                                                                                                                                                                             |
| DT-D05 | Implementation stack                   | shadcn/ui for components/theme + Tailwind as direct styling (ADR-097, reversing ADR-041)                                                                                                                                                                                   |
| DT-D06 | Stone→shadcn technical mapping (T-095.5) | The literal Stone theme values (ADR-087) are mapped 1:1 to the shadcn/ui CSS variables in § Engineering Mapping — an implementation reference for T-096.1, **not** a new brand token (different from § Color — Brand, which is still `TBD` awaiting design lock)        |

---

# Typography

| Slot           | Role                                          | Value                     | Notes                                                                    |
| -------------- | --------------------------------------------- | ------------------------- | ------------------------------------------------------------------------ |
| `font/display` | Brand moments (login, optional empty hero)    | `TBD`                     | Avoid Inter/Roboto/Arial as the main identity                            |
| `font/sans`    | Product UI (nav, list, form, caption)         | `TBD`                     | Readability priority; tabular numerals for time/schedule recommended     |
| `font/mono`    | Optional — technical IDs                      | `TBD` or not used         | Not for social captions                                                  |

**Type scale (design artifact → code):** `xs · sm · md · lg · xl · 2xl` — concrete size/line-height values: `TBD` after design lock.

---

# Color — Brand

| Slot                  | Used for                       | Value (hex/HSL) | Notes                                         |
| --------------------- | ------------------------------ | --------------- | --------------------------------------------- |
| `brand/primary`       | Main CTA, active nav           | `TBD`           |                                               |
| `brand/primary-hover` | Primary hover/focus            | `TBD`           |                                               |
| `brand/subtle`        | Soft accent background         | `TBD`           |                                               |
| `brand/secondary`     | Secondary action / second accent | `TBD`         | Fill in if the design uses an explicit secondary |

---

# Color — Neutral

| Slot             | Used for                          | Value (hex/HSL) | Notes                |
| ---------------- | --------------------------------- | --------------- | -------------------- |
| `bg/canvas`      | Application background            | `TBD`           |                      |
| `bg/surface`     | Panels, list rows, interaction cards | `TBD`        |                      |
| `bg/subtle`      | Secondary zones, optional zebra   | `TBD`           |                      |
| `border/default` | Default border                    | `TBD`           |                      |
| `border/strong`  | Emphasis border                   | `TBD`           | Optional             |
| `text/primary`   | Main text                         | `TBD`           |                      |
| `text/secondary` | Secondary text                    | `TBD`           |                      |
| `text/muted`     | Meta, timestamp, hint             | `TBD`           |                      |
| `text/on-brand`  | Text on top of `brand/primary`    | `TBD`           | Ensure AA contrast   |

---

# Color — Content Status

Must align with the status meanings in `../02-product/roles-permissions.md` and the visual patterns in Key Screen Patterns. Do not rely on color alone — chips still carry a text label.

| Slot               | Status            | Value (hex/HSL) | Notes                              |
| ------------------ | ----------------- | --------------- | ---------------------------------- |
| `status/draft`     | Draft             | `TBD`           |                                    |
| `status/in-review` | In Review         | `TBD`           |                                    |
| `status/ready`     | Ready to Schedule | `TBD`           |                                    |
| `status/scheduled` | Scheduled         | `TBD`           |                                    |
| `status/published` | Published         | `TBD`           |                                    |
| `status/failed`    | Failed            | `TBD`           | Must have high contrast (UXP-04)   |

---

# Color — Feedback

| Slot               | Used for                                   | Value (hex/HSL) | Notes                                                                                                                                                                                                                      |
| ------------------ | ------------------------------------------ | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `feedback/success` | Success toast, confirmation                | `TBD`           |                                                                                                                                                                                                                            |
| `feedback/warning` | Warnings (account about to expire, etc.)   | `TBD`           | The `warning` variant on the `Alert` component (`border-warning/40 bg-warning/10 text-warning`, the icon follows the color); used by the Draft Editor warning banner (T-250)                                               |
| `feedback/danger`  | Errors, destroy actions                    | `TBD`           | Semantically aligned with `status/failed` where needed                                                                                                                                                                     |
| `feedback/info`    | Neutral info                               | `TBD`           |                                                                                                                                                                                                                            |

---

# Color — Platform (optional)

Social network accent colors in the Calendar / Account Pill. Must not dominate the UI.

| Platform    | Value | Usage strength                |
| ----------- | ----- | ----------------------------- |
| Instagram   | `TBD` | `TBD` (small / medium hint)   |
| Facebook    | `TBD` | `TBD`                         |
| Twitter / X | `TBD` | `TBD`                         |
| LinkedIn    | `TBD` | `TBD`                         |
| TikTok      | `TBD` | `TBD`                         |
| YouTube     | `TBD` | `TBD`                         |
| Threads     | `TBD` | `TBD`                         |
| Pinterest   | `TBD` | `TBD`                         |

---

# Spacing

**Locked (ADR-095).** Base unit: **4px grid**. This scale is locked based on
values already used consistently in the real Astryx-era code (the `gap`/
`padding` props on `VStack`/`HStack`/`Stack`/`Grid`) — not new numbers
invented from scratch. The 4px grid value still stands as a decision after the
migration to shadcn/ui (ADR-097); its expression in code is now the direct Tailwind
spacing scale (e.g. `gap-4`, `p-4` for unit 4 = 16px), no longer the numeric Astryx
`gap`/`padding` props — see `apps/web/.claude/CLAUDE.md`
for the latest shadcn spacing conventions.

| Unit (× 4px) | Px   | Status                                                |
| ------------ | ---- | ----------------------------------------------------- |
| 0            | 0px  | Used (deliberate spacing reset)                       |
| 0.5          | 2px  | Used (dense UI, rare)                                 |
| 1            | 4px  | Used (icon-to-label, tightest)                        |
| 1.5          | 6px  | Used (dense UI)                                       |
| 2            | 8px  | Used (tight list items)                               |
| 3            | 12px | Used (between fields)                                 |
| 4            | 16px | **Most often used** — default between fields/inside a Card |
| 5            | 20px | Used (rare)                                           |
| 6            | 24px | Used (between sections)                               |
| 8            | 32px | Used (page-level padding)                             |

Other values (7, 9, 10+) are not yet used — they may be used if a real need
arises, this scale is **not closed** to the old list (4/8/12/16/24/32/48).
A 4px grid with 0.5-multiple flexibility at the low end for dense UI
(small icon+label) reflects real usage more accurately than the
classic closed list.

## Semantic Usage Guide

| Context                                                   | Prop (Astryx era) | Value (px)    | Reason                                                              |
| --------------------------------------------------------- | ----------------- | ------------- | ------------------------------------------------------------------- |
| Icon-to-label (Button, MenuItem, Badge)                   | `gap`             | 1–1.5 (4–6px) | Elements very close, minimal visual distance                        |
| Items in a tight list/stack (Table rows, Menu items)      | `gap`             | 2 (8px)       | Clear grouping but still dense                                      |
| Between form fields / between components within one Card/Section | `gap`      | 3–4 (12–16px) | Separation between related but distinct input units                 |
| Between sections/blocks within one page                   | `gap`             | 6 (24px)      | A firmer visual separation of sections                              |
| Internal padding of small components (Badge, Chip, Pill)  | `padding`         | 1–1.5 (4–6px) | Dense components, minimal padding                                   |
| Standard Card/Section/Container padding                   | `padding`         | 4 (16px)      | The most common default                                             |
| Large Container/page-level wrapper padding                | `padding`         | 8 (32px)      | Page-level breathing room, deliberately used less often             |
| Reset/no-space (a Stack wrapped by another component)     | `gap`/`padding`   | 0             | Deliberately no extra spacing                                       |

## Prohibitions

The Astryx migration is complete (ADR-097, v0.7, T-102). Active code uses
Tailwind utilities directly on the 4px scale above. The Astryx-era `VStack` /
`HStack` prop prohibitions no longer apply.

- **Arbitrary values** (`gap-[13px]`, `p-[10px]`) — always use a unit from the
  scale above.
- **`margin`** on a child for spacing between siblings — spacing comes from the
  `gap` utility on the parent flex/grid, not `margin` on the child.

Two historical exceptions were found (`p-0`, `my-1` in `ChannelsSection.tsx`) —
recorded as small technical debt to be tidied up, **not** a precedent
to follow in new code.

---

# Radius, Elevation

| System    | Decision                                                                                                                                                                       | Value                                                                                                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Radius    | **Not** mapped from the Stone theme — keep the Maia preset default (`--radius: 0.625rem` + its `calc()` derivatives, see § Engineering Mapping below)                           | `0.625rem` base, scale `radius-sm/md/lg/xl/2xl/3xl/4xl` via `calc(var(--radius) * n)`                                                                                                                                                  |
| Elevation | `TBD`                                                                                                                                                                          | `TBD` — shadow mainly for overlays; Stone has `--shadow-low/med/high` but they are not mapped yet (outside the scope of T-095.5, shadcn components generate their own Tailwind shadow per component)                                   |

---

# Theme (Light / Dark)

| ID       | Decision | Value                                                                                                  |
| -------- | -------- | ------------------------------------------------------------------------------------------------------ |
| DT-THEME | MVP mode | `TBD` — the project's initial preference: **light-only MVP** (may be changed at design lock)           |

---

# Motion (brief)

At least 2–3 deliberate motions after design lock — record here if the design sets a duration/easing:

| Motion         | Purpose                           | Spec  |
| -------------- | --------------------------------- | ----- |
| Sidebar active | Clear section switch              | `TBD` |
| Status change  | Chip Draft → Scheduled / Failed   | `TBD` |
| Inbox badge    | Unread update                     | `TBD` |

---

# Implementation mapping

```text
Before the tokens are Locked
        ↓
Stone theme tokens (ADR-087) + Tailwind as direct styling (ADR-097)

After design-tokens.md is Locked (co-equal with the design artifact, ADR-140/057)
        ↓
apps/web — shadcn/ui CSS variables + Tailwind token bridge
        ↓
shadcn/ui components + selective wrappers + screens KSP-01 … KSP-08
```

Engineering does **not** read the designer handoff package as the source of final token
values (the `design/` folder has been removed and will not be recreated,
ADR-045, ADR-057).

---

# Engineering Mapping — Stone theme → shadcn/ui CSS variables (T-095.5)

**Status: a technical reference for T-096.1** (the `globals.css` rewrite), not
"Locked tokens" — the brand/status semantic color values above (§ Color — Brand/
Content Status/Feedback) stay `TBD` until design lock (DT-D02). This section
is purely a **literal 1:1 value** mapping from `@astryxdesign/theme-stone`
(ADR-087) to the shadcn/ui variables already in
`apps/web/src/app/globals.css` since init (T-095.1), so the app's visuals
**do not change** (Stone colors stay in use) when the Astryx foundation is dropped
in T-096. Source: `@astryxdesign/theme-stone/dist/theme.css` (version
`0.4.3` installed) — all Stone values are in the form
`light-dark(<light>, <dark>)`, split into `:root` (light) and `.dark`
(dark) below because shadcn uses the `.dark` class strategy, not native CSS
`light-dark()`.

## Colors

| shadcn/ui variable       | Light     | Dark                     | Stone token source           | Notes                                                                                                                                                                                                                                                                                                          |
| ------------------------ | --------- | ------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--background`           | `#f3f3f5` | `#111015`                | `--color-background-body`    | App canvas                                                                                                                                                                                                                                                                                                     |
| `--foreground`           | `#25252a` | `#f3f3f5`                | `--color-text-primary`       |                                                                                                                                                                                                                                                                                                                |
| `--card`                 | `#ffffff` | `#242325`                | `--color-background-card`    |                                                                                                                                                                                                                                                                                                                |
| `--card-foreground`      | `#25252a` | `#f3f3f5`                | `--color-text-primary`       |                                                                                                                                                                                                                                                                                                                |
| `--popover`              | `#ffffff` | `#25252a`                | `--color-background-popover` |                                                                                                                                                                                                                                                                                                                |
| `--popover-foreground`   | `#25252a` | `#f3f3f5`                | `--color-text-primary`       |                                                                                                                                                                                                                                                                                                                |
| `--primary`              | `#25252a` | `#f3f3f5`                | `--color-accent`             |                                                                                                                                                                                                                                                                                                                |
| `--primary-foreground`   | `#ffffff` | `#25252a`                | `--color-on-accent`          |                                                                                                                                                                                                                                                                                                                |
| `--secondary`            | `#e2e2e8` | `#3b3b3f`                | `--color-background-muted`   |                                                                                                                                                                                                                                                                                                                |
| `--secondary-foreground` | `#25252a` | `#f3f3f5`                | `--color-text-primary`       |                                                                                                                                                                                                                                                                                                                |
| `--muted`                | `#e2e2e8` | `#3b3b3f`                | `--color-background-muted`   | Same as `--secondary` — consistent with the default shadcn pattern (both values are identical in the stock preset)                                                                                                                                                                                             |
| `--muted-foreground`     | `#5c5c63` | `#9d9da3`                | `--color-text-secondary`     | **Deviates from Stone** (`#83838a`, only 3.4–3.8:1) so it passes AA 4.5:1 on top of `--card` (6.63:1), `--background` (5.99:1), and the `--muted` fill (5.14:1). Dark mode is unchanged. ADR-147 (T-163)                                                                                                       |
| `--accent`               | `#e2e2e8` | `#3b3b3f`                | `--color-background-muted`   | Same as `--muted`/`--secondary` — Stone has no separate solid hover-state token that is dense enough (`--color-overlay-hover`/`--color-neutral` are transparent, unsuitable as a solid bg)                                                                                                                     |
| `--accent-foreground`    | `#25252a` | `#f3f3f5`                | `--color-text-primary`       |                                                                                                                                                                                                                                                                                                                |
| `--destructive`          | `#58413e` | `#dcc0bc`                | `--color-error`              | Used as a text/icon color (see the `button.tsx` pattern — `bg-destructive/10 text-destructive`), not a solid fill; `--color-error` fits this role better than `--color-background-red`                                                                                                                         |
| `--border`               | `#e2e2e8` | `rgba(255,255,255,0.10)` | `--color-border`             | The dark value (`#f3f3f51a`) happens to be almost identical to the shadcn default (`oklch(1 0 0 / 10%)`)                                                                                                                                                                                                       |
| `--input`                | `#e2e2e8` | `rgba(255,255,255,0.10)` | `--color-border`             | Stone has no `input` token separate from `border` (unlike the shadcn default, which splits the 10%/15% opacity) — use `--color-border` for both, consistent with how Astryx treats field borders                                                                                                              |
| `--ring`                 | `#83838a` | `#5e5e61`                | `--color-border-emphasized`  | Stone has no dedicated focus-ring token; `border-emphasized` is the closest equivalent (used for border emphasis)                                                                                                                                                                                              |

## Sidebar (`--sidebar-*` variables, used by `T-096.3` App Shell)

| shadcn/ui variable             | Light     | Dark                     | Stone token source                                                                                                                  |
| ------------------------------ | --------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `--sidebar`                    | `#ffffff` | `#1b1b1f`                | `--color-background-surface` (different from `--background`/canvas — surface is a generic elevated surface, suitable for a sidebar) |
| `--sidebar-foreground`         | `#25252a` | `#f3f3f5`                | `--color-text-primary`                                                                                                              |
| `--sidebar-primary`            | `#25252a` | `#f3f3f5`                | `--color-accent`                                                                                                                    |
| `--sidebar-primary-foreground` | `#ffffff` | `#25252a`                | `--color-on-accent`                                                                                                                 |
| `--sidebar-accent`             | `#e2e2e8` | `#3b3b3f`                | `--color-background-muted`                                                                                                          |
| `--sidebar-accent-foreground`  | `#25252a` | `#f3f3f5`                | `--color-text-primary`                                                                                                              |
| `--sidebar-border`             | `#e2e2e8` | `rgba(255,255,255,0.10)` | `--color-border`                                                                                                                    |
| `--sidebar-ring`               | `#83838a` | `#5e5e61`                | `--color-border-emphasized`                                                                                                         |

## Chart (`--chart-1..5`)

**Not mapped** — Stone/Astryx has no chart palette system (outside the
scope of the audited Astryx components). Recommendation: leave the default shadcn
CLI grayscale as is until the Analytics domain is actually migrated
(after T-102, outside the scope of the 8 tasks of this v0.7 release) — do not invent
chart colors now.

## Radius

**Not mapped from Stone.** Stone has its own radius scale
(`--radius-inner: 0.25rem`, `--radius-element: 0.5rem`,
`--radius-container: 0.75rem`, `--radius-page: 1.5rem`,
`--radius-full`), but the Maia preset (shadcn) already generated components
(e.g. `Button` → `rounded-4xl`, see `apps/web/src/components/ui/button.tsx`)
calibrated to the CLI's default base `--radius: 0.625rem` + the derived
`calc(var(--radius) * n)` in `globals.css` `@theme inline`. Changing the base
radius to a Stone value (e.g. `--radius-element` 0.5rem) would shift
the whole derived scale without a visual review — **T-095.5 decision: keep the
Maia default**, not mapped 1:1. If King Rezi wants the old Stone radius shape
preserved exactly, that is a separate visual change that must be explicitly approved
(not part of "migration without visual change").

## Font

| shadcn/ui variable   | Value                                                                                 | Stone source                              | Status                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--font-sans` (body) | Figtree                                                                               | `--font-family-body`                      | **Already matches** — Figtree has been loaded via `next/font/google` in `layout.tsx` since T-095.1 (`const figtree = Figtree({ variable: '--font-sans' })`), no change needed                                                                                                                                                                                              |
| `--font-heading`     | **Gap**: currently `var(--font-sans)` (follows Figtree) in `globals.css` `@theme inline` line 16 | `--font-family-heading` = Montserrat | Stone uses Montserrat specifically for headings (`h1`–`h6`), not yet loaded in the project. **For T-096.1:** load `Montserrat` via `next/font/google` (same pattern as `figtree`/`geistSans` in `layout.tsx`), then change `--font-heading: var(--font-sans)` → `--font-heading: var(--font-montserrat)`                                                                  |
| `--font-mono`        | Geist Mono (left as is)                                                               | `--font-family-code` = "JetBrains Mono"   | Low priority — used only for code/technical IDs (§ Typography `font/mono`, optional). No need to change unless there is a concrete need to display code in the product UI                                                                                                                                                                                              |

## Deliberately not mapped

- **Brand/status/feedback semantic colors** (§ Color — Brand/Content
  Status/Feedback above) — stay `TBD`, awaiting design lock (DT-D02),
  not part of this Stone→shadcn technical mapping.
- **Chart palette** — see above.
- **Motion/duration** — Stone has `--duration-fast/medium/slow` but there is
  no concrete animation requirement that uses them yet (§ Motion is still
  `TBD`).

---

# Start Page Theme (ADR-144)

The public Start Page has a theme the user can choose, but it is **not** its own token set: every preset is a derivative of the existing product tokens (§ Engineering Mapping), with no new tokens and no free-form colors from the user. Allowlist enum `default | dark | accent` (`START_PAGE_THEMES`); values outside the list fall back to `default`.

| Preset    | Behavior                                                                                                         |
| --------- | ---------------------------------------------------------------------------------------------------------------- |
| `default` | Follows the app theme (light or dark)                                                                            |
| `dark`    | The dark token scope is forced                                                                                   |
| `accent`  | A **neutral accent with no hue**: an inversion of Stone's `--primary` (background `--primary`, text `--primary-foreground`) |

The design is locked in the Postific artifact (King Rezi, 2026-10-26). If a new theme or free-form colors are requested, that is a new decision (ADR), not an addition of values here.

---

# Related Documents

- `README.md` (the Engineering folder)
- `../../project-os/DECISIONS.md` — ADR-038, ADR-041, ADR-056, ADR-057, ADR-095 (Spacing scale lock), ADR-097 (migration to shadcn/ui, reversing ADR-041)
- `../../project-os/PROJECT_OVERVIEW.md` — shadcn/ui + Tailwind direct (ADR-097)
- `../04-ux/` — UX Baseline (flows & screens)
- `../02-product/roles-permissions.md` — canonical content statuses
- `../../context/ctx-design.md` — design artifact pointer (the `design/` folder removed, ADR-045)
