# RFC-NNNN: [Title — concise verb phrase, e.g. "Add Elasticsearch for movie search"]

**Author**: Your Name
**Date**: YYYY-MM-DD
**Status**: Draft | Review | Approved | Implemented | Rejected | Superseded by RFC-NNNN
**Reviewers**: Names (tech lead, peers, security)
**Decision deadline**: YYYY-MM-DD

> **TL;DR (1-2 sentences)**: What are we proposing and why.

---

## 1. Summary

1 paragraph. What change. What problem it solves. What's the desired outcome.

Goal: someone reading ONLY this section understands the proposal.

---

## 2. Motivation

### 2.1 Current state

What exists now. Be SPECIFIC.

- File:line citations.
- Metrics: latency, error rate, cost.
- Concrete pain examples (incident IDs, user complaints).

### 2.2 Problem

Why the current state is insufficient.

- Quantify if possible ("query takes 800ms" not "slow").
- Reference data: dashboards, logs, incident reports.

### 2.3 Why now

Why this needs solving in this quarter, not next year.

- Trigger event (incident, scale milestone, customer demand).
- Cost of delay.

---

## 3. Goals & Non-Goals

### 3.1 Goals (in scope)

- Goal 1 with measurable success criterion.
- Goal 2 ...

Be specific. "Reduce P99 latency from 800ms to <100ms" not "make it faster".

### 3.2 Non-goals (out of scope)

- Thing X is NOT part of this RFC.
- Reduces scope creep + sets reviewer expectation.

---

## 4. Background

Context for readers unfamiliar with the area.

- Domain concepts (link to glossary).
- Existing architecture diagram.
- Related RFCs / ADRs.

Keep brief. Reference existing docs if possible.

---

## 5. Proposal

### 5.1 High-level architecture

Diagram (ASCII / Mermaid / linked image).

### 5.2 Detailed design

For each component:
- What it does.
- Tech choices.
- Data model.
- API contracts.
- Failure modes.

### 5.3 Migration strategy

Step-by-step plan from current → target state.

If big bang impossible: phases (expand-contract / strangler fig).

---

## 6. Alternatives Considered

Document the alternatives you CONSIDERED + WHY rejected.

This is the most important section. Shows thinking.

### Alternative A: [Name]
- How it works.
- Pros.
- Cons.
- Why rejected.

### Alternative B: [Name]
- ...

### Alternative: Do nothing
- ALWAYS include. Sometimes status quo wins.
- Cost of not changing.

---

## 7. Trade-offs

What we give up by choosing this.

- Cost ($$).
- Complexity.
- New dependencies.
- Operational burden.
- Future flexibility lost.

Be honest. Senior reviewer will ask if you don't.

---

## 8. Rollout Plan

### 8.1 Phases

- Phase 1: [What] — [Timeline] — [Risk]
- Phase 2: ...

### 8.2 Feature flag strategy

How to enable/disable gradually.

### 8.3 Rollback plan

If we need to revert, how?

### 8.4 Communication

- Who to inform (PM, support, affected teams).
- When (announcement timeline).

---

## 9. Observability

How we know it's working AND when something breaks.

- Metrics: what to track.
- Alerts: thresholds + recipients.
- Logs: what's logged where.
- Dashboards: name + URL.

---

## 10. Security & Compliance

- Auth/authz changes.
- Data classification (PII?).
- Compliance impact (GDPR, PCI-DSS).
- Threat model changes.

---

## 11. Performance

- Capacity estimates.
- Load test plan.
- SLO targets.

---

## 12. Cost

- Infrastructure: $X/month.
- Engineering effort: N person-weeks.
- Ongoing maintenance.

ROI calculation if applicable.

---

## 13. Testing Strategy

- Unit / Integration / E2E coverage.
- Performance test.
- Chaos test.

---

## 14. Open Questions

Things needing decision/feedback:

- Question 1?
- Question 2?

Mark resolved with date + decision.

---

## 15. Future Work

Beyond this RFC. Set expectations.

---

## 16. References

- Related RFCs/ADRs.
- External resources (vendor docs, papers).
- Discussion threads (Slack, GitHub).

---

## Appendix

Detailed data, benchmarks, etc. Move long content here to keep main doc scannable.

---

## How to use this template

1. Copy this file: `cp 00-RFC-TEMPLATE.md YYYY-MM-DD-rfc-NNN-short-name.md`.
2. Set RFC number sequentially (look at existing).
3. Fill **Summary first** — if you can't write 1 paragraph, you don't understand the problem yet.
4. Then Motivation + Alternatives — these are the "selling" sections.
5. Detailed design last (often easiest, but stakeholders care less).
6. Send for review when ready.
7. After approval, link RFC from PR descriptions implementing it.
8. After implementation, mark Status: Implemented + date.

### Common review feedback (anticipate)

- "What about scale? P99? failure rate?"
- "Did you consider alternative X?"
- "Cost?"
- "Migration risk for existing users?"
- "How will we know if this works?"

→ Address these IN the RFC before review.

### Length expectations

- Tiny change: 1 page.
- Medium change: 3-5 pages.
- Big change: 8-15 pages.

Concise > comprehensive. Reviewer's time precious.
