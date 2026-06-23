import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isActionFailure, isRedirect, isHttpError } from '@sveltejs/kit';

// Test-after coverage for The Tribunal of the Holy Tube — the Top-Dog-only adjudication
// surface (TASK-073; re-skinned as M8 TASK-099, route leaf court -> tribunal). The
// +page.server.ts under test (the crown-gated load + the `rule` verdict action) is
// preserved byte-identical across the rebuild; only the presentation changed, so this
// action coverage is unchanged against the same contract. The Tribunal is the
// Top-Dog-only moderation surface: its load is CROWN-GATED (a non-Top-Dog is redirected
// to /snacktum-snacktorum/procession and never sees the flagged-dog queue) and its
// `rule` action passes only the dog id + verdict to renderBurgerVerdict on the
// RLS-scoped client — the adjudicating Top Dog is derived server-side (auth.uid() INSIDE
// the RPC), NEVER a client-supplied id (the sibling of the feed voter-id guard).
//
// The verdictStore / profiles / storage modules are dependency-injected via their
// import surface, so we mock the network-touching wrappers with vi.mock and assert the
// load's gate + the action's orchestration directly:
//   - load: unauth -> redirect /sign-in; a NON-Top-Dog -> redirect /snacktum-snacktorum/procession (never
//     lists flagged dogs); a viewer-read failure -> 500; the Top Dog -> the flagged
//     queue with a server-signed URL per row (a failed mint degrades to null).
//   - rule: success forwards (dogId, verdict) to renderBurgerVerdict and returns
//     { ruled: true }; the adjudicator id is NEVER passed (derived in the RPC); a
//     missing dog id / bad verdict value -> boundary 400 (no RPC call); unauth -> 401;
//     VERDICT_NOT_TOP_DOG -> 403 friendly; other sentinels / raw text -> friendly 400.
//
// The crown EXISTS gate, the RPC-as-sole-write-path, ranking-inertness, and the
// LIAR/HERETIC consequences are the authoritative DB guarantees — live-DB coverage in
// tests/burger-court.e2e.ts (@security; the verdict RPC + table identifiers are
// unchanged code-level names). summarizeReactions-style pure math isn't on this
// surface; the REAL sentinels are kept so the action's mapping is faithful.

vi.mock('$lib/features/profiles/profiles', () => ({
	getProfileById: vi.fn()
}));

vi.mock('$lib/features/reports/verdictStore', async () => {
	// Keep the REAL sentinels (VERDICT_NOT_TOP_DOG, NOT_TOP_DOG, …) so the action's
	// error mapping is exercised faithfully; only the network-touching wrappers are
	// mocked.
	const actual = await vi.importActual<typeof import('$lib/features/reports/verdictStore')>(
		'$lib/features/reports/verdictStore'
	);
	return {
		...actual,
		listFlaggedDogs: vi.fn(),
		renderBurgerVerdict: vi.fn()
	};
});

vi.mock('$lib/storage', () => ({
	getSignedUrl: vi.fn()
}));

// The flagged-dog images are signed with the privileged SERVICE client AFTER the crown
// gate (the hotdogs bucket is owner-only SELECT, so a cross-owner view must sign
// server-side — the TASK-033 pattern). We mock getServiceClient to a sentinel instance
// and assert the signer is it, never the viewer's RLS client.
vi.mock('$lib/server/supabase', () => ({
	getServiceClient: vi.fn()
}));

import { actions, load } from './+page.server';
import { getProfileById } from '$lib/features/profiles/profiles';
import {
	listFlaggedDogs,
	renderBurgerVerdict,
	NOT_TOP_DOG,
	VERDICT_NOT_TOP_DOG,
	VERDICT_NO_SUCH_DOG,
	VERDICT_BAD_VALUE,
	VERDICT_UNAUTHENTICATED
} from '$lib/features/reports/verdictStore';
import { getSignedUrl } from '$lib/storage';
import { getServiceClient } from '$lib/server/supabase';

const rule_ = actions.rule;

const USER_ID = '11111111-1111-4111-8111-111111111111';
const VALID_USER = { id: USER_ID, email: 'topdog@topdog.test' };
const VALID_SESSION = { access_token: 'valid', user: VALID_USER };
const DOG_ID = '22222222-2222-4222-8222-222222222222';

