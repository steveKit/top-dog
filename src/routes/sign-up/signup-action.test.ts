import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isActionFailure, isRedirect } from '@sveltejs/kit';
import { actions, load } from './+page.server';
import { generateInviteToken } from '$lib/features/invites/token';

// Mock the server-only service client so the orphan-cleanup path can be exercised
// without a real secret-key Supabase client. The default deleteUser succeeds;
// individual tests can re-stub it via the exposed spy.
const deleteUser = vi.fn().mockResolvedValue({ data: null, error: null });
vi.mock('$lib/server/supabase', () => ({
	getServiceClient: () => ({ auth: { admin: { deleteUser } } })
}));

// Test-after coverage for the public sign-up + invite redemption flow (the
// integration AC: redemption is wired into sign-up). The action is exercised
// with a fake `event` exposing `locals.supabase` (auth.signUp + rpc) and a
// `request.formData()`. The redemption order under test is:
//   validate token shape -> validate email -> validate password ->
//   invite_is_redeemable pre-check (best-effort) -> supabase.auth.signUp() ->
//   redeem_invite RPC keyed to the new user id.
// Invariants:
//   - a valid token path pre-checks, calls signUp THEN the redeem RPC, then
//     redirects to /app when signUp returned a session
//   - an invalid/empty/used token returns fail() with a friendly message; a token
//     already used at submit time is rejected by the pre-check BEFORE any account
//     is created
//   - a token lost to a concurrent redemption AFTER signUp triggers orphan
//     cleanup (deleteUser) so the email is reusable
//   - no session from signUp (email confirmation) returns a success "confirm
//     email" state instead of redirecting into /app
//   - input validation (missing token, bad email, short password) fails BEFORE
//     any signUp call

const signUp = actions.default;

const A_TOKEN = generateInviteToken();
const NEW_USER = { id: 'new-user-uuid', email: 'newchef@topdog.test' };
const A_SESSION = { access_token: 'tok', refresh_token: 'ref' };

/**
 * Builds a fake sign-up event. `request.formData()` resolves a FormData built
 * from the supplied fields; `supabase.auth.signUp` resolves `signUpResult` and
 * `supabase.rpc` routes by function name: `invite_is_redeemable` resolves
 * `redeemableResult` (default: redeemable), `redeem_invite` resolves
 * `rpcResult` (default: success). Spies are exposed so tests can assert call
 * order / payloads.
 */
function makeEvent(opts: {
	fields: Record<string, string>;
	signUpResult?: { data: { user: unknown; session?: unknown } | { user: null }; error: unknown };
	rpcResult?: { data: unknown; error: unknown };
	redeemableResult?: { data: unknown; error: unknown };
}) {
	const formData = new FormData();
	for (const [k, v] of Object.entries(opts.fields)) {
		formData.set(k, v);
	}

	const signUpFn = vi
		.fn()
		.mockResolvedValue(
			opts.signUpResult ?? { data: { user: NEW_USER, session: A_SESSION }, error: null }
		);

	const redeemableResult = opts.redeemableResult ?? { data: true, error: null };
	const rpcResult = opts.rpcResult ?? { data: 'inv-1', error: null };
	const rpc = vi.fn((fn: string) =>
		Promise.resolve(fn === 'invite_is_redeemable' ? redeemableResult : rpcResult)
	);

	const event = {
		request: { formData: vi.fn().mockResolvedValue(formData) },
		locals: { supabase: { auth: { signUp: signUpFn }, rpc } }
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;

	return { event, signUpFn, rpc };
}

const GOOD_FIELDS = { token: A_TOKEN, email: 'newchef@topdog.test', password: 'hunter2hunter2' };

describe('sign-up load', () => {
	it('surfaces a token from the ?token= query param so the field pre-fills', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await load({ url: new URL('https://x/sign-up?token=abc123') } as any);
		expect(result).toEqual({ token: 'abc123' });
	});

	it('defaults to an empty token when none is supplied', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await load({ url: new URL('https://x/sign-up') } as any);
		expect(result).toEqual({ token: '' });
	});
});

