import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
	reportBurger,
	unreportBurger,
	getMyReportedDogIds,
	getBurgerAlarmCounts,
	CANNOT_REPORT_OWN
} from './reports';

// Unit tests for the server-side burger-report wrappers with a fully mocked
// `SupabaseClient` (the client is dependency-injected, mirroring reactions/votes/
// storage). They never touch a live stack — the DB-authoritative RLS / anonymity /
// ranking-inert guarantees are covered by tests/burger-alarms.e2e.ts (@security).
//
// Burger alarms are COSMETIC flair (decision #12): plain RLS-scoped INSERT/DELETE,
// no SECURITY DEFINER RPC. The reporter is ANONYMOUS (decision: owner-scoped SELECT).
// Each test asserts the SQLSTATE-keyed sentinel mapping and — critically — that the
// anonymous aggregate read (getBurgerAlarmCounts) returns ONLY per-dog timestamps,
// never reporter ids.

const VIEWER = '11111111-1111-4111-8111-111111111111';
const DOG = '22222222-2222-4222-8222-222222222222';

/** A fake `.from(...).insert(...)` that resolves `{ error }`. */
function makeInsertClient(result: { error: unknown }) {
	const insert = vi.fn().mockResolvedValue(result);
	const from = vi.fn().mockReturnValue({ insert });
	const client = { from } as unknown as SupabaseClient;
	return { client, from, insert };
}

/**
 * A fake `.from(...).delete().eq().eq()` chain resolving `{ error }`. Each chained
 * `.eq` returns the same builder so both filter calls land, and the builder is
 * thenable so awaiting resolves the result (matching PostgREST's awaitable builder).
 */
function makeDeleteClient(result: { error: unknown }) {
	const chain: {
		eq: ReturnType<typeof vi.fn>;
		then: (resolve: (v: unknown) => unknown) => unknown;
	} = {
		eq: vi.fn(() => chain),
		then: (resolve: (v: unknown) => unknown) => resolve(result)
	};
	const del = vi.fn().mockReturnValue(chain);
	const from = vi.fn().mockReturnValue({ delete: del });
	const client = { from } as unknown as SupabaseClient;
	return { client, from, del, chain };
}

/** A fake `.from(...).select(...).in(...)` resolving `{ data, error }`. */
function makeListClient(result: { data: unknown; error: unknown }) {
	const inFn = vi.fn().mockResolvedValue(result);
	const select = vi.fn().mockReturnValue({ in: inFn });
	const from = vi.fn().mockReturnValue({ select });
	const client = { from } as unknown as SupabaseClient;
	return { client, from, select, in: inFn };
}

function pgError(code: string, message = 'some postgrest prose') {
	return { name: 'PostgrestError', code, message, details: '' };
}

describe('reportBurger', () => {
	it('inserts { reporter_id, hot_dog_id } on the burger_alarms table and returns ok', async () => {
		const { client, from, insert } = makeInsertClient({ error: null });

		const result = await reportBurger(client, VIEWER, DOG);

		expect(from).toHaveBeenCalledWith('burger_alarms');
		expect(insert).toHaveBeenCalledWith({ reporter_id: VIEWER, hot_dog_id: DOG });
		expect(result).toEqual({ ok: true, data: null });
	});

	it('is idempotent: a 23505 unique-violation (already reported) maps to a benign success', async () => {
		const { client } = makeInsertClient({ error: pgError('23505') });

		const result = await reportBurger(client, VIEWER, DOG);

		// Re-reporting the same dog is a no-op toggle-on, not an error.
		expect(result).toEqual({ ok: true, data: null });
	});

	it('maps a 42501 RLS denial (reporting your OWN dog) to the friendly CANNOT_REPORT_OWN', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { client } = makeInsertClient({
			error: pgError('42501', 'new row violates row-level security policy')
		});

		const result = await reportBurger(client, VIEWER, DOG);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe(CANNOT_REPORT_OWN);
			// The raw SDK prose is never surfaced to the user.
			expect(result.error).not.toMatch(/row-level security/i);
		}
	});

	it('maps an unrelated Supabase error to a friendly sentinel (raw text not leaked)', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { client } = makeInsertClient({
			error: pgError('42P01', 'relation "burger_alarms" does not exist')
		});

		const result = await reportBurger(client, VIEWER, DOG);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).not.toMatch(/relation/i);
			expect(result.error).toMatch(/could not report/i);
		}
	});
});

describe('unreportBurger', () => {
	it('deletes scoped by (reporter_id, hot_dog_id) and returns ok on success', async () => {
		const { client, from, del, chain } = makeDeleteClient({ error: null });

		const result = await unreportBurger(client, VIEWER, DOG);

		expect(from).toHaveBeenCalledWith('burger_alarms');
		expect(del).toHaveBeenCalled();
		expect(chain.eq).toHaveBeenCalledWith('reporter_id', VIEWER);
		expect(chain.eq).toHaveBeenCalledWith('hot_dog_id', DOG);
		expect(result).toEqual({ ok: true, data: null });
	});

	it('is idempotent: retracting a missing report (no error) still succeeds (no-op)', async () => {
		// A delete matching zero rows is not an error in PostgREST.
		const { client } = makeDeleteClient({ error: null });

		const result = await unreportBurger(client, VIEWER, DOG);

		expect(result).toEqual({ ok: true, data: null });
	});

	it('maps a Supabase error to a friendly sentinel (raw text not leaked)', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { client } = makeDeleteClient({
			error: pgError('42501', 'permission denied for table burger_alarms')
		});

		const result = await unreportBurger(client, VIEWER, DOG);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).not.toMatch(/permission denied/i);
			expect(result.error).toMatch(/could not retract/i);
		}
	});
});

