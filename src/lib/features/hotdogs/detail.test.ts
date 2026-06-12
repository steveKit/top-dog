import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getDogDetail, DOG_NOT_FOUND } from './detail';

// Unit tests for the server-side per-dog detail query (TASK-031) with a fully
// mocked `SupabaseClient` — they never touch a live Supabase stack (that boundary
// is the @smoke / live-DB harness). The client is dependency-injected (first
// arg), mirroring feed.ts / the hotdogs/votes/storage modules, so a structural
// fake suffices. Each test asserts that:
//   (1) the correct table + id filter is applied and the owner profile (incl.
//       crown state) is embedded in the select,
//   (2) a found dog returns the full DogDetail shape incl. the server-maintained
//       counters peak_votes + vote_count,
//   (3) a not-found read maps to the DOG_NOT_FOUND sentinel — distinct from a
//       real read error — so the route can 404 vs 500,
//   (4) a real Supabase error maps to { ok: false } with the SDK message (the
//       sentinel is NOT leaked as a generic error and vice versa), and
//   (5) the embedded `profiles` join is normalized to a flat owner object whether
//       PostgREST returns it as an ARRAY (to-one inferred as a list) or a single
//       object, with a missing-owner row treated as not-found.

/**
 * Builds a fake `SupabaseClient` for the detail query. The builder chain
 * `.from().select().eq().maybeSingle()` resolves to the supplied result. The
 * chainable spies are exposed so tests can assert the table / filter / select.
 */
function makeDetailClient(result: { data: unknown; error: unknown }) {
	const maybeSingle = vi.fn().mockResolvedValue(result);
	const eq = vi.fn(() => ({ maybeSingle }));
	const select = vi.fn(() => ({ eq }));
	const from = vi.fn(() => ({ select }));

	const client = { from } as unknown as SupabaseClient;
	return { client, from, select, eq, maybeSingle };
}

const VIEWER_ID = '11111111-1111-4111-8111-111111111111';
const DOG_ID = '22222222-2222-4222-8222-222222222222';

const OWNER = {
	id: 'owner-1',
	handle: 'sausage_king',
	display_name: 'Sausage King',
	is_current_top_dog: true,
	top_dog_since: '2026-06-01T00:00:00Z'
};

/** A full detail row as PostgREST returns it (embed defaults to a single object). */
function aDetailRow(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: DOG_ID,
		owner_id: 'owner-1',
		image_path: 'owner-1/dog.webp',
		caption: 'best frank',
		created_at: '2026-06-09T00:00:00Z',
		vote_count: 4,
		peak_votes: 9,
		profiles: OWNER,
		...overrides
	};
}

