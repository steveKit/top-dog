import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
	createHotDog,
	listHotDogsByOwner,
	countByOwner,
	getHotDogById,
	deleteHotDog,
	appStorageBytes,
	isAtCap,
	PER_USER_CAP
} from './hotdogs';

// Unit tests for the server-side hot dog wrappers with a fully mocked
// `SupabaseClient` (mirrors invites/profiles tests). The client is
// dependency-injected (first arg), so a structural fake suffices; the RLS /
// column-privilege guarantees are a live-DB coverage gap noted with the other
// feature tests. Each test asserts: (1) the trusted ids are forwarded faithfully
// and counters are never written, (2) the SDK's `{ data, error }` shape is
// normalized into the discriminated HotDogResult, and (3) errors are surfaced,
// never swallowed. The pure cap predicate is tested independently.

const SDK_ERROR = { name: 'PostgrestError', message: 'boom', code: '500' };

const A_DOG = {
	id: 'dog-uuid',
	owner_id: 'user-uuid',
	image_path: 'user-uuid/dog-uuid.webp',
	caption: 'a fine frank',
	created_at: '2026-06-09T00:00:00Z',
	vote_count: 0,
	peak_votes: 0,
	byte_size: 123456
};

/** Fake client whose insert -> select -> single() chain resolves `result`. */
function makeInsertClient(result: { data: unknown; error: unknown }) {
	const single = vi.fn().mockResolvedValue(result);
	const select = vi.fn(() => ({ single }));
	const insert = vi.fn(() => ({ select }));
	const from = vi.fn(() => ({ insert }));
	const client = { from } as unknown as SupabaseClient;
	return { client, from, insert, select, single };
}

/** Fake client whose select -> eq -> order() chain resolves `result`. */
function makeListClient(result: { data: unknown; error: unknown }) {
	const order = vi.fn().mockResolvedValue(result);
	const eq = vi.fn(() => ({ order }));
	const select = vi.fn(() => ({ eq }));
	const from = vi.fn(() => ({ select }));
	const client = { from } as unknown as SupabaseClient;
	return { client, from, select, eq, order };
}

/** Fake client whose select(head count) -> eq() chain resolves `result`. */
function makeCountClient(result: { count: number | null; error: unknown }) {
	const eq = vi.fn().mockResolvedValue(result);
	const select = vi.fn(() => ({ eq }));
	const from = vi.fn(() => ({ select }));
	const client = { from } as unknown as SupabaseClient;
	return { client, from, select, eq };
}

/** Fake client whose select -> eq -> maybeSingle() chain resolves `result`. */
function makeMaybeSingleClient(result: { data: unknown; error: unknown }) {
	const maybeSingle = vi.fn().mockResolvedValue(result);
	const eq = vi.fn(() => ({ maybeSingle }));
	const select = vi.fn(() => ({ eq }));
	const from = vi.fn(() => ({ select }));
	const client = { from } as unknown as SupabaseClient;
	return { client, from, select, eq, maybeSingle };
}

/** Fake client whose delete -> eq -> select() chain resolves `result`. */
function makeDeleteClient(result: { data: unknown; error: unknown }) {
	const select = vi.fn().mockResolvedValue(result);
	const eq = vi.fn(() => ({ select }));
	const del = vi.fn(() => ({ eq }));
	const from = vi.fn(() => ({ delete: del }));
	const client = { from } as unknown as SupabaseClient;
	return { client, from, del, eq, select };
}

/** Fake client whose rpc() resolves `result`. */
function makeRpcClient(result: { data: unknown; error: unknown }) {
	const rpc = vi.fn().mockResolvedValue(result);
	const client = { rpc } as unknown as SupabaseClient;
	return { client, rpc };
}

describe('isAtCap', () => {
	it('is false below the cap', () => {
		expect(isAtCap(0)).toBe(false);
		expect(isAtCap(PER_USER_CAP - 1)).toBe(false);
	});

	it('is true at the cap (decision #10: delete one to add another)', () => {
		expect(isAtCap(PER_USER_CAP)).toBe(true);
	});

	it('is true over the cap', () => {
		expect(isAtCap(PER_USER_CAP + 5)).toBe(true);
	});
});

