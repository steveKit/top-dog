import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
	sendDm,
	listConversations,
	listThread,
	markThreadRead,
	MAX_DM_BODY_LENGTH,
	type ThreadMessage
} from './dms';

// Unit tests for the server-side DM wrappers with a fully mocked `SupabaseClient`
// — they never touch a live Supabase stack (that boundary, especially the privacy
// SELECT RLS, is covered by tests/dms.e2e.ts). The client is dependency-injected
// (first arg), mirroring walls/reactions/votes, so a structural fake suffices.
//
// DMs are a PRIVACY surface: the load-bearing control is the SELECT RLS, but the
// WRITE path is a plain owner-scoped RLS write (no RPC). Each test asserts:
//   (1) sendDm validates body (empty/whitespace/over-length) and self-DM BEFORE
//       any DB call, with friendly sentinels; a valid body is trimmed-then-stored
//       verbatim; SQLSTATE 23514 maps to the length sentinel and any other raw
//       error maps to a friendly sentinel (never leaked) + a server log;
//   (2) listConversations forwards the dual-party embed select + ordering, picks
//       the counterparty relative to the viewer, normalizes the embed whether
//       PostgREST returns it as an OBJECT or a single-element ARRAY, and delegates
//       to the pure summarizer;
//   (3) listThread builds the both-directions .or() pair filter, orders oldest
//       first, and never leaks a raw error;
//   (4) markThreadRead scopes the read_at UPDATE to recipient = viewer, sender =
//       counterparty, read_at IS NULL (idempotent), and never leaks a raw error.

const VIEWER = '11111111-1111-4111-8111-111111111111';
const ALICE = '22222222-2222-4222-8222-222222222222';

function pgError(code: string, message = 'some postgrest prose') {
	return { name: 'PostgrestError', code, message, details: '' };
}

/** Fake client whose `.from(...).insert(...)` resolves `{ error }`. */
function makeInsertClient(result: { error: unknown }) {
	const insert = vi.fn().mockResolvedValue(result);
	const from = vi.fn().mockReturnValue({ insert });
	const client = { from } as unknown as SupabaseClient;
	return { client, from, insert };
}

/**
 * Fake client for the inbox path: `.from(...).select(...).order(...)` resolves
 * `{ data, error }`. The terminal `.order()` is awaited.
 */
function makeListConversationsClient(result: { data: unknown; error: unknown }) {
	const order = vi.fn().mockResolvedValue(result);
	const select = vi.fn(() => ({ order }));
	const from = vi.fn(() => ({ select }));
	const client = { from } as unknown as SupabaseClient;
	return { client, from, select, order };
}

/**
 * Fake client for the thread path: `.from(...).select(...).or(...).order(...)`
 * resolves `{ data, error }`. The terminal `.order()` is awaited.
 */
function makeListThreadClient(result: { data: unknown; error: unknown }) {
	const order = vi.fn().mockResolvedValue(result);
	const or = vi.fn(() => ({ order }));
	const select = vi.fn(() => ({ or }));
	const from = vi.fn(() => ({ select }));
	const client = { from } as unknown as SupabaseClient;
	return { client, from, select, or, order };
}

/**
 * Fake client for the mark-read path:
 * `.from(...).update(...).eq(...).eq(...).is(...)` resolves `{ error }`. The
 * terminal `.is()` is awaited; the intermediate chainable spies are exposed.
 */
function makeMarkReadClient(result: { error: unknown }) {
	const is = vi.fn().mockResolvedValue(result);
	const eqSender = vi.fn(() => ({ is }));
	const eqRecipient = vi.fn(() => ({ eq: eqSender }));
	const update = vi.fn(() => ({ eq: eqRecipient }));
	const from = vi.fn(() => ({ update }));
	const client = { from } as unknown as SupabaseClient;
	return { client, from, update, eqRecipient, eqSender, is };
}

