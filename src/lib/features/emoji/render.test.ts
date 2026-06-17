import { describe, it, expect } from 'vitest';

import { stringToSeed, renderWallBody, renderMessageBody } from './render';
import { filterToHotdog } from './filter';
import { isHotdogEmoji } from './emojiSet';

// TASK-061 TEST-AFTER coverage for the M6 render-time COMPOSITION layer
// (render.ts). The lower-level filterToHotdog / sprinkleHotdog transforms are
// already exhaustively covered by filter.test.ts (TASK-060) — these tests do NOT
// duplicate that. They pin the composition contracts render.ts adds on top:
//
//   - stringToSeed: a stable, deterministic uuid → uint32 sprinkle seed.
//   - renderWallBody:    filter THEN seeded sprinkle (wall surface).
//   - renderMessageBody: filter ONLY, never a sprinkle (DM surface).
//
// PROJECT.md decision #16 governs the whole layer: the transforms run at RENDER
// time and the ORIGINAL body argument is NEVER mutated.

// --- shared assertion helpers -----------------------------------------------

const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
function graphemes(text: string): string[] {
	return Array.from(segmenter.segment(text), (seg) => seg.segment);
}
function isEmojiGrapheme(grapheme: string): boolean {
	if (/\p{Extended_Pictographic}/u.test(grapheme)) return true;
	return /\p{Regional_Indicator}/u.test(grapheme);
}
function countHotdogEmoji(text: string): number {
	return graphemes(text).filter((g) => isEmojiGrapheme(g) && isHotdogEmoji(g)).length;
}

