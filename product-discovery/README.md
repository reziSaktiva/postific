# Product Discovery

Product Discovery is the phase for understanding **what will be built, why it must be built, and how the solution delivers value to users**.

In this phase **there is no code implementation**. All focus goes to research, planning, documentation, and decision-making so that development runs faster and large changes later are kept to a minimum.

---

# Objectives

The main objectives of Product Discovery are:

- Understand the problem to be solved.
- Define the target users.
- Define the product scope.
- Set the feature priorities for the MVP.
- Design the user experience (UX).
- Decide on the right system architecture.
- Document every engineering decision before implementation.
- Provide documentation as the reference for implementation.

---

# Workflow

All Product Discovery activities follow this order:

```text
Business
    ↓
Product
    ↓
User
    ↓
UX
    ↓
Architecture
    ↓
Engineering
```

Each stage must be finished before moving on to the next one.

---

# Folder Structure

```text
product-discovery/
├── README.md
├── 01-business/
├── 02-product/
├── 03-user/
├── 04-ux/
├── 05-architecture/
└── 06-engineering/
```

The operational summary folder for the design team (`design/`) has been removed and
**will not be recreated** — this project will not hire external designers; the
role is permanently replaced by King Rezi through the Postific design
artifact (ADR-140; earlier ADR-045, ADR-057). The pointer to the design artifact is in
`../context/ctx-design.md`.

---

# Discovery Stages

## 01 — Business

Focus on the business goals and the direction of the product.

Example topics:

- Product Vision
- Problem Statement
- Business Goals
- Target Market
- Competitor Analysis
- Pricing Strategy
- Success Metrics

---

## 02 — Product

Focus on the definition of the product.

Example topics:

- Product Scope
- MVP Scope
- Feature List
- Feature Priority
- Functional Requirements
- Non-Functional Requirements
- Product Roadmap

---

## 03 — User

Focus on who uses the product.

Example topics:

- User Personas
- User Goals
- User Journey
- User Scenarios
- Pain Points
- Jobs To Be Done (JTBD)

---

## 04 — UX

Focus on the user experience.

Example topics:

- Information Architecture
- Navigation
- Dashboard Structure
- User Flow
- Wireframe Planning
- Design Principles

---

## 05 — Architecture

Focus on the system architecture at a conceptual level.

Example topics:

- System Architecture
- Domain Design
- Bounded Context
- Module Structure
- Data Flow
- API Strategy (high-level)

---

## 06 — Engineering

Focus on the technical decisions before implementation starts.

Example topics:

- Monorepo & Workspace Setup
- Deployment Platform & Infrastructure
- Authentication Strategy
- ORM & Database Access Layer
- CI/CD Pipeline
- Environment Management
- Developer Experience (DX) Tooling
- Package & Dependency Strategy

---

# Documentation Rules

During the Product Discovery phase:

- Every important decision must be recorded in `../project-os/PROJECT_STATE.md` and `../project-os/DECISIONS.md` as needed.
- Avoid code implementation before the main documentation is finished.
- Every change must go through discussion and a clear decision.
- The documentation is the Source of Truth before implementation starts.

---

# Exit Criteria

The Product Discovery phase is considered finished when:

- Business is documented and set as Baseline v1.0.
- Product Scope is agreed and set as Baseline v1.0.
- Target User is defined and set as Baseline v1.0.
- UX is designed and set as Baseline v1.0 (ADR-013).
- System Architecture is set as Baseline v1.0 (ADR-025).
- Engineering Planning is set as Baseline v1.0 (ADR-036).
- All important decisions are recorded in `DECISIONS.md`.
- The documentation is ready to serve as the reference for implementation.

---

# Next Phase

After all Exit Criteria are met, the project enters the next phase:

**M7 — Repository & Bootstrap**

In that phase the following will be done:

- Initialize the repository based on the Hybrid Monorepo decision (ADR-001).
- Set up the workspace and tooling based on the output of Engineering Planning.
- Configure the development, staging, and production environments.
- Prepare the CI/CD pipeline.
- Prepare feature implementation (M8 — Development).

---

# Related Documents

- `../project-os/README.md`
- `../project-os/PROJECT_OVERVIEW.md`
- `../project-os/PROJECT_RULES.md`
- `../project-os/PROJECT_STATE.md`
- `../project-os/DECISIONS.md`
