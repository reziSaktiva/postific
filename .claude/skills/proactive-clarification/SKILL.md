---
name: proactive-clarification
description: >-
  Guides the AI to proactively identify undecided decisions before executing any
  task: documentation, features, architecture, configuration, or any other
  interaction. The AI must ask first, offering the best-in-class options, rather
  than assume. Use this skill before working on any task that has an unclear
  decision fork.
---

# Proactive Clarification

Before working on any task, the AI must identify whether an important decision is still undecided, one that would send the output in the wrong direction if assumed. If there is one, ask first. Only then do the work.

---

## Core Principle

**Do not assume, ask first.** This applies to ALL kinds of tasks:

- Writing or revising documentation
- Building a feature or component
- Choosing a library, tool, or service
- Designing an architecture or flow
- Configuring an environment or infrastructure
- UX/UI design decisions

**Exception:** If the decision is already documented in the project baseline (an ADR, `DECISIONS.md`, or the relevant baseline document), use that decision. Do not ask again.

---

## When to Ask

Ask before execution when there is a **decision fork** that:

1. **Is not in the project baseline yet.** It is not in `DECISIONS.md`, an ADR, or a relevant document.
2. **Has a significant impact on the output.** Different choices produce substantially different documents / code / structure.
3. **Has equally valid options.** No single answer is "clearly right".

### Examples of Forks to Ask About

| Context          | Example question                                                  |
| ---------------- | ----------------------------------------------------------------- |
| Auth feature     | Which provider? (Supabase Auth, Better Auth, NextAuth, Clerk)     |
| Database         | Which ORM? (Prisma, Drizzle, Kysely)                              |
| State management | Which approach? (Zustand, Jotai, React Query, Context API)        |
| Flow docs        | Whose point of view is the main focus? (a specific persona)       |
| Deployment       | Target platform? (Vercel, Railway, Fly.io, self-hosted VPS)       |
| Testing          | Which framework? (Vitest, Jest, Playwright, Cypress)              |
| UX pattern       | Which navigation paradigm is used? (tab bar, sidebar, breadcrumb) |

---

## How to Ask

### 1. Identify the Fork

Before asking, determine:

- What is unclear?
- What is the impact on the output?
- What are the best relevant options?

### 2. Present the Best Options

Give options that are **truly the best in their class**, not a list of everything that exists. Quota: at most 4 of the most relevant and proven options. Include a short note on why each one is attractive.

**Format when using the `AskUserQuestion` tool:**
Use `AskUserQuestion` to collect answers in a structured way. Tool limits: 1 to 4 questions per call and 2 to 4 options per question; the "Other" option is added automatically, so do not create it yourself. A frontier of more than 4 forks is split into several sequential calls, still ordered from the highest impact down.

**Format when asking conversationally:**

```
Before I start, there is one decision you need to make first:

**[Aspect to decide]**

Best options:
- **[Option A]** — [why it is attractive, when it fits]
- **[Option B]** — [why it is attractive, when it fits]
- **[Option C]** — [why it is attractive, when it fits]

Which one do you want to use?
```

### 3. Questions per Round

Ask per **round**, not one at a time and not everything at once without order:

- **Decision frontier** = all forks that can be answered now, meaning those that do not depend on the answer to another fork. One round contains that whole frontier (batched into one `AskUserQuestion` call when using the tool), ordered from the highest impact down.
- A fork that depends on the answer from this round goes into the next round; do not ask it before its time.
- **Recommendation first:** write each fork with the recommended option first, marked "(Recommended)" on the label when using the tool (or "(recommended)" when asking in text), together with a one-sentence reason. King Rezi only needs to approve it or replace it.
- **Find facts yourself:** anything that can be answered by reading the baseline, code, or documents is not asked; read it, then state the finding as the basis for the recommendation. Only decisions (choices that truly belong to King Rezi) are asked.
- **Done when the frontier is empty:** repeat rounds until no fork remains, whether one still open or one newly raised by an earlier answer.

---

## Quality of the Options Presented

The options presented must be:

- **Relevant:** fit the project context (tech stack, phase, scale)
- **Best in class:** not merely popular, but proven and actively used
- **Curated:** show only those that truly compete; drop what is outdated or irrelevant
- **Contextual:** every option has one sentence on why it is attractive or when it fits best

### Example of Good Options (Auth)

```
- **Supabase Auth** — already integrated if you use Supabase as the DB; zero config
- **Better Auth** — framework-agnostic, self-hostable, full enterprise features
- **Clerk** — best DX with ready-made UI components; fits when auth is not an engineering focus
- **NextAuth v5** — the standard Next.js choice; flexible but needs more setup
```

### Example of Bad Options (do not do this)

```
- Supabase
- Firebase
- Auth0
- Okta
- Passport.js
- Custom JWT
- ...
```

Too many, no context, not curated.

---

## After Getting an Answer

1. Confirm the chosen option in one sentence.
2. If the choice affects a document or a project decision, ask whether it should be recorded in `DECISIONS.md`.
3. If the answer opens a new fork, ask the next round (see "Questions per Round").
4. When the frontier is empty, summarize the shared understanding (the decisions taken and those taken from the baseline) in a few lines, then **wait for King Rezi to confirm**. Do not act before that confirmation.
5. After confirmation, continue executing the task.

---

## Critical Rules

- Do not skip a question just because you feel you already know the answer, unless it is already in the baseline.
- Do not ask about trivial matters that do not substantially affect the output.
- Do not list options that are outdated, irrelevant, or not recommended for this context.
- If the user responds with "up to you" or "you decide", pick the best option with its reason, then confirm before proceeding.
