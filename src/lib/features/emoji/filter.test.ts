import { describe, it, expect } from 'vitest';

import { filterToHotdog, sprinkleHotdog } from './filter';
import { HOTDOG_EMOJIS, isHotdogEmoji } from './emojiSet';

// PROJECT.md decision #16 (Emoji Library): the M6 render-time filter replaces every
// NON-hot-dog emoji grapheme with a hot-dog emoji, leaves non-emoji text and
// existing hot-dog emoji untouched, and never mutates the stored original (the
// transform is reversible because it is applied at RENDER time only). The sprinkle
// deterministically ADDS hot-dog emoji from the same library. These tests (TASK-060)
// pin both contracts, with explicit coverage of multi-codepoint grapheme clusters
// (ZWJ sequences, skin-tone modifiers, regional-indicator flags) which MUST be
// treated as single units — never shattered mid-codepoint.

// Split a string into grapheme CLUSTERS the same way the implementation must, so the
// expectations themselves never split a multi-codepoint emoji. Intl.Segmenter is
// available in the Vitest/Node (server project) environment.
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
function graphemes(text: string): string[] {
	return Array.from(segmenter.segment(text), (seg) => seg.segment);
}

// Detect emoji graphemes for assertions. A grapheme counts as "emoji" if any of its
// codepoints is Extended_Pictographic, OR it is a regional-indicator pair (flags are
// built from regional indicators, which are not themselves Extended_Pictographic).
function isEmojiGrapheme(grapheme: string): boolean {
	if (/\p{Extended_Pictographic}/u.test(grapheme)) return true;
	return /\p{Regional_Indicator}/u.test(grapheme);
}

// Multi-codepoint fixtures — each is ONE grapheme cluster despite many codepoints.
const ZWJ_FAMILY = '👨‍👩‍👧'; // ZWJ sequence (man+ZWJ+woman+ZWJ+girl)
const SKIN_TONE_THUMB = '👍🏽'; // thumbs-up + medium skin-tone modifier
const FLAG_US = '🇺🇸'; // regional-indicator pair (U+1F1FA U+1F1F8)

describe('filterToHotdog — mixed emoji input', () => {
	it('replaces non-hot-dog emoji (😀, 🍕) with hot-dog-library emoji', () => {
		const out = filterToHotdog('hi 😀 pizza 🍕 done');
		for (const g of graphemes(out)) {
			if (isEmojiGrapheme(g)) {
				expect(isHotdogEmoji(g)).toBe(true);
			}
		}
		// The non-hot-dog emoji must be gone (replaced), not preserved.
		expect(out).not.toContain('😀');
		expect(out).not.toContain('🍕');
	});

	it("preserves existing hot-dog emoji '🌭' unchanged", () => {
		const out = filterToHotdog('my dog 🌭 is best');
		expect(out).toContain('🌭');
	});

	it('preserves the surrounding non-emoji text verbatim', () => {
		const out = filterToHotdog('hi 😀 there');
		expect(out.startsWith('hi ')).toBe(true);
		expect(out.endsWith(' there')).toBe(true);
	});
});

describe('filterToHotdog — pass-through cases', () => {
	it('returns plain ASCII text byte-identical (no emoji present)', () => {
		const input = 'just some plain words, 123!';
		expect(filterToHotdog(input)).toBe(input);
	});

	it('returns non-emoji unicode text byte-identical (no emoji present)', () => {
		const input = 'café — naïve — Москва — 日本語';
		expect(filterToHotdog(input)).toBe(input);
	});

	it('returns text containing ONLY hot-dog-library emoji unchanged', () => {
		const input = `${HOTDOG_EMOJIS.join('')} ${HOTDOG_EMOJIS[0]}`;
		expect(filterToHotdog(input)).toBe(input);
	});

	it('returns empty string for empty input', () => {
		expect(filterToHotdog('')).toBe('');
	});

	it('returns whitespace-only input unchanged', () => {
		const input = '   \t\n ';
		expect(filterToHotdog(input)).toBe(input);
	});

	it('preserves leading/trailing whitespace around a replaced emoji', () => {
		expect(filterToHotdog('  😀  ')).toBe(`  ${HOTDOG_EMOJIS[0]}  `);
	});
});

