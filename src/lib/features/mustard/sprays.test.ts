import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
	addSpray,
	listSpraysForProfile,
	listAnointmentsForProfile,
	NOT_TOP_DOG,
	type SprayRow
} from './sprays';
import { MUSTARD_LIFESPAN_MS } from './decay';

// Unit tests for the server-side mustard-spray wrappers with a fully mocked
// `SupabaseClient` — they never touch a live Supabase stack (the RLS Top-Dog
// INSERT gate is covered by tests/mustard.e2e.ts). The client is
// dependency-injected (first arg), mirroring reactions/votes/storage, so a
// structural fake suffices.
//
// Mustard sprays are COSMETIC flair (decision #15): plain RLS-scoped INSERT, no
// SECURITY DEFINER RPC. Each test asserts that:
//   1. the (x,y) range boundary is validated BEFORE any DB call;
//   2. sprayer_id is pinned to the PASSED (trusted session) id, never derived from
//      a client value, and target/x/y are forwarded faithfully;
//   3. a 42501 (RLS WITH-CHECK / not-the-Top-Dog) maps to the NOT_TOP_DOG sentinel;
//   4. a 23514 (CHECK backstop) maps to a friendly position error;
//   5. an unrelated Supabase error maps to a friendly sentinel (raw text not leaked);
//   6. listSpraysForProfile filters to the last 24h and shapes the rows the render
//      path needs.

const SPRAYER = 'sprayer-uuid';
const TARGET = 'target-uuid';

/** A fake SupabaseClient whose `.from(...).insert(...)` resolves `{ error }`. */
function makeInsertClient(result: { error: unknown }) {
	const insert = vi.fn().mockResolvedValue(result);
	const from = vi.fn().mockReturnValue({ insert });
	const client = { from } as unknown as SupabaseClient;
	return { client, from, insert };
}

/**
 * A fake SupabaseClient for the list path:
 * `.from(...).select(...).eq(...).gte(...).order(...)` resolves `{ data, error }`.
 * Each chained builder method returns the same builder; `.order(...)` resolves the
 * result (the last call in the chain, awaited).
 */
function makeListClient(result: { data: unknown; error: unknown }) {
	const order = vi.fn().mockResolvedValue(result);
	const gte = vi.fn(() => ({ order }));
	const eq = vi.fn(() => ({ gte }));
	const select = vi.fn(() => ({ eq }));
	const from = vi.fn().mockReturnValue({ select });
	const client = { from } as unknown as SupabaseClient;
	return { client, from, select, eq, gte, order };
}

/**
 * A fake SupabaseClient for the FULL anoint-history path:
 * `.from(...).select(...).eq(...).order(...).limit(...)` resolves `{ data, error }`.
 * Note the SHAPE difference from makeListClient: there is NO `.gte(...)` (the
 * un-time-bounded history is not capped to the 6h overlay window), and the chain
 * ends in `.limit(...)` (the most-recent cap).
 */
function makeHistoryClient(result: { data: unknown; error: unknown }) {
	const limit = vi.fn().mockResolvedValue(result);
	const order = vi.fn(() => ({ limit }));
	const eq = vi.fn(() => ({ order }));
	const select = vi.fn(() => ({ eq }));
	const from = vi.fn().mockReturnValue({ select });
	const client = { from } as unknown as SupabaseClient;
	return { client, from, select, eq, order, limit };
}

function pgError(code: string, message = 'some postgrest prose') {
	return { name: 'PostgrestError', code, message, details: '' };
}

