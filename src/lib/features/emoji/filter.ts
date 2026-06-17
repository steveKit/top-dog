// Top Dog M6 render-time emoji filter + sprinkle — PURE module. No SvelteKit or
// Supabase imports so the render-time text transforms can be unit-tested in
// isolation (CLAUDE.md Testing Strategy: emoji replacement + sprinkle is TDD-first;
// PROJECT.md decision #16: hot-dog-only library, filtered at RENDER time, the
// ORIGINAL stored text is NEVER mutated — these functions return NEW strings).
//
// Live wiring: this is the pure render-time transform, consumed by the M6 render
// path (wall messages, captions, DMs). That consumer is wired later — this module
// currently has no non-test caller by design, mirroring mustard/decay.ts and
// voting/ranking.ts.

import { HOTDOG_EMOJIS, isHotdogEmoji } from './emojiSet';

// Shared grapheme segmenter — iterating by grapheme CLUSTER is what keeps ZWJ
// sequences, skin-tone modifiers, and regional-indicator flags intact (a flag is a
// pair of regional indicators; a family is codepoints joined by ZWJ; both are ONE
// cluster and must be replaced/skipped as a unit, never split mid-codepoint).
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

// A grapheme is "emoji" when any codepoint is Extended_Pictographic OR it is a
// regional indicator (flags are built from regional indicators, which are not
// themselves Extended_Pictographic). Matches the test's own detection so the filter
// and the assertions agree on what counts as an emoji.
const EMOJI_PROBE = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

function isEmojiGrapheme(grapheme: string): boolean {
	return EMOJI_PROBE.test(grapheme);
}

/**
 * Render-time filter: replace every emoji grapheme in `text` that is NOT a member
 * of HOTDOG_EMOJIS with a hot-dog emoji. Non-emoji characters pass through
 * unchanged; existing hot-dog-library emoji are preserved. Emoji are matched as
 * whole grapheme CLUSTERS (ZWJ sequences, skin-tone modifiers, regional-indicator
 * flags count as ONE unit — never split mid-codepoint).
 *
 * Pure: returns a NEW string, never mutates the input.
 */
export function filterToHotdog(text: string): string {
	let out = '';
	for (const { segment } of segmenter.segment(text)) {
		if (isEmojiGrapheme(segment) && !isHotdogEmoji(segment)) {
			out += HOTDOG_EMOJIS[0];
		} else {
			out += segment;
		}
	}
	return out;
}

// Hand-written mulberry32 PRNG — deterministic, no dependency. Given the same seed
// it yields the same sequence, so (text, seed) maps to one stable sprinkle.
function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const DEFAULT_SPRINKLE_RATE = 0.3;

/**
 * Deterministically sprinkle hot-dog emoji (from HOTDOG_EMOJIS) into `text` based
 * on `seed`. Same (text, seed[, opts]) MUST produce identical output (internal
 * hand-written PRNG — no dependency). `rate` controls density. Only ADDS hot-dog
 * emoji; never removes, replaces, or reorders existing content.
 *
 * Emoji are appended after whitespace-delimited tokens (with a leading space), so
 * the original tokens stay present, in order, and individually splittable on
 * whitespace once the added emoji are stripped.
 *
 * Pure: returns a NEW string, never mutates the input.
 */
export function sprinkleHotdog(text: string, seed: number, opts?: { rate?: number }): string {
	if (text === '') return '';

	const rate = opts?.rate ?? DEFAULT_SPRINKLE_RATE;
	const rng = mulberry32(seed);

	// Split into tokens and the whitespace runs between them, preserving both so the
	// original text rebuilds verbatim when no emoji are added.
	const parts = text.split(/(\s+)/);
	let out = '';
	for (const part of parts) {
		out += part;
		// Only consider sprinkling after a non-empty, non-whitespace token.
		if (part.length === 0 || /^\s+$/.test(part)) continue;
		if (rng() < rate) {
			const emoji = HOTDOG_EMOJIS[Math.floor(rng() * HOTDOG_EMOJIS.length)];
			out += ` ${emoji}`;
		}
	}
	return out;
}