describe('sendDm', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('inserts { sender_id, recipient_id, body } and returns ok on success', async () => {
		const { client, from, insert } = makeInsertClient({ error: null });

		const result = await sendDm(client, VIEWER, ALICE, 'hey there');

		expect(from).toHaveBeenCalledWith('dms');
		expect(insert).toHaveBeenCalledWith({
			sender_id: VIEWER,
			recipient_id: ALICE,
			body: 'hey there'
		});
		expect(result).toEqual({ ok: true, data: null });
	});

	it('rejects an empty body BEFORE touching the DB', async () => {
		const { client, from } = makeInsertClient({ error: null });

		const result = await sendDm(client, VIEWER, ALICE, '');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toMatch(/empty/i);
		}
		expect(from).not.toHaveBeenCalled();
	});

	it('rejects a whitespace-only body BEFORE touching the DB', async () => {
		const { client, from } = makeInsertClient({ error: null });

		const result = await sendDm(client, VIEWER, ALICE, '   \n\t  ');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toMatch(/empty/i);
		}
		expect(from).not.toHaveBeenCalled();
	});

	it('rejects a body longer than MAX_DM_BODY_LENGTH (after trim) BEFORE touching the DB', async () => {
		const { client, from } = makeInsertClient({ error: null });
		const tooLong = 'a'.repeat(MAX_DM_BODY_LENGTH + 1);

		const result = await sendDm(client, VIEWER, ALICE, tooLong);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toMatch(/too long/i);
		}
		expect(from).not.toHaveBeenCalled();
	});

	it('accepts a body exactly at MAX_DM_BODY_LENGTH (boundary is inclusive)', async () => {
		const { client, insert } = makeInsertClient({ error: null });
		const atBound = 'a'.repeat(MAX_DM_BODY_LENGTH);

		const result = await sendDm(client, VIEWER, ALICE, atBound);

		expect(result).toEqual({ ok: true, data: null });
		expect(insert).toHaveBeenCalledWith({
			sender_id: VIEWER,
			recipient_id: ALICE,
			body: atBound
		});
	});

	it('rejects a self-DM (sender === recipient) BEFORE touching the DB', async () => {
		const { client, from } = makeInsertClient({ error: null });

		const result = await sendDm(client, VIEWER, VIEWER, 'talking to myself');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toMatch(/yourself/i);
		}
		expect(from).not.toHaveBeenCalled();
	});

	it('stores the body VERBATIM after a boundary trim only — internal content preserved', async () => {
		const { client, insert } = makeInsertClient({ error: null });
		// Leading/trailing whitespace is trimmed at the boundary, but the INTERNAL
		// content — emoji, double spaces, newlines — is preserved exactly (M6 applies
		// a render-time filter; nothing is transformed here).
		const raw = '  Hot  dog 🌭\nwith  mustard 🟡  ';
		const expected = 'Hot  dog 🌭\nwith  mustard 🟡';

		const result = await sendDm(client, VIEWER, ALICE, raw);

		expect(result).toEqual({ ok: true, data: null });
		const inserted = vi.mocked(insert).mock.calls[0][0] as { body: string };
		expect(inserted.body).toBe(expected);
		expect(inserted.body).toContain('🌭');
		expect(inserted.body).toContain('Hot  dog');
		expect(inserted.body).toContain('\n');
	});

	it('maps a 23514 CHECK violation (length/self-DM backstop) to a friendly sentinel', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { client } = makeInsertClient({
			error: pgError('23514', 'new row violates check constraint "dms_body_length"')
		});

		const result = await sendDm(client, VIEWER, ALICE, 'reaches the db');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toMatch(/too long/i);
			expect(result.error).not.toMatch(/check constraint/i);
		}
	});

	it('maps an unrelated Supabase error to a friendly sentinel (raw text not leaked) and logs server-side', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { client } = makeInsertClient({
			error: pgError('42501', 'permission denied for table dms')
		});

		const result = await sendDm(client, VIEWER, ALICE, 'a message');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).not.toMatch(/permission denied/i);
			expect(result.error).toMatch(/could not send/i);
		}
		expect(errorSpy).toHaveBeenCalled();
	});
});

