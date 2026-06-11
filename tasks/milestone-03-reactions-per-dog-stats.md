# Milestone M3: Reactions & Per-Dog Stats

> **Status:** `pending`
> Index: [[TASKS]] · Architecture: [[PROJECT]] · Conventions: [[CLAUDE]]
> **Goal:** cosmetic reactions, peak votes.

## Active Tasks

### TASK-030: Hot dog reactions (cosmetic) [`pending`] [`P2`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-013
**Acceptance Criteria:**

- [ ] `hotdog_reactions` migration + RLS (many per user, no ranking effect)
- [ ] Drop hot-dog emoji reactions on a photo; render counts
- [ ] Reactions explicitly do NOT change vote_count or ranking

### TASK-031: Per-dog stats [`pending`] [`P3`] [`S`]

**Owner:** unassigned
**Dependencies:** TASK-021
**Acceptance Criteria:**

- [ ] Track/display peak_votes per dog
- [ ] Stats visible on the dog detail view

---

> **No caps.** Acceptance criteria, subtasks, and integration points are
> unbounded. Give each task as much specificity as it needs to be completed to
> spec — never trim detail to hit a count.
