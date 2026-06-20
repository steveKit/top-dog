import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { listVotableDogs, getCurrentVote } from './feed';

// Unit tests for the server-side feed query wrappers with a fully mocked
// `SupabaseClient` — they never touch a live Supabase stack (that boundary is
// covered by the @smoke / live-DB harness). The client is dependency-injected
// (first arg), mirroring the votes/hotdogs/storage modules, so a structural fake
// suffices. Each test asserts that: (1) the correct table + filter + ordering is
// applied (the viewer's own dogs are excluded; vote_count desc then id asc),
// (2) the embedded `profiles` join is normalized to flat owner_handle /
// owner_display_name whether PostgREST returns it as an ARRAY or a single object,
// with a missing-owner fallback, and (3) the SDK's `{ data, error }` shape is
// normalized into the discriminated `FeedResult`.

/**
 * Builds a fake `SupabaseClient` for the list query. The builder chain
 * `.from().select().neq().order().order()` resolves (it is awaited) to the
 * supplied result. The chainable spies are exposed so tests can assert the
 * filter / ordering arguments.
 */
function makeListClient(result: { data: unknown; error: unknown }) {
	// The terminal `.order()` (second call) is what the wrapper awaits, so it is
	// the thenable. Both `.order()` calls return the same chainable object.
	const chain: Record<string, ReturnType<typeof vi.fn>> = {};
	const thenable = {
		...result,
		then: (resolve: (v: unknown) => unknown) => resolve(result)
	};
	chain.order = vi.fn(() => ({ ...chain, ...thenable }));
	chain.neq = vi.fn(() => chain);
	chain.select = vi.fn(() => chain);
	chain.from = vi.fn(() => chain);

	const client = { from: chain.from } as unknown as SupabaseClient;
	return { client, chain };
}

/**
 * Builds a fake `SupabaseClient` for the current-vote query:
 * `.from().select().eq().maybeSingle()` resolving to the supplied result.
 */
function makeCurrentVoteClient(result: { data: unknown; error: unknown }) {
	const maybeSingle = vi.fn().mockResolvedValue(result);
	const eq = vi.fn(() => ({ maybeSingle }));
	const select = vi.fn(() => ({ eq }));
	const from = vi.fn(() => ({ select }));

	const client = { from } as unknown as SupabaseClient;
	return { client, from, select, eq, maybeSingle };
}

const VIEWER_ID = '11111111-1111-4111-8111-111111111111';

