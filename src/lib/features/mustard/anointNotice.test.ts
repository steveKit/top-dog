import { describe, it, expect } from 'vitest';

import { coalesceAnointNotices, ANOINT_NOTICE_WINDOW_MS, type AnointRow } from './anointNotice';

// M8 TASK-094 / OQ-2e — the pure anoint→wall-notice coalescing. The notice is
// DERIVED at render time from existing mustard_sprays rows (no new schema / write
// path; un-forgeable by construction). These tests pin the rolling-24h grouping
// that RESETS at each anointing, the ×N coalescing, the >24h-gap → new-notice
// boundary, the empty case, and defensive ordering.

const NOW_MS = Date.UTC(2026, 5, 22, 12, 0, 0); // 2026-06-22T12:00:00.000Z
const HOUR_MS = 60 * 60 * 1000;

/** Build an anoint row `ageMs` before NOW with a given id. */
function rowAt(id: string, ageMs: number): AnointRow {
	return { id, sprayed_at: new Date(NOW_MS - ageMs).toISOString() };
}

describe('ANOINT_NOTICE_WINDOW_MS', () => {
	it('is exactly 24 hours in milliseconds', () => {
		expect(ANOINT_NOTICE_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
	});
});

describe('coalesceAnointNotices — empty / singleton', () => {
	it('returns no notices for an empty input', () => {
		expect(coalesceAnointNotices([])).toEqual([]);
	});

	it('produces a single ×1 notice for one anointing', () => {
		const row = rowAt('s1', 0);
		const notices = coalesceAnointNotices([row]);

		expect(notices).toHaveLength(1);
		expect(notices[0]).toEqual({
			id: 'anoint:s1',
			count: 1,
			firstAt: row.sprayed_at,
			lastAt: row.sprayed_at
		});
	});
});

describe('coalesceAnointNotices — ×N coalescing within the rolling window', () => {
	it('coalesces a burst of anointings into one ×N notice', () => {
		// Three anointings, each within 24h of the previous (10h, 5h, now).
		const a = rowAt('s1', 10 * HOUR_MS);
		const b = rowAt('s2', 5 * HOUR_MS);
		const c = rowAt('s3', 0);

		const notices = coalesceAnointNotices([a, b, c]);

		expect(notices).toHaveLength(1);
		expect(notices[0].count).toBe(3);
		expect(notices[0].firstAt).toBe(a.sprayed_at);
		expect(notices[0].lastAt).toBe(c.sprayed_at);
		// The notice id is derived from the run's LAST anointing.
		expect(notices[0].id).toBe('anoint:s3');
	});

	it('keeps a steady sub-24h drip in ONE run (the window RESETS at each anointing)', () => {
		// Anointings 20h apart across 60h: each is >24h from the FIRST, but each is
		// only 20h from the PREVIOUS, so the rolling window never lapses → one run.
		const rows = [
			rowAt('s1', 60 * HOUR_MS),
			rowAt('s2', 40 * HOUR_MS),
			rowAt('s3', 20 * HOUR_MS),
			rowAt('s4', 0)
		];

		const notices = coalesceAnointNotices(rows);

		expect(notices).toHaveLength(1);
		expect(notices[0].count).toBe(4);
	});
});

describe('coalesceAnointNotices — >24h gap starts a NEW notice', () => {
	it('splits anointings separated by more than 24h into separate notices', () => {
		// First run: two anointings 5h apart, ~3 days ago. Then a >24h lull. Then a
		// second run: two anointings 2h apart, recent.
		const run1a = rowAt('r1a', 77 * HOUR_MS);
		const run1b = rowAt('r1b', 72 * HOUR_MS);
		const run2a = rowAt('r2a', 2 * HOUR_MS);
		const run2b = rowAt('r2b', 0);

		const notices = coalesceAnointNotices([run1a, run1b, run2a, run2b]);

		expect(notices).toHaveLength(2);
		// Ordered by lastAt ascending — the older run first.
		expect(notices[0].count).toBe(2);
		expect(notices[0].lastAt).toBe(run1b.sprayed_at);
		expect(notices[1].count).toBe(2);
		expect(notices[1].lastAt).toBe(run2b.sprayed_at);
	});

	it('treats a gap of EXACTLY 24h as still within the same run (≤ window)', () => {
		const a = rowAt('s1', 24 * HOUR_MS);
		const b = rowAt('s2', 0); // exactly 24h after a

		const notices = coalesceAnointNotices([a, b]);

		expect(notices).toHaveLength(1);
		expect(notices[0].count).toBe(2);
	});

	it('treats a gap of 24h + 1ms as a NEW run (> window)', () => {
		const a = rowAt('s1', 24 * HOUR_MS + 1);
		const b = rowAt('s2', 0); // 24h + 1ms after a

		const notices = coalesceAnointNotices([a, b]);

		expect(notices).toHaveLength(2);
		expect(notices[0].count).toBe(1);
		expect(notices[1].count).toBe(1);
	});
});

describe('coalesceAnointNotices — defensive ordering', () => {
	it('sorts unordered input chronologically before grouping', () => {
		// Same three-burst as above, but shuffled — the result must be identical.
		const a = rowAt('s1', 10 * HOUR_MS);
		const b = rowAt('s2', 5 * HOUR_MS);
		const c = rowAt('s3', 0);

		const notices = coalesceAnointNotices([c, a, b]);

		expect(notices).toHaveLength(1);
		expect(notices[0].count).toBe(3);
		expect(notices[0].firstAt).toBe(a.sprayed_at);
		expect(notices[0].lastAt).toBe(c.sprayed_at);
	});

	it('orders equal timestamps deterministically by id', () => {
		const t = new Date(NOW_MS).toISOString();
		const notices = coalesceAnointNotices([
			{ id: 'zeta', sprayed_at: t },
			{ id: 'alpha', sprayed_at: t }
		]);

		// Both share a timestamp → one run of 2; the id derives from the last by the
		// id tie-break (alpha < zeta, so zeta is last).
		expect(notices).toHaveLength(1);
		expect(notices[0].count).toBe(2);
		expect(notices[0].id).toBe('anoint:zeta');
	});

	it('throws on an unparseable sprayed_at', () => {
		expect(() => coalesceAnointNotices([{ id: 's1', sprayed_at: 'not-a-date' }])).toThrow();
	});
});
