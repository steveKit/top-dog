# Milestone M6: Emoji Library

> **Status:** `active`
> Index: [[TASKS]] · Architecture: [[PROJECT]] · Conventions: [[CLAUDE]]
> **Goal:** hot-dog emoji set + render-time filter + random sprinkle. TDD-first.

## Active Tasks

### TASK-061: Apply emoji filter in walls/DMs render [`in_progress`] [`P2`] [`S`]

**Owner:** unassigned
**Dependencies:** TASK-060, TASK-050, TASK-051
**Acceptance Criteria:**

- [ ] Wall + DM rendering pipes body through the filter
- [ ] Custom hot-dog emoji assets render correctly

---

> **No caps.** Acceptance criteria, subtasks, and integration points are
> unbounded. Give each task as much specificity as it needs to be completed to
> spec — never trim detail to hit a count.

## Completed Tasks (this milestone)

### TASK-060: Emoji filter + sprinkle logic [`complete`] [`P2`] [`M`]

**Owner:** unassigned
**Dependencies:** none
**Description:** Filter at RENDER (decision 16 — store original). TDD.
**Acceptance Criteria:**

- [x] Pure function: replace all non-hot-dog emoji with hot-dog emoji at render
- [x] Random hot-dog emoji sprinkle into wall messages (seeded for testability)
- [x] Original stored text is never mutated
- [x] Tests: mixed emoji input, no-emoji input, sprinkle determinism

**Notes:** The first M6 task lands the **pure render-time emoji seam** — a
dependency-free string-transform module realizing **decision #16** (hot-dog-only
library, filter at RENDER time, the ORIGINAL stored body is NEVER mutated). This is
a direct implementation of an existing decision, so **no new architecture-decision
row** — and it mirrors the established **pure-logic-first, orphan-by-design** pattern
of `voting/ranking.ts` and `mustard/decay.ts`: **no production consumer yet** (the
filter is wired into walls/DM render by **TASK-061**), so it is an accepted
orphan-by-design, **no Discovered Work logged for the missing consumer**. New feature
folder `src/lib/features/emoji/`: `emojiSet.ts` exports the curated `HOTDOG_EMOJIS`
set (`🌭 🥖 🌮 🥨 🧂 🍟 🔥`, deliberately **single-codepoint / modifier-free** so each
member is always exactly one grapheme cluster — the property the filter and sprinkle
both lean on) plus `isHotdogEmoji(grapheme)`; `filter.ts` exports the two pure
transforms. `filterToHotdog(text)` replaces every **non-library** emoji with a hot-dog
emoji, iterating by grapheme **CLUSTER** via `Intl.Segmenter` so ZWJ sequences,
skin-tone modifiers, and regional-indicator flags are matched/replaced as one unit and
**never split mid-codepoint** (an emoji probe of `\p{Extended_Pictographic}` OR
`\p{Regional_Indicator}`, since flags are built from regional indicators that aren't
themselves Extended_Pictographic). `sprinkleHotdog(text, seed, opts?)` deterministically
sprinkles library emoji using a **hand-written `mulberry32` PRNG — zero dependencies**
(same `(text, seed)` → same output), and only **ADDS** library emoji, never removing,
replacing, or reordering existing tokens. Both return a NEW string and never mutate the
input. **Built TDD-first** (RED → GREEN → verify) per decision #2 (emoji
replacement + sprinkle is a named TDD-first spec); coverage exercises mixed-emoji input,
no-emoji passthrough, and sprinkle determinism. Two **non-behavioral pre-merge cleanups**
(neither a bug): stale TDD "STUB" banner comments removed, and a dead `_SPRINKLE_SOURCE`
export the reviewer flagged was dropped. **One non-blocking reviewer finding logged as
DW-019** (forward-looking): exact-string membership in `isHotdogEmoji` means a
VS16-decorated variant of a library emoji — e.g. `🔥` + U+FE0F — is replaced with `🌭`
rather than preserved; benign against the AC, and the right place to DECIDE intended
behavior is TASK-061 when real user content flows through the filter. Reviewer **APPROVE,
0 production fix cycles**. Gates at merge: `pnpm test` 603/603, `pnpm check` 0 errors,
`pnpm lint` clean. **PR #71** (squash `a2e309d`) · Reviewer APPROVE. **M6 stays open —
TASK-061 (apply the filter in walls/DM render) remains.**
