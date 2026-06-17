// Top Dog M6 emoji library — the canonical curated HOT-DOG emoji set used both as
// the allowed render-filter library and the sprinkle source (PROJECT.md decision
// #16: hot-dog-only library; filter at RENDER time; stored text is never mutated).
//
// This is the M6 render-filter library — a SEPARATE concern from the interim
// reaction picker set in src/lib/features/reactions/emojiSet.ts (which includes
// non-hot-dog emoji like ❤️/😂 for reactions). DW-012 tracks eventually sourcing
// the reaction set from here; out of scope here — do not couple them.

/**
 * Curated hot-dog / food-adjacent emoji library. Readonly so callers can't mutate
 * the shared set. Used as BOTH the allowed render-filter set (filterToHotdog) and
 * the sprinkle source (sprinkleHotdog). Must include '🌭'.
 *
 * Single-codepoint, modifier-free graphemes only — keeping the library to plain
 * pictographs means a member is always exactly one grapheme cluster, so the render
 * filter's pass-through check (isHotdogEmoji on each cluster) and the sprinkle's
 * "every added emoji is one HOTDOG_EMOJIS member" contract both hold without any
 * cluster-splitting surprises.
 */
export const HOTDOG_EMOJIS = ['🌭', '🥖', '🌮', '🥨', '🧂', '🍟', '🔥'] as const;

export type HotdogEmoji = (typeof HOTDOG_EMOJIS)[number];

// Set for O(1) membership checks. Typed as a plain string set so arbitrary input
// (a single rendered grapheme cluster) can be tested without a cast.
const HOTDOG_SET: ReadonlySet<string> = new Set(HOTDOG_EMOJIS);

/**
 * Whether `grapheme` is a member of the hot-dog emoji library. Single-grapheme
 * membership check used by the render filter to decide pass-through vs replace.
 */
export function isHotdogEmoji(grapheme: string): boolean {
	return HOTDOG_SET.has(grapheme);
}