describe('addSpray', () => {
	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('inserts { sprayer_id, target_profile_id, x, y } and returns ok on success', async () => {
		const { client, from, insert } = makeInsertClient({ error: null });

		const result = await addSpray(client, SPRAYER, TARGET, 0.25, 0.75);

		expect(from).toHaveBeenCalledWith('mustard_sprays');
		expect(insert).toHaveBeenCalledWith({
			sprayer_id: SPRAYER,
			target_profile_id: TARGET,
			x: 0.25,
			y: 0.75
		});
		expect(result).toEqual({ ok: true, data: null });
	});

	it('pins sprayer_id to the PASSED id and never substitutes another value', async () => {
		const { client, insert } = makeInsertClient({ error: null });

		await addSpray(client, SPRAYER, TARGET, 0, 0);

		// The trusted sprayer id is the only sprayer_id written — the wrapper has no
		// path that could swap in a client-supplied id.
		const written = vi.mocked(insert).mock.calls[0][0] as { sprayer_id: string };
		expect(written.sprayer_id).toBe(SPRAYER);
	});

	it('allows a self-spray (sprayer === target)', async () => {
		const { client, insert } = makeInsertClient({ error: null });

		const result = await addSpray(client, SPRAYER, SPRAYER, 0.5, 0.5);

		expect(result).toEqual({ ok: true, data: null });
		expect(insert).toHaveBeenCalledWith({
			sprayer_id: SPRAYER,
			target_profile_id: SPRAYER,
			x: 0.5,
			y: 0.5
		});
	});

	it.each([
		['x below 0', -0.01, 0.5],
		['x above 1', 1.01, 0.5],
		['y below 0', 0.5, -0.0001],
		['y above 1', 0.5, 1.5],
		['x not finite (NaN)', NaN, 0.5],
		['y not finite (Infinity)', 0.5, Infinity],
		['y not finite (-Infinity)', 0.5, -Infinity]
	])('rejects %s BEFORE touching the DB', async (_label, x, y) => {
		const { client, from } = makeInsertClient({ error: null });

		const result = await addSpray(client, SPRAYER, TARGET, x, y);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toMatch(/position/i);
		}
		// The boundary short-circuited — no DB call happened.
		expect(from).not.toHaveBeenCalled();
	});

	it.each([
		['inclusive lower bound (0,0)', 0, 0],
		['inclusive upper bound (1,1)', 1, 1]
	])('accepts the boundary value %s and reaches the DB', async (_label, x, y) => {
		const { client, from } = makeInsertClient({ error: null });

		const result = await addSpray(client, SPRAYER, TARGET, x, y);

		expect(result).toEqual({ ok: true, data: null });
		expect(from).toHaveBeenCalledWith('mustard_sprays');
	});

	it('maps a 42501 (RLS WITH-CHECK / not the Top Dog) to the NOT_TOP_DOG sentinel', async () => {
		const { client } = makeInsertClient({
			error: pgError(
				'42501',
				'new row violates row-level security policy for table "mustard_sprays"'
			)
		});

		const result = await addSpray(client, SPRAYER, TARGET, 0.5, 0.5);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe(NOT_TOP_DOG);
			// Raw policy text is never leaked.
			expect(result.error).not.toMatch(/row-level security/i);
		}
	});

	it('maps a 23514 (CHECK backstop) to a friendly position error', async () => {
		const { client } = makeInsertClient({
			error: pgError('23514', 'new row violates check constraint "mustard_sprays_x_range"')
		});

		const result = await addSpray(client, SPRAYER, TARGET, 0.5, 0.5);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toMatch(/position/i);
			expect(result.error).not.toBe(NOT_TOP_DOG);
			expect(result.error).not.toMatch(/check constraint/i);
		}
	});

	it('maps an unrelated Supabase error to a friendly sentinel (raw text not leaked) + logs', async () => {
		const { client } = makeInsertClient({
			error: pgError('42P01', 'relation "mustard_sprays" does not exist')
		});

		const result = await addSpray(client, SPRAYER, TARGET, 0.5, 0.5);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).not.toMatch(/relation/i);
			expect(result.error).not.toBe(NOT_TOP_DOG);
			expect(result.error).toMatch(/could not anoint/i);
		}
		// The raw error is logged server-side for debugging.
		expect(console.error).toHaveBeenCalled();
	});
});