describe('sign-up default action — happy path', () => {
	beforeEach(() => vi.clearAllMocks());

	it('pre-checks, signs the user up, then redeems the invite for the new user id, then redirects to /app', async () => {
		const { event, signUpFn, rpc } = makeEvent({ fields: GOOD_FIELDS });

		let thrown: unknown;
		try {
			await signUp(event);
		} catch (e) {
			thrown = e;
		}

		// signUp received the credentials.
		expect(signUpFn).toHaveBeenCalledWith({
			email: 'newchef@topdog.test',
			password: 'hunter2hunter2'
		});
		// best-effort pre-check ran with the token.
		expect(rpc).toHaveBeenCalledWith('invite_is_redeemable', { invite_token: A_TOKEN });
		// redemption is keyed to the freshly created user id (not client-supplied).
		expect(rpc).toHaveBeenCalledWith('redeem_invite', {
			invite_token: A_TOKEN,
			redeemer_id: 'new-user-uuid'
		});
		// pre-check happens before signUp, which happens before redemption.
		const preCheckOrder = rpc.mock.invocationCallOrder[0];
		const redeemOrder = rpc.mock.invocationCallOrder[1];
		const signUpOrder = signUpFn.mock.invocationCallOrder[0];
		expect(preCheckOrder).toBeLessThan(signUpOrder);
		expect(signUpOrder).toBeLessThan(redeemOrder);
		// success ends in a redirect into the app (signUp returned a session).
		expect(isRedirect(thrown)).toBe(true);
		expect((thrown as { status: number }).status).toBe(303);
		expect((thrown as { location: string }).location).toBe('/app');
	});
});

