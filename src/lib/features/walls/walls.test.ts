import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
	postWallMessage,
	listWallMessages,
	deleteWallMessage,
	MAX_WALL_BODY_LENGTH
} from './walls';

// Unit tests for the server-side wall-message wrappers with a fully mocked
// `SupabaseClient` — they never touch a live Supabase stack (that boundary is
// covered by tests/walls.e2e.ts). The client is dependency-injected (first arg),
// mirroring the reactions/votes/storage modules, so a structural fake suffices.
//
// Wall messages are a COSMETIC / many-allowed surface (decision #12/#15): plain
// owner-scoped RLS INSERT/DELETE, no SECURITY DEFINER RPC. Each test asserts:
//   (1) the body boundary is validated BEFORE any DB call (empty/whitespace and
//       >1000 chars are rejected with friendly sentinels);
//   (2) a valid body is stored VERBATIM (boundary-trimmed only — internal content,
//       including emoji and newlines, is preserved; M6 applies a render-time filter);
//   (3) SQLSTATE 23514 (CHECK violation) maps to the BODY_TOO_LONG sentinel and any
//       other raw Supabase error maps to a friendly sentinel (never leaked);
//   (4) listWallMessages forwards the profile filter + ordering + limit and
//       normalizes the author embed whether PostgREST returns it as a single
//       OBJECT or a single-element ARRAY (both yield one author);
//   (5) deleteWallMessage forwards the id filter; RLS is authoritative (live-DB).

const AUTHOR = 'author-uuid';
const PROFILE = 'wall-owner-uuid';
const MESSAGE_ID = 'message-uuid';

/** A fake SupabaseClient whose `.from(...).insert(...)` resolves `{ error }`. */
function makeInsertClient(result: { error: unknown }) {
	const insert = vi.fn().mockResolvedValue(result);
	const from = vi.fn().mockReturnValue({ insert });
	const client = { from } as unknown as SupabaseClient;
	return { client, from, insert };
}

/**
 * A fake SupabaseClient for the list path:
 * `.from(...).select(...).eq(...).order(...).limit(...)` resolves `{ data, error }`.
 * The terminal `.limit()` is what the wrapper awaits, so it resolves the result;
 * the intermediate chainable spies are exposed so tests can assert the arguments.
 */
function makeListClient(result: { data: unknown; error: unknown }) {
	const limit = vi.fn().mockResolvedValue(result);
	const order = vi.fn(() => ({ limit }));
	const eq = vi.fn(() => ({ order }));
	const select = vi.fn(() => ({ eq }));
	const from = vi.fn(() => ({ select }));
	const client = { from } as unknown as SupabaseClient;
	return { client, from, select, eq, order, limit };
}

/**
 * A fake SupabaseClient for the delete path: `.from(...).delete().eq(...)`
 * resolves `{ error }`.
 */
function makeDeleteClient(result: { error: unknown }) {
	const eq = vi.fn().mockResolvedValue(result);
	const del = vi.fn(() => ({ eq }));
	const from = vi.fn().mockReturnValue({ delete: del });
	const client = { from } as unknown as SupabaseClient;
	return { client, from, del, eq };
}

function pgError(code: string, message = 'some postgrest prose') {
	return { name: 'PostgrestError', code, message, details: '' };
}

