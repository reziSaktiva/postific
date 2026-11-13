# User Segments

This document defines the user groups of the **Postific** product, distinguishes the buyer from the daily user, and sets segment priorities for the MVP.

This segmentation must be consistent with Business Baseline v1.0 and is the basis for Persona, User Goals, Pain Points, JTBD, UX Discovery, and Architecture Discovery.

---

# Overview

User Segments describes **who** the product targets, not **how** they use features.

In this project, the main unit of analysis is the **Organization**, while the user (User) is a member of that organization.

For that reason, segmentation is done by organization characteristics first, followed by identifying the buyer and the daily user.

The product focuses on organizations that manage social media collaboratively.

The Individual Creator, Influencer, and Personal Brand segments are not an MVP focus.

---

# Purpose

- Translate the Target Market into actionable user segments.
- Determine the Ideal Customer Profile (ICP).
- Separate the buyer and the daily user explicitly.
- Determine segment priorities for the MVP.
- Provide a consistent basis for Persona, Goals, JTBD, UX, and Architecture.

---

# Scope

## In Scope

- Primary and secondary user segments.
- Ideal Customer Profile.
- Buyer vs Daily User.
- Organization characteristics.
- Segment priorities.
- Non-priority segments.

## Out of Scope

- Individual personas.
- Goals.
- Pain Points.
- JTBD.
- User Journey.
- UX Solution.
- Permission System.
- Technical Architecture.

---

# Segmentation Principles

Segmentation is done based on a combination of the following dimensions.

- Type of organization.
- How the team collaborates.
- Publishing intensity.
- Number of social media accounts.
- Workflow complexity.
- The difference between buyer and daily user.

Segmentation is **not** done by company size alone.

---

# Ideal Customer Profile (ICP)

The organizations that best fit the MVP have the following characteristics.

- Manage more than one social media account.
- Have more than one member involved in the workflow.
- Publish content regularly.
- Already experience context switching between tools.
- Need visibility of work across members.
- Are starting to need workflow standardization.

The more of the characteristics above are met, the higher the product fit with the MVP.

---

# Primary Segment

## Marketing Team

**Priority:** P0

The Marketing Team is the main segment for the MVP.

This segment consists of organizations that have an in-house team managing the social media of one or several brands.

### Organization Characteristics

- Team size of around 3–20 people.
- Have a clear division of responsibilities.
- Manage more than one social media channel.
- Have a consistent publishing cadence.
- Use analytics for evaluation.

### Why Primary

- Has the highest collaboration needs.
- Experiences fragmented workflow most often.
- The product's value is easiest to prove.
- Aligned with the Product Vision and Business Baseline.

### Typical Buyer

- Marketing Manager
- Head of Marketing
- Founder (small organization)

### Typical Daily Users

- Social Media Manager
- Social Media Specialist
- Content Creator
- Copywriter
- Community Manager

---

# Secondary Segments

## Startup

**Priority:** P1

Startups with an in-house marketing team that is starting to grow.

### Organization Characteristics

- Small team.
- Many members have dual roles.
- Focus on execution speed.
- Need simple onboarding.
- Workflow is starting to grow but is not yet complex.

### Buyer

- Founder
- Marketing Lead
- Growth Lead

### Daily Users

- Marketing Generalist
- Social Media Owner
- Content Creator

### Product Fit

A fit when the startup already has a consistent publishing rhythm.

---

## Digital Agency

**Priority:** P1

Agencies that manage the social media of several clients at once.

### Organization Characteristics

- Multi-client.
- Multi-brand.
- High deadlines.
- Repetitive workflow.
- Need visibility across clients.

### Buyer

- Agency Owner
- Operations Lead
- Account Director

### Daily Users

- Social Media Manager
- Community Manager
- Content Creator
- Account Coordinator

### Product Fit

A fit for small to mid-sized agencies that need a centralized dashboard without enterprise complexity.

---

# Buyer vs Daily User

The Buyer and the Daily User have different needs.

| Dimension | Buyer                           | Daily User                       |
| --------- | ------------------------------- | -------------------------------- |
| Success   | The team is more productive     | Work gets done faster            |
| Concern   | ROI, cost, team adoption        | Workflow speed                   |
| Value     | Organizational efficiency       | Operational efficiency           |
| Evaluates | Workspace, Reporting, Analytics | Publishing, Calendar, Engagement |
| Risk      | The product is too complex      | The product slows work down      |

The product must be able to win both perspectives.

The Buyer buys the product.

The Daily User determines retention.

---

# Segment Priority

| Segment            | Priority | Decision                                                   |
| ------------------ | -------- | ---------------------------------------------------------- |
| Marketing Team     | P0       | The whole MVP is optimized for this segment                |
| Startup            | P1       | Supported without sacrificing the Marketing Team           |
| Digital Agency     | P1       | Supported as long as it does not add enterprise complexity |
| Individual Creator | P3       | Not a basis for MVP decisions                              |
| Enterprise         | Future   | Evaluated after Product-Market Fit                         |

---

# Segment Decision Criteria

A segment is fit to be an MVP target if it meets most of the following conditions.

- The workflow is carried out by more than one person.
- Publishing is done regularly.
- Manages more than one social media account.
- Has coordination needs.
- Experiences context switching between tools.
- Needs a centralized dashboard.

If most conditions are not met, that segment is not an MVP priority.

---

# Anti-ICP

The following segments are not an MVP target.

- Individual Creator.
- Influencer.
- Personal Brand.
- Hobbyist.
- A Freelance Social Media Manager who works alone.
- Enterprise with complex compliance.
- Agency that needs white-label.
- Organizations that do not yet have a routine social media workflow.

Product decisions must not be optimized for the segments above.

---

# Expansion Opportunity

After Product-Market Fit is reached in the Primary Segment, expansion opportunities may include:

- Individual Creator.
- Enterprise.
- White-label Agency.
- Multi-brand Enterprise Organization.
- Franchise Organization.

This document does not discuss the needs of those segments in detail.

---

# Assumptions Validated

| ID   | Assumption                                                             | Observation                                      | Status                  |
| ---- | ---------------------------------------------------------------------- | ------------------------------------------------ | ----------------------- |
| A-01 | Marketing Team is the primary user                                     | Best fit with the ICP                            | Supported               |
| A-02 | Buyer and Daily User are different                                     | Seen in the Marketing Team and Agency            | Supported               |
| A-08 | Individual Creator is not an MVP focus                                 | Does not fit the collaboration value proposition | Supported               |
| A-09 | Startups and Agencies have work patterns similar to the Marketing Team | Similar workflow with a different context        | Supported (with nuance) |

---

# Expected Output

After this document is complete, the project has:

- A consistent segmentation definition.
- An Ideal Customer Profile.
- A clear Buyer and Daily User.
- Segment priorities for the MVP.
- A basis for Persona, Goals, JTBD, UX, and Architecture.

---

# Exit Criteria

The document is considered complete when:

- The Primary and Secondary Segments have been set.
- The Ideal Customer Profile has been defined.
- The Buyer and Daily User have been separated.
- Segment priorities have been agreed.
- The Anti-ICP has been defined.
- Personas can be created without ambiguity.

---

# Related Documents

- `README.md`
- `discovery-plan.md`
- `user-personas.md`
- `user-goals.md`
- `pain-points.md`
- `jobs-to-be-done.md`
- `user-journey.md`
- `insights.md`
- `../01-business/target-market.md`
- `../01-business/problem-statement.md`
- `../02-product/mvp-definition.md`
- `../../project-os/DECISIONS.md`