describe('sign-up default action — invalid / used token rejection', () => {
	beforeEach(() => vi.clearAllMocks());

	it('rejects a malformed token before any signUp call', async () => {
		const { event, signUpFn, rpc } = makeEvent({
			fields: { ...GOOD_FIELDS, token: 'too short' }
		});

		const result = await signUp(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect((result as { data: { error: string } }).data.error).toMatch(/valid invite link/i);
		// No account is created when the token is malformed.
		expect(signUpFn).not.toHaveBeenCalled();
		expect(rpc).not.toHaveBeenCalled();
	});

	it('rejects an empty token before any signUp call', async () => {
		const { event, signUpFn } = makeEvent({ fields: { ...GOOD_FIELDS, token: '' } });

		const result = await signUp(event);

		expect(isActionFailure(result)).toBe(true);
		expect(signUpFn).not.toHaveBeenCalled();
	});

	it('rejects an already-used token at the pre-check, before any signUp call', async () => {
		// The pre-check RPC reports the token is no longer redeemable.
		const { event, signUpFn, rpc } = makeEvent({
			fields: GOOD_FIELDS,
			redeemableResult: { data: false, error: null }
		});

		const result = await signUp(event);

		// Pre-check ran; signUp and redeem did NOT — no orphan account is created.
		expect(rpc).toHaveBeenCalledWith('invite_is_redeemable', { invite_token: A_TOKEN });
		expect(rpc).not.toHaveBeenCalledWith('redeem_invite', expect.anything());
		expect(signUpFn).not.toHaveBeenCalled();
		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect((result as { data: { error: string } }).data.error).toMatch(
			/invalid or has already been used/i
		);
	});

	it('cleans up the orphan account when redemption loses the race after signUp', async () => {
		// Pre-check passes, signUp succeeds, but the atomic redeem RPC returns NULL
		// (someone consumed the token in the narrow window). The just-created auth
		// user must be deleted so the email is reusable.
		const { event, signUpFn, rpc } = makeEvent({
			fields: GOOD_FIELDS,
			rpcResult: { data: null, error: null }
		});

		let thrown: unknown;
		let result: unknown;
		try {
			result = await signUp(event);
		} catch (e) {
			thrown = e;
		}

		// signUp ran, redemption was attempted and rejected, orphan was deleted.
		expect(signUpFn).toHaveBeenCalledOnce();
		expect(rpc).toHaveBeenCalledWith('redeem_invite', {
			invite_token: A_TOKEN,
			redeemer_id: 'new-user-uuid'
		});
		expect(deleteUser).toHaveBeenCalledWith('new-user-uuid');
		// The user is NOT sent into the app — no redirect, an action failure instead.
		expect(thrown).toBeUndefined();
		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect((result as { data: { error: string } }).data.error).toMatch(/valid invite/i);
	});

	it('still fails cleanly (no crash) when orphan cleanup itself errors on the lost-race path', async () => {
		// The lost-race path tries to delete the just-created auth user. If that
		// delete ALSO fails (e.g. the admin call errors), the action must log and
		// still return a friendly fail() — it must not throw or redirect the user
		// into /app on a half-broken state.
		deleteUser.mockResolvedValueOnce({ data: null, error: { message: 'admin delete failed' } });

		const { event, signUpFn, rpc } = makeEvent({
			fields: GOOD_FIELDS,
			rpcResult: { data: null, error: null }
		});

		let thrown: unknown;
		let result: unknown;
		try {
			result = await signUp(event);
		} catch (e) {
			thrown = e;
		}

		// The orphan delete was attempted with the new user id and reported an error.
		expect(signUpFn).toHaveBeenCalledOnce();
		expect(rpc).toHaveBeenCalledWith('redeem_invite', {
			invite_token: A_TOKEN,
			redeemer_id: 'new-user-uuid'
		});
		expect(deleteUser).toHaveBeenCalledWith('new-user-uuid');
		// Despite the cleanup error, the action neither threw nor redirected.
		expect(thrown).toBeUndefined();
		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
	});

	it('preserves the token and email on the failure payload so the form repopulates', async () => {
		const { event } = makeEvent({
			fields: GOOD_FIELDS,
			redeemableResult: { data: false, error: null }
		});

		const result = await signUp(event);
		const data = (result as { data: { token: string; email: string } }).data;

		expect(data.token).toBe(A_TOKEN);
		expect(data.email).toBe('newchef@topdog.test');
	});
});

describe('sign-up default action — input validation', () => {
	beforeEach(() => vi.clearAllMocks());

	it('rejects a missing/empty email before signUp', async () => {
		const { event, signUpFn } = makeEvent({ fields: { ...GOOD_FIELDS, email: '' } });

		const result = await signUp(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect((result as { data: { error: string } }).data.error).toMatch(/valid email/i);
		expect(signUpFn).not.toHaveBeenCalled();
	});

	it('rejects a malformed email before signUp', async () => {
		const { event, signUpFn } = makeEvent({ fields: { ...GOOD_FIELDS, email: 'not-an-email' } });

		const result = await signUp(event);

		expect(isActionFailure(result)).toBe(true);
		expect(signUpFn).not.toHaveBeenCalled();
	});

	it('rejects a short password (< 8 chars) before signUp', async () => {
		const { event, signUpFn } = makeEvent({ fields: { ...GOOD_FIELDS, password: 'short' } });

		const result = await signUp(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect((result as { data: { error: string } }).data.error).toMatch(/at least 8 characters/i);
		expect(signUpFn).not.toHaveBeenCalled();
	});

	it('accepts a password exactly at the 8-char minimum boundary', async () => {
		const { event, signUpFn } = makeEvent({
			fields: { ...GOOD_FIELDS, password: '12345678' }
		});

		try {
			await signUp(event);
		} catch {
			// The happy path redirects (throws) after signUp — that's expected here.
		}

		expect(signUpFn).toHaveBeenCalledOnce();
	});
});

describe('sign-up default action — signUp failure', () => {
	beforeEach(() => vi.clearAllMocks());

	it('returns a 400 fail and never redeems when signUp errors', async () => {
		const { event, rpc } = makeEvent({
			fields: GOOD_FIELDS,
			signUpResult: { data: { user: null }, error: { message: 'User already registered' } }
		});

		const result = await signUp(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		// A failed signUp must not consume the invite token (the best-effort
		// pre-check may run, but the authoritative redeem RPC must not).
		expect(rpc).not.toHaveBeenCalledWith('redeem_invite', expect.anything());
	});

	it('treats a null user (no error) as a signUp failure and does not redeem', async () => {
		const { event, rpc } = makeEvent({
			fields: GOOD_FIELDS,
			signUpResult: { data: { user: null }, error: null }
		});

		const result = await signUp(event);

		expect(isActionFailure(result)).toBe(true);
		expect(rpc).not.toHaveBeenCalledWith('redeem_invite', expect.anything());
	});
});

describe('sign-up default action — email confirmation (no session)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('returns a confirm-email success state instead of redirecting when signUp has no session', async () => {
		// Email confirmation enabled: signUp succeeds but returns no session. The
		// invite was validly consumed, so this is a success, not a fail() — and we
		// must NOT redirect into /app (the guard would bounce an unauthenticated user).
		const { event, rpc } = makeEvent({
			fields: GOOD_FIELDS,
			signUpResult: { data: { user: NEW_USER, session: null }, error: null }
		});

		let thrown: unknown;
		let result: unknown;
		try {
			result = await signUp(event);
		} catch (e) {
			thrown = e;
		}

		expect(thrown).toBeUndefined();
		expect(isActionFailure(result)).toBe(false);
		expect(result).toEqual({ success: true, confirmEmail: true, email: 'newchef@topdog.test' });
		// The invite WAS validly consumed in this branch — redemption ran and the
		// orphan-cleanup path must NOT fire (the account is legitimate, just
		// awaiting email confirmation).
		expect(rpc).toHaveBeenCalledWith('redeem_invite', {
			invite_token: A_TOKEN,
			redeemer_id: 'new-user-uuid'
		});
		expect(deleteUser).not.toHaveBeenCalled();
	});
});