describe('postWallMessage', () => {
	it('inserts { profile_id, author_id, body } and returns ok on success', async () => {
		const { client, from, insert } = makeInsertClient({ error: null });

		const result = await postWallMessage(client, AUTHOR, PROFILE, 'Nice dog!');

		expect(from).toHaveBeenCalledWith('wall_messages');
		expect(insert).toHaveBeenCalledWith({
			profile_id: PROFILE,
			author_id: AUTHOR,
			body: 'Nice dog!'
		});
		expect(result).toEqual({ ok: true, data: null });
	});

	it('rejects an empty body BEFORE touching the DB', async () => {
		const { client, from } = makeInsertClient({ error: null });

		const result = await postWallMessage(client, AUTHOR, PROFILE, '');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toMatch(/empty/i);
		}
		// No DB call happened — the boundary short-circuited.
		expect(from).not.toHaveBeenCalled();
	});

	it('rejects a whitespace-only body BEFORE touching the DB', async () => {
		const { client, from } = makeInsertClient({ error: null });

		const result = await postWallMessage(client, AUTHOR, PROFILE, '   \n\t  ');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toMatch(/empty/i);
		}
		expect(from).not.toHaveBeenCalled();
	});

	it('rejects a body longer than MAX_WALL_BODY_LENGTH (after trim) BEFORE touching the DB', async () => {
		const { client, from } = makeInsertClient({ error: null });
		// One char over the bound once trimmed.
		const tooLong = 'a'.repeat(MAX_WALL_BODY_LENGTH + 1);

		const result = await postWallMessage(client, AUTHOR, PROFILE, tooLong);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toMatch(/too long/i);
		}
		expect(from).not.toHaveBeenCalled();
	});

	it('accepts a body exactly at MAX_WALL_BODY_LENGTH (boundary is inclusive)', async () => {
		const { client, insert } = makeInsertClient({ error: null });
		const atBound = 'a'.repeat(MAX_WALL_BODY_LENGTH);

		const result = await postWallMessage(client, AUTHOR, PROFILE, atBound);

		expect(result).toEqual({ ok: true, data: null });
		expect(insert).toHaveBeenCalledWith({
			profile_id: PROFILE,
			author_id: AUTHOR,
			body: atBound
		});
	});

	it('stores the body VERBATIM after a boundary trim only — internal content (emoji, newlines, spaces) preserved', async () => {
		const { client, insert } = makeInsertClient({ error: null });
		// Leading/trailing whitespace is trimmed at the boundary, but the INTERNAL
		// content — including emoji, double spaces, and newlines — is preserved
		// exactly (M6 applies a render-time filter; nothing is transformed here).
		const raw = '  Hot  dog 🌭\nwith  mustard 🟡  ';
		const expected = 'Hot  dog 🌭\nwith  mustard 🟡';

		const result = await postWallMessage(client, AUTHOR, PROFILE, raw);

		expect(result).toEqual({ ok: true, data: null });
		const inserted = vi.mocked(insert).mock.calls[0][0] as { body: string };
		expect(inserted.body).toBe(expected);
		// No emoji stripping / no internal-whitespace collapse — verbatim storage.
		expect(inserted.body).toContain('🌭');
		expect(inserted.body).toContain('Hot  dog');
		expect(inserted.body).toContain('\n');
	});

	it('maps a 23514 CHECK violation (body too long backstop) to the BODY_TOO_LONG sentinel', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { client } = makeInsertClient({
			error: pgError('23514', 'new row violates check constraint "wall_messages_body_length"')
		});

		// A non-empty, within-bound body passes the app boundary and reaches the DB,
		// where the CHECK backstop fires (e.g. a multibyte edge); it maps to the
		// friendly length message, never the raw constraint text.
		const result = await postWallMessage(client, AUTHOR, PROFILE, 'reaches the db');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toMatch(/too long/i);
			expect(result.error).not.toMatch(/check constraint/i);
		}
	});

	it('maps an unrelated Supabase error to a friendly sentinel (raw text not leaked) and logs server-side', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { client } = makeInsertClient({
			error: pgError('42501', 'permission denied for table wall_messages')
		});

		const result = await postWallMessage(client, AUTHOR, PROFILE, 'a message');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).not.toMatch(/permission denied/i);
			expect(result.error).toMatch(/could not post/i);
		}
		// The raw error is logged server-side for debugging, never surfaced to the user.
		expect(errorSpy).toHaveBeenCalled();
	});
});

