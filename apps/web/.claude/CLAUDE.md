# CLAUDE

Project-specific guidance for AI coding agents.

<!-- SHADCN:START -->
shadcn/ui · style `radix-maia` (Radix base + Maia preset) · icon library `hugeicons`
CLI: run every command as `bunx shadcn@latest <cmd>` (shown below as `shadcn ...`).
MCP: an `shadcn` MCP server is registered (`.mcp.json` + `.cursor/mcp.json`, ADR-064) exposing the same lookups as tools — prefer it for exploration inside this session; fall back to CLI when MCP is unavailable.

shadcn/ui ships as source you copy into the repo (`apps/web/src/components/ui/`), not a closed dependency like Astryx — there is no version/Beta drift to track, but it also means **nothing exists until you add it**. Migration from Astryx to shadcn/ui (ADR-097) is **complete** (v0.7 release, T-102, 2026-09-04) — 0 active `@astryxdesign/*` imports remain in `apps/web/src`. Don't assume an unmigrated Astryx screen still exists; if you find one, treat it as drift and flag it rather than silently working around it.

WORKFLOW — discover, don't guess. Never invent a component name, prop, or class; every one of these steps has a cheap way to check first.

1. **Check before adding** — a component may already exist in `apps/web/src/components/ui/`. Read it before reaching for the CLI/MCP again.
2. **Search the registry** — MCP `search_items_in_registries` (or `shadcn search "<query>"`) to find the closest component/block by name or description.
3. **View before installing** — MCP `view_items_in_registries` (or `shadcn view @shadcn/<name>`) to read the actual source, props, and dependencies. Don't assume a shadcn component has the same API as its Astryx equivalent.
4. **Check real usage** — MCP `get_item_examples_from_registries` (or search for `<name>-demo`) for a working example before wiring it into a page.
5. **Install** — MCP `get_add_command_for_items` to get the exact command, then run it (`shadcn add <name>`). This copies the component's source into `components/ui/` and updates `components.json`/deps — it is not an import, so re-run when you need a newer upstream version.
6. **Audit after generating** — MCP `get_audit_checklist` after adding/wiring a component: named vs default imports, `next/image` remote patterns if used, deps installed, lint/type errors, Playwright/manual verify.

RULES:
- Tailwind utilities are the primary styling mechanism (`ctx-design.md`, ADR-097) — components are composed with Tailwind classes, not swapped in as fully-styled black boxes like Astryx's props-only model.
- Tokens for every value — use the CSS variables defined in `src/app/globals.css` (`bg-background`, `text-foreground`, `border-border`, etc.) via their Tailwind utility form. No raw hex/px, no arbitrary values (`bg-[#fff]`, `p-[13px]`) unless the token genuinely doesn't exist yet.
- `cn()` from `@/lib/utils` (clsx + tailwind-merge) for conditional/merged class names — every generated component already uses it, keep using it rather than template-string concatenation.
- Variant props (`variant`, `size`, …) are `class-variance-authority` (`cva`) definitions inside the component file itself — read the component's `cva(...)` block to see what variants actually exist instead of guessing from the Astryx equivalent's prop names.
- Icons: `hugeicons` (`@hugeicons/react` + `@hugeicons/core-free-icons`) is the configured `iconLibrary` for new shadcn components — `react-icons` (Astryx-era) stays in the tree only for code not yet migrated; don't mix the two within a single newly-written component.
- SELF-CHECK before you finish: re-read the file and replace any inline `style={{…}}`, raw hardcoded color/spacing values, or a hand-rolled variant of something the registry already provides. If unsure a component/prop exists, search/view it — don't hand-roll markup that duplicates an installable component.

MORE CLI / MCP:
  shadcn search "<query>"           find a component/block by name or description   → MCP search_items_in_registries
  shadcn view @shadcn/<name>        read a component's source, props, deps          → MCP view_items_in_registries
  shadcn add <name>                 install a component into components/ui/          → MCP get_add_command_for_items
  (registry list)                   browse everything available                      → MCP list_items_in_registries
  (usage demo)                      full working example for a component             → MCP get_item_examples_from_registries
  (configured registries)           check which registries components.json points at → MCP get_project_registries
<!-- SHADCN:END -->