describe('listConversations', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('selects both parties embedded, ordered created_at desc, and returns the summarized inbox', async () => {
		const { client, from, select, order } = makeListConversationsClient({ data: [], error: null });

		const result = await listConversations(client, VIEWER);

		expect(from).toHaveBeenCalledWith('dms');
		const selectArg = (select.mock.calls[0] as unknown[])[0] as string;
		expect(selectArg).toContain('sender:profiles!sender_id');
		expect(selectArg).toContain('recipient:profiles!recipient_id');
		expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
		expect(result).toEqual({ ok: true, data: [] });
	});

	it('picks the RECIPIENT embed as the counterparty when the viewer is the SENDER', async () => {
		const rows = [
			{
				sender_id: VIEWER,
				recipient_id: ALICE,
				body: 'hi alice',
				created_at: '2026-06-16T10:00:00Z',
				read_at: null,
				sender: { id: VIEWER, handle: 'me', display_name: 'Me' },
				recipient: { id: ALICE, handle: 'alice', display_name: 'Alice' }
			}
		];
		const { client } = makeListConversationsClient({ data: rows, error: null });

		const result = await listConversations(client, VIEWER);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data).toHaveLength(1);
			expect(result.data[0].counterpartyId).toBe(ALICE);
			expect(result.data[0].counterpartyHandle).toBe('alice');
			expect(result.data[0].counterpartyDisplayName).toBe('Alice');
		}
	});

	it('picks the SENDER embed as the counterparty when the viewer is the RECIPIENT', async () => {
		const rows = [
			{
				sender_id: ALICE,
				recipient_id: VIEWER,
				body: 'hi viewer',
				created_at: '2026-06-16T10:00:00Z',
				read_at: null,
				sender: { id: ALICE, handle: 'alice', display_name: 'Alice' },
				recipient: { id: VIEWER, handle: 'me', display_name: 'Me' }
			}
		];
		const { client } = makeListConversationsClient({ data: rows, error: null });

		const result = await listConversations(client, VIEWER);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data[0].counterpartyId).toBe(ALICE);
			expect(result.data[0].counterpartyHandle).toBe('alice');
			// The viewer-received unread row counts toward unreadCount.
			expect(result.data[0].unreadCount).toBe(1);
		}
	});

	it('normalizes a SINGLE-ELEMENT-ARRAY embed identically to an object embed', async () => {
		// PostgREST's inferred types surface an FK embed as an array; the wrapper must
		// flatten a single-element array to one profile.
		const rows = [
			{
				sender_id: VIEWER,
				recipient_id: ALICE,
				body: 'array embed',
				created_at: '2026-06-16T10:00:00Z',
				read_at: null,
				sender: [{ id: VIEWER, handle: 'me', display_name: 'Me' }],
				recipient: [{ id: ALICE, handle: 'alice', display_name: 'Alice' }]
			}
		];
		const { client } = makeListConversationsClient({ data: rows, error: null });

		const result = await listConversations(client, VIEWER);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data[0].counterpartyHandle).toBe('alice');
			expect(result.data[0].counterpartyDisplayName).toBe('Alice');
		}
	});

	it('coerces a null data payload to an empty inbox', async () => {
		const { client } = makeListConversationsClient({ data: null, error: null });

		const result = await listConversations(client, VIEWER);

		expect(result).toEqual({ ok: true, data: [] });
	});

	it('maps a Supabase error to a friendly sentinel (raw text not leaked) and logs server-side', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { client } = makeListConversationsClient({
			data: null,
			error: pgError('42P01', 'relation "dms" does not exist')
		});

		const result = await listConversations(client, VIEWER);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).not.toMatch(/relation/i);
			expect(result.error).toMatch(/could not load/i);
		}
		expect(errorSpy).toHaveBeenCalled();
	});
});

