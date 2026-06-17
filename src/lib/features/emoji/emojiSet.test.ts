import { describe, it, expect } from 'vitest';

import { HOTDOG_EMOJIS, isHotdogEmoji } from './emojiSet';

// PROJECT.md decision #16 (Emoji Library): the M6 render filter is backed by a
// curated HOT-DOG emoji library that is the single source of truth for both the
// allowed render set and the sprinkle source. These tests pin that the library
// exists, is non-empty, contains the canonical hot dog, and that membership is a
// reliable predicate (TASK-060). This is a SEPARATE set from the reaction picker
// in reactions/emojiSet.ts — do not conflate them.

describe('HOTDOG_EMOJIS', () => {
	it('is non-empty', () => {
		expect(HOTDOG_EMOJIS.length).toBeGreaterThan(0);
	});

	it("includes the canonical hot dog '🌭'", () => {
		expect(HOTDOG_EMOJIS).toContain('🌭');
	});
});

describe('isHotdogEmoji', () => {
	it("returns true for the canonical hot dog '🌭'", () => {
		expect(isHotdogEmoji('🌭')).toBe(true);
	});

	it("returns false for a non-hot-dog food emoji '🍕'", () => {
		expect(isHotdogEmoji('🍕')).toBe(false);
	});

	it("returns false for a plain ASCII letter 'a'", () => {
		expect(isHotdogEmoji('a')).toBe(false);
	});

	it('returns true for every member of HOTDOG_EMOJIS (set and predicate agree)', () => {
		for (const emoji of HOTDOG_EMOJIS) {
			expect(isHotdogEmoji(emoji)).toBe(true);
		}
	});
});
