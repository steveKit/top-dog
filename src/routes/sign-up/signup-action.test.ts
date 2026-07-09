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
//                   advances IN-PAGE instead of redirecting to /snacktum-snacktorum).
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
// without a real secret-key Supabase client. The same client is now ALSO used by
// register's handle-uniqueness pre-check as a head count
// (`from('profiles').select('id', { count, head }).eq('handle', …)`), so the mock
// exposes a `from` builder resolving to a configurable count. Defaults to
// "available" (count 0); the taken-handle test overrides with mockResolvedValueOnce.
const deleteUser = vi.fn().mockResolvedValue({ data: null, error: null });
const serviceHandleCount = vi.fn().mockResolvedValue({ count: 0, error: null });
const serviceEq = vi.fn(() => serviceHandleCount());
const serviceSelect = vi.fn(() => ({ eq: serviceEq }));
const serviceFrom = vi.fn(() => ({ select: serviceSelect }));
vi.mock('$lib/server/supabase', () => ({
	getServiceClient: () => ({ auth: { admin: { deleteUser } }, from: serviceFrom })
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

	// The RLS-scoped client register holds (event.locals.supabase). The production
	// action MUST NEVER use this for the handle-uniqueness probe: the register
	// caller is unauthenticated, and profiles grants SELECT only to `authenticated`,
	// so an RLS-scoped probe would report EVERY handle as free. We give it a WORKING
	// `from` builder (rather than leaving it absent) so a misuse does not merely
	// crash with an opaque TypeError but is caught by an explicit
	// `expect(rlsFrom).not.toHaveBeenCalled()` — making the two clients genuinely
	// distinguishable in both directions (service used, RLS untouched).
	const rlsFrom = vi.fn(() => ({
		select: () => ({ eq: () => Promise.resolve({ count: 0, error: null }) })
	}));

	const event = {
		request: { formData: vi.fn().mockResolvedValue(formData) },
		locals: { supabase: { auth: { signUp: signUpFn }, rpc, from: rlsFrom } }
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;

	return { event, signUpFn, rpc, rlsFrom };
}

const GOOD_FIELDS = {
	token: A_TOKEN,
	email: 'newchef@topdog.test',
	password: 'hunter2hunter2',
	handle: 'ChefDog'
};

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
		expect((thrown as { location: string }).location).toBe('/snacktum-snacktorum/shrine/ChefDog');
	});
});

// ---------------------------------------------------------------------------
// register — invite redemption (mechanics UNCHANGED)
// ---------------------------------------------------------------------------

