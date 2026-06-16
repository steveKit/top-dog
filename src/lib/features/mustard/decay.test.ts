import { describe, it, expect } from 'vitest';

import { mustardOpacity, MUSTARD_LIFESPAN_MS } from './decay';

// PROJECT.md decision #15 (Mustard Mechanic): a mustard spray fades over 24h and
// its opacity is computed at RENDER time from the stored `sprayed_at` timestamp —
// no cron, no persisted decayed value. These tests pin that pure decay contract
// (TASK-040): full at spray time, linear to 0 across 24h, clamped at both ends,
// and tolerant of clock skew / mixed input forms.

// Fixed reference instant so each case reads as the age it pins, not as Date
// plumbing. All cases derive `now` (or `sprayedAt`) from this anchor.
const NOW_MS = Date.UTC(2026, 5, 16, 12, 0, 0); // 2026-06-16T12:00:00.000Z
const HOUR_MS = 60 * 60 * 1000;

describe('MUSTARD_LIFESPAN_MS', () => {
	it('is exactly 24 hours in milliseconds', () => {
		expect(MUSTARD_LIFESPAN_MS).toBe(24 * 60 * 60 * 1000);
	});
});

describe('mustardOpacity — decay curve', () => {
	it('returns exactly 1.0 at spray time (age 0)', () => {
		expect(mustardOpacity(NOW_MS, NOW_MS)).toBe(1.0);
	});

	it('returns ~0.5 at the half-life (age 12h)', () => {
		const sprayedAt = NOW_MS - 12 * HOUR_MS;
		expect(mustardOpacity(sprayedAt, NOW_MS)).toBeCloseTo(0.5, 10);
	});

	it('returns ~0.75 at quarter-life (age 6h) — linearity sanity', () => {
		const sprayedAt = NOW_MS - 6 * HOUR_MS;
		expect(mustardOpacity(sprayedAt, NOW_MS)).toBeCloseTo(0.75, 10);
	});

	it('returns ~0.25 at three-quarter-life (age 18h) — linearity sanity', () => {
		const sprayedAt = NOW_MS - 18 * HOUR_MS;
		expect(mustardOpacity(sprayedAt, NOW_MS)).toBeCloseTo(0.25, 10);
	});
});

describe('mustardOpacity — expiry clamping', () => {
	it('returns exactly 0.0 at the moment of expiry (age = 24h)', () => {
		const sprayedAt = NOW_MS - MUSTARD_LIFESPAN_MS;
		expect(mustardOpacity(sprayedAt, NOW_MS)).toBe(0.0);
	});

	it('returns 0.0 (clamped, never negative) well past expiry (age = 48h)', () => {
		const sprayedAt = NOW_MS - 48 * HOUR_MS;
		expect(mustardOpacity(sprayedAt, NOW_MS)).toBe(0.0);
	});

	it('returns a small positive value just before expiry (age = 24h - 1ms)', () => {
		const sprayedAt = NOW_MS - (MUSTARD_LIFESPAN_MS - 1);
		const opacity = mustardOpacity(sprayedAt, NOW_MS);
		expect(opacity).toBeGreaterThan(0);
		expect(opacity).toBeLessThan(1e-6);
	});
});

describe('mustardOpacity — future-timestamp guard (clock skew)', () => {
	it('clamps to 1.0 when now is before sprayedAt', () => {
		const sprayedAt = NOW_MS + HOUR_MS; // sprayed "in the future" vs now
		expect(mustardOpacity(sprayedAt, NOW_MS)).toBe(1.0);
	});

	it('does not return >1 or NaN under clock skew', () => {
		const sprayedAt = NOW_MS + 10 * HOUR_MS;
		const opacity = mustardOpacity(sprayedAt, NOW_MS);
		expect(Number.isNaN(opacity)).toBe(false);
		expect(opacity).toBeLessThanOrEqual(1);
		expect(opacity).toBeGreaterThanOrEqual(0);
	});
});

describe('mustardOpacity — input flexibility (Date | ISO string | epoch ms)', () => {
	const sprayedMs = NOW_MS - 12 * HOUR_MS;

	it('accepts epoch milliseconds', () => {
		expect(mustardOpacity(sprayedMs, NOW_MS)).toBeCloseTo(0.5, 10);
	});

	it('accepts Date objects', () => {
		expect(mustardOpacity(new Date(sprayedMs), new Date(NOW_MS))).toBeCloseTo(0.5, 10);
	});

	it('accepts ISO timestamp strings (as Postgres timestamptz returns)', () => {
		const sprayedIso = new Date(sprayedMs).toISOString();
		const nowIso = new Date(NOW_MS).toISOString();
		expect(mustardOpacity(sprayedIso, nowIso)).toBeCloseTo(0.5, 10);
	});

	it('produces identical results across Date, ISO string, and epoch ms inputs', () => {
		const fromMs = mustardOpacity(sprayedMs, NOW_MS);
		const fromDate = mustardOpacity(new Date(sprayedMs), new Date(NOW_MS));
		const fromIso = mustardOpacity(
			new Date(sprayedMs).toISOString(),
			new Date(NOW_MS).toISOString()
		);
		expect(fromDate).toBe(fromMs);
		expect(fromIso).toBe(fromMs);
	});
});

describe('mustardOpacity — invalid input', () => {
	it('throws on an unparseable sprayedAt string', () => {
		expect(() => mustardOpacity('not-a-date', NOW_MS)).toThrow();
	});

	it('throws on an unparseable now string', () => {
		expect(() => mustardOpacity(NOW_MS, 'not-a-date')).toThrow();
	});

	it('throws on a NaN epoch input', () => {
		expect(() => mustardOpacity(NaN, NOW_MS)).toThrow();
	});

	it('throws on an Invalid Date object', () => {
		expect(() => mustardOpacity(new Date('not-a-date'), NOW_MS)).toThrow();
	});
});

describe('mustardOpacity — invariant: always within [0, 1]', () => {
	it('stays within [0, 1] across the full age range (and beyond both ends)', () => {
		// Sample from "1h in the future" (skew) through "48h old" (well past expiry).
		for (let ageMs = -HOUR_MS; ageMs <= 48 * HOUR_MS; ageMs += 30 * 60 * 1000) {
			const sprayedAt = NOW_MS - ageMs;
			const opacity = mustardOpacity(sprayedAt, NOW_MS);
			expect(Number.isNaN(opacity)).toBe(false);
			expect(opacity).toBeGreaterThanOrEqual(0);
			expect(opacity).toBeLessThanOrEqual(1);
		}
	});
});
