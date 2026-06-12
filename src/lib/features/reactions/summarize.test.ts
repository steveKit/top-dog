import { describe, it, expect } from 'vitest';

import { summarizeReactions, type ReactionRow } from './summarize';

// PURE-logic (TDD-grade) coverage for the reaction aggregator. summarizeReactions
// is the ENTIRE "count" mechanism for cosmetic reactions (decision #12 — there is
// no denormalized DB counter), so its correctness IS the feature: per-emoji
// distinct-member counts, the viewer's reactedByMe flag, and a deterministic sort
// (count DESC, then emoji ASC). No SvelteKit / Supabase imports — plain data in,
// plain data out.

const VIEWER = 'viewer-uuid';
const OTHER_A = 'other-a-uuid';
const OTHER_B = 'other-b-uuid';

function row(emoji: string, userId: string): ReactionRow {
	return { emoji, user_id: userId };
}

describe('summarizeReactions', () => {
	it('returns an empty list for no rows', () => {
		expect(summarizeReactions([], VIEWER)).toEqual([]);
	});

	it('returns an empty list for no rows even when viewerId is null', () => {
		expect(summarizeReactions([], null)).toEqual([]);
	});

	it('aggregates a single emoji from a single member into count 1', () => {
		const result = summarizeReactions([row('🌭', OTHER_A)], VIEWER);

		expect(result).toEqual([{ emoji: '🌭', count: 1, reactedByMe: false }]);
	});

	it('counts distinct members for one emoji', () => {
		const result = summarizeReactions(
			[row('🔥', OTHER_A), row('🔥', OTHER_B), row('🔥', VIEWER)],
			VIEWER
		);

		expect(result).toEqual([{ emoji: '🔥', count: 3, reactedByMe: true }]);
	});

	it('aggregates multiple distinct emojis independently', () => {
		const result = summarizeReactions(
			[row('🌭', OTHER_A), row('❤️', OTHER_A), row('❤️', OTHER_B)],
			VIEWER
		);

		// ❤️ has 2, 🌭 has 1 → count DESC orders ❤️ first.
		expect(result).toEqual([
			{ emoji: '❤️', count: 2, reactedByMe: false },
			{ emoji: '🌭', count: 1, reactedByMe: false }
		]);
	});

	it('marks reactedByMe true only for emojis the viewer reacted with', () => {
		const result = summarizeReactions(
			[row('🌭', VIEWER), row('🔥', OTHER_A), row('🔥', OTHER_B)],
			VIEWER
		);

		const byEmoji = new Map(result.map((r) => [r.emoji, r]));
		expect(byEmoji.get('🌭')?.reactedByMe).toBe(true);
		expect(byEmoji.get('🔥')?.reactedByMe).toBe(false);
	});

	it("counts the viewer's own reaction in the total (not just flags it)", () => {
		const result = summarizeReactions([row('🤤', VIEWER), row('🤤', OTHER_A)], VIEWER);

		expect(result).toEqual([{ emoji: '🤤', count: 2, reactedByMe: true }]);
	});

	it('reports reactedByMe false for every emoji when viewerId is null', () => {
		const result = summarizeReactions([row('🌭', OTHER_A), row('🔥', OTHER_B)], null);

		expect(result.every((r) => r.reactedByMe === false)).toBe(true);
	});

	it('orders by count DESC, then emoji ASC for equal counts (deterministic)', () => {
		// 🔥 → 2, then a 3-way tie at count 1 between ❤️, 🌭, 😂. The tie resolves by
		// emoji ASC (codepoint order): ❤️ (U+2764) < 🌭 (U+1F32D) < 😂 (U+1F602).
		const result = summarizeReactions(
			[
				row('😂', OTHER_A),
				row('🌭', OTHER_A),
				row('❤️', OTHER_A),
				row('🔥', OTHER_A),
				row('🔥', OTHER_B)
			],
			VIEWER
		);

		expect(result.map((r) => r.emoji)).toEqual(['🔥', '❤️', '🌭', '😂']);
		expect(result.map((r) => r.count)).toEqual([2, 1, 1, 1]);
	});

	it('produces the same ordering regardless of input row order', () => {
		const rows = [row('🔥', OTHER_A), row('🔥', OTHER_B), row('🌭', OTHER_A), row('❤️', OTHER_B)];
		const reversed = [...rows].reverse();

		expect(summarizeReactions(reversed, VIEWER)).toEqual(summarizeReactions(rows, VIEWER));
	});
});
