# Milestone M6: Emoji Library

> **Status:** `complete` (2026-06-17 · tag `milestone-06-emoji-library`)
> Index: [[TASKS]] · Architecture: [[PROJECT]] · Conventions: [[CLAUDE]]
> **Goal:** hot-dog emoji set + render-time filter + random sprinkle. TDD-first.

## Active Tasks

_All M6 tasks complete — milestone closed. See Completed Tasks below._

---

> **No caps.** Acceptance criteria, subtasks, and integration points are
> unbounded. Give each task as much specificity as it needs to be completed to
> spec — never trim detail to hit a count.

## Completed Tasks (this milestone)

### TASK-061: Apply emoji filter in walls/DMs render [`complete`] [`P2`] [`S`]

**Owner:** unassigned
**Dependencies:** TASK-060, TASK-050, TASK-051
**Acceptance Criteria:**

- [x] Wall + DM rendering pipes body through the filter
- [x] Custom hot-dog emoji assets render correctly

**Notes:** The **final M6 task** wires the merged TASK-060 emoji seam into the
live render surfaces, **closing M6**. New pure composition layer
`src/lib/features/emoji/render.ts` (no SvelteKit/Supabase imports — unit-testable
in isolation) sits one level above `filter.ts` and keeps each Svelte component to a
single call. It realizes the consumer half of **decision #16** (filter at RENDER
time; the ORIGINAL stored body is NEVER mutated), so **no new architecture-decision
row**. The two exported render functions encode a deliberate **wall-vs-DM split**:
`renderWallBody(body, id)` = `sprinkleHotdog(filterToHotdog(body), stringToSeed(id))`
— walls get **filter + seeded sprinkle**; `renderMessageBody(body)` =
`filterToHotdog(body)` — DM thread + inbox preview get **filter only** (the random
hot-dog sprinkle is scoped to WALL messages by TASK-060's AC, so DMs never sprinkle).
The sprinkle seed comes from a hand-written **FNV-1a `stringToSeed`** (zero
dependencies) over the message's **immutable uuid `id`**, so a given wall message
sprinkles the **same** way on every re-render (no per-render jitter) — the stable
counterpart to TASK-060's deterministic `mulberry32` PRNG. Wired into **three
components**: the wall (`profile/[handle]/+page.svelte`), the DM thread
(`messages/[handle]/+page.svelte`), and the DM inbox preview
(`messages/+page.svelte`). All three keep the body inside Svelte **auto-escaped
text** (no `{@html}`), so rendering hot-dog emoji is **XSS-safe**, and because the
filter/sprinkle output is only ever a render-time return value (never written back),
**decision #16's "store original" guarantee holds structurally** — there is no
persist path that could mutate the stored body. **Zero server / DB / RLS / RPC /
migration / dependency change.** **DW-019 resolved (accepted):** the
`render.ts` header comment documents the accepted decision that a VS16-decorated
variant of a library emoji (e.g. `🔥` + U+FE0F) is replaced with `🌭` rather than
preserved — benign, since the output is still a hot-dog emoji, so no
grapheme-normalization pass is warranted. **One accepted tracked test gap logged as
DW-020:** no E2E asserts the browser-rendered wall/DM DOM shows the FILTERED body —
the store-original half is covered by `tests/walls.e2e.ts`'s verbatim-body test and
the render wiring by `render.test.ts`, so this is a sibling of DW-011/DW-013, a
candidate for a future M6/M7 E2E hardening task. Standard implementer-first,
test-after: `render.test.ts` adds **19 unit cases**. Gates at merge: `pnpm test`
622/622, `pnpm check` 0 errors, `pnpm lint` clean, `@smoke` 4/4. **PR #72** (squash
`3d85087`) · Reviewer **APPROVE, 0 production fix cycles** (2 minor non-blocking
test-strength notes only). **This closes M6.**

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
`pnpm lint` clean. **PR #71** (squash `a2e309d`) · Reviewer APPROVE. The filter was
wired into walls/DM render by **TASK-061** (PR #72 `3d85087`), which **closed M6**.
