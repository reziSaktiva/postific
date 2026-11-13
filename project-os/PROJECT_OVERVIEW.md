# PROJECT OVERVIEW

## Metadata

| Field        | Value      |
| ------------ | ---------- |
| Project Name | Postific   |
| Version      | 0.1.0      |
| Status       | Active     |
| Owner        | Rezi       |
| Last Updated | 2026-07-21 |

---

# Project Summary

Postific is a web-based platform that helps users manage all of their social media activity from a single dashboard.

This project is developed as a modern alternative to Buffer (buffer.com), focusing on a user experience that is simple, fast, and easy to use.

Integration with the various social media platforms will use the **Outstand API**, so the application can focus on user experience and business features without having to build social media integrations from scratch.

---

# Product Vision

To build a modern Social Media Management platform that lets marketing teams, startups, and digital agencies manage their social media activity efficiently through a single centralized dashboard.

---

# Project Goals

### Short Term

- Build a Minimum Viable Product (MVP)
- Provide a stable publishing experience
- Have an architecture that is easy to extend
- Finish core features before additional features

### Long Term

- Become an alternative to Buffer
- Support a wide range of social media platforms
- Have a scalable architecture
- The user's AI works inside the product through MCP (ADR-138)
- Support team collaboration and more complex workflows

---

# Target Users

Primary Users:

- Marketing Team

Secondary Users:

- Startup
- Digital Agency

Future Users:

- Enterprise

---

# MVP Scope

Main features planned for the MVP:

- Workspace
- Publishing
- Analytics
- Engagement
- MCP Server (the user's own AI works in Postific, ADR-138)
- Start Page

---

# Supported Social Platforms

Social media platforms supported by the application (ADR-037; via Outstand):

1. Instagram
2. Facebook
3. Twitter / X
4. LinkedIn
5. TikTok
6. YouTube
7. Threads
8. Pinterest

Source of Truth for the enum: `SocialPlatform` in `packages/shared`.

---

# Technical Overview

| Category            | Decision                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| Repository Strategy | Hybrid Monorepo                                                                                       |
| Runtime             | Bun                                                                                                   |
| Framework           | Next.js                                                                                               |
| Language            | TypeScript                                                                                            |
| Architecture        | Modular Monolith                                                                                      |
| Design Pattern      | Domain-Driven Design (DDD)                                                                            |
| Database            | Supabase PostgreSQL                                                                                   |
| ORM                 | Prisma                                                                                                |
| Data Access         | Prisma (CRUD) + Supabase client (Realtime, Storage)                                                   |
| Auth                | Better Auth                                                                                           |
| Storage             | Supabase Storage                                                                                      |
| Deployment          | Railway                                                                                               |
| CI                  | GitHub Actions                                                                                        |
| Lint / Format       | ESLint + Prettier                                                                                     |
| Pre-commit          | Lefthook + lint-staged                                                                                |
| Test Runner         | Vitest                                                                                                |
| Env / Secrets       | Railway Variables + `.env.local` (native)                                                             |
| Dependencies        | Bun workspaces; `^` ranges; root `bun.lock`; manual updates. Astryx is no longer used (ADR-097)       |
| Styling             | Tailwind CSS _(direct styling of shadcn/ui components)_                                               |
| UI Components       | shadcn/ui _(ADR-097, reversing ADR-041 — the migration from Astryx is complete, release v0.7, T-102)_ |
| External Provider   | Outstand API                                                                                          |

---

# Development Principles

This project is developed on the following principles:

- Documentation First
- Business First
- Domain-Driven Design
- AI Friendly Development
- Maintainability over Complexity
- Scalability by Design
- Iterative Development

---

# Developer Profile & Working Preferences

This section documents who works on this project and what their working preferences are, so the AI Assistant can collaborate consistently without having to be told again every session.

Unlike the other sections of this document, this section **may grow** over time whenever a new preference is found in a working session — but it must still record only preferences that have been **confirmed**, not assumptions.

**Profile:**

- Solo developer (Rezi) — there is no other team at the moment.
- Builds this project while writing the documentation in parallel (Documentation First).

**Confirmed Working Preferences:**

- The language of communication and documentation follows `AGENTS.md` rule 8.
- Structural changes (folders, paths, rules) must be executed completely until all related documents are consistent — never left half-done.
- Every inconsistency the AI finds must be stated explicitly to the user, not ignored or silently fixed.
- Prefers a tidy, unambiguous documentation structure over speed — good documentation is considered more important than coding right away.
- Open to re-discussing documentation decisions (governance, document classification) if a long-term inconsistency risk is found.

**How to Add a New Entry:**

If a working session reveals a new preference (e.g. code review style, how decisions are approved, communication habits), add it as a new bullet above. Do not delete old entries unless the user explicitly states that preference no longer applies.

---

# Related Documents

→ ARCHITECTURE_OVERVIEW.md
→ PROJECT_STATE.md
→ PROJECT_RULES.md
→ DECISIONS.md
→ ../context/ctx-design.md
→ ../product-discovery/README.md
→ ../product-discovery/01-business/README.md
→ ../product-discovery/02-product/README.md
→ ../product-discovery/04-ux/README.md
→ ../product-discovery/05-architecture/README.md
→ ../product-discovery/06-engineering/README.md
→ ../product-discovery/06-engineering/design-tokens.md