describe('getDogDetail', () => {
	it('queries hot_dogs filtered by the dog id via .eq(id) + maybeSingle()', async () => {
		const { client, from, eq } = makeDetailClient({ data: aDetailRow(), error: null });

		await getDogDetail(client, DOG_ID, VIEWER_ID);

		expect(from).toHaveBeenCalledWith('hot_dogs');
		expect(eq).toHaveBeenCalledWith('id', DOG_ID);
	});

	it('selects the stats columns (vote_count, peak_votes) and embeds the owner profile + crown state', async () => {
		const { client, select } = makeDetailClient({ data: aDetailRow(), error: null });

		await getDogDetail(client, DOG_ID, VIEWER_ID);

		const selectArg = (select.mock.calls[0] as unknown[])[0] as string;
		expect(selectArg).toContain('vote_count');
		expect(selectArg).toContain('peak_votes');
		expect(selectArg).toContain(
			'profiles(id, handle, display_name, is_current_top_dog, top_dog_since)'
		);
	});

	it('returns the full DogDetail shape incl. peak_votes + vote_count for a found dog', async () => {
		const { client } = makeDetailClient({ data: aDetailRow(), error: null });

		const result = await getDogDetail(client, DOG_ID, VIEWER_ID);

		expect(result).toEqual({
			ok: true,
			data: {
				id: DOG_ID,
				owner_id: 'owner-1',
				image_path: 'owner-1/dog.webp',
				caption: 'best frank',
				created_at: '2026-06-09T00:00:00Z',
				vote_count: 4,
				peak_votes: 9,
				owner: {
					id: 'owner-1',
					handle: 'sausage_king',
					display_name: 'Sausage King',
					is_current_top_dog: true,
					top_dog_since: '2026-06-01T00:00:00Z'
				}
			}
		});
	});

	it('preserves peak_votes independently of the current vote_count', async () => {
		const { client } = makeDetailClient({
			data: aDetailRow({ vote_count: 1, peak_votes: 42 }),
			error: null
		});

		const result = await getDogDetail(client, DOG_ID, VIEWER_ID);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.peak_votes).toBe(42);
			expect(result.data.vote_count).toBe(1);
		}
	});

	it('maps a missing dog (maybeSingle -> null) to the DOG_NOT_FOUND sentinel, NOT a generic error', async () => {
		const { client } = makeDetailClient({ data: null, error: null });

		const result = await getDogDetail(client, DOG_ID, VIEWER_ID);

		expect(result).toEqual({ ok: false, error: DOG_NOT_FOUND });
	});

	it('treats a dog whose owner embed is missing (null) as DOG_NOT_FOUND', async () => {
		const { client } = makeDetailClient({
			data: aDetailRow({ profiles: null }),
			error: null
		});

		const result = await getDogDetail(client, DOG_ID, VIEWER_ID);

		expect(result).toEqual({ ok: false, error: DOG_NOT_FOUND });
	});

	it('treats a dog whose owner embed is an EMPTY array as DOG_NOT_FOUND', async () => {
		const { client } = makeDetailClient({
			data: aDetailRow({ profiles: [] }),
			error: null
		});

		const result = await getDogDetail(client, DOG_ID, VIEWER_ID);

		expect(result).toEqual({ ok: false, error: DOG_NOT_FOUND });
	});

	it('maps a real Supabase error to { ok: false } with the SDK message — distinct from DOG_NOT_FOUND', async () => {
		const { client } = makeDetailClient({
			data: null,
			error: { message: 'permission denied for table hot_dogs' }
		});

		const result = await getDogDetail(client, DOG_ID, VIEWER_ID);

		expect(result).toEqual({ ok: false, error: 'permission denied for table hot_dogs' });
		// A read error must NOT be misreported as a clean not-found (route 500 vs 404).
		expect((result as { error: string }).error).not.toBe(DOG_NOT_FOUND);
	});

	it('does NOT leak raw error internals as the not-found sentinel (sentinel reserved for null data)', async () => {
		// A real error path returns the raw SDK message; only a clean null-data read
		// yields DOG_NOT_FOUND. This pins the two paths stay separable.
		const { client: errClient } = makeDetailClient({
			data: null,
			error: { message: 'relation hot_dogs does not exist' }
		});
		const { client: missingClient } = makeDetailClient({ data: null, error: null });

		const errResult = await getDogDetail(errClient, DOG_ID, VIEWER_ID);
		const missingResult = await getDogDetail(missingClient, DOG_ID, VIEWER_ID);

		expect(errResult).toEqual({ ok: false, error: 'relation hot_dogs does not exist' });
		expect(missingResult).toEqual({ ok: false, error: DOG_NOT_FOUND });
	});

	it('normalizes an ARRAY-form owner embed (to-one inferred as a list) to a flat owner object', async () => {
		const { client } = makeDetailClient({
			data: aDetailRow({ profiles: [OWNER] }),
			error: null
		});

		const result = await getDogDetail(client, DOG_ID, VIEWER_ID);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.owner).toEqual({
				id: 'owner-1',
				handle: 'sausage_king',
				display_name: 'Sausage King',
				is_current_top_dog: true,
				top_dog_since: '2026-06-01T00:00:00Z'
			});
		}
	});

	it('normalizes a SINGLE-OBJECT owner embed to the same flat owner object', async () => {
		const { client } = makeDetailClient({
			data: aDetailRow({ profiles: { ...OWNER, is_current_top_dog: false, top_dog_since: null } }),
			error: null
		});

		const result = await getDogDetail(client, DOG_ID, VIEWER_ID);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.owner.handle).toBe('sausage_king');
			expect(result.data.owner.is_current_top_dog).toBe(false);
			expect(result.data.owner.top_dog_since).toBeNull();
		}
	});

	it('surfaces a null caption for a captionless dog (no coercion)', async () => {
		const { client } = makeDetailClient({
			data: aDetailRow({ caption: null }),
			error: null
		});

		const result = await getDogDetail(client, DOG_ID, VIEWER_ID);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.caption).toBeNull();
		}
	});
});