describe('listVotableDogs', () => {
	it('queries hot_dogs and excludes the viewer own dogs via .neq(owner_id)', async () => {
		const { client, chain } = makeListClient({ data: [], error: null });

		await listVotableDogs(client, VIEWER_ID);

		expect(chain.from).toHaveBeenCalledWith('hot_dogs');
		expect(chain.neq).toHaveBeenCalledWith('owner_id', VIEWER_ID);
	});

	it('embeds the owner profile (handle, display_name, is_current_top_dog) in the select', async () => {
		const { client, chain } = makeListClient({ data: [], error: null });

		await listVotableDogs(client, VIEWER_ID);

		const selectArg = chain.select.mock.calls[0][0] as string;
		// is_current_top_dog (the live crown flag, decision #25) is embedded so the
		// procession can mark the reigning owner's frank with the champion ribbon.
		expect(selectArg).toContain('profiles(handle, display_name, is_current_top_dog)');
	});

	it('orders by vote_count desc, then id asc (leaderboard ordering)', async () => {
		const { client, chain } = makeListClient({ data: [], error: null });

		await listVotableDogs(client, VIEWER_ID);

		expect(chain.order).toHaveBeenNthCalledWith(1, 'vote_count', { ascending: false });
		expect(chain.order).toHaveBeenNthCalledWith(2, 'id', { ascending: true });
	});

	it('selects peak_votes alongside vote_count in the query', async () => {
		const { client, chain } = makeListClient({ data: [], error: null });

		await listVotableDogs(client, VIEWER_ID);

		const selectArg = chain.select.mock.calls[0][0] as string;
		expect(selectArg).toContain('vote_count');
		expect(selectArg).toContain('peak_votes');
	});

	it('normalizes an ARRAY embed to flat owner_handle / owner_display_name / owner_is_current_top_dog', async () => {
		const row = {
			id: 'dog-1',
			owner_id: 'owner-1',
			image_path: 'owner-1/dog-1.webp',
			caption: 'frank',
			vote_count: 3,
			peak_votes: 8,
			// This owner currently holds the crown — the flag must surface flattened so
			// the procession can render the champion ribbon on this frank.
			profiles: [{ handle: 'sausage_king', display_name: 'Sausage King', is_current_top_dog: true }]
		};
		const { client } = makeListClient({ data: [row], error: null });

		const result = await listVotableDogs(client, VIEWER_ID);

		expect(result).toEqual({
			ok: true,
			data: [
				{
					id: 'dog-1',
					owner_id: 'owner-1',
					image_path: 'owner-1/dog-1.webp',
					caption: 'frank',
					vote_count: 3,
					peak_votes: 8,
					owner_handle: 'sausage_king',
					owner_display_name: 'Sausage King',
					owner_is_current_top_dog: true
				}
			]
		});
	});

	it('maps peak_votes onto the VotableDog (all-time high carried alongside vote_count)', async () => {
		const row = {
			id: 'dog-peak',
			owner_id: 'owner-1',
			image_path: 'owner-1/dog-peak.webp',
			caption: null,
			vote_count: 2,
			peak_votes: 11,
			profiles: { handle: 'peak_chef', display_name: 'Peak Chef' }
		};
		const { client } = makeListClient({ data: [row], error: null });

		const result = await listVotableDogs(client, VIEWER_ID);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data[0].peak_votes).toBe(11);
			// peak_votes is independent of the current vote_count.
			expect(result.data[0].vote_count).toBe(2);
		}
	});

	it('normalizes a SINGLE-OBJECT embed to flat owner fields (including the crown flag)', async () => {
		const row = {
			id: 'dog-2',
			owner_id: 'owner-2',
			image_path: 'owner-2/dog-2.webp',
			caption: null,
			vote_count: 1,
			// A non-reigning owner — the crown flag surfaces flattened as false.
			profiles: {
				handle: 'mustard_maven',
				display_name: 'Mustard Maven',
				is_current_top_dog: false
			}
		};
		const { client } = makeListClient({ data: [row], error: null });

		const result = await listVotableDogs(client, VIEWER_ID);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data[0].owner_handle).toBe('mustard_maven');
			expect(result.data[0].owner_display_name).toBe('Mustard Maven');
			expect(result.data[0].owner_is_current_top_dog).toBe(false);
			expect(result.data[0].caption).toBeNull();
		}
	});

	it('surfaces owner_is_current_top_dog: true from a SINGLE-OBJECT embed (champion source)', async () => {
		const row = {
			id: 'dog-crown',
			owner_id: 'owner-crown',
			image_path: 'owner-crown/dog-crown.webp',
			caption: 'reigning frank',
			vote_count: 12,
			peak_votes: 12,
			profiles: { handle: 'top_dog', display_name: 'The Top Dog', is_current_top_dog: true }
		};
		const { client } = makeListClient({ data: [row], error: null });

		const result = await listVotableDogs(client, VIEWER_ID);

		expect(result.ok).toBe(true);
		if (result.ok) {
			// This flag drives the load's championDogId / the procession's champion ribbon.
			expect(result.data[0].owner_is_current_top_dog).toBe(true);
		}
	});

	it('falls back to empty owner strings + false crown when the embed is missing (null / empty array)', async () => {
		const rowNull = {
			id: 'dog-3',
			owner_id: 'owner-3',
			image_path: 'owner-3/dog-3.webp',
			caption: null,
			vote_count: 0,
			profiles: null
		};
		const rowEmpty = { ...rowNull, id: 'dog-4', image_path: 'owner-3/dog-4.webp', profiles: [] };
		const { client } = makeListClient({ data: [rowNull, rowEmpty], error: null });

		const result = await listVotableDogs(client, VIEWER_ID);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data[0].owner_handle).toBe('');
			expect(result.data[0].owner_display_name).toBe('');
			expect(result.data[0].owner_is_current_top_dog).toBe(false);
			expect(result.data[1].owner_handle).toBe('');
			expect(result.data[1].owner_display_name).toBe('');
			expect(result.data[1].owner_is_current_top_dog).toBe(false);
		}
	});

	it('returns an empty list (not an error) when the query yields null data', async () => {
		const { client } = makeListClient({ data: null, error: null });

		const result = await listVotableDogs(client, VIEWER_ID);

		expect(result).toEqual({ ok: true, data: [] });
	});

	it('returns { ok: false } with the SDK message on a Supabase error', async () => {
		const { client } = makeListClient({
			data: null,
			error: { message: 'relation hot_dogs does not exist' }
		});

		const result = await listVotableDogs(client, VIEWER_ID);

		expect(result).toEqual({ ok: false, error: 'relation hot_dogs does not exist' });
	});
});

describe('getCurrentVote', () => {
	it('reads the votes table scoped to the viewer via .eq(voter_id) + maybeSingle()', async () => {
		const { client, from, select, eq } = makeCurrentVoteClient({
			data: { hot_dog_id: 'dog-9' },
			error: null
		});

		await getCurrentVote(client, VIEWER_ID);

		expect(from).toHaveBeenCalledWith('votes');
		expect(select).toHaveBeenCalledWith('hot_dog_id');
		expect(eq).toHaveBeenCalledWith('voter_id', VIEWER_ID);
	});

	it('returns the hot_dog_id when an active vote row exists', async () => {
		const { client } = makeCurrentVoteClient({ data: { hot_dog_id: 'dog-9' }, error: null });

		const result = await getCurrentVote(client, VIEWER_ID);

		expect(result).toEqual({ ok: true, data: 'dog-9' });
	});

	it('returns null when there is no active vote (maybeSingle -> null)', async () => {
		const { client } = makeCurrentVoteClient({ data: null, error: null });

		const result = await getCurrentVote(client, VIEWER_ID);

		expect(result).toEqual({ ok: true, data: null });
	});

	it('returns { ok: false } with the SDK message on a Supabase error', async () => {
		const { client } = makeCurrentVoteClient({
			data: null,
			error: { message: 'permission denied for table votes' }
		});

		const result = await getCurrentVote(client, VIEWER_ID);

		expect(result).toEqual({ ok: false, error: 'permission denied for table votes' });
	});
});
