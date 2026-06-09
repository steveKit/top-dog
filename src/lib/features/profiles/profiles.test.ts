import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
	getProfileById,
	getProfileByHandle,
	isHandleAvailable,
	createProfile,
	HANDLE_TAKEN
} from './profiles';

// Unit tests for the server-side profile wrappers with a fully mocked
// `SupabaseClient` (mirrors invites.test.ts). The client is dependency-injected
// (first arg) so a structural fake suffices; the RLS/UNIQUE guarantees are a
// live-DB coverage gap noted alongside the invites tests. Each test asserts:
// (1) the trusted id/handle is forwarded faithfully, (2) the SDK's
// `{ data, error }` shape is normalized into the discriminated `ProfileResult`,
// (3) a unique-violation insert is mapped to HANDLE_TAKEN (never leaking the
// constraint text), and (4) errors are surfaced, never swallowed.

const SDK_ERROR = { name: 'PostgrestError', message: 'boom', code: '500' };
const UNIQUE_ERROR = { name: 'PostgrestError', message: 'duplicate key value', code: '23505' };

const A_PROFILE = {
	id: 'user-uuid',
	handle: 'ChefDog',
	display_name: 'Chef Dog',
	avatar_path: null,
	joined_at: '2026-06-09T00:00:00Z',
	days_as_top_dog: 0,
	is_current_top_dog: false,
	top_dog_since: null
};

/** Fake client whose select -> eq -> maybeSingle() chain resolves `result`. */
function makeMaybeSingleClient(result: { data: unknown; error: unknown }) {
	const maybeSingle = vi.fn().mockResolvedValue(result);
	const eq = vi.fn(() => ({ maybeSingle }));
	const select = vi.fn(() => ({ eq }));
	const from = vi.fn(() => ({ select }));
	const client = { from } as unknown as SupabaseClient;
	return { client, from, select, eq, maybeSingle };
}

/** Fake client whose insert -> select -> single() chain resolves `result`. */
function makeInsertClient(result: { data: unknown; error: unknown }) {
	const single = vi.fn().mockResolvedValue(result);
	const select = vi.fn(() => ({ single }));
	const insert = vi.fn(() => ({ select }));
	const from = vi.fn(() => ({ insert }));
	const client = { from } as unknown as SupabaseClient;
	return { client, from, insert, select, single };
}

describe('getProfileById', () => {
	it('queries the profiles table filtered by id', async () => {
		const { client, from, eq } = makeMaybeSingleClient({ data: A_PROFILE, error: null });

		await getProfileById(client, 'user-uuid');

		expect(from).toHaveBeenCalledWith('profiles');
		expect(eq).toHaveBeenCalledWith('id', 'user-uuid');
	});

	it('returns { ok: true, data: <profile> } when a row exists', async () => {
		const { client } = makeMaybeSingleClient({ data: A_PROFILE, error: null });

		const result = await getProfileById(client, 'user-uuid');

		expect(result).toEqual({ ok: true, data: A_PROFILE });
	});

	it('returns { ok: true, data: null } when no row exists', async () => {
		const { client } = makeMaybeSingleClient({ data: null, error: null });

		const result = await getProfileById(client, 'user-uuid');

		expect(result).toEqual({ ok: true, data: null });
	});

	it('surfaces a query error as { ok: false } (does not swallow)', async () => {
		const { client } = makeMaybeSingleClient({ data: null, error: SDK_ERROR });

		const result = await getProfileById(client, 'user-uuid');

		expect(result).toEqual({ ok: false, error: 'boom' });
	});
});

describe('getProfileByHandle', () => {
	it('queries the profiles table filtered by handle', async () => {
		const { client, from, eq } = makeMaybeSingleClient({ data: A_PROFILE, error: null });

		await getProfileByHandle(client, 'ChefDog');

		expect(from).toHaveBeenCalledWith('profiles');
		expect(eq).toHaveBeenCalledWith('handle', 'ChefDog');
	});

	it('returns { ok: true, data: null } for an unknown handle', async () => {
		const { client } = makeMaybeSingleClient({ data: null, error: null });

		const result = await getProfileByHandle(client, 'nobody');

		expect(result).toEqual({ ok: true, data: null });
	});

	it('surfaces a query error as { ok: false }', async () => {
		const { client } = makeMaybeSingleClient({ data: null, error: SDK_ERROR });

		const result = await getProfileByHandle(client, 'ChefDog');

		expect(result).toEqual({ ok: false, error: 'boom' });
	});
});

