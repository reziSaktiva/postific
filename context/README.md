# AI Context Layer

An **index + operating rules** layer for AI coding agents. Not a Source of Truth for the product.

If the content of a file here conflicts with a baseline or an ADR → **the baseline + ADR win**.

---

## Purpose

- Give a short entry point per work domain (project, business/product, domain, architecture, technical, development, implementation, design).
- Point to the baseline documents that must be read — not copy `product-discovery/` or `project-os/` again.
- Enforce the boundaries between files so the agent does not put a rule in the wrong place (e.g. coding rules vs feature patterns).

---

## Structure (option A)

```text
context/
├── README.md                  ← this document
├── ctx-project.md             ← Project OS, state, rules, ADR
├── ctx-business.md            ← Business + Product + User
├── ctx-domain.md              ← Bounded context, shared types, boundary
├── ctx-architecture.md        ← Layer, ACL, jobs, auth arch, realtime
├── ctx-technical-context.md   ← Stack, env, Prisma, Better Auth, deploy/CI
├── ctx-development.md         ← DX, scripts, lint/test, coding conventions
├── ctx-implementation.md      ← Implementation patterns in apps/web & domains/
└── ctx-design.md              ← UX pointer (04-ux) + Postific design artifact (ADR-140)
```

---

## Hard boundaries between files

| File                    | Included                                                                                | Not included                                                   |
| ----------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `ctx-project`           | How the project works, phase/state, governance, ADR index                               | Product/UX/architecture detail                                 |
| `ctx-business`          | Vision, market, MVP/scope, roles, persona                                               | DDD BC, technical stack, code patterns                         |
| `ctx-domain`            | BC, entity, shared types, domain boundary rules                                         | Infra, Prisma schema detail, UI                                |
| `ctx-architecture`      | _What & why_ of the system: layer, Outstand ACL, jobs, auth arch, realtime, DB strategy | Env config, DX scripts, code style                             |
| `ctx-technical-context` | _Stack & infra_: Bun/Next, Prisma, Better Auth config, Railway, env, CI                 | Domain folder patterns, code naming conventions                |
| `ctx-development`       | DX, local/CI commands, lint/format/test, **coding rules/conventions**                   | Application Service patterns / where a feature goes in folders |
| `ctx-implementation`    | _How to write a feature_ in the repo: entry → service → domain → repo, import rules     | Stack decisions or business pricing                            |
| `ctx-design`            | Pointer to UX flows/IA (`04-ux/`) and the Postific design artifact (ADR-140)            | Detailed React component implementation                        |

---

## How to use (agent)

1. Read `../AGENTS.md` and the Snapshot in `../project-os/PROJECT_STATE.md` first. If you are going to work a task: continue to `../project-os/AVAILABLE_TICKETS.md` and stop there to choose an ID, then open only that ticket's section in `tickets/vXX-*.md`.
2. Open **one or two** `ctx-*` files relevant to the task (see the mapping table in `.claude/skills/project-os-navigator/SKILL.md`).
3. Follow the links to the baseline; read the source document before changing code or making a material decision.
4. Do not duplicate progress status (% / ✅ / phase) in `context/` files — it lives only in `PROJECT_STATE.md`, except task status, whose home is `AVAILABLE_TICKETS.md` + `tickets/` (ADR-062, ADR-131).

---

## Content rules for `ctx-*` files

- Concise: indexes, checklists, and operating rules.
- Pointers must use repo-relative paths (example: `../product-discovery/05-architecture/domain-model.md`).
- Do not copy long paragraphs from the baseline.
- Material changes (architecture, scope, stack) → ADR in `../project-os/DECISIONS.md`, then update the pointer here if needed.

---

## Related

- Agent entry point: `../AGENTS.md`
- Product Source of Truth: `../product-discovery/`
- Project OS: `../project-os/`
- Design pointer (design artifact + UX): `ctx-design.md`
