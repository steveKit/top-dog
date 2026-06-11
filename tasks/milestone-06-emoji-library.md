# Milestone M6: Emoji Library

> **Status:** `pending`
> Index: [[TASKS]] · Architecture: [[PROJECT]] · Conventions: [[CLAUDE]]
> **Goal:** hot-dog emoji set + render-time filter + random sprinkle. TDD-first.

## Active Tasks

### TASK-060: Emoji filter + sprinkle logic [`pending`] [`P2`] [`M`]

**Owner:** unassigned
**Dependencies:** none
**Description:** Filter at RENDER (decision 16 — store original). TDD.
**Acceptance Criteria:**

- [ ] Pure function: replace all non-hot-dog emoji with hot-dog emoji at render
- [ ] Random hot-dog emoji sprinkle into wall messages (seeded for testability)
- [ ] Original stored text is never mutated
- [ ] Tests: mixed emoji input, no-emoji input, sprinkle determinism

### TASK-061: Apply emoji filter in walls/DMs render [`pending`] [`P2`] [`S`]

**Owner:** unassigned
**Dependencies:** TASK-060, TASK-050, TASK-051
**Acceptance Criteria:**

- [ ] Wall + DM rendering pipes body through the filter
- [ ] Custom hot-dog emoji assets render correctly

---

> **No caps.** Acceptance criteria, subtasks, and integration points are
> unbounded. Give each task as much specificity as it needs to be completed to
> spec — never trim detail to hit a count.
