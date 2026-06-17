import { describe, it, expect } from 'vitest';
import { bannerAngle, MAX_BANNER_ANGLE_DEG } from './angle';

// Unit tests for the PURE seeded banner-tilt helper (TASK-071). Each HAMBURGER
// ALARM police-tape strip is rotated by a small, jaunty angle derived from a seed
// string (`${dogId}:${label}`) so the strips look hand-slapped but stay STABLE per
// (dog, label) — no jitter between re-renders. No SvelteKit / Supabase — isolated.
//
// Invariants:
//   - deterministic: the same seed always yields the same angle;
//   - varied: different seeds (dog id + label) spread across the range;
//   - bounded: every angle stays within ±MAX_BANNER_ANGLE_DEG.

describe('bannerAngle — determinism', () => {
	it('returns the same angle for the same seed across calls (no per-render jitter)', () => {
		const seed = 'dog-123:HAMBURGER';

		const first = bannerAngle(seed);
		const second = bannerAngle(seed);
		const third = bannerAngle(seed);

		expect(second).toBe(first);
		expect(third).toBe(first);
	});

	it('is a pure function of the seed string (label changes the tilt)', () => {
		const top = bannerAngle('dog-123:HAMBURGER');
		const bottom = bannerAngle('dog-123:ALARM');

		// The two strips on the SAME dog use different labels, so they tilt
		// independently — the banners don't look like one rigid block.
		expect(top).not.toBe(bottom);
	});
});

describe('bannerAngle — variation across seeds', () => {
	it('produces a spread of distinct angles across many different dog ids', () => {
		const angles = new Set<number>();
		for (let i = 0; i < 50; i++) {
			angles.add(bannerAngle(`dog-${i}:HAMBURGER`));
		}

		// FNV-1a + mulberry32 over distinct seeds should give a wide spread, not a
		// single constant. Allow a tiny collision margin but demand real variety.
		expect(angles.size).toBeGreaterThan(40);
	});

	it('does not collapse to zero for typical seeds', () => {
		const nonZero = ['a:x', 'b:y', 'c:z', 'dog-1:HAMBURGER'].some(
			(seed) => bannerAngle(seed) !== 0
		);
		expect(nonZero).toBe(true);
	});
});

describe('bannerAngle — bounded within ±MAX_BANNER_ANGLE_DEG', () => {
	it('stays within the tilt bound for a large sample of seeds', () => {
		for (let i = 0; i < 1000; i++) {
			const angle = bannerAngle(`seed-${i}:label-${i % 7}`);
			expect(angle).toBeGreaterThanOrEqual(-MAX_BANNER_ANGLE_DEG);
			expect(angle).toBeLessThanOrEqual(MAX_BANNER_ANGLE_DEG);
		}
	});

	it('handles an empty seed within the bound', () => {
		const angle = bannerAngle('');
		expect(angle).toBeGreaterThanOrEqual(-MAX_BANNER_ANGLE_DEG);
		expect(angle).toBeLessThanOrEqual(MAX_BANNER_ANGLE_DEG);
	});
});
