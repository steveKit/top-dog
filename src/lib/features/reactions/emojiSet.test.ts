import { describe, it, expect } from 'vitest';

import { isAllowedReactionEmoji, REACTION_EMOJIS } from './emojiSet';

// Unit coverage for the AUTHORITATIVE app-boundary emoji validation. The DB keeps
// only a length sanity CHECK, not a rigid enum (decision #12 / M6 will expand the
// set without a migration), so isAllowedReactionEmoji IS the gate that the
// wrappers and the feed form actions call before any DB write. We prove every
// allowed emoji passes and that disallowed / empty / oversized input is rejected.

describe('isAllowedReactionEmoji', () => {
	it('accepts every emoji in the allowed set', () => {
		for (const emoji of REACTION_EMOJIS) {
			expect(isAllowedReactionEmoji(emoji), `expected ${emoji} to be allowed`).toBe(true);
		}
	});

	it('rejects an emoji that is not in the allowed set', () => {
		expect(isAllowedReactionEmoji('💩')).toBe(false);
		expect(isAllowedReactionEmoji('🦄')).toBe(false);
	});

	it('rejects empty string', () => {
		expect(isAllowedReactionEmoji('')).toBe(false);
	});

	it('rejects plain non-emoji text', () => {
		expect(isAllowedReactionEmoji('hotdog')).toBe(false);
		expect(isAllowedReactionEmoji('a')).toBe(false);
	});

	it('rejects oversized input (abuse of the free-text column)', () => {
		// A would-be attacker stuffing the field with junk far past a single
		// grapheme — not in the allowed set, so rejected at the app boundary.
		expect(isAllowedReactionEmoji('🌭'.repeat(50))).toBe(false);
		expect(isAllowedReactionEmoji('x'.repeat(1000))).toBe(false);
	});

	it('rejects an allowed emoji with surrounding whitespace (exact match only)', () => {
		// The check is exact membership — a padded value is a different string and
		// must not slip through.
		expect(isAllowedReactionEmoji(' 🌭')).toBe(false);
		expect(isAllowedReactionEmoji('🌭 ')).toBe(false);
	});
});