describe('listWallMessages', () => {
	it('queries wall_messages filtered by profile_id, ordered created_at desc, limited', async () => {
		const { client, from, select, eq, order, limit } = makeListClient({ data: [], error: null });

		await listWallMessages(client, PROFILE, 25);

		expect(from).toHaveBeenCalledWith('wall_messages');
		expect(select).toHaveBeenCalledWith(
			'id, author_id, body, created_at, author:profiles!author_id (handle, display_name)'
		);
		expect(eq).toHaveBeenCalledWith('profile_id', PROFILE);
		expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
		expect(limit).toHaveBeenCalledWith(25);
	});

	it('defaults to the latest 50 messages when no limit is given', async () => {
		const { client, limit } = makeListClient({ data: [], error: null });

		await listWallMessages(client, PROFILE);

		expect(limit).toHaveBeenCalledWith(50);
	});

	it('normalizes an OBJECT-form author embed to one author', async () => {
		const rows = [
			{
				id: 'm-1',
				author_id: AUTHOR,
				body: 'object embed',
				created_at: '2026-06-16T10:00:00Z',
				author: { handle: 'chef', display_name: 'Chef Dog' }
			}
		];
		const { client } = makeListClient({ data: rows, error: null });

		const result = await listWallMessages(client, PROFILE);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data).toEqual([
				{
					id: 'm-1',
					author_id: AUTHOR,
					body: 'object embed',
					created_at: '2026-06-16T10:00:00Z',
					author_handle: 'chef',
					author_display_name: 'Chef Dog'
				}
			]);
		}
	});

	it('normalizes a SINGLE-ELEMENT-ARRAY author embed to one author', async () => {
		// PostgREST's inferred types surface an FK embed as an array; the wrapper
		// must flatten a single-element array to one author identically to the object.
		const rows = [
			{
				id: 'm-2',
				author_id: AUTHOR,
				body: 'array embed',
				created_at: '2026-06-16T11:00:00Z',
				author: [{ handle: 'chef', display_name: 'Chef Dog' }]
			}
		];
		const { client } = makeListClient({ data: rows, error: null });

		const result = await listWallMessages(client, PROFILE);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data).toHaveLength(1);
			expect(result.data[0].author_handle).toBe('chef');
			expect(result.data[0].author_display_name).toBe('Chef Dog');
		}
	});

	it('falls back to empty author strings when the embed is null', async () => {
		const rows = [
			{
				id: 'm-3',
				author_id: AUTHOR,
				body: 'no author embed',
				created_at: '2026-06-16T12:00:00Z',
				author: null
			}
		];
		const { client } = makeListClient({ data: rows, error: null });

		const result = await listWallMessages(client, PROFILE);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data[0].author_handle).toBe('');
			expect(result.data[0].author_display_name).toBe('');
		}
	});

	it('coerces a null data payload to an empty array', async () => {
		const { client } = makeListClient({ data: null, error: null });

		const result = await listWallMessages(client, PROFILE);

		expect(result).toEqual({ ok: true, data: [] });
	});

	it('maps a Supabase error to a friendly sentinel (raw text not leaked) and logs server-side', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { client } = makeListClient({
			data: null,
			error: pgError('42P01', 'relation "wall_messages" does not exist')
		});

		const result = await listWallMessages(client, PROFILE);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).not.toMatch(/relation/i);
			expect(result.error).toMatch(/could not load/i);
		}
		expect(errorSpy).toHaveBeenCalled();
	});
});

describe('deleteWallMessage', () => {
	it('deletes scoped by id and returns ok on success', async () => {
		const { client, from, del, eq } = makeDeleteClient({ error: null });

		const result = await deleteWallMessage(client, MESSAGE_ID);

		expect(from).toHaveBeenCalledWith('wall_messages');
		expect(del).toHaveBeenCalled();
		expect(eq).toHaveBeenCalledWith('id', MESSAGE_ID);
		expect(result).toEqual({ ok: true, data: null });
	});

	it('is idempotent: deleting a missing/unauthorized row (no error) still succeeds', async () => {
		// RLS makes a non-author/non-owner delete affect zero rows, which PostgREST
		// does not treat as an error — the wrapper still returns ok.
		const { client } = makeDeleteClient({ error: null });

		const result = await deleteWallMessage(client, MESSAGE_ID);

		expect(result).toEqual({ ok: true, data: null });
	});

	it('maps a Supabase error to a friendly sentinel (raw text not leaked) and logs server-side', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { client } = makeDeleteClient({
			error: pgError('42501', 'permission denied for table wall_messages')
		});

		const result = await deleteWallMessage(client, MESSAGE_ID);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).not.toMatch(/permission denied/i);
			expect(result.error).toMatch(/could not delete/i);
		}
		expect(errorSpy).toHaveBeenCalled();
	});
});
