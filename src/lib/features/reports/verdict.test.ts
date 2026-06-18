import { describe, it, expect } from 'vitest';
import {
	summarizeLiarBrand,
	isHamburgerHeretic,
	dogAlarmState,
	LIAR_BRAND_WINDOW_MS,
	type BurgerVerdict
} from './verdict';

// Unit tests for the PURE Hamburger Court verdict logic (TASK-073, decision #15: the
// DB stores raw brand timestamps + the raw verdict; the displayed banner/stamp state
// is computed at RENDER time). No SvelteKit / Supabase — fully isolated.
//
// Three pure surfaces under test:
//   - summarizeLiarBrand: the LIAR banner DECAYS over ~7 days (window-exclusive edge,
//     freshest-brand fade intensity, future/unparseable handling);
//   - isHamburgerHeretic: the HERETIC brand is PERSISTENT (derived from the verdict
//     set, no clock, no decay);
//   - dogAlarmState: verdict -> dog alarm render-state (confirmed-branch resolution).

// A fixed "now" so the age math is deterministic regardless of when the suite runs.
const NOW = new Date('2026-06-18T12:00:00.000Z');
const NOW_MS = NOW.getTime();

/** An ISO timestamp `ageMs` milliseconds before NOW. */
function isoAgedBy(ageMs: number): string {
	return new Date(NOW_MS - ageMs).toISOString();
}

describe('summarizeLiarBrand — empty / inactive', () => {
	it('returns an inactive brand for no rows', () => {
		expect(summarizeLiarBrand([], NOW)).toEqual({
			active: false,
			brandCount: 0,
			intensity: 0
		});
	});

	it('is inactive when every brand is outside the 7-day window', () => {
		const stale = [isoAgedBy(LIAR_BRAND_WINDOW_MS + 1), isoAgedBy(LIAR_BRAND_WINDOW_MS * 2)];
		const result = summarizeLiarBrand(stale, NOW);
		expect(result.active).toBe(false);
		expect(result.brandCount).toBe(0);
		expect(result.intensity).toBe(0);
	});
});

describe('summarizeLiarBrand — 7-day window boundary (exclusive)', () => {
	it('a brand exactly at the window edge has just expired and does NOT count', () => {
		const result = summarizeLiarBrand([isoAgedBy(LIAR_BRAND_WINDOW_MS)], NOW);
		expect(result.active).toBe(false);
		expect(result.brandCount).toBe(0);
	});

	it('a brand 1ms inside the window still counts', () => {
		const result = summarizeLiarBrand([isoAgedBy(LIAR_BRAND_WINDOW_MS - 1)], NOW);
		expect(result.active).toBe(true);
		expect(result.brandCount).toBe(1);
	});
});

describe('summarizeLiarBrand — decay intensity (freshest brand)', () => {
	it('a just-minted brand is fully opaque (intensity ~1)', () => {
		const result = summarizeLiarBrand([isoAgedBy(0)], NOW);
		expect(result.active).toBe(true);
		expect(result.intensity).toBeCloseTo(1, 5);
	});

	it('a brand halfway through the window has ~0.5 intensity', () => {
		const result = summarizeLiarBrand([isoAgedBy(LIAR_BRAND_WINDOW_MS / 2)], NOW);
		expect(result.intensity).toBeCloseTo(0.5, 5);
	});

	it('intensity tracks the FRESHEST in-window brand, not the count', () => {
		const result = summarizeLiarBrand(
			[isoAgedBy(LIAR_BRAND_WINDOW_MS * 0.9), isoAgedBy(LIAR_BRAND_WINDOW_MS * 0.1)],
			NOW
		);
		expect(result.brandCount).toBe(2);
		// Freshest is the 0.1-aged one -> fade ~0.9.
		expect(result.intensity).toBeCloseTo(0.9, 5);
	});

	it('counts all in-window brands (stacking)', () => {
		const result = summarizeLiarBrand([isoAgedBy(0), isoAgedBy(1000), isoAgedBy(2000)], NOW);
		expect(result.brandCount).toBe(3);
	});
});

describe('summarizeLiarBrand — defensive inputs', () => {
	it('a future-dated brand (clock skew) counts as fully fresh (intensity clamped to 1)', () => {
		const future = new Date(NOW_MS + 60_000).toISOString();
		const result = summarizeLiarBrand([future], NOW);
		expect(result.active).toBe(true);
		expect(result.intensity).toBe(1);
	});

	it('skips an unparseable timestamp without throwing or blanking a valid one', () => {
		const result = summarizeLiarBrand(['not-a-date', isoAgedBy(0)], NOW);
		expect(result.active).toBe(true);
		expect(result.brandCount).toBe(1);
	});

	it('accepts Date objects as well as ISO strings', () => {
		const result = summarizeLiarBrand([new Date(NOW_MS - 1000)], NOW);
		expect(result.active).toBe(true);
		expect(result.brandCount).toBe(1);
	});

	it('throws on an invalid "now" input', () => {
		expect(() => summarizeLiarBrand([isoAgedBy(0)], 'not-a-date')).toThrow();
	});
});

describe('isHamburgerHeretic — persistent, derived from verdicts', () => {
	it('is false when the profile has no dogs / no verdicts', () => {
		expect(isHamburgerHeretic([])).toBe(false);
	});

	it('is false when no dog is a confirmed hamburger', () => {
		expect(isHamburgerHeretic(['not_a_hamburger', 'not_a_hamburger'])).toBe(false);
	});

	it('is true when ANY dog has a confirmed_hamburger verdict', () => {
		expect(isHamburgerHeretic(['not_a_hamburger', 'confirmed_hamburger'])).toBe(true);
	});

	it('is true for a single confirmed verdict (a lasting brand)', () => {
		expect(isHamburgerHeretic(['confirmed_hamburger'])).toBe(true);
	});
});

describe('dogAlarmState — verdict -> dog alarm render-state (confirmed-branch resolution)', () => {
	it('no verdict -> "alarm" (fall through to the report-timestamp decay)', () => {
		expect(dogAlarmState(null)).toBe('alarm');
		expect(dogAlarmState(undefined)).toBe('alarm');
	});

	it('not_a_hamburger -> "cleared" (alarm adjudicated / suppressed)', () => {
		expect(dogAlarmState('not_a_hamburger')).toBe('cleared');
	});

	it('confirmed_hamburger -> "confirmed" (persistent CONFIRMED HAMBURGER stamp)', () => {
		const v: BurgerVerdict = 'confirmed_hamburger';
		expect(dogAlarmState(v)).toBe('confirmed');
	});
});
