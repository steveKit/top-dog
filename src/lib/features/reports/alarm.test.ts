import { describe, it, expect } from 'vitest';
import { summarizeBurgerAlarm, BURGER_ALARM_WINDOW_MS, type BurgerAlarmIntensity } from './alarm';

// Unit tests for the PURE render-time burger-alarm summarizer (TASK-071, decision
// #15: the DB stores only raw report timestamps; the alarm { active, reporterCount,
// intensity } is computed at RENDER time). No SvelteKit / Supabase — fully isolated.
//
// Invariants under test:
//   - empty input -> inactive (none);
//   - the 24h window boundary is EXCLUSIVE at exactly BURGER_ALARM_WINDOW_MS (a
//     report that old has just expired and does NOT count);
//   - reporterCount counts only in-window reports;
//   - intensity scales with count across none/low/medium/high bands;
//   - a future timestamp (clock skew) counts as fresh;
//   - an unparseable timestamp is skipped defensively (never throws / blanks).

// A fixed "now" so the age math is deterministic regardless of when the suite runs.
const NOW = new Date('2026-06-17T12:00:00.000Z');
const NOW_MS = NOW.getTime();

/** An ISO timestamp `ageMs` milliseconds before NOW. */
function isoAgedBy(ageMs: number): string {
	return new Date(NOW_MS - ageMs).toISOString();
}

describe('summarizeBurgerAlarm — empty / inactive', () => {
	it('returns an inactive alarm for no reports', () => {
		expect(summarizeBurgerAlarm([], NOW)).toEqual({
			active: false,
			reporterCount: 0,
			intensity: 'none'
		});
	});

	it('is inactive when every report is outside the 24h window', () => {
		const stale = [isoAgedBy(BURGER_ALARM_WINDOW_MS + 1), isoAgedBy(BURGER_ALARM_WINDOW_MS * 3)];

		const result = summarizeBurgerAlarm(stale, NOW);

		expect(result.active).toBe(false);
		expect(result.reporterCount).toBe(0);
		expect(result.intensity).toBe('none');
	});
});

describe('summarizeBurgerAlarm — 24h window boundary', () => {
	// Table-driven boundary cases around BURGER_ALARM_WINDOW_MS. The edge is
	// EXCLUSIVE: a report exactly at the window age has just expired.
	const cases: { name: string; ageMs: number; counts: boolean }[] = [
		{ name: 'just landed (age 0)', ageMs: 0, counts: true },
		{ name: 'one ms inside the window', ageMs: BURGER_ALARM_WINDOW_MS - 1, counts: true },
		{ name: 'exactly at the window edge (expired)', ageMs: BURGER_ALARM_WINDOW_MS, counts: false },
		{ name: 'one ms past the window', ageMs: BURGER_ALARM_WINDOW_MS + 1, counts: false }
	];

	for (const { name, ageMs, counts } of cases) {
		it(`a report ${name} ${counts ? 'counts' : 'does NOT count'}`, () => {
			const result = summarizeBurgerAlarm([isoAgedBy(ageMs)], NOW);

			expect(result.reporterCount).toBe(counts ? 1 : 0);
			expect(result.active).toBe(counts);
		});
	}
});

describe('summarizeBurgerAlarm — reporterCount counts only in-window reports', () => {
	it('counts the fresh reports and ignores the stale ones', () => {
		const reports = [
			isoAgedBy(0), // fresh
			isoAgedBy(60_000), // fresh
			isoAgedBy(BURGER_ALARM_WINDOW_MS + 5_000), // stale
			isoAgedBy(BURGER_ALARM_WINDOW_MS) // exactly expired
		];

		const result = summarizeBurgerAlarm(reports, NOW);

		expect(result.reporterCount).toBe(2);
		expect(result.active).toBe(true);
	});

	it('accepts Date objects as well as ISO strings', () => {
		const reports = [new Date(NOW_MS - 1000), isoAgedBy(2000)];

		const result = summarizeBurgerAlarm(reports, NOW);

		expect(result.reporterCount).toBe(2);
	});
});

describe('summarizeBurgerAlarm — intensity bands', () => {
	// Table-driven: intensity scales with the in-window reporter count.
	const bands: { count: number; intensity: BurgerAlarmIntensity }[] = [
		{ count: 0, intensity: 'none' },
		{ count: 1, intensity: 'low' },
		{ count: 2, intensity: 'medium' },
		{ count: 3, intensity: 'medium' },
		{ count: 4, intensity: 'high' },
		{ count: 10, intensity: 'high' }
	];

	for (const { count, intensity } of bands) {
		it(`${count} in-window report(s) -> ${intensity}`, () => {
			const reports = Array.from({ length: count }, (_, i) => isoAgedBy(i * 1000));

			const result = summarizeBurgerAlarm(reports, NOW);

			expect(result.reporterCount).toBe(count);
			expect(result.intensity).toBe(intensity);
			expect(result.active).toBe(count > 0);
		});
	}
});

describe('summarizeBurgerAlarm — clock skew / defensive parsing', () => {
	it('counts a future-timestamped report (clock skew) as fresh', () => {
		// A report "in the future" (negative age) is still within the window.
		const future = new Date(NOW_MS + 60_000).toISOString();

		const result = summarizeBurgerAlarm([future], NOW);

		expect(result.reporterCount).toBe(1);
		expect(result.active).toBe(true);
	});

	it('skips an unparseable timestamp without throwing or blanking the others', () => {
		const reports = [isoAgedBy(0), 'not-a-real-timestamp', isoAgedBy(1000)];

		const result = summarizeBurgerAlarm(reports, NOW);

		// The one bad row is skipped; the two good fresh rows still count.
		expect(result.reporterCount).toBe(2);
		expect(result.active).toBe(true);
	});

	it('accepts an epoch-ms number for "now"', () => {
		const result = summarizeBurgerAlarm([isoAgedBy(1000)], NOW_MS);

		expect(result.reporterCount).toBe(1);
	});

	it('throws on an invalid "now" (a developer error, not a data row)', () => {
		expect(() => summarizeBurgerAlarm([], 'definitely-not-a-date')).toThrow();
	});
});
