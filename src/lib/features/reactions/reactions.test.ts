import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { addReaction, removeReaction, listReactionsForDogs } from './reactions';

// Unit tests for the server-side reaction wrappers with a fully mocked
// `SupabaseClient` — they never touch a live Supabase stack (that boundary is
// covered by tests/db-guards.e2e.ts). The client is dependency-injected (first
// arg), mirroring the votes/storage modules, so a structural fake suffices.
//
// Reactions are COSMETIC flair (decision #12): plain RLS-scoped INSERT/DELETE,
// no SECURITY DEFINER RPC. Each test asserts that: (1) the allowed-emoji boundary
// is checked BEFORE any DB call, (2) add is idempotent (a 23505 unique-violation
// maps to a benign success, NOT an error), (3) remove is idempotent (a no-row
// delete still succeeds), (4) a raw Supabase error maps to a friendly sentinel
// (never leaked), and (5) listReactionsForDogs forwards the dog-id set and shapes
// the rows the aggregator needs.

const VIEWER = 'viewer-uuid';
const DOG = 'dog-uuid';
const ALLOWED = '🌭';
const DISALLOWED = '💩';

/** A fake SupabaseClient whose `.from(...).insert(...)` resolves `{ error }`. */
function makeInsertClient(result: { error: unknown }) {
	const insert = vi.fn().mockResolvedValue(result);
	const from = vi.fn().mockReturnValue({ insert });
	const client = { from } as unknown as SupabaseClient;
	return { client, from, insert };
}

/**
 * A fake SupabaseClient for the delete path:
 * `.from(...).delete().eq().eq().eq()` resolves `{ error }`. Each chained `.eq`
 * returns the same builder so all three filter calls land, and the builder is
 * thenable so `await`-ing the chain resolves the result (matching how PostgREST's
 * query builder is awaitable).
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

/**
 * A fake SupabaseClient for the list path:
 * `.from(...).select(...).in(...)` resolves `{ data, error }`.
 */
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

describe('addReaction', () => {
	it('inserts { user_id, hot_dog_id, emoji } and returns ok on success', async () => {
		const { client, from, insert } = makeInsertClient({ error: null });

		const result = await addReaction(client, VIEWER, DOG, ALLOWED);

		expect(from).toHaveBeenCalledWith('hotdog_reactions');
		expect(insert).toHaveBeenCalledWith({ user_id: VIEWER, hot_dog_id: DOG, emoji: ALLOWED });
		expect(result).toEqual({ ok: true, data: null });
	});

	it('rejects a disallowed emoji BEFORE touching the DB', async () => {
		const { client, from } = makeInsertClient({ error: null });

		const result = await addReaction(client, VIEWER, DOG, DISALLOWED);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toMatch(/not allowed/i);
		}
		// No DB call happened — the boundary short-circuited.
		expect(from).not.toHaveBeenCalled();
	});

	it('is idempotent: a 23505 unique-violation maps to a benign success', async () => {
		const { client } = makeInsertClient({ error: pgError('23505') });

		const result = await addReaction(client, VIEWER, DOG, ALLOWED);

		// Re-reacting with the same emoji is a no-op toggle-on, not an error.
		expect(result).toEqual({ ok: true, data: null });
	});

	it('maps an unrelated Supabase error to a friendly sentinel (raw text not leaked)', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { client } = makeInsertClient({
			error: pgError('42501', 'permission denied for table hotdog_reactions')
		});

		const result = await addReaction(client, VIEWER, DOG, ALLOWED);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).not.toMatch(/permission denied/i);
			expect(result.error).toMatch(/could not add/i);
		}
	});
});

describe('removeReaction', () => {
	it('deletes scoped by (user_id, hot_dog_id, emoji) and returns ok on success', async () => {
		const { client, from, del, chain } = makeDeleteClient({ error: null });

		const result = await removeReaction(client, VIEWER, DOG, ALLOWED);

		expect(from).toHaveBeenCalledWith('hotdog_reactions');
		expect(del).toHaveBeenCalled();
		// Three .eq filters: user_id, hot_dog_id, emoji.
		expect(chain.eq).toHaveBeenCalledWith('user_id', VIEWER);
		expect(chain.eq).toHaveBeenCalledWith('hot_dog_id', DOG);
		expect(chain.eq).toHaveBeenCalledWith('emoji', ALLOWED);
		expect(result).toEqual({ ok: true, data: null });
	});

	it('is idempotent: deleting a missing reaction (no error) still succeeds', async () => {
		// A delete matching zero rows is not an error in PostgREST.
		const { client } = makeDeleteClient({ error: null });

		const result = await removeReaction(client, VIEWER, DOG, ALLOWED);

		expect(result).toEqual({ ok: true, data: null });
	});

	it('rejects a disallowed emoji BEFORE touching the DB', async () => {
		const { client, from } = makeDeleteClient({ error: null });

		const result = await removeReaction(client, VIEWER, DOG, DISALLOWED);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toMatch(/not allowed/i);
		}
		expect(from).not.toHaveBeenCalled();
	});

	it('maps a Supabase error to a friendly sentinel (raw text not leaked)', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { client } = makeDeleteClient({
			error: pgError('42501', 'permission denied for table hotdog_reactions')
		});

		const result = await removeReaction(client, VIEWER, DOG, ALLOWED);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).not.toMatch(/permission denied/i);
			expect(result.error).toMatch(/could not remove/i);
		}
	});
});

describe('listReactionsForDogs', () => {
	it('short-circuits to an empty result for an empty id list (no query)', async () => {
		const { client, from } = makeListClient({ data: [], error: null });

		const result = await listReactionsForDogs(client, []);

		expect(result).toEqual({ ok: true, data: [] });
		// No pointless query for zero dogs.
		expect(from).not.toHaveBeenCalled();
	});

	it('selects (hot_dog_id, emoji, user_id) filtered by the dog-id set and returns the rows', async () => {
		const rows = [
			{ hot_dog_id: 'dog-1', emoji: '🌭', user_id: 'u-1' },
			{ hot_dog_id: 'dog-2', emoji: '🔥', user_id: 'u-2' }
		];
		const { client, from, select, in: inFn } = makeListClient({ data: rows, error: null });

		const result = await listReactionsForDogs(client, ['dog-1', 'dog-2']);

		expect(from).toHaveBeenCalledWith('hotdog_reactions');
		expect(select).toHaveBeenCalledWith('hot_dog_id, emoji, user_id');
		expect(inFn).toHaveBeenCalledWith('hot_dog_id', ['dog-1', 'dog-2']);
		expect(result).toEqual({ ok: true, data: rows });
	});

	it('coerces a null data payload to an empty array', async () => {
		const { client } = makeListClient({ data: null, error: null });

		const result = await listReactionsForDogs(client, ['dog-1']);

		expect(result).toEqual({ ok: true, data: [] });
	});

	it('maps a Supabase error to a friendly sentinel (raw text not leaked)', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { client } = makeListClient({
			data: null,
			error: pgError('42P01', 'relation "hotdog_reactions" does not exist')
		});

		const result = await listReactionsForDogs(client, ['dog-1']);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).not.toMatch(/relation/i);
			expect(result.error).toMatch(/could not load/i);
		}
	});
});