describe('createHotDog', () => {
	it('inserts the row with the trusted id, owner_id, image_path, byte_size, caption', async () => {
		const { client, from, insert } = makeInsertClient({ data: A_DOG, error: null });

		await createHotDog(client, {
			id: 'dog-uuid',
			ownerId: 'user-uuid',
			imagePath: 'user-uuid/dog-uuid.webp',
			byteSize: 123456,
			caption: 'a fine frank'
		});

		expect(from).toHaveBeenCalledWith('hot_dogs');
		expect(insert).toHaveBeenCalledWith({
			id: 'dog-uuid',
			owner_id: 'user-uuid',
			image_path: 'user-uuid/dog-uuid.webp',
			byte_size: 123456,
			caption: 'a fine frank'
		});
	});

	it('never writes the server-maintained counters', async () => {
		const { client, insert } = makeInsertClient({ data: A_DOG, error: null });

		await createHotDog(client, {
			id: 'dog-uuid',
			ownerId: 'user-uuid',
			imagePath: 'user-uuid/dog-uuid.webp',
			byteSize: 1
		});

		expect(insert).toHaveBeenCalledWith(
			expect.not.objectContaining({ vote_count: expect.anything() })
		);
		expect(insert).toHaveBeenCalledWith(
			expect.not.objectContaining({ peak_votes: expect.anything() })
		);
	});

	it('defaults caption to null when omitted', async () => {
		const { client, insert } = makeInsertClient({ data: A_DOG, error: null });

		await createHotDog(client, {
			id: 'dog-uuid',
			ownerId: 'user-uuid',
			imagePath: 'user-uuid/dog-uuid.webp',
			byteSize: 1
		});

		expect(insert).toHaveBeenCalledWith(expect.objectContaining({ caption: null }));
	});

	it('returns { ok: true, data: <dog> } on success', async () => {
		const { client } = makeInsertClient({ data: A_DOG, error: null });

		const result = await createHotDog(client, {
			id: 'dog-uuid',
			ownerId: 'user-uuid',
			imagePath: 'user-uuid/dog-uuid.webp',
			byteSize: 123456
		});

		expect(result).toEqual({ ok: true, data: A_DOG });
	});

	it('surfaces an insert error as { ok: false } (does not swallow)', async () => {
		const { client } = makeInsertClient({ data: null, error: SDK_ERROR });

		const result = await createHotDog(client, {
			id: 'dog-uuid',
			ownerId: 'user-uuid',
			imagePath: 'user-uuid/dog-uuid.webp',
			byteSize: 1
		});

		expect(result).toEqual({ ok: false, error: 'boom' });
	});

	it('fails closed when the insert returns no row and no error', async () => {
		const { client } = makeInsertClient({ data: null, error: null });

		const result = await createHotDog(client, {
			id: 'dog-uuid',
			ownerId: 'user-uuid',
			imagePath: 'user-uuid/dog-uuid.webp',
			byteSize: 1
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toMatch(/failed to save/i);
		}
	});
});

describe('listHotDogsByOwner', () => {
	it('queries hot_dogs filtered by owner, newest first', async () => {
		const { client, from, eq, order } = makeListClient({ data: [A_DOG], error: null });

		await listHotDogsByOwner(client, 'user-uuid');

		expect(from).toHaveBeenCalledWith('hot_dogs');
		expect(eq).toHaveBeenCalledWith('owner_id', 'user-uuid');
		expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
	});

	it('returns the rows on success', async () => {
		const { client } = makeListClient({ data: [A_DOG], error: null });

		const result = await listHotDogsByOwner(client, 'user-uuid');

		expect(result).toEqual({ ok: true, data: [A_DOG] });
	});

	it('returns an empty array when the owner has no dogs', async () => {
		const { client } = makeListClient({ data: null, error: null });

		const result = await listHotDogsByOwner(client, 'user-uuid');

		expect(result).toEqual({ ok: true, data: [] });
	});

	it('surfaces a query error as { ok: false }', async () => {
		const { client } = makeListClient({ data: null, error: SDK_ERROR });

		const result = await listHotDogsByOwner(client, 'user-uuid');

		expect(result).toEqual({ ok: false, error: 'boom' });
	});
});

describe('countByOwner', () => {
	it('counts hot_dogs for the owner (head count) and returns the count', async () => {
		const { client, from, eq } = makeCountClient({ count: 7, error: null });

		const result = await countByOwner(client, 'user-uuid');

		expect(from).toHaveBeenCalledWith('hot_dogs');
		expect(eq).toHaveBeenCalledWith('owner_id', 'user-uuid');
		expect(result).toEqual({ ok: true, data: 7 });
	});

	it('treats a null count as 0', async () => {
		const { client } = makeCountClient({ count: null, error: null });

		const result = await countByOwner(client, 'user-uuid');

		expect(result).toEqual({ ok: true, data: 0 });
	});

	it('surfaces a count error as { ok: false }', async () => {
		const { client } = makeCountClient({ count: null, error: SDK_ERROR });

		const result = await countByOwner(client, 'user-uuid');

		expect(result).toEqual({ ok: false, error: 'boom' });
	});
});

describe('getHotDogById', () => {
	it('returns { ok: true, data: <dog> } when the row exists', async () => {
		const { client, from, eq } = makeMaybeSingleClient({ data: A_DOG, error: null });

		const result = await getHotDogById(client, 'dog-uuid');

		expect(from).toHaveBeenCalledWith('hot_dogs');
		expect(eq).toHaveBeenCalledWith('id', 'dog-uuid');
		expect(result).toEqual({ ok: true, data: A_DOG });
	});

	it('returns { ok: true, data: null } when no row exists', async () => {
		const { client } = makeMaybeSingleClient({ data: null, error: null });

		const result = await getHotDogById(client, 'dog-uuid');

		expect(result).toEqual({ ok: true, data: null });
	});

	it('surfaces a query error as { ok: false }', async () => {
		const { client } = makeMaybeSingleClient({ data: null, error: SDK_ERROR });

		const result = await getHotDogById(client, 'dog-uuid');

		expect(result).toEqual({ ok: false, error: 'boom' });
	});
});

describe('deleteHotDog', () => {
	it('deletes the row by id and reports how many rows were removed', async () => {
		const { client, from, eq } = makeDeleteClient({ data: [{ id: 'dog-uuid' }], error: null });

		const result = await deleteHotDog(client, 'dog-uuid');

		expect(from).toHaveBeenCalledWith('hot_dogs');
		expect(eq).toHaveBeenCalledWith('id', 'dog-uuid');
		expect(result).toEqual({ ok: true, data: { deleted: 1 } });
	});

	it('reports 0 deleted when no row matched (wrong id / not owned)', async () => {
		const { client } = makeDeleteClient({ data: [], error: null });

		const result = await deleteHotDog(client, 'dog-uuid');

		expect(result).toEqual({ ok: true, data: { deleted: 0 } });
	});

	it('surfaces a delete error as { ok: false }', async () => {
		const { client } = makeDeleteClient({ data: null, error: SDK_ERROR });

		const result = await deleteHotDog(client, 'dog-uuid');

		expect(result).toEqual({ ok: false, error: 'boom' });
	});
});

describe('appStorageBytes', () => {
	it('calls the app_storage_bytes RPC and returns the byte total', async () => {
		const { client, rpc } = makeRpcClient({ data: 5000, error: null });

		const result = await appStorageBytes(client);

		expect(rpc).toHaveBeenCalledWith('app_storage_bytes');
		expect(result).toEqual({ ok: true, data: 5000 });
	});

	it('treats a null/empty total as 0', async () => {
		const { client } = makeRpcClient({ data: null, error: null });

		const result = await appStorageBytes(client);

		expect(result).toEqual({ ok: true, data: 0 });
	});

	it('coerces a bigint sum surfaced as a numeric string into a number', async () => {
		// Postgres sum() over a bigint column can come back as a numeric string
		// from supabase-js; the wrapper must Number()-coerce it, not pass it through.
		const { client } = makeRpcClient({ data: '838860800', error: null });

		const result = await appStorageBytes(client);

		expect(result).toEqual({ ok: true, data: 838860800 });
		if (result.ok) {
			expect(typeof result.data).toBe('number');
		}
	});

	it('surfaces an RPC error as { ok: false }', async () => {
		const { client } = makeRpcClient({ data: null, error: SDK_ERROR });

		const result = await appStorageBytes(client);

		expect(result).toEqual({ ok: false, error: 'boom' });
	});
});
