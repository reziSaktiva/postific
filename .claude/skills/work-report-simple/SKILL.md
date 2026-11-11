---
name: work-report-simple
description: >-
  Automatically explain completed work in plain, easy-to-understand language —
  like a subordinate briefing their boss. Use this skill after completing any
  task: creating documents, editing files, making changes, or finishing a work
  session. Produces a friendly summary covering what was done, why it matters,
  key outcomes, and next steps. Triggers when work is completed and a clear
  summary is needed.
---

# Work Report — Plain Language

After finishing any piece of work, always write a short report in language anyone can understand — the way a subordinate reports results to their boss.

---

## When to Use

Automatically after:

- Creating or editing a document / file
- Finishing a task or assignment
- Changing code, configuration, or project structure
- Ending a work session

---

## Report Format

Use the structure below, in conversational language, with analogies where they help.

### 1. Done by (REQUIRED, top line of the report)

Name the persona who did the work — the subagent name if it was done through a
named subagent in `.claude/agents/` (e.g. "Prabowo Feature Engineer", "Elon
Backend Engineer"), or **"Main AI"** if it was done directly without
delegating to a specific subagent. If several subagents took part in one
session, name them all (e.g. "Elon Backend Engineer + Ridwan Architecture
Reviewer").

### 2. What Was Done

2–4 sentences. Explain the finished work as if telling a story to someone who does not know the technical context. Use an analogy when it helps.

### 3. Contents / Key Points

Explain the key points of the result. Use bullet points or a simple table. Each point must be understandable without opening the file.

### 4. Why This Matters

One or two sentences on the impact on the project or on the next piece of work.

### 5. Next Steps

Name the next task briefly and clearly.

---

## Style Rules

- Language: follow `AGENTS.md` rule 8.
- Avoid technical jargon without explanation. When a technical term is unavoidable, explain it in a few words next to it — for example: "Information Architecture (the app's floor plan)".
- Everyday analogies are welcome for clarifying abstract concepts.
- Tone: warm, professional, straight to the point — not stiff, not long-winded.
- Report length is proportional to the size of the work. Small work → short report. Large work → more detailed report, but still concise.
- Do not say "I used skill X" or mention the skill name. Report the result directly.
- The "Done by" line is required even when the report is very short.

---

## Example Output

**After creating `information-architecture.md`:**

---

`information-architecture.md` is done. Here is a summary of what was made:

**Done by:** Main AI

**What was done:**
I made the "floor plan of the app" — a document that decides which menus exist, which pages sit inside each menu, and where each kind of user enters the app.

**Key points:**

- There are 5 main menus: **Home, Publish, Engage, Analyze, Start Page** — the order follows the real workflow, not a feature list
- The AI has no menu of its own — it appears inside the caption editor when needed
- Raka (who works day to day) goes straight to Publish; Maya (the manager) enters through Home to check status
- Every Must Have MVP feature is mapped to a specific screen

**Why it matters:**
This is the foundation before we design the user flows and the screen layouts.

**Next:**
`user-flows.md` — the solution flows for the users' core jobs.

---

**After creating a configuration file:**

---

`docker-compose.yml` is done. Here is a summary of what was made:

**Done by:** Elon Backend Engineer

**What was done:**
I made a "recipe" file that tells Docker how to run every part of the application at once — database, backend, and frontend — with a single command.

**Key points:**

- 3 services: PostgreSQL (database), API server, and Next.js frontend
- All of them are connected to each other over an internal network
- Database data is kept in a volume so it is not lost when the container is shut down

**Why it matters:**
Other developers can run the project right away without a complicated manual setup.

**Next:**
Try it with `docker compose up` and make sure all services run normally.

---