describe('listThread', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('builds the both-directions .or() pair filter and orders oldest-first', async () => {
		const { client, from, select, or, order } = makeListThreadClient({ data: [], error: null });

		await listThread(client, VIEWER, ALICE);

		expect(from).toHaveBeenCalledWith('dms');
		expect(select).toHaveBeenCalledWith('id, sender_id, recipient_id, body, created_at, read_at');
		const orArg = (or.mock.calls[0] as unknown[])[0] as string;
		// Both directions of the conversation must be present in the filter.
		expect(orArg).toContain(`and(sender_id.eq.${VIEWER},recipient_id.eq.${ALICE})`);
		expect(orArg).toContain(`and(sender_id.eq.${ALICE},recipient_id.eq.${VIEWER})`);
		expect(order).toHaveBeenCalledWith('created_at', { ascending: true });
	});

	it('returns the thread rows on success', async () => {
		const messages: ThreadMessage[] = [
			{
				id: 'm-1',
				sender_id: ALICE,
				recipient_id: VIEWER,
				body: 'first',
				created_at: '2026-06-16T09:00:00Z',
				read_at: null
			}
		];
		const { client } = makeListThreadClient({ data: messages, error: null });

		const result = await listThread(client, VIEWER, ALICE);

		expect(result).toEqual({ ok: true, data: messages });
	});

	it('coerces a null data payload to an empty thread', async () => {
		const { client } = makeListThreadClient({ data: null, error: null });

		const result = await listThread(client, VIEWER, ALICE);

		expect(result).toEqual({ ok: true, data: [] });
	});

	it('maps a Supabase error to a friendly sentinel (raw text not leaked) and logs server-side', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { client } = makeListThreadClient({
			data: null,
			error: pgError('42P01', 'relation "dms" does not exist')
		});

		const result = await listThread(client, VIEWER, ALICE);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).not.toMatch(/relation/i);
			expect(result.error).toMatch(/could not load/i);
		}
		expect(errorSpy).toHaveBeenCalled();
	});
});

describe('markThreadRead', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('updates read_at scoped to recipient=viewer, sender=counterparty, read_at IS NULL', async () => {
		const { client, from, update, eqRecipient, eqSender, is } = makeMarkReadClient({ error: null });

		const result = await markThreadRead(client, VIEWER, ALICE);

		expect(from).toHaveBeenCalledWith('dms');
		// The UPDATE writes ONLY read_at (the column grant confines it to read_at).
		const updateArg = (update.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
		expect(Object.keys(updateArg)).toEqual(['read_at']);
		expect(typeof updateArg.read_at).toBe('string');
		// Recipient = the viewer (only the recipient may mark read).
		expect(eqRecipient).toHaveBeenCalledWith('recipient_id', VIEWER);
		// Sender = the counterparty (scopes to this thread's received messages).
		expect(eqSender).toHaveBeenCalledWith('sender_id', ALICE);
		// Idempotent: only still-unread rows are touched.
		expect(is).toHaveBeenCalledWith('read_at', null);
		expect(result).toEqual({ ok: true, data: null });
	});

	it('is idempotent: a zero-row update (nothing unread) still succeeds', async () => {
		const { client } = makeMarkReadClient({ error: null });

		const result = await markThreadRead(client, VIEWER, ALICE);

		expect(result).toEqual({ ok: true, data: null });
	});

	it('maps a Supabase error to a friendly sentinel (raw text not leaked) and logs server-side', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { client } = makeMarkReadClient({
			error: pgError('42501', 'permission denied for table dms')
		});

		const result = await markThreadRead(client, VIEWER, ALICE);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).not.toMatch(/permission denied/i);
			expect(result.error).toMatch(/could not update/i);
		}
		expect(errorSpy).toHaveBeenCalled();
	});
});