describe('listSpraysForProfile', () => {
	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-16T12:00:00.000Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('selects the render columns for the target, filtered to the last 24h, ordered by spray time', async () => {
		const rows: SprayRow[] = [
			{ id: 's1', x: 0.1, y: 0.2, sprayed_at: '2026-06-16T06:00:00Z' },
			{ id: 's2', x: 0.3, y: 0.4, sprayed_at: '2026-06-16T11:00:00Z' }
		];
		const { client, from, select, eq, gte, order } = makeListClient({ data: rows, error: null });

		const result = await listSpraysForProfile(client, TARGET);

		expect(from).toHaveBeenCalledWith('mustard_sprays');
		expect(select).toHaveBeenCalledWith('id, x, y, sprayed_at');
		expect(eq).toHaveBeenCalledWith('target_profile_id', TARGET);
		// The 24h cutoff is exactly now - MUSTARD_LIFESPAN_MS as an ISO string.
		const expectedCutoff = new Date(Date.now() - MUSTARD_LIFESPAN_MS).toISOString();
		expect(gte).toHaveBeenCalledWith('sprayed_at', expectedCutoff);
		expect(order).toHaveBeenCalledWith('sprayed_at', { ascending: true });
		expect(result).toEqual({ ok: true, data: rows });
	});

	it('coerces a null data payload to an empty array', async () => {
		const { client } = makeListClient({ data: null, error: null });

		const result = await listSpraysForProfile(client, TARGET);

		expect(result).toEqual({ ok: true, data: [] });
	});

	it('maps a Supabase error to a friendly sentinel (raw text not leaked) + logs', async () => {
		const { client } = makeListClient({
			data: null,
			error: pgError('42P01', 'relation "mustard_sprays" does not exist')
		});

		const result = await listSpraysForProfile(client, TARGET);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).not.toMatch(/relation/i);
			expect(result.error).toMatch(/could not load/i);
		}
		expect(console.error).toHaveBeenCalled();
	});
});

// listAnointmentsForProfile: the FULL persisted anoint history for the PERSISTING
// anoint→wall notice (OQ-2e, decision #29). Same RLS-scoped client + mustard_sprays
// table as listSpraysForProfile but WITHOUT the 6h `gte` cutoff (the notice must NOT
// age out at the overlay window), capped at the most-recent rows so the read stays
// bounded.
describe('listAnointmentsForProfile', () => {
	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-16T12:00:00.000Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('selects the render columns for the target with NO 6h cutoff, ordered desc, capped at 200', async () => {
		const rows: SprayRow[] = [
			// A row far OUTSIDE the 6h overlay window — the history fetch must still return
			// it (no `gte` filter), proving the notice source persists past the overlay.
			{ id: 's-old', x: 0.1, y: 0.2, sprayed_at: '2026-01-01T06:00:00Z' },
			{ id: 's-new', x: 0.3, y: 0.4, sprayed_at: '2026-06-16T11:00:00Z' }
		];
		const { client, from, select, eq, order, limit } = makeHistoryClient({
			data: rows,
			error: null
		});

		const result = await listAnointmentsForProfile(client, TARGET);

		expect(from).toHaveBeenCalledWith('mustard_sprays');
		expect(select).toHaveBeenCalledWith('id, x, y, sprayed_at');
		expect(eq).toHaveBeenCalledWith('target_profile_id', TARGET);
		// Most-recent-first, capped at the documented ANOINT_HISTORY_CAP (200).
		expect(order).toHaveBeenCalledWith('sprayed_at', { ascending: false });
		expect(limit).toHaveBeenCalledWith(200);
		expect(result).toEqual({ ok: true, data: rows });
	});

	it('does NOT apply a 6h `gte` window (no gte builder method is invoked)', async () => {
		// The history builder chain has no `.gte` — assert the function never reaches for
		// one (it would throw if it did, since the fake omits it). This pins the
		// un-time-bounded contract distinct from listSpraysForProfile's 6h window.
		const { client, eq } = makeHistoryClient({ data: [], error: null });

		const result = await listAnointmentsForProfile(client, TARGET);

		// The builder returned by `.eq(...)` exposes `.order`, NOT `.gte`.
		const builder = vi.mocked(eq).mock.results[0]?.value as Record<string, unknown>;
		expect(typeof builder.order).toBe('function');
		expect(builder.gte).toBeUndefined();
		expect(result).toEqual({ ok: true, data: [] });
	});

	it('coerces a null data payload to an empty array', async () => {
		const { client } = makeHistoryClient({ data: null, error: null });

		const result = await listAnointmentsForProfile(client, TARGET);

		expect(result).toEqual({ ok: true, data: [] });
	});

	it('maps a Supabase error to a friendly sentinel (raw text not leaked) + logs', async () => {
		const { client } = makeHistoryClient({
			data: null,
			error: pgError('42P01', 'relation "mustard_sprays" does not exist')
		});

		const result = await listAnointmentsForProfile(client, TARGET);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).not.toMatch(/relation/i);
			expect(result.error).toMatch(/could not load/i);
		}
		expect(console.error).toHaveBeenCalled();
	});
});
