# Context — Design (+ UX)

Pointer to the **Postific design artifact** (artifact in Claude, ADR-140) and to the
**UX Planning Baseline** (`04-ux/`). Product/roles/persona → `ctx-business.md`.

**Note (ADR-045, ADR-057):** the `design/` folder (a handoff package for the
designer team) has been **deleted** from the repo and **will not be recreated** —
this project will not hire an external designer; the role is permanently
taken over by King Rezi himself through the design artifact. The pointers that
previously lived in the `design/` folder (now deleted) were moved to the "Postific
design artifact" section below.

---

## Read first

### UX Planning Baseline — `04-ux/` (SoT for flows & screen structure)

| Document                                                                                | Topic                            |
| --------------------------------------------------------------------------------------- | -------------------------------- |
| [`../product-discovery/04-ux/README.md`](../product-discovery/04-ux/README.md)          | UX Baseline v1.0 index (ADR-013) |
| [`information-architecture.md`](../product-discovery/04-ux/information-architecture.md) | IA / information structure       |
| [`user-flows.md`](../product-discovery/04-ux/user-flows.md)                             | Solution flows                   |
| [`navigation-patterns.md`](../product-discovery/04-ux/navigation-patterns.md)           | Navigation                       |
| [`key-screen-patterns.md`](../product-discovery/04-ux/key-screen-patterns.md)           | Critical screen patterns         |
| [`ux-principles.md`](../product-discovery/04-ux/ux-principles.md)                       | UX principles                    |

### Postific design artifact (visual reference, ADR-140)

Replaces the standalone Claude Design project and the `DesignSync` tool (standalone shuts down 2026-12-14).

| Field                  | Value                                                                                                                                                                                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Postific artifact      | https://claude.ai/artifact/FdRNU4gnxgAGY3zmBxNfR3 (Design System type). Tokens (`project/tokens.json`, `project/tokens.css`), real shadcn components (`project/components/<Name>/`), screen cards (`project/components/Screen<Name>/preview.html`), real templates (`project/templates/`) |
| Postific Design Review | https://claude.ai/artifact/4BJCWNsCwubLd7SFwRtree — gallery of all screens with a side menu; where King Rezi reviews and confirms designs                                                                                                                                                 |
| Access                 | claude.ai (log in with the same account). Read and written through the `Artifact` tool (actions `read` and `publish`)                                                                                                                                                                     |
| Sync                   | Manual/on-request, not automatic (ADR-140 point 8). There is no `DesignSync` for writing                                                                                                                                                                                                  |
| Old project            | Claude Design `84aded99-bb23-49b1-be9f-dd8f21c6873e`: read-only, released before 2026-12-14. The "Modernist" project on the same account is **not** this product's                                                                                                                        |

**How to read:** `Artifact` action `read` with the artifact `url` and the file `path` (e.g. `project/components/ScreenPublishHistory/preview.html`). The file that is read is saved locally; do not change the artifact without reading the latest version.

**How to change:** follow the artifact type's rules (read first, change only what is needed, republish with `files`, the `project/design-system.json` index last). A changed screen is republished to Postific Design Review and its card is updated in the Postific artifact. A new design must be confirmed by King Rezi in the gallery before code is written.

**Draft Editor banner name map (artifact → code, T-250):** the name in the artifact is not the same as the name in code; match through this table before interpreting a request.

| Name in artifact (`ScreenDraftEditorRedesain`) | Content                                                                                    | Code (`apps/web/src/app/(app)/components/draft-editor/`)                        | Variant                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `globalMsgs`                                   | cross-network violations (e.g. Story with mixed captions, more than one Pinterest account) | `FormAlerts.tsx`, `crossNetworkIssues` through `ValidationBanner`               | destructive, icon                                         |
| `pinBoard`                                     | Pinterest board not yet chosen                                                             | `NetworkBlock.tsx`, issue `pinterest-board-required` through `ValidationBanner` | destructive, icon                                         |
| `schedMsg`                                     | limit or past-schedule message in the footer                                               | `EditorFooter.tsx`, `scheduleTimeMessage`                                       | destructive, icon                                         |
| "tanpa media" banner                           | media required                                                                             | `NetworkBlock.tsx`, issue `media-required`                                      | warning (yellow), icon; still blocks Schedule/Publish Now |
| "Reel bukan video" banner                      | Reel needs a video                                                                         | `NetworkBlock.tsx`, issue `reel-requires-video`                                 | destructive, icon                                         |
| "Akun terputus" block                          | account needs Reconnect                                                                    | `NetworkBlock.tsx` (`isAccountDisconnected`)                                    | warning (yellow), icon                                    |
| `actionErr` (scenarios 8c, 8d)                 | Schedule or Publish Now error at the Confirmation step                                     | `ConfirmationSummary.tsx`, `notice` with error status                           | destructive, icon                                         |
| (no counterpart in the artifact)               | action-result notice above the editor                                                      | `FormAlerts.tsx`, `notice`                                                      | destructive with icon for errors                          |

This mapping was read from Neymar's report and the code (2026-11-12); if the artifact changes, update this table.

