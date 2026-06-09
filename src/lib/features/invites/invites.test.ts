import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createInvite, redeemInvite } from './invites';
import { isValidTokenFormat } from './token';

// Unit tests for the server-side invite wrappers with a fully mocked
// `SupabaseClient` — they never touch a live Supabase stack (the project has no
// DB/RLS integration harness; that boundary is covered structurally here and the
// RLS/single-use guarantee is noted as a live-DB coverage gap). The client is
// dependency-injected (first arg), mirroring the storage module's pattern, so a
// structural fake suffices. Each test asserts that: (1) the trusted inviter id /
// token / redeemer id are forwarded faithfully, (2) the SDK's `{ data, error }`
// shape is normalized into the discriminated `InviteResult`, and (3) Supabase
// errors are surfaced, never swallowed.

const SDK_ERROR = { name: 'PostgrestError', message: 'boom', code: '500' };

/**
 * Builds a fake `SupabaseClient` for `createInvite`. The insert -> select ->
 * single() chain is modelled as thenable-free chained spies; `single` resolves
 * the supplied `{ data, error }`. Exposes the per-link spies so tests can assert
 * the inviter id reached `.insert()`.
 */
function makeInsertClient(result: { data: unknown; error: unknown }) {
	const single = vi.fn().mockResolvedValue(result);
	const select = vi.fn(() => ({ single }));
	const insert = vi.fn(() => ({ select }));
	const from = vi.fn(() => ({ insert }));
	const client = { from } as unknown as SupabaseClient;
	return { client, from, insert, select, single };
}

/** Builds a fake `SupabaseClient` whose `.rpc()` resolves the supplied result. */
function makeRpcClient(result: { data: unknown; error: unknown }) {
	const rpc = vi.fn().mockResolvedValue(result);
	const client = { rpc } as unknown as SupabaseClient;
	return { client, rpc };
}

describe('createInvite', () => {
	it('inserts into the invites table attributed to the trusted inviter id', async () => {
		const { client, from, insert } = makeInsertClient({
			data: { id: 'inv-1', token: 'tok-abc' },
			error: null
		});

		await createInvite(client, 'inviter-uuid');

		expect(from).toHaveBeenCalledWith('invites');
		expect(insert).toHaveBeenCalledWith(expect.objectContaining({ inviter_id: 'inviter-uuid' }));
	});

	it('mints a well-formed token and writes it on the inserted row', async () => {
		const { client, insert } = makeInsertClient({
			data: { id: 'inv-1', token: 'placeholder' },
			error: null
		});

		await createInvite(client, 'inviter-uuid');

		const insertArgs = (insert.mock.calls as unknown[][])[0];
		const written = insertArgs[0] as { token: string };
		expect(isValidTokenFormat(written.token)).toBe(true);
	});

	it('returns { ok: true, data: { id, token } } from the inserted row', async () => {
		const { client } = makeInsertClient({
			data: { id: 'inv-1', token: 'tok-abc' },
			error: null
		});

		const result = await createInvite(client, 'inviter-uuid');

		expect(result).toEqual({ ok: true, data: { id: 'inv-1', token: 'tok-abc' } });
	});

	it('selects only the id and token columns from the inserted row', async () => {
		const { client, select } = makeInsertClient({
			data: { id: 'inv-1', token: 'tok-abc' },
			error: null
		});

		await createInvite(client, 'inviter-uuid');

		expect(select).toHaveBeenCalledWith('id, token');
	});

	it('surfaces an RLS/insert error as { ok: false } with the SDK message', async () => {
		const { client } = makeInsertClient({ data: null, error: SDK_ERROR });

		const result = await createInvite(client, 'inviter-uuid');

		expect(result).toEqual({ ok: false, error: 'boom' });
	});

	it('returns { ok: false } when the insert yields no row and no error', async () => {
		const { client } = makeInsertClient({ data: null, error: null });

		const result = await createInvite(client, 'inviter-uuid');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toMatch(/failed to create invite/i);
		}
	});
});

describe('redeemInvite', () => {
	it('calls the redeem_invite RPC with the token and redeemer id', async () => {
		const { client, rpc } = makeRpcClient({ data: 'inv-1', error: null });

		await redeemInvite(client, 'tok-abc', 'redeemer-uuid');

		expect(rpc).toHaveBeenCalledWith('redeem_invite', {
			invite_token: 'tok-abc',
			redeemer_id: 'redeemer-uuid'
		});
	});

	it('returns { ok: true, data: <invite id> } when the RPC yields a uuid', async () => {
		const { client } = makeRpcClient({ data: 'inv-1', error: null });

		const result = await redeemInvite(client, 'tok-abc', 'redeemer-uuid');

		expect(result).toEqual({ ok: true, data: 'inv-1' });
	});

	it('returns { ok: false } when the RPC returns NULL (invalid or already-used token)', async () => {
		// NULL is the atomic single-use signal: the conditional UPDATE matched zero
		// rows because the token does not exist or was already consumed.
		const { client } = makeRpcClient({ data: null, error: null });

		const result = await redeemInvite(client, 'tok-abc', 'redeemer-uuid');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toMatch(/invalid or has already been used/i);
		}
	});

	it('surfaces an RPC error as { ok: false } with the SDK message (does not swallow)', async () => {
		const { client } = makeRpcClient({ data: null, error: SDK_ERROR });

		const result = await redeemInvite(client, 'tok-abc', 'redeemer-uuid');

		expect(result).toEqual({ ok: false, error: 'boom' });
	});

	it('treats an empty-string RPC result as a rejection, not a success', async () => {
		// Defensive: a falsy non-null value must still be rejected, never returned
		// as a usable invite id.
		const { client } = makeRpcClient({ data: '', error: null });

		const result = await redeemInvite(client, 'tok-abc', 'redeemer-uuid');

		expect(result.ok).toBe(false);
	});
});
