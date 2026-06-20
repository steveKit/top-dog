import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isActionFailure, isRedirect } from '@sveltejs/kit';
import { actions, load } from './+page.server';
import { generateInviteToken } from '$lib/features/invites/token';
import { HANDLE_TAKEN } from '$lib/features/profiles/profiles';

// Test-after coverage for the Snacktum Onboarding RITE at /sign-up (TASK-092).
// The single route now drives the ceremony with TWO actions:
//
//   register      — Summoned + Inscribe: the invite-redemption flow (mechanics
//                   UNCHANGED from the old sign-up; only the success-with-session
//                   branch differs — it returns { registered: true } so the rite
//                   advances IN-PAGE instead of redirecting to /app).
//   createProfile — Sigil + Renounce: the absorbed onboarding logic — handle
//                   validation + profile creation, with the chosen sigil stored
//                   as `sigil:<id>` in avatar_path (no upload, no migration).
//
// The redemption order under register is:
//   validate token shape -> validate email -> validate password ->
//   invite_is_redeemable pre-check (best-effort) -> supabase.auth.signUp() ->
//   redeem_invite RPC keyed to the new user id.
//
// Mock the server-only service client so the orphan-cleanup path can be exercised
// without a real secret-key Supabase client.
const deleteUser = vi.fn().mockResolvedValue({ data: null, error: null });
vi.mock('$lib/server/supabase', () => ({
	getServiceClient: () => ({ auth: { admin: { deleteUser } } })
}));

const register = actions.register;
const createProfile = actions.createProfile;

const A_TOKEN = generateInviteToken();
const NEW_USER = { id: 'new-user-uuid', email: 'newchef@topdog.test' };
const A_SESSION = { access_token: 'tok', refresh_token: 'ref' };

// ---------------------------------------------------------------------------
// register (invite-redemption) — fake event
// ---------------------------------------------------------------------------