**Platform icons (T-209.3):** `PLATFORM_ICON[platform].Icon` (`apps/web/src/app/(app)/components/platform-icons.tsx`) uses the official brand-kit logos through `withOfficialLogo` (`platform-logos.tsx`) for Instagram, Facebook, LinkedIn, YouTube, Threads; files in `apps/web/public/brand/platforms/`, must not be recolored or reshaped. Below the brand minimum size (Facebook width 16 px, LinkedIn height 21 px) the component falls back to the react-icons glyph. X, Pinterest, TikTok stay react-icons glyphs until their official assets exist. Consumers do not change: still `<Icon size={n} aria-hidden />`.

---

## Operating rules

1. `04-ux/` remains the **SoT** for flows, IA, and screen function — the design artifact is only a visual representation derived from it, not a replacement.
2. `design-tokens.md` (`../product-discovery/06-engineering/design-tokens.md`) remains the **SoT for design tokens** (ADR-038) — not the design artifact, not a screenshot.
3. M8 screen implementation **does not wait** for final tokens: use the Stone theme (ADR-087) as the value reference and do not invent custom brand hex values. Since ADR-055 (amended by ADR-097), the Light/Dark Mode Toggle is an official feature (a persistent control in the sidebar footer) — its mechanism is through Tailwind `dark:` + the shadcn theme provider, not a new theme/token.
4. **shadcn/ui is the permanent component foundation** (ADR-097, reversing ADR-041). The migration from Astryx to shadcn/ui is complete (ADR-097); for status detail see `PROJECT_STATE.md` / `../project-os/tickets/v07-astryx-shadcn-migration.md` § T-102. Tailwind is used directly as styling for shadcn components; wrappers in `components/ui/` are made selectively.
5. Detailed wireframes in the M8 phase: **limited** — only if needed to implement a screen (see `PROJECT_STATE` Active Conversation Mode).
6. Content status & visual roles must align with `roles-permissions.md` (see `ctx-business.md`).
7. Personas in UI copy / examples: Raka, Maya, Sinta, Dimas, Lara.
8. Do not invent new IA, flows, or navigation patterns that contradict `04-ux/` without an ADR / baseline update.
9. Synchronization between the baseline (`04-ux/`, `design-tokens.md`) and the design artifact is **manual/on-request** — run when explicitly asked, not a mandatory checklist in every UI work session (unlike the shadcn CLI/MCP workflow in `AGENTS.md` which is mandatory for every task). Republish the artifact when the UX baseline changes meaningfully; review before accepting changes from the design artifact side (baseline + ADR still win, see item 1).
   9a. **Proactive reminder required (ADR-056, kept by ADR-140):** whenever there is a change
   related to UI/UX — whether in documents (`04-ux/`, `design-tokens.md`)
   or in the design artifact (via the `Artifact` tool) — the AI **must**
   explicitly tell King Rezi that the two sides may be out of
   sync, and ask whether they need to be aligned now. For **visual
   value tokens**, `design-tokens.md` and the design artifact are **co-equal**
   (neither has to be the first writer, amendment to ADR-038). For
   **flow/screen function**, `04-ux/` remains the SoT as in item 1 above —
   the reminder here means "check whether the representation in the artifact still
   matches", not changing who wins.
10. **Scope discipline (required, incident ADR-052):** before changing anything in the
    design artifact — especially when asked to add a comparison control
    (toggle/switch between variants) — read and follow
    `.claude/skills/claude-design-scope-discipline/SKILL.md`. The gist: never
    change a default/state the user has approved as a side effect of a new feature;
    if the scope is ambiguous, ask first; verification of done
    includes "no unrequested side effects", not just "the new feature
    works".

---

## UI task mapping → read

| Task                                      | Read                                                   |
| ----------------------------------------- | ------------------------------------------------------ |
| Compose a page / route per the menu       | `information-architecture.md`                          |
| Publish / approve / connect account flow  | `user-flows.md`                                        |
| Sidebar, navigation, Settings entry point | `navigation-patterns.md`                               |
| Editor, inbox, analytics screen patterns  | `key-screen-patterns.md`                               |
| Content Format (Post/Reel/Story/Pin)      | `key-screen-patterns.md` (KSP-05-F11) + ADR-039        |
| Font, color, neutral, status (SoT)        | `../product-discovery/06-engineering/design-tokens.md` |
| UI components / styling                   | `monorepo-setup.md` + ADR-097 + local shadcn CLI/MCP   |

React implementation follows `ctx-implementation.md`. Use the Stone theme neutral
tokens during M8 (Light/Dark Mode Toggle ADR-055, amended by ADR-097,
still applies across all sections — see `IconButton`/toggle in the sidebar
footer); simple components may be imported directly and critical/broad components
use selective wrappers. Tokens that are already locked (co-equal with the design
artifact, not waiting for an external designer — ADR-140, ADR-057) are mapped to
shadcn/ui CSS variables + the Tailwind token bridge.

---

## Related context

- Roles, MVP, persona → `ctx-business.md`
- UI entry code patterns → `ctx-implementation.md`
- Stack / token mirror into code → `ctx-technical-context.md`
- Project mode (wireframes allowed or not) → `ctx-project.md` + `PROJECT_STATE.md`
- Decision to delete `design/` → `../project-os/DECISIONS.md` (ADR-045)
- Scope discipline when changing the design artifact → `../.claude/skills/claude-design-scope-discipline/SKILL.md` (ADR-052)
- Artifact replaces Claude Design, docs ↔ artifact sync, and the proactive reminder obligation → `../project-os/DECISIONS.md` (ADR-140, replacing ADR-042 and ADR-056)
- No external designer, permanent → `../project-os/DECISIONS.md` (ADR-057)