describe('register — happy path', () => {
	beforeEach(() => vi.clearAllMocks());

	it('pre-checks, signs up, redeems for the new user id, then returns registered (no /snacktum-snacktorum redirect)', async () => {
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

// ---------------------------------------------------------------------------
// register — handle validation (FIX-RITE-VALIDATION)
//
// The Inscribe step posts name="handle"; validating it only at the later Sigil
// step meant a malformed handle created the auth account and BURNED the single-
// use invite before being rejected. register must now reject a bad handle at the
// boundary — BEFORE the invite gate / signUp / redemption — and reject an
// already-taken handle (via a service-client head count) AFTER the invite gate
// but BEFORE signUp. Asserting that ORDERING is asserting the bug is fixed.
// ---------------------------------------------------------------------------

describe('register — handle validation', () => {
	beforeEach(() => vi.clearAllMocks());

	it('rejects an invalid-charset handle before the invite gate, signUp, or redemption', async () => {
		// A handle with a space is length-legal but charset-illegal. It must die at
		// the boundary — no invite probe, no account, no invite consumption.
		const { event, signUpFn, rpc, rlsFrom } = makeRegisterEvent({
			fields: { ...GOOD_FIELDS, handle: 'Frank The Faithful' }
		});

		const result = await register(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect((result as { data: { error: string } }).data.error).toMatch(
			/letters, numbers, and underscores/i
		);
		// Ordering IS the fix: no invite gate/redeem RPC, no account, no uniqueness probe
		// on EITHER client.
		expect(rpc).not.toHaveBeenCalled();
		expect(signUpFn).not.toHaveBeenCalled();
		expect(serviceFrom).not.toHaveBeenCalled();
		expect(rlsFrom).not.toHaveBeenCalled();
		// The bad handle echoes back so the rite repopulates the field.
		expect((result as { data: { handle: string } }).data.handle).toBe('Frank The Faithful');
	});

	it('rejects an empty handle before the invite gate, signUp, or either uniqueness probe', async () => {
		const { event, signUpFn, rpc, rlsFrom } = makeRegisterEvent({
			fields: { ...GOOD_FIELDS, handle: '' }
		});

		const result = await register(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect(rpc).not.toHaveBeenCalled();
		expect(signUpFn).not.toHaveBeenCalled();
		// Neither client is touched — the empty handle dies at the boundary.
		expect(serviceFrom).not.toHaveBeenCalled();
		expect(rlsFrom).not.toHaveBeenCalled();
	});

	it('rejects an already-taken handle after the invite gate but before signUp, via a service-client head count', async () => {
		serviceHandleCount.mockResolvedValueOnce({ count: 1, error: null });
		const { event, signUpFn, rpc, rlsFrom } = makeRegisterEvent({ fields: GOOD_FIELDS });

		const result = await register(event);

		// The invite gate ran and passed; the uniqueness probe then rejected — so the
		// account was NEVER created and the invite was NEVER consumed.
		expect(rpc).toHaveBeenCalledWith('invite_is_redeemable', { invite_token: A_TOKEN });
		expect(rpc).not.toHaveBeenCalledWith('redeem_invite', expect.anything());
		expect(signUpFn).not.toHaveBeenCalled();
		// The probe used the SERVICE client as a head count keyed on the handle — NOT
		// the RLS-scoped locals client (which would report every handle as free).
		expect(serviceFrom).toHaveBeenCalledWith('profiles');
		expect(serviceSelect).toHaveBeenCalledWith('id', { count: 'exact', head: true });
		expect(serviceEq).toHaveBeenCalledWith('handle', 'ChefDog');
		expect(rlsFrom).not.toHaveBeenCalled();
		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect((result as { data: { error: string } }).data.error).toMatch(/already worn|taken/i);
	});

	it('probes handle uniqueness ONLY after the invite gate passes (a valid invite is required to probe)', async () => {
		// A used/invalid token fails the invite gate first, so the uniqueness probe
		// never runs — only a valid-invite holder can learn whether a handle exists.
		const { event, signUpFn } = makeRegisterEvent({
			fields: GOOD_FIELDS,
			redeemableResult: { data: false, error: null }
		});

		const result = await register(event);

		expect(serviceFrom).not.toHaveBeenCalled();
		expect(signUpFn).not.toHaveBeenCalled();
		expect(isActionFailure(result)).toBe(true);
	});

	it('proceeds to signUp for a valid, available handle (head count 0)', async () => {
		const { event, signUpFn } = makeRegisterEvent({ fields: GOOD_FIELDS });

		await register(event);

		expect(serviceFrom).toHaveBeenCalledWith('profiles');
		expect(signUpFn).toHaveBeenCalledOnce();
	});
});

// ---------------------------------------------------------------------------
// register — uniqueness-probe client identity + full step ordering
//
// The security contract of the fix is ORDERING, not merely "a bad handle is
// rejected". Two invariants that a loose toHaveBeenCalled() would miss:
//   (a) the probe runs on the SERVICE client, never the RLS-scoped locals client
//       — an RLS probe by an unauthenticated caller reports every handle free;
//   (b) the probe sits AFTER the invite gate and BEFORE signUp/redeem, so a taken
//       handle can neither leak handle-existence to a stranger nor burn an invite.
// ---------------------------------------------------------------------------

describe('register — uniqueness probe client identity + ordering', () => {
	beforeEach(() => vi.clearAllMocks());

	it('uses the SERVICE client for the uniqueness probe, never the RLS-scoped locals client', async () => {
		// If the probe accidentally used event.locals.supabase, an unauthenticated
		// caller would see zero rows for EVERY handle (profiles SELECT is granted only
		// to `authenticated`). Pinning that the RLS `from` is never touched — while the
		// service `from` IS — makes the two clients distinguishable in both directions.
		const { event, rlsFrom } = makeRegisterEvent({ fields: GOOD_FIELDS });

		await register(event);

		expect(serviceFrom).toHaveBeenCalledWith('profiles');
		expect(serviceSelect).toHaveBeenCalledWith('id', { count: 'exact', head: true });
		expect(rlsFrom).not.toHaveBeenCalled();
	});

	it('orders the steps: invite gate -> uniqueness probe -> signUp -> redeem', async () => {
		const { event, signUpFn, rpc } = makeRegisterEvent({ fields: GOOD_FIELDS });

		await register(event);

		const inviteGateOrder = rpc.mock.invocationCallOrder[0]; // invite_is_redeemable
		const probeOrder = serviceFrom.mock.invocationCallOrder[0];
		const signUpOrder = signUpFn.mock.invocationCallOrder[0];
		const redeemOrder = rpc.mock.invocationCallOrder[1]; // redeem_invite

		expect(inviteGateOrder).toBeLessThan(probeOrder);
		expect(probeOrder).toBeLessThan(signUpOrder);
		expect(signUpOrder).toBeLessThan(redeemOrder);
	});

	it('treats the uniqueness probe as best-effort: a probe ERROR still proceeds to signUp', async () => {
		// The code gates on `!handleCountError && count > 0`, so a probe that ERRORS
		// must NOT block signup — the DB citext UNIQUE constraint stays authoritative.
		// This pins the best-effort semantics: flipping it to reject-on-error breaks here.
		serviceHandleCount.mockResolvedValueOnce({ count: null, error: { message: 'probe boom' } });
		const { event, signUpFn } = makeRegisterEvent({ fields: GOOD_FIELDS });

		const result = await register(event);

		expect(signUpFn).toHaveBeenCalledOnce();
		expect(isActionFailure(result)).toBe(false);
		expect(result).toEqual({ registered: true });
	});
});

// ---------------------------------------------------------------------------
// register — handle boundary cases AT THE register boundary
//
// handle.test.ts covers the pure validateHandle boundaries; these prove the
// register ACTION wires that validator at the entry boundary with zero side
// effects on rejection, and that normalize/trim + case-preservation flow into
// the service-client uniqueness probe.
// ---------------------------------------------------------------------------

describe('register — handle boundary cases', () => {
	beforeEach(() => vi.clearAllMocks());

	// A rejection that must die at the handle boundary: no invite gate, no probe on
	// either client, no account, no redemption.
	async function expectRejectedAtBoundary(handle: string) {
		const { event, signUpFn, rpc, rlsFrom } = makeRegisterEvent({
			fields: { ...GOOD_FIELDS, handle }
		});

		const result = await register(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect(rpc).not.toHaveBeenCalled();
		expect(signUpFn).not.toHaveBeenCalled();
		expect(serviceFrom).not.toHaveBeenCalled();
		expect(rlsFrom).not.toHaveBeenCalled();
		return result;
	}

	it('rejects a 1-char handle (below the 2-char minimum) with no side effects', async () => {
		await expectRejectedAtBoundary('a');
	});

	it('rejects a 33-char handle (above the 32-char maximum) with no side effects', async () => {
		await expectRejectedAtBoundary('a'.repeat(33));
	});

	it('rejects a whitespace-only handle (collapses to empty after trim) with no side effects', async () => {
		await expectRejectedAtBoundary('   ');
	});

	it('rejects an emoji/unicode handle with no side effects', async () => {
		await expectRejectedAtBoundary('hot🌭dog');
	});

	it('rejects a handle with an embedded control character (newline) with no side effects', async () => {
		await expectRejectedAtBoundary('chef\ndog');
	});

	it('accepts a 2-char handle (the minimum boundary) and probes/signs up with it', async () => {
		const { event, signUpFn, rlsFrom } = makeRegisterEvent({
			fields: { ...GOOD_FIELDS, handle: 'ab' }
		});

		await register(event);

		expect(serviceFrom).toHaveBeenCalledWith('profiles');
		expect(serviceEq).toHaveBeenCalledWith('handle', 'ab');
		expect(signUpFn).toHaveBeenCalledOnce();
		expect(rlsFrom).not.toHaveBeenCalled();
	});

	it('accepts a 32-char handle (the maximum boundary) and probes/signs up with it', async () => {
		const maxHandle = 'a'.repeat(32);
		const { event, signUpFn } = makeRegisterEvent({
			fields: { ...GOOD_FIELDS, handle: maxHandle }
		});

		await register(event);

		expect(serviceEq).toHaveBeenCalledWith('handle', maxHandle);
		expect(signUpFn).toHaveBeenCalledOnce();
	});

	it('trims a surrounding-whitespace handle and carries the TRIMMED value into the probe + signUp', async () => {
		// normalizeHandle trims surrounding whitespace, so "  Chef  " is a VALID handle
		// server-side. The trimmed value — not the raw padded one — must flow into the
		// uniqueness probe, or the citext lookup would miss the real row.
		const { event, signUpFn } = makeRegisterEvent({
			fields: { ...GOOD_FIELDS, handle: '  Chef  ' }
		});

		await register(event);

		expect(serviceEq).toHaveBeenCalledWith('handle', 'Chef');
		expect(serviceEq).not.toHaveBeenCalledWith('handle', '  Chef  ');
		expect(signUpFn).toHaveBeenCalledOnce();
	});

	it('preserves handle casing into the probe (no lowercasing — citext collides Chef with chef)', async () => {
		// citext makes uniqueness case-insensitive at the DB, so the app must NOT
		// lowercase: it passes the case-PRESERVED handle and lets citext collide `Chef`
		// with an existing `chef`. Count 1 simulates that existing row.
		serviceHandleCount.mockResolvedValueOnce({ count: 1, error: null });
		const { event, signUpFn } = makeRegisterEvent({
			fields: { ...GOOD_FIELDS, handle: 'Chef' }
		});

		const result = await register(event);

		expect(serviceEq).toHaveBeenCalledWith('handle', 'Chef');
		expect(serviceEq).not.toHaveBeenCalledWith('handle', 'chef');
		expect(signUpFn).not.toHaveBeenCalled();
		expect(isActionFailure(result)).toBe(true);
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
