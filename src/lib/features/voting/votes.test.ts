import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { castVote, removeVote, VOTE_UNAUTHENTICATED, VOTE_SELF, VOTE_NO_SUCH_DOG } from './votes';

// Unit tests for the server-side vote wrappers with a fully mocked
// `SupabaseClient` — they never touch a live Supabase stack (that boundary is
// covered by tests/votes.e2e.ts). The client is dependency-injected (first arg),
// mirroring the invites/storage modules, so a structural fake suffices. Each test
// asserts that: (1) the RPC name + the trusted target id are forwarded faithfully
// and NO client-supplied voter id is ever passed (the RPC derives the voter from
// auth.uid()), (2) the SDK's `{ data, error }` shape is normalized into the
// discriminated `VoteResult`, and (3) known SQLSTATEs are mapped to typed
// sentinels keyed on `error.code` — never on message text.

/** Builds a fake `SupabaseClient` whose `.rpc()` resolves the supplied result. */
function makeRpcClient(result: { data: unknown; error: unknown }) {
	const rpc = vi.fn().mockResolvedValue(result);
	const client = { rpc } as unknown as SupabaseClient;
	return { client, rpc };
}

/**
 * A Postgres error carrying a specific SQLSTATE in `code` but a DELIBERATELY
 * misleading `message`. The mapping must key on `code`, so the message text is
 * irrelevant — these fixtures prove that.
 */
function sdkError(code: string) {
	return { name: 'PostgrestError', code, message: 'some unrelated postgrest prose', details: '' };
}

describe('castVote', () => {
	it('calls the cast_vote RPC with the target dog id', async () => {
		const { client, rpc } = makeRpcClient({ data: 'vote-1', error: null });

		await castVote(client, 'dog-uuid');

		expect(rpc).toHaveBeenCalledWith('cast_vote', { target_dog: 'dog-uuid' });
	});

	it('does NOT pass a client-supplied voter id to the RPC', async () => {
		const { client, rpc } = makeRpcClient({ data: 'vote-1', error: null });

		await castVote(client, 'dog-uuid');

		const [, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
		// The voter is derived from auth.uid() inside the SECURITY DEFINER RPC.
		// The wrapper must send ONLY target_dog — never a voter/voter_id key.
		expect(Object.keys(args)).toEqual(['target_dog']);
		expect(args).not.toHaveProperty('voter');
		expect(args).not.toHaveProperty('voter_id');
	});

	it('returns { ok: true, data: <vote id> } when the RPC yields a uuid', async () => {
		const { client } = makeRpcClient({ data: 'vote-1', error: null });

		const result = await castVote(client, 'dog-uuid');

		expect(result).toEqual({ ok: true, data: 'vote-1' });
	});

	it('maps SQLSTATE 28000 to VOTE_UNAUTHENTICATED (keyed on code, not message)', async () => {
		const { client } = makeRpcClient({ data: null, error: sdkError('28000') });

		const result = await castVote(client, 'dog-uuid');

		expect(result).toEqual({ ok: false, error: VOTE_UNAUTHENTICATED });
	});

	it('maps SQLSTATE 23514 to VOTE_SELF (keyed on code, not message)', async () => {
		const { client } = makeRpcClient({ data: null, error: sdkError('23514') });

		const result = await castVote(client, 'dog-uuid');

		expect(result).toEqual({ ok: false, error: VOTE_SELF });
	});

	it('maps SQLSTATE P0002 to VOTE_NO_SUCH_DOG (keyed on code, not message)', async () => {
		const { client } = makeRpcClient({ data: null, error: sdkError('P0002') });

		const result = await castVote(client, 'dog-uuid');

		expect(result).toEqual({ ok: false, error: VOTE_NO_SUCH_DOG });
	});

	it('surfaces an unrecognised SQLSTATE as the raw SDK message (does not swallow)', async () => {
		const { client } = makeRpcClient({
			data: null,
			error: { name: 'PostgrestError', code: '42P01', message: 'relation missing' }
		});

		const result = await castVote(client, 'dog-uuid');

		expect(result).toEqual({ ok: false, error: 'relation missing' });
	});

	it('returns { ok: false } when the RPC yields neither a vote id nor an error', async () => {
		const { client } = makeRpcClient({ data: null, error: null });

		const result = await castVote(client, 'dog-uuid');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toMatch(/failed to cast/i);
		}
	});
});

describe('removeVote', () => {
	it('calls the remove_vote RPC with no arguments', async () => {
		const { client, rpc } = makeRpcClient({ data: 'dog-uuid', error: null });

		await removeVote(client);

		expect(rpc).toHaveBeenCalledWith('remove_vote');
	});

	it('does NOT pass a client-supplied voter id to the RPC', async () => {
		const { client, rpc } = makeRpcClient({ data: 'dog-uuid', error: null });

		await removeVote(client);

		// Only the RPC name — no payload object carrying a forged voter id.
		expect(rpc.mock.calls[0]).toEqual(['remove_vote']);
	});

	it('returns { ok: true, data: <hot_dog_id> } when a vote was removed', async () => {
		const { client } = makeRpcClient({ data: 'dog-uuid', error: null });

		const result = await removeVote(client);

		expect(result).toEqual({ ok: true, data: 'dog-uuid' });
	});

	it('returns { ok: true, data: null } when there was no active vote', async () => {
		// The RPC returns NULL when there was nothing to remove (idempotent).
		const { client } = makeRpcClient({ data: null, error: null });

		const result = await removeVote(client);

		expect(result).toEqual({ ok: true, data: null });
	});

	it('maps SQLSTATE 28000 to VOTE_UNAUTHENTICATED (keyed on code, not message)', async () => {
		const { client } = makeRpcClient({ data: null, error: sdkError('28000') });

		const result = await removeVote(client);

		expect(result).toEqual({ ok: false, error: VOTE_UNAUTHENTICATED });
	});

	it('surfaces an unrecognised SQLSTATE as the raw SDK message (does not swallow)', async () => {
		const { client } = makeRpcClient({
			data: null,
			error: { name: 'PostgrestError', code: '42501', message: 'permission denied' }
		});

		const result = await removeVote(client);

		expect(result).toEqual({ ok: false, error: 'permission denied' });
	});
});
