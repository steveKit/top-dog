# Milestone M7: Safety & Polish

> **Status:** `pending`
> Index: [[TASKS]] · Architecture: [[PROJECT]] · Conventions: [[CLAUDE]]
> **Goal:** upload limits, report button, polish.

## Active Tasks

### TASK-070: Upload limits enforcement [`pending`] [`P1`] [`S`]

**Owner:** unassigned
**Dependencies:** TASK-013
**Acceptance Criteria:**

- [ ] Hard size + count limits enforced server-side (not just client)
- [ ] Clear errors on violation

### TASK-071: Report button [`pending`] [`P2`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-013, TASK-011
**Acceptance Criteria:**

- [ ] Report a hot dog or profile; stored for review
- [ ] RLS: reporter identity not exposed to reported user

### TASK-072: Polish pass [`pending`] [`P3`] [`M`]

**Owner:** unassigned
**Dependencies:** all prior milestones
**Acceptance Criteria:**

- [ ] Responsive layout, empty states, loading states
- [ ] `pnpm lint`, `pnpm check`, `pnpm test`, `@smoke` all green

---

> **No caps.** Acceptance criteria, subtasks, and integration points are
> unbounded. Give each task as much specificity as it needs to be completed to
> spec — never trim detail to hit a count.