function makeRegisterEvent(opts: {
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

// ---------------------------------------------------------------------------
// createProfile (absorbed onboarding) — fake event
// ---------------------------------------------------------------------------

const PROFILE_USER = { id: '11111111-1111-1111-1111-111111111111', email: 'chef@topdog.test' };
const PROFILE_SESSION = { access_token: 'tok', user: PROFILE_USER };

const NEW_PROFILE = {
	id: PROFILE_USER.id,
	handle: 'ChefDog',
	display_name: 'ChefDog',
	avatar_path: 'sigil:tube',
	joined_at: '2026-06-09T00:00:00Z',
	days_as_top_dog: 0,
	is_current_top_dog: false,
	top_dog_since: null
};

function makeProfileEvent(opts: {
	fields: Record<string, string>;
	session?: unknown;
	existingProfile?: { data: unknown; error: unknown };
	insertResult?: { data: unknown; error: unknown };
}) {
	const formData = new FormData();
	for (const [k, v] of Object.entries(opts.fields)) {
		formData.set(k, v);
	}

	const existingProfile = opts.existingProfile ?? { data: null, error: null };
	const insertResult = opts.insertResult ?? { data: NEW_PROFILE, error: null };

	// select -> eq -> maybeSingle (the isHandleAvailable pre-check)
	const maybeSingle = vi.fn().mockResolvedValue(existingProfile);
	const eq = vi.fn(() => ({ maybeSingle }));
	// insert -> select -> single (createProfile)
	const single = vi.fn().mockResolvedValue(insertResult);
	const insertSelect = vi.fn(() => ({ single }));
	const insert = vi.fn(() => ({ select: insertSelect }));
	const select = vi.fn(() => ({ eq }));
	const from = vi.fn(() => ({ select, insert }));

	const safeGetSession = vi.fn(async () => {
		const session = 'session' in opts ? opts.session : PROFILE_SESSION;
		return { session, user: session ? PROFILE_USER : null };
	});

	// A raw getSession spy: the action MUST NOT use this (auth-trust boundary).
	const rawGetSession = vi.fn(async () => ({ data: { session: PROFILE_SESSION }, error: null }));
	const getUser = vi.fn(async () => ({ data: { user: PROFILE_USER }, error: null }));

	const event = {
		request: { formData: vi.fn().mockResolvedValue(formData) },
		locals: {
			supabase: { from, auth: { getSession: rawGetSession, getUser } },
			safeGetSession
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;

	return { event, from, insert, safeGetSession, rawGetSession };
}

// ---------------------------------------------------------------------------
// load
// ---------------------------------------------------------------------------

describe('sign-up rite load', () => {
	beforeEach(() => vi.clearAllMocks());

	it('surfaces a ?token= for an anonymous visitor and does NOT resume at profile', async () => {
		const safeGetSession = vi.fn(async () => ({ session: null, user: null }));
		const result = await load({
			url: new URL('https://x/sign-up?token=abc123'),
			locals: { supabase: {}, safeGetSession }
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any);

		expect(result).toEqual({ token: 'abc123', resumeAtProfile: false });
	});

	it('defaults to an empty token when none is supplied', async () => {
		const safeGetSession = vi.fn(async () => ({ session: null, user: null }));
		const result = await load({
			url: new URL('https://x/sign-up'),
			locals: { supabase: {}, safeGetSession }
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any);

		expect(result).toEqual({ token: '', resumeAtProfile: false });
	});

	it('resumes at the profile step for an authenticated, profile-less visitor', async () => {
		// The app guard funnels a profile-less member here; the rite skips the
		// invite/credential steps and resumes at naming/sigil.
		const safeGetSession = vi.fn(async () => ({ session: PROFILE_SESSION, user: PROFILE_USER }));
		const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
		const eq = vi.fn(() => ({ maybeSingle }));
		const select = vi.fn(() => ({ eq }));
		const from = vi.fn(() => ({ select }));

		const result = await load({
			url: new URL('https://x/sign-up'),
			locals: { supabase: { from }, safeGetSession }
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any);

		expect(result).toEqual({ token: '', resumeAtProfile: true });
	});

	it('redirects an already-onboarded visitor straight to their profile', async () => {
		const safeGetSession = vi.fn(async () => ({ session: PROFILE_SESSION, user: PROFILE_USER }));
		const maybeSingle = vi.fn().mockResolvedValue({ data: NEW_PROFILE, error: null });
		const eq = vi.fn(() => ({ maybeSingle }));
		const select = vi.fn(() => ({ eq }));
		const from = vi.fn(() => ({ select }));

		let thrown: unknown;
		try {
			await load({
				url: new URL('https://x/sign-up'),
				locals: { supabase: { from }, safeGetSession }
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} as any);
		} catch (e) {
			thrown = e;
		}

		expect(isRedirect(thrown)).toBe(true);
		expect((thrown as { location: string }).location).toBe('/app/profile/ChefDog');
	});
});

// ---------------------------------------------------------------------------
// register — invite redemption (mechanics UNCHANGED)
// ---------------------------------------------------------------------------

describe('register — happy path', () => {
	beforeEach(() => vi.clearAllMocks());

	it('pre-checks, signs up, redeems for the new user id, then returns registered (no /app redirect)', async () => {
		const { event, signUpFn, rpc } = makeRegisterEvent({ fields: GOOD_FIELDS });

		const result = await register(event);

		expect(signUpFn).toHaveBeenCalledWith({
			email: 'newchef@topdog.test',
			password: 'hunter2hunter2'
		});
		expect(rpc).toHaveBeenCalledWith('invite_is_redeemable', { invite_token: A_TOKEN });
		expect(rpc).toHaveBeenCalledWith('redeem_invite', {
			invite_token: A_TOKEN,
			redeemer_id: 'new-user-uuid'
		});
		// pre-check before signUp before redemption.
		const preCheckOrder = rpc.mock.invocationCallOrder[0];
		const redeemOrder = rpc.mock.invocationCallOrder[1];
		const signUpOrder = signUpFn.mock.invocationCallOrder[0];
		expect(preCheckOrder).toBeLessThan(signUpOrder);
		expect(signUpOrder).toBeLessThan(redeemOrder);
		// The single-route rite advances IN-PAGE: a registered flag, not a redirect.
		expect(isActionFailure(result)).toBe(false);
		expect(result).toEqual({ registered: true });
	});
});

describe('register — invalid / used token rejection', () => {
	beforeEach(() => vi.clearAllMocks());

	it('rejects a malformed token before any signUp call', async () => {
		const { event, signUpFn, rpc } = makeRegisterEvent({
			fields: { ...GOOD_FIELDS, token: 'too short' }
		});

		const result = await register(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect((result as { data: { error: string } }).data.error).toMatch(/valid invite link/i);
		expect(signUpFn).not.toHaveBeenCalled();
		expect(rpc).not.toHaveBeenCalled();
	});

	it('rejects an empty token before any signUp call', async () => {
		const { event, signUpFn } = makeRegisterEvent({ fields: { ...GOOD_FIELDS, token: '' } });

		const result = await register(event);

		expect(isActionFailure(result)).toBe(true);
		expect(signUpFn).not.toHaveBeenCalled();
	});

	it('rejects an already-used token at the pre-check, before any signUp call', async () => {
		const { event, signUpFn, rpc } = makeRegisterEvent({
			fields: GOOD_FIELDS,
			redeemableResult: { data: false, error: null }
		});

		const result = await register(event);

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
		const { event, signUpFn, rpc } = makeRegisterEvent({
			fields: GOOD_FIELDS,
			rpcResult: { data: null, error: null }
		});

		const result = await register(event);

		expect(signUpFn).toHaveBeenCalledOnce();
		expect(rpc).toHaveBeenCalledWith('redeem_invite', {
			invite_token: A_TOKEN,
			redeemer_id: 'new-user-uuid'
		});
		expect(deleteUser).toHaveBeenCalledWith('new-user-uuid');
		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect((result as { data: { error: string } }).data.error).toMatch(/valid invite/i);
	});

	it('still fails cleanly (no crash) when orphan cleanup itself errors on the lost-race path', async () => {
		deleteUser.mockResolvedValueOnce({ data: null, error: { message: 'admin delete failed' } });

		const { event, signUpFn, rpc } = makeRegisterEvent({
			fields: GOOD_FIELDS,
			rpcResult: { data: null, error: null }
		});

		const result = await register(event);

		expect(signUpFn).toHaveBeenCalledOnce();
		expect(rpc).toHaveBeenCalledWith('redeem_invite', {
			invite_token: A_TOKEN,
			redeemer_id: 'new-user-uuid'
		});
		expect(deleteUser).toHaveBeenCalledWith('new-user-uuid');
		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
	});

	it('preserves the token and email on the failure payload so the rite repopulates', async () => {
		const { event } = makeRegisterEvent({
			fields: GOOD_FIELDS,
			redeemableResult: { data: false, error: null }
		});

		const result = await register(event);
		const data = (result as { data: { token: string; email: string } }).data;

		expect(data.token).toBe(A_TOKEN);
		expect(data.email).toBe('newchef@topdog.test');
	});
});

describe('register — input validation', () => {
	beforeEach(() => vi.clearAllMocks());

	it('rejects a missing/empty email before signUp', async () => {
		const { event, signUpFn } = makeRegisterEvent({ fields: { ...GOOD_FIELDS, email: '' } });

		const result = await register(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect((result as { data: { error: string } }).data.error).toMatch(/valid email/i);
		expect(signUpFn).not.toHaveBeenCalled();
	});

	it('rejects a malformed email before signUp', async () => {
		const { event, signUpFn } = makeRegisterEvent({
			fields: { ...GOOD_FIELDS, email: 'not-an-email' }
		});

		const result = await register(event);

		expect(isActionFailure(result)).toBe(true);
		expect(signUpFn).not.toHaveBeenCalled();
	});

	it('rejects a short password (< 8 chars) before signUp', async () => {
		const { event, signUpFn } = makeRegisterEvent({
			fields: { ...GOOD_FIELDS, password: 'short' }
		});

		const result = await register(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect((result as { data: { error: string } }).data.error).toMatch(/at least 8 characters/i);
		expect(signUpFn).not.toHaveBeenCalled();
	});

	it('accepts a password exactly at the 8-char minimum boundary', async () => {
		const { event, signUpFn } = makeRegisterEvent({
			fields: { ...GOOD_FIELDS, password: '12345678' }
		});

		await register(event);

		expect(signUpFn).toHaveBeenCalledOnce();
	});
});

describe('register — signUp failure', () => {
	beforeEach(() => vi.clearAllMocks());

	it('returns a 400 fail and never redeems when signUp errors', async () => {
		const { event, rpc } = makeRegisterEvent({
			fields: GOOD_FIELDS,
			signUpResult: { data: { user: null }, error: { message: 'User already registered' } }
		});

		const result = await register(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect(rpc).not.toHaveBeenCalledWith('redeem_invite', expect.anything());
	});

	it('treats a null user (no error) as a signUp failure and does not redeem', async () => {
		const { event, rpc } = makeRegisterEvent({
			fields: GOOD_FIELDS,
			signUpResult: { data: { user: null }, error: null }
		});

		const result = await register(event);

		expect(isActionFailure(result)).toBe(true);
		expect(rpc).not.toHaveBeenCalledWith('redeem_invite', expect.anything());
	});
});

describe('register — email confirmation (no session)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('returns a confirm-email success state when signUp has no session', async () => {
		// Email confirmation enabled: signUp succeeds but returns no session. The
		// invite WAS validly consumed, so this is a success, not a fail() — and the
		// rite cannot advance into the profile steps without a session.
		const { event, rpc } = makeRegisterEvent({
			fields: GOOD_FIELDS,
			signUpResult: { data: { user: NEW_USER, session: null }, error: null }
		});

		const result = await register(event);

		expect(isActionFailure(result)).toBe(false);
		expect(result).toEqual({ success: true, confirmEmail: true, email: 'newchef@topdog.test' });
		expect(rpc).toHaveBeenCalledWith('redeem_invite', {
			invite_token: A_TOKEN,
			redeemer_id: 'new-user-uuid'
		});
		expect(deleteUser).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// createProfile — absorbed onboarding (handle validation + profile creation,
// sigil stored in avatar_path). Relocated from onboarding-action.test.ts.
// ---------------------------------------------------------------------------

describe('createProfile — handle validation', () => {
	beforeEach(() => vi.clearAllMocks());

	it('rejects a bad-charset handle before any insert', async () => {
		const { event, insert } = makeProfileEvent({ fields: { handle: 'chef dog!', sigil: 'tube' } });

		const result = await createProfile(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { data: { error: string } }).data.error).toMatch(
			/letters, numbers, and underscores/i
		);
		expect(insert).not.toHaveBeenCalled();
	});

	it('rejects a too-short handle before any insert', async () => {
		const { event, insert } = makeProfileEvent({ fields: { handle: 'a', sigil: 'tube' } });

		const result = await createProfile(event);

		expect(isActionFailure(result)).toBe(true);
		expect(insert).not.toHaveBeenCalled();
	});

	it('fails when the pre-check reports the handle is taken, preserving inputs', async () => {
		const { event, insert } = makeProfileEvent({
			fields: { handle: 'ChefDog', sigil: 'tube' },
			existingProfile: { data: { id: 'someone-else' }, error: null }
		});

		const result = await createProfile(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { data: { error: string } }).data.error).toMatch(/taken/i);
		expect((result as { data: { handle: string } }).data.handle).toBe('ChefDog');
		expect(insert).not.toHaveBeenCalled();
	});

	it('maps a unique-violation on insert to a friendly taken message, preserving inputs', async () => {
		const { event } = makeProfileEvent({
			fields: { handle: 'ChefDog', sigil: 'tube' },
			insertResult: { data: null, error: { code: '23505', message: 'duplicate key' } }
		});

		const result = await createProfile(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { data: { error: string } }).data.error).toMatch(/taken/i);
		expect((result as { data: { error: string } }).data.error).not.toContain(HANDLE_TAKEN);
		expect((result as { data: { handle: string } }).data.handle).toBe('ChefDog');
	});
});

describe('createProfile — happy path + sigil storage', () => {
	beforeEach(() => vi.clearAllMocks());

	it('inserts with the trusted session uid and returns { created, handle } on success (no redirect)', async () => {
		const { event, insert } = makeProfileEvent({ fields: { handle: 'ChefDog', sigil: 'tube' } });

		const result = await createProfile(event);

		expect(insert).toHaveBeenCalledWith(
			expect.objectContaining({ id: PROFILE_USER.id, handle: 'ChefDog' })
		);
		// The rite advances IN-PAGE (Sigil -> Renounce -> Received): a returned flag
		// carrying the canonical handle, not a redirect away to the profile.
		expect(isActionFailure(result)).toBe(false);
		expect(result).toEqual({ created: true, handle: 'ChefDog' });
	});

	it('defaults display_name to the handle (the rite has no separate display name)', async () => {
		const { event, insert } = makeProfileEvent({ fields: { handle: 'ChefDog', sigil: 'tube' } });

		await createProfile(event);

		expect(insert).toHaveBeenCalledWith(expect.objectContaining({ display_name: 'ChefDog' }));
	});

	it('stores the chosen sigil as a `sigil:<id>` value in avatar_path (no upload)', async () => {
		const { event, insert } = makeProfileEvent({ fields: { handle: 'ChefDog', sigil: 'candle' } });

		await createProfile(event);

		expect(insert).toHaveBeenCalledWith(expect.objectContaining({ avatar_path: 'sigil:candle' }));
	});

	it('falls back to the default sigil when the submitted sigil is unknown/absent', async () => {
		const { event, insert } = makeProfileEvent({
			fields: { handle: 'ChefDog', sigil: 'not-a-real-sigil' }
		});

		await createProfile(event);

		// Default sigil is `cowled` -> stored prefixed; every member gets a face.
		expect(insert).toHaveBeenCalledWith(expect.objectContaining({ avatar_path: 'sigil:cowled' }));
	});

	it('does not forge another user id — the insert id is the trusted session uid', async () => {
		const { event, insert } = makeProfileEvent({
			fields: { handle: 'ChefDog', sigil: 'tube', id: 'attacker-supplied-id' }
		});

		await createProfile(event);

		expect(insert).toHaveBeenCalledWith(expect.objectContaining({ id: PROFILE_USER.id }));
		const insertArg = (insert.mock.calls as Record<string, unknown>[][])[0][0];
		expect(insertArg.id).not.toBe('attacker-supplied-id');
	});
});

describe('createProfile — auth-trust boundary', () => {
	beforeEach(() => vi.clearAllMocks());

	it('returns 401 when there is no validated session; never inserts', async () => {
		const { event, insert } = makeProfileEvent({
			fields: { handle: 'ChefDog', sigil: 'tube' },
			session: null
		});

		const result = await createProfile(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(401);
		expect(insert).not.toHaveBeenCalled();
	});

	it('reads the session via safeGetSession, never the raw unvalidated getSession', async () => {
		const { event, safeGetSession, rawGetSession } = makeProfileEvent({
			fields: { handle: 'ChefDog', sigil: 'tube' }
		});

		await createProfile(event);

		expect(safeGetSession).toHaveBeenCalled();
		expect(rawGetSession).not.toHaveBeenCalled();
	});
});
