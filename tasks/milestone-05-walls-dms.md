# Milestone M5: Walls & DMs

> **Status:** `pending`
> Index: [[TASKS]] · Architecture: [[PROJECT]] · Conventions: [[CLAUDE]]
> **Goal:** message walls + direct messages.

## Active Tasks

### TASK-050: Message walls [`pending`] [`P2`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-011
**Acceptance Criteria:**

- [ ] `wall_messages` migration + RLS (store ORIGINAL body; author/owner may delete)
- [ ] Post to and render a profile's wall

### TASK-051: Direct messages [`pending`] [`P2`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-011
**Acceptance Criteria:**

- [ ] `dms` migration + RLS (only sender/recipient read; sender inserts)
- [ ] Send/receive DMs; mark read_at

---

> **No caps.** Acceptance criteria, subtasks, and integration points are
> unbounded. Give each task as much specificity as it needs to be completed to
> spec — never trim detail to hit a count.