/** A distinct sentinel service-client instance (NOT event.locals.supabase). */
const SERVICE_CLIENT = { __brand: 'service-client' } as unknown;

function aFlaggedDog(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: DOG_ID,
		owner_id: 'owner-1',
		owner_handle: 'sausage_king',
		caption: 'is this a burger?',
		image_path: 'owner-1/dog.webp',
		reportCount: 3,
		verdict: null,
		...overrides
	};
}

/**
 * Builds a fake load event. `rawGetSession` is exposed to prove the load never reaches
 * for the unvalidated session.
 */
function makeLoadEvent(opts: { session: unknown; user: unknown }) {
	const safeGetSession = vi.fn(async () => ({ session: opts.session, user: opts.user }));
	const rawGetSession = vi.fn(async () => ({ data: { session: null }, error: null }));
	const supabase = { __brand: 'rls-client', auth: { getSession: rawGetSession } };
	const event = {
		locals: { supabase, safeGetSession }
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;
	return { event, safeGetSession, rawGetSession, supabase };
}

/**
 * Builds a fake action event. `formFields` is appended to FormData so we can pass (or
 * omit) the dog id / verdict and smuggle a hostile adjudicator id.
 */
function makeActionEvent(opts: {
	session: unknown;
	user: unknown;
	formFields?: Record<string, string>;
}) {
	const form = new FormData();
	for (const [k, v] of Object.entries(opts.formFields ?? {})) {
		form.append(k, v);
	}
	const request = { formData: vi.fn(async () => form) };
	const safeGetSession = vi.fn(async () => ({ session: opts.session, user: opts.user }));
	const rawGetSession = vi.fn(async () => ({ data: { session: null }, error: null }));
	const supabase = { __brand: 'rls-client', auth: { getSession: rawGetSession } };
	const event = {
		request,
		locals: { supabase, safeGetSession }
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;
	return { event, safeGetSession, rawGetSession, supabase };
}

type LoadData = {
	flagged: {
		id: string;
		ownerHandle: string;
		caption: string | null;
		reportCount: number;
		verdict: string | null;
		signedUrl: string | null;
	}[];
};
async function loadData(event: unknown): Promise<LoadData> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const result = await load(event as any);
	expect(result).toBeDefined();
	return result as LoadData;
}

/** Marks the signed-in viewer as the current Top Dog (passes the crown gate). */
function asTopDog() {
	vi.mocked(getProfileById).mockResolvedValue({
		ok: true,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		data: { id: USER_ID, is_current_top_dog: true } as any
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(console, 'error').mockImplementation(() => {});
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	vi.mocked(getServiceClient).mockReturnValue(SERVICE_CLIENT as any);
	// Default: NOT the Top Dog (the gate redirects). Crown-path tests call asTopDog().
	vi.mocked(getProfileById).mockResolvedValue({
		ok: true,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		data: { id: USER_ID, is_current_top_dog: false } as any
	});
	vi.mocked(listFlaggedDogs).mockResolvedValue({ ok: true, data: [] });
	vi.mocked(getSignedUrl).mockResolvedValue({
		ok: true,
		data: { signedUrl: 'https://signed/x' }
	});
	vi.mocked(renderBurgerVerdict).mockResolvedValue({ ok: true, data: 'verdict-1' });
});

describe('tribunal load (crown gate)', () => {
	it('reads the session via safeGetSession(), never raw getSession()', async () => {
		asTopDog();
		const { event, safeGetSession, rawGetSession } = makeLoadEvent({
			session: VALID_SESSION,
			user: VALID_USER
		});

		await loadData(event);

		expect(safeGetSession).toHaveBeenCalledOnce();
		expect(rawGetSession).not.toHaveBeenCalled();
	});

	it('redirects to /sign-in when unauthenticated; never reads the profile', async () => {
		const { event } = makeLoadEvent({ session: null, user: null });

		let thrown: unknown;
		try {
			await load(event);
		} catch (e) {
			thrown = e;
		}

		expect(isRedirect(thrown)).toBe(true);
		expect((thrown as { location: string }).location).toBe('/sign-in');
		expect(getProfileById).not.toHaveBeenCalled();
		expect(listFlaggedDogs).not.toHaveBeenCalled();
	});

	it('reads the crown off the VIEWER own profile (user.id)', async () => {
		asTopDog();
		const { event, supabase } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		await loadData(event);

		expect(getProfileById).toHaveBeenCalledWith(supabase, USER_ID);
	});

	it('redirects a NON-Top-Dog to /snacktum-snacktorum/procession; never lists flagged dogs (UI gate half)', async () => {
		// Default profile is non-crown.
		const { event } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		let thrown: unknown;
		try {
			await load(event);
		} catch (e) {
			thrown = e;
		}

		expect(isRedirect(thrown)).toBe(true);
		expect((thrown as { location: string }).location).toBe('/snacktum-snacktorum/procession');
		// The flagged queue is the Top Dog's alone: a non-Top-Dog never reaches it.
		expect(listFlaggedDogs).not.toHaveBeenCalled();
		expect(getSignedUrl).not.toHaveBeenCalled();
	});

	it('redirects a profile-less (null) viewer to /snacktum-snacktorum/procession (treated as not Top Dog)', async () => {
		vi.mocked(getProfileById).mockResolvedValue({ ok: true, data: null });
		const { event } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		let thrown: unknown;
		try {
			await load(event);
		} catch (e) {
			thrown = e;
		}

		expect(isRedirect(thrown)).toBe(true);
		expect((thrown as { location: string }).location).toBe('/snacktum-snacktorum/procession');
		expect(listFlaggedDogs).not.toHaveBeenCalled();
	});

	it('500s when the viewer profile read fails (gate cannot be evaluated)', async () => {
		vi.mocked(getProfileById).mockResolvedValue({ ok: false, error: 'profile boom' });
		const { event } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		let thrown: unknown;
		try {
			await load(event);
		} catch (e) {
			thrown = e;
		}

		expect(isHttpError(thrown)).toBe(true);
		expect((thrown as { status: number }).status).toBe(500);
		// Fail closed: a read failure must NOT fall through to the flagged queue.
		expect(listFlaggedDogs).not.toHaveBeenCalled();
		expect(console.error).toHaveBeenCalled();
	});

	it('the Top Dog gets the flagged queue with a SERVICE-signed URL per row', async () => {
		asTopDog();
		const dogA = aFlaggedDog();
		const dogB = aFlaggedDog({
			id: 'dog-b',
			image_path: 'owner-b/dog-b.webp',
			owner_handle: 'frank_fan',
			reportCount: 1,
			verdict: 'confirmed_hamburger'
		});
		vi.mocked(listFlaggedDogs).mockResolvedValue({ ok: true, data: [dogA, dogB] });
		vi.mocked(getSignedUrl).mockImplementation(async (_c, path) => ({
			ok: true,
			data: { signedUrl: `https://signed/${path}` }
		}));
		const { event, supabase } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await loadData(event);

		// The list is an anonymous aggregate read on the SERVICE client AFTER the gate.
		expect(listFlaggedDogs).toHaveBeenCalledWith(SERVICE_CLIENT);
		// Each image is signed with the SERVICE client (never the viewer's RLS client),
		// the cross-owner private-bucket pattern (TASK-033).
		expect(getSignedUrl).toHaveBeenCalledTimes(2);
		for (const call of vi.mocked(getSignedUrl).mock.calls) {
			expect(call[0]).toBe(SERVICE_CLIENT);
			expect(call[0]).not.toBe(supabase);
		}
		expect(result.flagged).toEqual([
			{
				id: DOG_ID,
				ownerHandle: 'sausage_king',
				caption: 'is this a burger?',
				reportCount: 3,
				verdict: null,
				signedUrl: `https://signed/${dogA.image_path}`
			},
			{
				id: 'dog-b',
				ownerHandle: 'frank_fan',
				caption: 'is this a burger?',
				reportCount: 1,
				verdict: 'confirmed_hamburger',
				signedUrl: `https://signed/${dogB.image_path}`
			}
		]);
	});

	it('the flagged row payload carries NO owner_id / reporter ids (anonymity)', async () => {
		asTopDog();
		const dogA = aFlaggedDog({ owner_id: '99999999-9999-4999-8999-999999999999' });
		vi.mocked(listFlaggedDogs).mockResolvedValue({ ok: true, data: [dogA] });
		const { event } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await loadData(event);

		// Only per-dog metadata + an aggregate count reach the page — never owner_id or
		// reporter ids (the Tribunal shows WHAT was flagged, not WHO reported).
		const serialized = JSON.stringify(result);
		expect(serialized).not.toContain('99999999-9999-4999-8999-999999999999');
		expect(serialized).not.toMatch(/reporter_?id|owner_id/i);
	});

	it('degrades a failed signed-URL mint to null without blanking the row', async () => {
		asTopDog();
		const dogA = aFlaggedDog();
		const dogB = aFlaggedDog({ id: 'dog-b', image_path: 'owner-b/dog-b.webp' });
		vi.mocked(listFlaggedDogs).mockResolvedValue({ ok: true, data: [dogA, dogB] });
		vi.mocked(getSignedUrl).mockImplementation(async (_c, path) => {
			if (path === dogA.image_path) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				return { ok: false, error: { message: 'sign failed' } as any };
			}
			return { ok: true, data: { signedUrl: `https://signed/${path}` } };
		});
		const { event } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await loadData(event);

		expect(result.flagged[0].signedUrl).toBeNull();
		expect(result.flagged[1].signedUrl).toBe(`https://signed/${dogB.image_path}`);
	});

	it('500s when the flagged-dog list read fails', async () => {
		asTopDog();
		vi.mocked(listFlaggedDogs).mockResolvedValue({ ok: false, error: 'list boom' });
		const { event } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		let thrown: unknown;
		try {
			await load(event);
		} catch (e) {
			thrown = e;
		}

		expect(isHttpError(thrown)).toBe(true);
		expect((thrown as { status: number }).status).toBe(500);
		expect(console.error).toHaveBeenCalled();
	});
});

describe('tribunal rule action', () => {
	it('reads the session via safeGetSession(), never raw getSession()', async () => {
		const { event, safeGetSession, rawGetSession } = makeActionEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { dogId: DOG_ID, verdict: 'confirmed_hamburger' }
		});

		await rule_(event);

		expect(safeGetSession).toHaveBeenCalledOnce();
		expect(rawGetSession).not.toHaveBeenCalled();
	});

	it('success: forwards ONLY (dogId, verdict) to renderBurgerVerdict on the RLS client, returns { ruled: true }', async () => {
		const { event, supabase } = makeActionEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { dogId: DOG_ID, verdict: 'not_a_hamburger' }
		});

		const result = await rule_(event);

		expect(renderBurgerVerdict).toHaveBeenCalledWith(supabase, DOG_ID, 'not_a_hamburger');
		expect(result).toEqual({ ruled: true });
	});

	it('does NOT pass an adjudicator id: the Top Dog is derived in the RPC (auth.uid()), never the form', async () => {
		// The sibling of the feed voter-id guard: a smuggled adjudicator id must reach
		// no argument — renderBurgerVerdict is called with (client, dogId, verdict) only.
		const { event } = makeActionEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: {
				dogId: DOG_ID,
				verdict: 'confirmed_hamburger',
				adjudicator_id: 'attacker-uuid',
				sprayer_id: 'attacker-uuid'
			}
		});

		await rule_(event);

		const callArgs = vi.mocked(renderBurgerVerdict).mock.calls[0];
		expect(callArgs).toHaveLength(3);
		expect(callArgs[1]).toBe(DOG_ID);
		expect(callArgs[2]).toBe('confirmed_hamburger');
		expect(callArgs).not.toContain('attacker-uuid');
		expect(callArgs).not.toContain(USER_ID);
	});

	it('rejects a missing dog id with a boundary 400; never calls renderBurgerVerdict', async () => {
		const { event } = makeActionEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { verdict: 'confirmed_hamburger' }
		});

		const result = await rule_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect(renderBurgerVerdict).not.toHaveBeenCalled();
	});

	it('rejects an unknown verdict value with a boundary 400; never calls renderBurgerVerdict', async () => {
		const { event } = makeActionEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { dogId: DOG_ID, verdict: 'tasty' }
		});

		const result = await rule_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect(renderBurgerVerdict).not.toHaveBeenCalled();
	});

	it('rejects a missing verdict value with a boundary 400; never calls renderBurgerVerdict', async () => {
		const { event } = makeActionEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { dogId: DOG_ID }
		});

		const result = await rule_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect(renderBurgerVerdict).not.toHaveBeenCalled();
	});

	it('fails closed with 401 when unauthenticated; never calls renderBurgerVerdict', async () => {
		const { event } = makeActionEvent({
			session: null,
			user: null,
			formFields: { dogId: DOG_ID, verdict: 'confirmed_hamburger' }
		});

		const result = await rule_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(401);
		expect(renderBurgerVerdict).not.toHaveBeenCalled();
	});

	it('fails closed when a user is present but the session is null', async () => {
		const { event } = makeActionEvent({
			session: null,
			user: VALID_USER,
			formFields: { dogId: DOG_ID, verdict: 'confirmed_hamburger' }
		});

		const result = await rule_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(401);
		expect(renderBurgerVerdict).not.toHaveBeenCalled();
	});

	it('VERDICT_NOT_TOP_DOG from the RPC -> 403 friendly fail() (not raw sentinel text)', async () => {
		// The DB gate is authoritative: even if the UI is bypassed, the RPC rejects a
		// non-Top-Dog caller, and the action maps that denial to a 403.
		vi.mocked(renderBurgerVerdict).mockResolvedValue({ ok: false, error: VERDICT_NOT_TOP_DOG });
		const { event } = makeActionEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { dogId: DOG_ID, verdict: 'confirmed_hamburger' }
		});

		const result = await rule_(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { message: string } };
		expect(failure.status).toBe(403);
		expect(failure.data.message).toBe(NOT_TOP_DOG);
		expect(failure.data.message).not.toContain(VERDICT_NOT_TOP_DOG);
		expect(console.error).toHaveBeenCalled();
	});

	it('VERDICT_NO_SUCH_DOG -> friendly 400 (not raw sentinel text)', async () => {
		vi.mocked(renderBurgerVerdict).mockResolvedValue({ ok: false, error: VERDICT_NO_SUCH_DOG });
		const { event } = makeActionEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { dogId: DOG_ID, verdict: 'not_a_hamburger' }
		});

		const result = await rule_(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { message: string } };
		expect(failure.status).toBe(400);
		expect(failure.data.message).toMatch(/no longer exists/i);
		expect(failure.data.message).not.toContain(VERDICT_NO_SUCH_DOG);
	});

	it('VERDICT_BAD_VALUE -> friendly 400 (not raw sentinel text)', async () => {
		vi.mocked(renderBurgerVerdict).mockResolvedValue({ ok: false, error: VERDICT_BAD_VALUE });
		const { event } = makeActionEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { dogId: DOG_ID, verdict: 'confirmed_hamburger' }
		});

		const result = await rule_(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { message: string } };
		expect(failure.status).toBe(400);
		expect(failure.data.message).not.toContain(VERDICT_BAD_VALUE);
	});

	it('VERDICT_UNAUTHENTICATED -> friendly 400 (not raw sentinel text)', async () => {
		vi.mocked(renderBurgerVerdict).mockResolvedValue({ ok: false, error: VERDICT_UNAUTHENTICATED });
		const { event } = makeActionEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { dogId: DOG_ID, verdict: 'confirmed_hamburger' }
		});

		const result = await rule_(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { message: string } };
		expect(failure.status).toBe(400);
		expect(failure.data.message).toMatch(/signed in/i);
		expect(failure.data.message).not.toContain(VERDICT_UNAUTHENTICATED);
	});

	it('an unrecognized error -> generic friendly 400 + server-side log (no raw text)', async () => {
		vi.mocked(renderBurgerVerdict).mockResolvedValue({
			ok: false,
			error: 'relation burger_verdicts does not exist'
		});
		const { event } = makeActionEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { dogId: DOG_ID, verdict: 'confirmed_hamburger' }
		});

		const result = await rule_(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { message: string } };
		expect(failure.status).toBe(400);
		expect(failure.data.message).not.toMatch(/relation burger_verdicts does not exist/i);
		expect(failure.data.message).toMatch(/try again/i);
		expect(console.error).toHaveBeenCalled();
	});
});
