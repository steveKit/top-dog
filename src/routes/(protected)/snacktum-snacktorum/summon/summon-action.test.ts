import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isActionFailure } from '@sveltejs/kit';
import { actions } from './+page.server';
import { isValidTokenFormat } from '$lib/features/invites/token';

// Test-after coverage for the Summon page's authed invite-minting `create` form
// action (project strategy: test-after for form actions / wiring). The page was
// renamed invite -> summon; the +page.server.ts action is byte-identical, so the
// contract under test ({ token } on success, fail(401)/fail(500)) is unchanged.
// The action is exercised with
// a fake `event` exposing `locals.supabase` + `locals.safeGetSession`. Key
// invariants:
//   - session is read via safeGetSession() (the validated path), never a raw
//     getSession()
//   - the inviter_id written is the trusted auth.uid() from the validated user,
//     not anything client-supplied
//   - an absent/invalid session fails closed (401)
//   - a Supabase failure surfaces a friendly 500 without leaking internals

const create = actions.create;

const VALID_USER = { id: 'inviter-uuid', email: 'chef@topdog.test' };
const VALID_SESSION = { access_token: 'valid', user: VALID_USER };

/**
 * Builds a fake invite-action event. `safeGetSession` returns the supplied
 * session/user; `supabase` is a structural fake whose insert chain resolves the
 * supplied `{ data, error }`. The `insert` spy is exposed so tests can assert the
 * inviter id reached the write.
 */
function makeEvent(opts: {
	session: unknown;
	user: unknown;
	insertResult?: { data: unknown; error: unknown };
}) {
	const single = vi
		.fn()
		.mockResolvedValue(opts.insertResult ?? { data: { id: 'inv-1', token: 'tok' }, error: null });
	const select = vi.fn(() => ({ single }));
	const insert = vi.fn(() => ({ select }));
	const from = vi.fn(() => ({ insert }));
	const safeGetSession = vi.fn(async () => ({ session: opts.session, user: opts.user }));
	const rawGetSession = vi.fn(async () => ({ data: { session: null }, error: null }));

	const event = {
		locals: {
			supabase: { from, auth: { getSession: rawGetSession } },
			safeGetSession
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;

	return { event, safeGetSession, rawGetSession, from, insert };
}

describe('(protected)/snacktum-snacktorum/summon create action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('reads the session via safeGetSession(), never raw getSession()', async () => {
		const { event, safeGetSession, rawGetSession } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER
		});

		await create(event);

		expect(safeGetSession).toHaveBeenCalledOnce();
		expect(rawGetSession).not.toHaveBeenCalled();
	});

	it('mints an invite attributed to the validated auth.uid() and returns its token', async () => {
		const { event, insert } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			insertResult: { data: { id: 'inv-1', token: 'minted-token' }, error: null }
		});

		const result = await create(event);

		expect(insert).toHaveBeenCalledWith(expect.objectContaining({ inviter_id: 'inviter-uuid' }));
		expect(result).toEqual({ token: 'minted-token' });
	});

	it('mints a well-formed token via the pure generator', async () => {
		const { event, insert } = makeEvent({ session: VALID_SESSION, user: VALID_USER });

		await create(event);

		const insertArgs = (insert.mock.calls as unknown[][])[0];
		const written = insertArgs[0] as { token: string };
		expect(isValidTokenFormat(written.token)).toBe(true);
	});

	it('fails closed with 401 when there is no validated session', async () => {
		const { event, from } = makeEvent({ session: null, user: null });

		const result = await create(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(401);
		// No write may be attempted without a session.
		expect(from).not.toHaveBeenCalled();
	});

	it('fails closed when a user is present but the session is null', async () => {
		// A null session is the authoritative signal; never mint on user alone.
		const { event } = makeEvent({ session: null, user: VALID_USER });

		const result = await create(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(401);
	});

	it('returns a friendly 500 (no internals leaked) when the insert errors', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			insertResult: {
				data: null,
				error: { message: 'duplicate key value violates unique constraint' }
			}
		});

		const result = await create(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { error: string } };
		expect(failure.status).toBe(500);
		expect(failure.data.error).not.toMatch(/duplicate key|constraint/i);
		expect(failure.data.error).toMatch(/try again/i);
	});
});
