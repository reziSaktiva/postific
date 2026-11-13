# Project Manager

This folder is the **Project Operating System (Project OS)** for the **Postific** project.

This folder is dedicated to documenting **how work is done**: the collaboration process between the Developer and the AI Assistant, project rules, status and progress, important decisions, change history, and discussion and brainstorming logs.

Documentation about the **product** being built (business, product, user, UX, architecture, engineering) is **not** in this folder, but in `../product-discovery/`.

> **Source of Truth:**
>
> - `project-os/` — how this project is worked on (process, rules, decisions, status).
> - `../product-discovery/` — what is built (product knowledge).

---

# Purpose

The purpose of this folder is to:

- Be the center of documentation for the project's working process.
- Record all important decisions along with their reasons (ADR).
- Track the project's status, milestones, and progress in real time.
- Keep the change history (changelog) and the log of important conversations across sessions.
- Make collaboration easier between the Developer, the AI Assistant, and other contributors.
- Keep documentation and implementation in sync at all times.

---

# Scope

`project-os/` covers:

- Project working rules and principles.
- Project summary and overview.
- Current status, milestones, and progress.
- Important decisions (ADR) along with their reasons and the alternatives considered.
- Change history of documentation as well as implementation.
- Discussion logs and the idea bank from working sessions with the AI.

`project-os/` does **not** cover:

- Detailed documentation of business, product, user, UX, architecture, or engineering — see `../product-discovery/README.md`.
- Code implementation.

Exception: `ARCHITECTURE_OVERVIEW.md` is a high-level visual summary for orientation and the Figma blueprint. The architecture Source of Truth stays in `../product-discovery/05-architecture/`.

---

# Folder Structure

```text
social-media-management/
├── project-os/          → how we work, decisions, status (this folder)
│   ├── README.md
│   ├── PROJECT_OVERVIEW.md
│   ├── ARCHITECTURE_OVERVIEW.md
│   ├── PROJECT_RULES.md
│   ├── PROJECT_STATE.md      → read the "Snapshot" section first for a quick lookup
│   ├── AVAILABLE_TICKETS.md    → queue of tasks that are not finished
│   ├── tickets/              → tickets per release, including finished ones
│   ├── specs/                → specs for multi-session work
│   ├── reports/              → spike and investigation reports (e.g. T-148)
│   ├── DECISIONS.md          → compact ADR index (full text in decisions/)
│   ├── decisions/            → one file per ADR (ADR-XXX-slug.md)
│   ├── DEVELOPER_WORKFLOW.md
│   ├── QA_TEST_ACCOUNTS.md   → QA test accounts
│   ├── CONVERSATIONS.md
│   └── BRAINSTORM.md
└── product-discovery/        → product knowledge (business through engineering)
    ├── README.md
    ├── 01-business/
    ├── 02-product/
    ├── 03-user/
    ├── 04-ux/
    ├── 05-architecture/
    └── 06-engineering/
```

---

# Core Documents

| File                       | Description                                                                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PROJECT_OVERVIEW.md`      | Overall project summary.                                                                                                                                                           |
| `ARCHITECTURE_OVERVIEW.md` | High-level architecture for the Figma blueprint (not the detailed architecture SoT).                                                                                               |
| `PROJECT_RULES.md`         | Project working rules and principles.                                                                                                                                              |
| `PROJECT_STATE.md`         | Phase, milestone, overall progress, Known Issues, and Blockers. The "Snapshot" section at the top is for a quick lookup without reading it in full. Not the place for task detail. |
| `AVAILABLE_TICKETS.md`     | Queue of tasks that are not finished. Looking for available work stops here (ADR-131).                                                                                             |
| `tickets/`                 | Tickets per release, including finished ones.                                                                                                                                      |
| `specs/`                   | Specs for work that spans more than one session. Their shape is in `specs/README.md`.                                                                                              |
| `DECISIONS.md`             | Compact index of all ADRs (table + links); the full text of each ADR is in `decisions/ADR-XXX-slug.md`.                                                                            |
| `DEVELOPER_WORKFLOW.md`    | Project workflow & core user flows as mermaid diagrams (visualization, not SoT).                                                                                                   |
| `CONVERSATIONS.md`         | Log of important conversations across sessions (filled in automatically by the AI).                                                                                                |
| `BRAINSTORM.md`            | Idea bank from brainstorming sessions (filled in automatically by the AI).                                                                                                         |

---

# Relationship with Product Discovery

```text
project-os/                 product-discovery/
─────────────────                ──────────────────
How we work                ←→     What we build
Process, rules, decisions         Business, Product, User,
Status & progress                 UX, Architecture, Engineering
```

Every change to `product-discovery/` that affects the project's scope, architecture, or direction must be recorded as a decision (ADR) in `DECISIONS.md`, and its progress updated in `PROJECT_STATE.md`.

> Code implementation **always follows the documentation**, not the other way around.

---

# Working Principles

- Documentation First
- Business First
- UX Driven
- Domain-Driven Design (DDD)
- Modular Monolith Architecture
- AI Friendly Development
- Maintainability over Complexity
- Scalability by Design

---

# Current Status

To find the latest project status, see:

- `PROJECT_STATE.md`

To see the decisions that have been agreed, see:

- `DECISIONS.md`

To see the product documentation, see:

- `../product-discovery/README.md`