describe('filterToHotdog — multi-codepoint graphemes treated as single units', () => {
	it('replaces a ZWJ family sequence as ONE unit (not shattered into parts)', () => {
		const out = filterToHotdog(`a ${ZWJ_FAMILY} b`);
		// No fragment of the family survives — it was handled whole, not split.
		expect(out).not.toContain('👨');
		expect(out).not.toContain('👩');
		expect(out).not.toContain('👧');
		expect(out).not.toContain('‍'); // no orphaned ZWJ left behind
		// Every emoji in the result is a single hot-dog grapheme.
		const emojiGraphemes = graphemes(out).filter(isEmojiGrapheme);
		expect(emojiGraphemes.length).toBe(1);
		expect(isHotdogEmoji(emojiGraphemes[0])).toBe(true);
	});

	it('replaces a skin-tone-modified emoji as ONE unit (no orphaned modifier)', () => {
		const out = filterToHotdog(`x ${SKIN_TONE_THUMB} y`);
		expect(out).not.toContain('👍');
		expect(out).not.toContain('🏽'); // skin-tone modifier must not be left behind
		const emojiGraphemes = graphemes(out).filter(isEmojiGrapheme);
		expect(emojiGraphemes.length).toBe(1);
		expect(isHotdogEmoji(emojiGraphemes[0])).toBe(true);
	});

	it('replaces a regional-indicator flag as ONE unit (not split into two letters)', () => {
		const out = filterToHotdog(`flag ${FLAG_US} here`);
		// Neither half of the flag survives as a lone regional indicator.
		expect(out).not.toContain('🇺');
		expect(out).not.toContain('🇸');
		const emojiGraphemes = graphemes(out).filter(isEmojiGrapheme);
		expect(emojiGraphemes.length).toBe(1);
		expect(isHotdogEmoji(emojiGraphemes[0])).toBe(true);
	});
});

describe('filterToHotdog — purity', () => {
	it('does not mutate the input string variable', () => {
		const input = 'keep 😀 me 🍕 intact';
		const snapshot = input;
		filterToHotdog(input);
		expect(input).toBe(snapshot);
	});

	it('returns a value distinct from a mutated input (original still has the foreign emoji)', () => {
		const input = 'foreign 😀 emoji';
		filterToHotdog(input);
		// The original still contains the non-hot-dog emoji — proof nothing in-place changed.
		expect(input).toContain('😀');
	});
});

// --- sprinkle ---------------------------------------------------------------

// Strip every emoji grapheme, leaving only the original non-emoji content. Used to
// prove the sprinkle ADDED emoji without removing/reordering the original tokens.
function withoutEmoji(text: string): string {
	return graphemes(text)
		.filter((g) => !isEmojiGrapheme(g))
		.join('');
}

function emojiGraphemesOf(text: string): string[] {
	return graphemes(text).filter(isEmojiGrapheme);
}

describe('sprinkleHotdog — determinism', () => {
	it('produces IDENTICAL output for the same (text, seed) across two calls', () => {
		const text = 'the quick brown fox jumps over the lazy dog';
		expect(sprinkleHotdog(text, 42)).toBe(sprinkleHotdog(text, 42));
	});

	it('is stable across many repeated calls (no hidden state drift)', () => {
		const text = 'best hot dog in town tonight';
		const first = sprinkleHotdog(text, 7);
		for (let i = 0; i < 5; i++) {
			expect(sprinkleHotdog(text, 7)).toBe(first);
		}
	});

	it('produces IDENTICAL output for the same (text, seed, opts) across two calls', () => {
		const text = 'sprinkle me with an explicit rate please';
		expect(sprinkleHotdog(text, 42, { rate: 0.7 })).toBe(sprinkleHotdog(text, 42, { rate: 0.7 }));
	});

	it('generally differs across seeds (at least one of several seeds differs from seed 42)', () => {
		const text = 'a moderately long sentence to give the sprinkler room to work with';
		const baseline = sprinkleHotdog(text, 42);
		const others = [1, 2, 3, 7, 99, 1000].map((s) => sprinkleHotdog(text, s));
		expect(others.some((out) => out !== baseline)).toBe(true);
	});
});

describe('sprinkleHotdog — only adds hot-dog emoji', () => {
	it('every emoji grapheme in the result is a member of HOTDOG_EMOJIS', () => {
		const out = sprinkleHotdog('plenty of words here to sprinkle across the string', 42, {
			rate: 0.9
		});
		for (const g of emojiGraphemesOf(out)) {
			expect(HOTDOG_EMOJIS).toContain(g);
		}
	});

	it('introduces no NON-hot-dog emoji even at a high rate', () => {
		const out = sprinkleHotdog('word word word word word word', 123, { rate: 1 });
		for (const g of emojiGraphemesOf(out)) {
			expect(isHotdogEmoji(g)).toBe(true);
		}
	});

	it('adds NO emoji at rate 0 (density floor)', () => {
		const out = sprinkleHotdog('one two three four five six seven', 42, { rate: 0 });
		expect(emojiGraphemesOf(out)).toEqual([]);
	});
});

describe('sprinkleHotdog — preserves original content', () => {
	it('keeps all original words present and in order (nothing removed/reordered)', () => {
		const words = ['alpha', 'bravo', 'charlie', 'delta', 'echo'];
		const text = words.join(' ');
		const out = sprinkleHotdog(text, 42, { rate: 0.8 });
		// Strip the added emoji; the original tokens must remain, in order.
		const remaining = withoutEmoji(out);
		const seenWords = remaining.split(/\s+/).filter((w) => /[a-z]/.test(w));
		expect(seenWords).toEqual(words);
	});

	it('returns empty string for empty input', () => {
		expect(sprinkleHotdog('', 42)).toBe('');
	});
});

describe('sprinkleHotdog — purity', () => {
	it('does not mutate the input string variable', () => {
		const input = 'do not touch this original text';
		const snapshot = input;
		sprinkleHotdog(input, 42, { rate: 1 });
		expect(input).toBe(snapshot);
	});
});