describe('getMyReportedDogIds', () => {
	it('short-circuits to an empty set for an empty id list (no query)', async () => {
		const { client, from } = makeListClient({ data: [], error: null });

		const result = await getMyReportedDogIds(client, []);

		expect(result).toEqual({ ok: true, data: new Set() });
		expect(from).not.toHaveBeenCalled();
	});

	it('selects (hot_dog_id) filtered by the dog-id set and returns the reported set', async () => {
		const rows = [{ hot_dog_id: 'dog-1' }, { hot_dog_id: 'dog-3' }];
		const { client, from, select, in: inFn } = makeListClient({ data: rows, error: null });

		const result = await getMyReportedDogIds(client, ['dog-1', 'dog-2', 'dog-3']);

		expect(from).toHaveBeenCalledWith('burger_alarms');
		expect(select).toHaveBeenCalledWith('hot_dog_id');
		expect(inFn).toHaveBeenCalledWith('hot_dog_id', ['dog-1', 'dog-2', 'dog-3']);
		expect(result).toEqual({ ok: true, data: new Set(['dog-1', 'dog-3']) });
	});

	it('coerces a null data payload to an empty set', async () => {
		const { client } = makeListClient({ data: null, error: null });

		const result = await getMyReportedDogIds(client, ['dog-1']);

		expect(result).toEqual({ ok: true, data: new Set() });
	});

	it('maps a Supabase error to a friendly sentinel (raw text not leaked)', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { client } = makeListClient({
			data: null,
			error: pgError('42501', 'permission denied for table burger_alarms')
		});

		const result = await getMyReportedDogIds(client, ['dog-1']);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).not.toMatch(/permission denied/i);
			expect(result.error).toMatch(/could not load/i);
		}
	});
});

describe('getBurgerAlarmCounts — anonymity-preserving aggregate', () => {
	it('short-circuits to an empty map for an empty id list (no query)', async () => {
		const { client, from } = makeListClient({ data: [], error: null });

		const result = await getBurgerAlarmCounts(client, []);

		expect(result).toEqual({ ok: true, data: new Map() });
		expect(from).not.toHaveBeenCalled();
	});

	it('selects ONLY (hot_dog_id, created_at) — never reporter_id (anonymity)', async () => {
		const { client, select } = makeListClient({ data: [], error: null });

		await getBurgerAlarmCounts(client, ['dog-1']);

		// The SELECT column list must NOT include the reporter id — a reporter's
		// identity must never even enter the server's working set for this read.
		const selectArg = vi.mocked(select).mock.calls[0][0] as string;
		expect(selectArg).toBe('hot_dog_id, created_at');
		expect(selectArg).not.toMatch(/reporter/i);
	});

	it('buckets timestamps per dog and returns ONLY counts/timestamps — no reporter ids', async () => {
		const t1 = '2026-06-17T11:00:00.000Z';
		const t2 = '2026-06-17T11:30:00.000Z';
		const t3 = '2026-06-17T09:00:00.000Z';
		// Even if a row carried a reporter id, the wrapper must not surface it.
		const rows = [
			{ hot_dog_id: 'dog-1', created_at: t1, reporter_id: 'leaky-uuid-a' },
			{ hot_dog_id: 'dog-1', created_at: t2, reporter_id: 'leaky-uuid-b' },
			{ hot_dog_id: 'dog-2', created_at: t3, reporter_id: 'leaky-uuid-c' }
		];
		const { client } = makeListClient({ data: rows, error: null });

		const result = await getBurgerAlarmCounts(client, ['dog-1', 'dog-2']);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		// Per-dog timestamp buckets only.
		expect(result.data.get('dog-1')).toEqual([t1, t2]);
		expect(result.data.get('dog-2')).toEqual([t3]);

		// HARD anonymity guarantee: the returned map carries no reporter identity —
		// the only values are timestamp strings. Serializing it must not leak an id.
		const serialized = JSON.stringify(Array.from(result.data.entries()));
		expect(serialized).not.toMatch(/leaky-uuid/);
		expect(serialized).not.toMatch(/reporter/i);
	});

	it('coerces a null data payload to an empty map', async () => {
		const { client } = makeListClient({ data: null, error: null });

		const result = await getBurgerAlarmCounts(client, ['dog-1']);

		expect(result).toEqual({ ok: true, data: new Map() });
	});

	it('maps a Supabase error to a friendly sentinel (raw text not leaked)', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { client } = makeListClient({
			data: null,
			error: pgError('42P01', 'relation "burger_alarms" does not exist')
		});

		const result = await getBurgerAlarmCounts(client, ['dog-1']);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).not.toMatch(/relation/i);
			expect(result.error).toMatch(/could not load burger alarms/i);
		}
	});
});