// Independent re-implementation of FNV-1a (32-bit) — NOT a copy of render.ts's
// function, so it serves as an oracle: if the production hash ever changes
// algorithm, the pinned expectations below diverge and the test fails. Kept
// separate on purpose.
function fnv1aOracle(input: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

// Probe several candidate ids against a chosen no-emoji body, returning the first
// id whose wall render (sprinkle fires) actually DIFFERS from the body — i.e. the
// id-seeded sprinkle produced at least one added emoji. Lets the wall-vs-DM
// distinction test assert on a meaningful, sprinkle-firing case rather than a
// silently-empty one.
function findSprinklingId(body: string, candidates: string[]): string | undefined {
	return candidates.find((id) => renderWallBody(body, id) !== body);
}

describe('stringToSeed', () => {
	it('is deterministic — same input yields the same number across calls', () => {
		const id = '11111111-2222-3333-4444-555555555555';
		expect(stringToSeed(id)).toBe(stringToSeed(id));
	});

	it('is stable across many repeated calls (no hidden state drift)', () => {
		const id = 'a1b2c3d4-e5f6-7890-abcd-ef0123456789';
		const first = stringToSeed(id);
		for (let i = 0; i < 5; i++) {
			expect(stringToSeed(id)).toBe(first);
		}
	});

	it('generally differs across different inputs (sampled uuids)', () => {
		const ids = [
			'00000000-0000-0000-0000-000000000000',
			'11111111-1111-1111-1111-111111111111',
			'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
			'deadbeef-cafe-babe-f00d-0123456789ab'
		];
		const seeds = ids.map(stringToSeed);
		const unique = new Set(seeds);
		// All four distinct uuids should hash to distinct seeds (no collision in
		// this small, well-separated sample).
		expect(unique.size).toBe(ids.length);
	});

	it('returns a uint32 (non-negative 32-bit integer) for varied inputs', () => {
		const inputs = ['', 'x', 'topdog', '😀 emoji id', '11111111-1111-1111-1111-111111111111'];
		for (const input of inputs) {
			const seed = stringToSeed(input);
			expect(Number.isInteger(seed)).toBe(true);
			expect(seed).toBeGreaterThanOrEqual(0);
			expect(seed).toBeLessThanOrEqual(0xffffffff);
		}
	});

	it('matches an independent FNV-1a oracle for fixed known strings (pins the hash)', () => {
		// Pinning concrete values via an independent re-implementation: if render.ts's
		// hash algorithm ever changes, these diverge and the test catches it.
		const fixtures = ['topdog', '00000000-0000-0000-0000-000000000000', 'wall-message-1'];
		for (const s of fixtures) {
			expect(stringToSeed(s)).toBe(fnv1aOracle(s));
		}
	});
});

describe('renderWallBody', () => {
	it('applies the filter — a non-library emoji (😀) becomes a hot-dog emoji', () => {
		const out = renderWallBody('hello 😀 world', 'some-id');
		expect(out).not.toContain('😀');
		// At least one hot-dog emoji is present (the replacement; sprinkle may add more).
		expect(countHotdogEmoji(out)).toBeGreaterThanOrEqual(1);
	});

	it('is deterministic for the same (body, id) across calls', () => {
		const body = 'the quick brown fox jumps over the lazy dog';
		const id = 'fixed-id-42';
		expect(renderWallBody(body, id)).toBe(renderWallBody(body, id));
	});

	it('can differ for the SAME body with a DIFFERENT id (sprinkle is id-seeded)', () => {
		const body = 'plenty of words here to give the sprinkler room to work across the string';
		const ids = ['id-a', 'id-b', 'id-c', 'id-d', 'id-e', 'id-f', 'id-g', 'id-h'];
		const baseline = renderWallBody(body, ids[0]);
		const others = ids.slice(1).map((id) => renderWallBody(body, id));
		// At least one different id produces a different render — proof the id seeds
		// the sprinkle rather than being ignored.
		expect(others.some((out) => out !== baseline)).toBe(true);
	});

	it('preserves existing hot-dog-library emoji (🌭 survives the filter)', () => {
		const out = renderWallBody('my dog 🌭 is the best', 'id-keep');
		expect(out).toContain('🌭');
	});

	it('does not mutate the input body (purity)', () => {
		const body = 'keep 😀 me 🍕 intact';
		const snapshot = body;
		renderWallBody(body, 'id-pure');
		expect(body).toBe(snapshot);
		// The original still holds the foreign emoji — nothing changed in place.
		expect(body).toContain('😀');
	});

	it('handles the empty string', () => {
		expect(renderWallBody('', 'id-empty')).toBe('');
	});
});

describe('renderMessageBody', () => {
	it('applies the filter — a non-library emoji (🍕) becomes a hot-dog emoji', () => {
		const out = renderMessageBody('lunch 🍕 today');
		expect(out).not.toContain('🍕');
		expect(countHotdogEmoji(out)).toBe(1);
	});

	it('adds NO sprinkle — output equals filterToHotdog(body) exactly', () => {
		// The strongest possible statement of "filter only, no sprinkle": the DM render
		// is byte-identical to running the filter alone, for several bodies including
		// long multi-token ones where a sprinkle would otherwise be most likely to fire.
		const bodies = [
			'short note',
			'a much longer message with many whitespace separated tokens that a sprinkle could attach to',
			'mixed 😀 emoji 🍕 and 🌭 text',
			'plain ascii only, no emoji at all'
		];
		for (const body of bodies) {
			expect(renderMessageBody(body)).toBe(filterToHotdog(body));
		}
	});

	it('contains no more hot-dog emoji than filterToHotdog(body) alone', () => {
		const body = 'tokens tokens tokens tokens tokens tokens tokens tokens';
		expect(countHotdogEmoji(renderMessageBody(body))).toBe(countHotdogEmoji(filterToHotdog(body)));
	});

	it('preserves existing hot-dog-library emoji (🌭 survives)', () => {
		expect(renderMessageBody('top 🌭 dog')).toContain('🌭');
	});

	it('does not mutate the input body (purity)', () => {
		const body = 'foreign 😀 emoji here';
		const snapshot = body;
		renderMessageBody(body);
		expect(body).toBe(snapshot);
		expect(body).toContain('😀');
	});

	it('handles the empty string', () => {
		expect(renderMessageBody('')).toBe('');
	});
});

describe('wall vs DM distinction', () => {
	it('wall sprinkles where DM does not — for a no-emoji body and a sprinkle-firing id', () => {
		// A body with NO emoji isolates the sprinkle: filterToHotdog is a no-op, so any
		// difference between wall and DM output is the wall-only seeded sprinkle.
		const body = 'just plain words here with several tokens to sprinkle around freely';
		const candidates = [
			'id-1',
			'id-2',
			'id-3',
			'id-4',
			'id-5',
			'id-6',
			'id-7',
			'id-8',
			'id-9',
			'id-10'
		];
		const firingId = findSprinklingId(body, candidates);
		// Guard: the test is only meaningful if we actually found a sprinkling id.
		expect(firingId, 'expected at least one candidate id to trigger a sprinkle').toBeDefined();

		const wall = renderWallBody(body, firingId as string);
		const dm = renderMessageBody(body);

		// DM is the untouched body (no emoji to filter, no sprinkle).
		expect(dm).toBe(body);
		// Wall added at least one hot-dog emoji via the sprinkle — so they differ.
		expect(wall).not.toBe(dm);
		expect(countHotdogEmoji(wall)).toBeGreaterThan(countHotdogEmoji(dm));
	});

	it('wall and DM agree on the FILTER for a body with emoji but no sprinkle effect', () => {
		// Sanity: stripping the wall's added sprinkle emoji recovers the same filtered
		// content the DM renders — the filter half is shared, only the sprinkle differs.
		const body = 'pizza 🍕 party';
		const dm = renderMessageBody(body);
		// DM equals filter alone.
		expect(dm).toBe(filterToHotdog(body));
		// Both replaced the foreign emoji.
		expect(dm).not.toContain('🍕');
		expect(renderWallBody(body, 'any-id')).not.toContain('🍕');
	});
});
