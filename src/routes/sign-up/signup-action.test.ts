import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isActionFailure, isRedirect } from '@sveltejs/kit';
import { actions, load } from './+page.server';
import { generateInviteToken } from '$lib/features/invites/token';

// Test-after coverage for the public sign-up + invite redemption flow (the
// integration AC: redemption is wired into sign-up). The action is exercised
// with a fake `event` exposing `locals.supabase` (auth.signUp + rpc) and a
// `request.formData()`. The redemption order under test is:
//   validate token shape -> validate email -> validate password ->
//   supabase.auth.signUp() -> redeem_invite RPC keyed to the new user id.
// Invariants:
//   - a valid token path calls signUp THEN the redeem RPC, then redirects to /app
//   - an invalid/empty/used token returns fail() with a friendly message and does
//     NOT create a usable account (used token: signUp may run, but redemption
//     rejects and the user is not sent into the app)
//   - input validation (missing token, bad email, short password) fails BEFORE
//     any signUp call

const signUp = actions.default;

const A_TOKEN = generateInviteToken();
const NEW_USER = { id: 'new-user-uuid', email: 'newchef@topdog.test' };

/**
 * Builds a fake sign-up event. `request.formData()` resolves a FormData built
 * from the supplied fields; `supabase.auth.signUp` and `supabase.rpc` resolve the
 * supplied results. Spies are exposed so tests can assert call order / payloads.
 */
function makeEvent(opts: {
	fields: Record<string, string>;
	signUpResult?: { data: { user: unknown } | { user: null }; error: unknown };
	rpcResult?: { data: unknown; error: unknown };
}) {
	const formData = new FormData();
	for (const [k, v] of Object.entries(opts.fields)) {
		formData.set(k, v);
	}

	const signUpFn = vi
		.fn()
		.mockResolvedValue(opts.signUpResult ?? { data: { user: NEW_USER }, error: null });
	const rpc = vi.fn().mockResolvedValue(opts.rpcResult ?? { data: 'inv-1', error: null });

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

	it('signs the user up, then redeems the invite for the new user id, then redirects to /app', async () => {
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
		// redemption is keyed to the freshly created user id (not client-supplied).
		expect(rpc).toHaveBeenCalledWith('redeem_invite', {
			invite_token: A_TOKEN,
			redeemer_id: 'new-user-uuid'
		});
		// signUp happens before redemption.
		expect(signUpFn.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[0]);
		// success ends in a redirect into the app.
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

	it('rejects a used/invalid token: signUp runs but redemption fails, no redirect into the app', async () => {
		// The RPC returns NULL — the atomic single-use guard matched zero rows.
		const { event, rpc } = makeEvent({
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

		// Redemption was attempted and rejected.
		expect(rpc).toHaveBeenCalledOnce();
		// The user is NOT sent into the app — no redirect, an action failure instead.
		expect(thrown).toBeUndefined();
		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect((result as { data: { error: string } }).data.error).toMatch(
			/invalid or has already been used/i
		);
	});

	it('preserves the token and email on the failure payload so the form repopulates', async () => {
		const { event } = makeEvent({
			fields: GOOD_FIELDS,
			rpcResult: { data: null, error: null }
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
		// A failed signUp must not consume the invite token.
		expect(rpc).not.toHaveBeenCalled();
	});

	it('treats a null user (no error) as a signUp failure and does not redeem', async () => {
		const { event, rpc } = makeEvent({
			fields: GOOD_FIELDS,
			signUpResult: { data: { user: null }, error: null }
		});

		const result = await signUp(event);

		expect(isActionFailure(result)).toBe(true);
		expect(rpc).not.toHaveBeenCalled();
	});
});