describe('isHandleAvailable', () => {
	it('returns { ok: true, data: true } when the handle is free', async () => {
		const { client, eq } = makeMaybeSingleClient({ data: null, error: null });

		const result = await isHandleAvailable(client, 'ChefDog');

		expect(eq).toHaveBeenCalledWith('handle', 'ChefDog');
		expect(result).toEqual({ ok: true, data: true });
	});

	it('returns { ok: true, data: false } when the handle is taken', async () => {
		const { client } = makeMaybeSingleClient({ data: { id: 'someone' }, error: null });

		const result = await isHandleAvailable(client, 'ChefDog');

		expect(result).toEqual({ ok: true, data: false });
	});

	it('surfaces a query error as { ok: false }', async () => {
		const { client } = makeMaybeSingleClient({ data: null, error: SDK_ERROR });

		const result = await isHandleAvailable(client, 'ChefDog');

		expect(result).toEqual({ ok: false, error: 'boom' });
	});
});

describe('createProfile', () => {
	it('inserts the row with the trusted id, handle, display_name, avatar_path', async () => {
		const { client, from, insert } = makeInsertClient({ data: A_PROFILE, error: null });

		await createProfile(client, {
			id: 'user-uuid',
			handle: 'ChefDog',
			displayName: 'Chef Dog',
			avatarPath: 'user-uuid/avatar.webp'
		});

		expect(from).toHaveBeenCalledWith('profiles');
		expect(insert).toHaveBeenCalledWith({
			id: 'user-uuid',
			handle: 'ChefDog',
			display_name: 'Chef Dog',
			avatar_path: 'user-uuid/avatar.webp'
		});
	});

	it('defaults avatar_path to null when omitted', async () => {
		const { client, insert } = makeInsertClient({ data: A_PROFILE, error: null });

		await createProfile(client, { id: 'user-uuid', handle: 'ChefDog', displayName: 'Chef Dog' });

		expect(insert).toHaveBeenCalledWith(expect.objectContaining({ avatar_path: null }));
	});

	it('returns { ok: true, data: <profile> } on success', async () => {
		const { client } = makeInsertClient({ data: A_PROFILE, error: null });

		const result = await createProfile(client, {
			id: 'user-uuid',
			handle: 'ChefDog',
			displayName: 'Chef Dog'
		});

		expect(result).toEqual({ ok: true, data: A_PROFILE });
	});

	it('maps a unique-violation (23505) to HANDLE_TAKEN without leaking constraint text', async () => {
		const { client } = makeInsertClient({ data: null, error: UNIQUE_ERROR });

		const result = await createProfile(client, {
			id: 'user-uuid',
			handle: 'ChefDog',
			displayName: 'Chef Dog'
		});

		expect(result).toEqual({ ok: false, error: HANDLE_TAKEN });
	});

	it('surfaces a non-unique insert error with its SDK message', async () => {
		const { client } = makeInsertClient({ data: null, error: SDK_ERROR });

		const result = await createProfile(client, {
			id: 'user-uuid',
			handle: 'ChefDog',
			displayName: 'Chef Dog'
		});

		expect(result).toEqual({ ok: false, error: 'boom' });
	});

	it('forwards an explicitly-null avatar_path (not just an omitted one)', async () => {
		const { client, insert } = makeInsertClient({ data: A_PROFILE, error: null });

		await createProfile(client, {
			id: 'user-uuid',
			handle: 'ChefDog',
			displayName: 'Chef Dog',
			avatarPath: null
		});

		expect(insert).toHaveBeenCalledWith(expect.objectContaining({ avatar_path: null }));
	});

	it('fails closed when the insert returns no row and no error (defensive guard)', async () => {
		const { client } = makeInsertClient({ data: null, error: null });

		const result = await createProfile(client, {
			id: 'user-uuid',
			handle: 'ChefDog',
			displayName: 'Chef Dog'
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toMatch(/failed to create/i);
			// Must not leak the HANDLE_TAKEN sentinel for a non-duplicate failure.
			expect(result.error).not.toBe(HANDLE_TAKEN);
		}
	});
});
