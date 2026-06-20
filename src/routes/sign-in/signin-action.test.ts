import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isActionFailure, isRedirect } from '@sveltejs/kit';
import { actions } from './+page.server';

// Action coverage for the public sign-in flow. The action is exercised with a
// fake `event` exposing `locals.supabase.auth.signInWithPassword` and a
// `request.formData()`. Invariants under test:
//   - invalid/missing email -> fail(400) BEFORE any sign-in call
//   - empty password -> fail(400) BEFORE any sign-in call (no length policy)
//   - success (session returned) -> redirect(303, '/snacktum-snacktorum')
//   - auth failure -> friendly NON-ENUMERATING fail(400): one generic message,
//     the raw Supabase error is NOT surfaced, and the password is never echoed
//   - the email is echoed back on failure so the form repopulates

const signIn = actions.default;

const A_SESSION = { access_token: 'tok', refresh_token: 'ref' };
const GOOD_FIELDS = { email: 'member@topdog.test', password: 'hunter2hunter2' };

/**
 * Builds a fake sign-in event. `request.formData()` resolves a FormData built
 * from the supplied fields; `supabase.auth.signInWithPassword` resolves
 * `signInResult` (default: a live session). The spy is exposed so tests can
 * assert call payloads / that it was not called.
 */
function makeEvent(opts: {
	fields: Record<string, string>;
	signInResult?: { data: { session: unknown }; error: unknown };
}) {
	const formData = new FormData();
	for (const [k, v] of Object.entries(opts.fields)) {
		formData.set(k, v);
	}

	const signInWithPassword = vi
		.fn()
		.mockResolvedValue(opts.signInResult ?? { data: { session: A_SESSION }, error: null });

	const event = {
		request: { formData: vi.fn().mockResolvedValue(formData) },
		locals: { supabase: { auth: { signInWithPassword } } }
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;

	return { event, signInWithPassword };
}

describe('sign-in default action — input validation', () => {
	beforeEach(() => vi.clearAllMocks());

	it('rejects a missing/empty email before any sign-in call', async () => {
		const { event, signInWithPassword } = makeEvent({ fields: { ...GOOD_FIELDS, email: '' } });

		const result = await signIn(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect((result as { data: { error: string } }).data.error).toMatch(/valid email/i);
		expect(signInWithPassword).not.toHaveBeenCalled();
	});

	it('rejects a malformed email before any sign-in call', async () => {
		const { event, signInWithPassword } = makeEvent({
			fields: { ...GOOD_FIELDS, email: 'not-an-email' }
		});

		const result = await signIn(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect(signInWithPassword).not.toHaveBeenCalled();
	});

	it('rejects an empty password before any sign-in call', async () => {
		const { event, signInWithPassword } = makeEvent({ fields: { ...GOOD_FIELDS, password: '' } });

		const result = await signIn(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect(signInWithPassword).not.toHaveBeenCalled();
	});

	it('does NOT enforce a password-length policy on login (a short password reaches the auth call)', async () => {
		const { event, signInWithPassword } = makeEvent({ fields: { ...GOOD_FIELDS, password: 'x' } });

		try {
			await signIn(event);
		} catch {
			// Success path redirects (throws) — expected for a valid session result.
		}

		expect(signInWithPassword).toHaveBeenCalledOnce();
	});
});

describe('sign-in default action — happy path', () => {
	beforeEach(() => vi.clearAllMocks());

	it('signs in with the credentials and redirects to /snacktum-snacktorum on a live session', async () => {
		const { event, signInWithPassword } = makeEvent({ fields: GOOD_FIELDS });

		let thrown: unknown;
		try {
			await signIn(event);
		} catch (e) {
			thrown = e;
		}

		expect(signInWithPassword).toHaveBeenCalledWith({
			email: 'member@topdog.test',
			password: 'hunter2hunter2'
		});
		expect(isRedirect(thrown)).toBe(true);
		expect((thrown as { status: number }).status).toBe(303);
		// Redirect to /snacktum-snacktorum, not a deeper route — the app guard routes onward.
		expect((thrown as { location: string }).location).toBe('/snacktum-snacktorum');
	});

	it('trims the email before signing in', async () => {
		const { event, signInWithPassword } = makeEvent({
			fields: { ...GOOD_FIELDS, email: '  member@topdog.test  ' }
		});

		try {
			await signIn(event);
		} catch {
			// redirect on success
		}

		expect(signInWithPassword).toHaveBeenCalledWith({
			email: 'member@topdog.test',
			password: 'hunter2hunter2'
		});
	});
});

describe('sign-in default action — auth failure (non-enumerating)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('returns a generic, non-enumerating fail(400) when the credentials are wrong', async () => {
		const { event } = makeEvent({
			fields: GOOD_FIELDS,
			signInResult: { data: { session: null }, error: { message: 'Invalid login credentials' } }
		});

		const result = await signIn(event);
		const data = (result as { data: { error: string; email?: string; password?: string } }).data;

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		// One generic message — NOT the raw Supabase error, and not enumerating.
		expect(data.error).toBe("Those credentials didn't work.");
		expect(data.error).not.toMatch(/invalid login credentials/i);
		expect(data.error).not.toMatch(/password/i);
		expect(data.error).not.toMatch(/exist|not found|no account/i);
		// The email is echoed for repopulation; the password is NEVER echoed.
		expect(data.email).toBe('member@topdog.test');
		expect(data.password).toBeUndefined();
	});

	it('treats a null session with no error as a failure (no redirect, generic message)', async () => {
		const { event } = makeEvent({
			fields: GOOD_FIELDS,
			signInResult: { data: { session: null }, error: null }
		});

		let thrown: unknown;
		let result: unknown;
		try {
			result = await signIn(event);
		} catch (e) {
			thrown = e;
		}

		expect(thrown).toBeUndefined();
		expect(isActionFailure(result)).toBe(true);
		expect((result as { data: { error: string } }).data.error).toBe(
			"Those credentials didn't work."
		);
	});
});
