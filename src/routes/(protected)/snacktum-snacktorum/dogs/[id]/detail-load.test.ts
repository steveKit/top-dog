import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isRedirect, isHttpError, isActionFailure } from '@sveltejs/kit';

// Test-after coverage for the per-dog detail view load (TASK-031; project
// strategy: test-after for load functions / route wiring). The detail load is a
// read surface: safeGetSession()-gated, it fetches one dog's stats (peak_votes +
// vote_count) + owner via getDogDetail on the RLS-scoped event.locals.supabase,
// mints a signed URL for the private image with graceful null degradation, and
// attaches a READ-ONLY reaction summary (decision #12 — cosmetic flair, never
// touches vote_count/ranking).
//
// The detail / reactions / storage modules are dependency-injected via their
// import surface, so we mock the network-touching wrappers with vi.mock and
// assert the load's orchestration directly:
//   - unauth (no session / no user) -> redirect /sign-in (never reaches the read);
//   - a MALFORMED (non-uuid) id -> a 404 HttpError BEFORE the read (TASK-033:
//     the isUuid() guard maps a non-uuid param to 404, not a Postgres 22P02 → 500);
//   - DOG_NOT_FOUND -> a 404 HttpError (distinct from a read error);
//   - a real read error -> a 500 HttpError (no raw SDK internals leaked);
//   - a found dog -> { dog (stats + owner), signedUrl, reactions };
//   - the signed URL is minted with the PRIVILEGED SERVICE client, never the
//     RLS-scoped event.locals.supabase (TASK-033 P0: the owner-only hotdogs
//     SELECT policy means the viewer's RLS client can't sign a URL for a dog it
//     doesn't own — this assertion is the regression guard for that fix);
//   - a failed signed-URL mint degrades to a null url (no throw, page not blanked);
//   - the reaction summary is attached, aggregated viewer-relative;
//   - the read goes through safeGetSession() + the RLS-scoped client, with the
//     dog id taken from params.
//
// The RLS / real-signed-URL guarantees remain live-DB coverage (the existing
// @smoke), consistent with the tracked feature-test gaps. summarizeReactions is
// kept REAL so the load's aggregation is exercised faithfully.

vi.mock('$lib/features/hotdogs/detail', async () => {
	// Keep the REAL DOG_NOT_FOUND sentinel so the load's 404-vs-500 mapping is
	// exercised faithfully; only the network-touching read is mocked.
	const actual = await vi.importActual<typeof import('$lib/features/hotdogs/detail')>(
		'$lib/features/hotdogs/detail'
	);
	return {
		...actual,
		getDogDetail: vi.fn()
	};
});

vi.mock('$lib/storage', () => ({
	getSignedUrl: vi.fn(),
	// isUuid() gates the route param before the DB read (TASK-033). Defaulted to
	// `true` in beforeEach so the existing valid-uuid fixtures pass the guard; the
	// malformed-id test overrides it to `false`.
	isUuid: vi.fn()
}));

// The signed URL is minted with the privileged service client (TASK-033 P0 fix),
// NOT the viewer's RLS-scoped event.locals.supabase. We mock getServiceClient to
// return a sentinel instance and assert getSignedUrl is called with it — the test
// that would have caught the original "non-owner gets a null signed URL" bug.
vi.mock('$lib/server/supabase', () => ({
	getServiceClient: vi.fn()
}));

vi.mock('$lib/features/reactions/reactions', () => ({
	listReactionsForDogs: vi.fn()
}));

// Burger-alarm report wrappers (TASK-071). The report/unreport ACTIONS call
// reportBurger/unreportBurger, so we mock those two to assert the action's
// orchestration (auth gate, dog-id boundary, no client-supplied reporter id,
// friendly fail() mapping). The LOAD path depends on the REAL aggregate wrappers
// (getBurgerAlarmCounts / getMyReportedDogIds) — which run against the faked
// `.from('burger_alarms')` chain — and on the REAL CANNOT_REPORT_OWN sentinel, so
// we partial-mock: keep everything real except the two action wrappers.
vi.mock('$lib/features/reports/reports', async () => {
	const actual = await vi.importActual<typeof import('$lib/features/reports/reports')>(
		'$lib/features/reports/reports'
	);
	return {
		...actual,
		reportBurger: vi.fn(),
		unreportBurger: vi.fn()
	};
});

// 🍔 Hamburger Court verdict (TASK-073). The detail load reads this dog's verdict via
// getVerdictsForDogs on the RLS-scoped client and resolves the render-time alarm state
// through the REAL pure dogAlarmState (kept real so the verdict -> alarm-state mapping
// is exercised faithfully). A not_a_hamburger verdict suppresses the alarm; a
// confirmed_hamburger verdict converts it to a persistent CONFIRMED stamp. Only the
// network-touching wrapper is mocked; the load degrades to "no verdict" on failure.
vi.mock('$lib/features/reports/verdictStore', () => ({
	getVerdictsForDogs: vi.fn()
}));

import { actions, load } from './+page.server';
import { getDogDetail, DOG_NOT_FOUND } from '$lib/features/hotdogs/detail';
import { getSignedUrl, isUuid } from '$lib/storage';
import { getServiceClient } from '$lib/server/supabase';
import { listReactionsForDogs } from '$lib/features/reactions/reactions';
import { reportBurger, unreportBurger, CANNOT_REPORT_OWN } from '$lib/features/reports/reports';
import { getVerdictsForDogs } from '$lib/features/reports/verdictStore';

// The detail load now reads the anonymous per-dog burger-alarm aggregate with the
// SERVICE client (getBurgerAlarmCounts: `.from('burger_alarms').select('hot_dog_id,
// created_at').in('hot_dog_id', …)`) and the viewer's own report toggle with the RLS
// client (getMyReportedDogIds: `.from('burger_alarms').select('hot_dog_id').in(…)`).
// These are the REAL reports wrappers — only the underlying query builder is faked —
// so the anonymity-preserving aggregate (timestamps only, NEVER reporter ids) and
// the render-time alarm summary are exercised through the load.

/**
 * A fake `.from('burger_alarms').select(cols).in(col, ids)` chain resolving rows.
 */
function burgerAlarmsFrom(rows: Record<string, unknown>[]) {
	const inFn = vi.fn().mockResolvedValue({ data: rows, error: null });
	const select = vi.fn().mockReturnValue({ in: inFn });
	return { select };
}

// Mutable per-test report fixtures, reset in beforeEach.
let serviceAlarmRows: { hot_dog_id: string; created_at: string }[] = [];
let myReportRows: { hot_dog_id: string }[] = [];

/**
 * Sentinel service-client instance — distinct from event.locals.supabase. Its only
 * method is `.from('burger_alarms')`; getSignedUrl is mocked, so it needs no storage.
 */
const SERVICE_CLIENT = {
	__brand: 'service-client',
	from: vi.fn((table: string) => {
		if (table === 'burger_alarms') return burgerAlarmsFrom(serviceAlarmRows);
		throw new Error(`unexpected service-client table: ${table}`);
	})
} as unknown;

const USER_ID = '11111111-1111-4111-8111-111111111111';
const VALID_USER = { id: USER_ID, email: 'chef@topdog.test' };
const VALID_SESSION = { access_token: 'valid', user: VALID_USER };
const DOG_ID = '22222222-2222-4222-8222-222222222222';

const DOG_DETAIL = {
	id: DOG_ID,
	owner_id: 'owner-1',
	image_path: 'owner-1/dog.webp',
	caption: 'best frank',
	created_at: '2026-06-09T00:00:00Z',
	vote_count: 4,
	peak_votes: 9,
	owner: {
		id: 'owner-1',
		handle: 'sausage_king',
		display_name: 'Sausage King',
		is_current_top_dog: true,
		top_dog_since: '2026-06-01T00:00:00Z'
	}
};

/**
 * Builds a fake load event. `rawGetSession` is exposed to prove the load never
 * reaches for the unvalidated session; `params.id` carries the dog id.
 */
function makeLoadEvent(opts: { session: unknown; user: unknown; id?: string }) {
	const safeGetSession = vi.fn(async () => ({ session: opts.session, user: opts.user }));
	const rawGetSession = vi.fn(async () => ({ data: { session: null }, error: null }));
	// The RLS-scoped client carries a `burger_alarms` branch for getMyReportedDogIds
	// (the viewer's own report toggle runs on THIS client; owner-scoped SELECT means
	// it returns only the viewer's own rows).
	const supabase = {
		auth: { getSession: rawGetSession },
		from: vi.fn((table: string) => {
			if (table === 'burger_alarms') return burgerAlarmsFrom(myReportRows);
			throw new Error(`unexpected rls-client table: ${table}`);
		})
	};
	const event = {
		params: { id: opts.id ?? DOG_ID },
		locals: { supabase, safeGetSession }
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;
	return { event, safeGetSession, rawGetSession, supabase };
}

type LoadData = {
	dog: typeof DOG_DETAIL;
	signedUrl: string | null;
	reactions: { emoji: string; count: number; reactedByMe: boolean }[];
	alarm: { active: boolean; reporterCount: number; intensity: string };
	alarmState: 'alarm' | 'cleared' | 'confirmed';
	iReported: boolean;
	isOwnDog: boolean;
};
async function loadData(event: unknown): Promise<LoadData> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const result = await load(event as any);
	expect(result).toBeDefined();
	return result as LoadData;
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(console, 'error').mockImplementation(() => {});
	// Default: no burger reports on this dog, viewer hasn't reported it.
	serviceAlarmRows = [];
	myReportRows = [];
	// Default happy-path stubs; individual tests override as needed.
	// Valid-uuid fixtures pass the route-param guard by default.
	vi.mocked(isUuid).mockReturnValue(true);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	vi.mocked(getServiceClient).mockReturnValue(SERVICE_CLIENT as any);
	vi.mocked(getDogDetail).mockResolvedValue({ ok: true, data: DOG_DETAIL });
	vi.mocked(getSignedUrl).mockResolvedValue({
		ok: true,
		data: { signedUrl: 'https://signed/owner-1/dog.webp' }
	});
	vi.mocked(listReactionsForDogs).mockResolvedValue({ ok: true, data: [] });
	// Report action wrappers default to success; individual tests override.
	vi.mocked(reportBurger).mockResolvedValue({ ok: true, data: null });
	vi.mocked(unreportBurger).mockResolvedValue({ ok: true, data: null });
	// No verdict by default: the dog falls through to its decaying report alarm
	// ('alarm'). Verdict-specific tests override with a populated Map.
	vi.mocked(getVerdictsForDogs).mockResolvedValue({ ok: true, data: new Map() });
});

const report_ = actions.report;
const unreport_ = actions.unreport;

/**
 * Builds a fake ACTION event for the report/unreport form actions. `formFields` is
 * appended to FormData so we can pass (or omit) the dog id and probe a hostile
 * client-supplied reporter_id. `rawGetSession` proves the action never reaches for
 * the unvalidated session.
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
	const supabase = { auth: { getSession: rawGetSession } };
	const event = {
		request,
		locals: { supabase, safeGetSession }
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;
	return { event, safeGetSession, rawGetSession, supabase };
}

describe('dog detail load', () => {
	it('reads the session via safeGetSession(), never raw getSession()', async () => {
		const { event, safeGetSession, rawGetSession } = makeLoadEvent({
			session: VALID_SESSION,
			user: VALID_USER
		});

		await loadData(event);

		expect(safeGetSession).toHaveBeenCalledOnce();
		expect(rawGetSession).not.toHaveBeenCalled();
	});

	it('redirects to /sign-in when unauthenticated; never reads the dog', async () => {
		const { event } = makeLoadEvent({ session: null, user: null });

		let thrown: unknown;
		try {
			await load(event);
		} catch (e) {
			thrown = e;
		}

		expect(isRedirect(thrown)).toBe(true);
		expect((thrown as { location: string }).location).toBe('/sign-in');
		expect(getDogDetail).not.toHaveBeenCalled();
	});

	it('fails closed (redirect) when a user is present but the session is null', async () => {
		const { event } = makeLoadEvent({ session: null, user: VALID_USER });

		let thrown: unknown;
		try {
			await load(event);
		} catch (e) {
			thrown = e;
		}

		expect(isRedirect(thrown)).toBe(true);
		expect(getDogDetail).not.toHaveBeenCalled();
	});

	it('reads the dog via the RLS-scoped client + the params id and the trusted session uid', async () => {
		const { event, supabase } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		await loadData(event);

		expect(getDogDetail).toHaveBeenCalledWith(supabase, DOG_ID, USER_ID);
	});

	it('returns the dog stats (peak_votes + vote_count) + owner + a signed URL for a found dog', async () => {
		const { event } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await loadData(event);

		expect(result.dog).toEqual(DOG_DETAIL);
		expect(result.dog.peak_votes).toBe(9);
		expect(result.dog.vote_count).toBe(4);
		expect(result.dog.owner.handle).toBe('sausage_king');
		expect(result.signedUrl).toBe('https://signed/owner-1/dog.webp');
		// The signed URL is minted for the dog's private image path, with the
		// PRIVILEGED SERVICE client — NOT the viewer's RLS-scoped event.locals.supabase.
		// This is the TASK-033 P0 regression guard: the owner-only hotdogs SELECT
		// policy means the viewer's RLS client cannot sign a URL for a dog it doesn't
		// own, so the load must sign with getServiceClient() after the auth gate.
		expect(getServiceClient).toHaveBeenCalled();
		expect(getSignedUrl).toHaveBeenCalledWith(SERVICE_CLIENT, DOG_DETAIL.image_path);
	});

	it('mints the signed URL with the SERVICE client, NOT the RLS-scoped event.locals.supabase (TASK-033 P0 guard)', async () => {
		const { event, supabase } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		await loadData(event);

		// The signer must be the privileged service client. If a regression reverts
		// this to event.locals.supabase, the non-owner viewer gets a failed mint
		// (owner-only hotdogs_select_own) and a null image — the original P0.
		expect(getSignedUrl).toHaveBeenCalledTimes(1);
		const signerArg = vi.mocked(getSignedUrl).mock.calls[0][0];
		expect(signerArg).toBe(SERVICE_CLIENT);
		expect(signerArg).not.toBe(supabase);
		// The DOG READ stays RLS-scoped on event.locals.supabase (unchanged).
		expect(getDogDetail).toHaveBeenCalledWith(supabase, DOG_ID, USER_ID);
	});

	it('throws a 404 (NOT 500) for a malformed non-uuid id, BEFORE reaching the DB read (TASK-033)', async () => {
		// A non-uuid route param would otherwise hit Postgres as a uuid comparison
		// and raise 22P02 → getDogDetail read error → 500. The isUuid() guard maps it
		// to a 404 instead, and getDogDetail is never called.
		vi.mocked(isUuid).mockReturnValue(false);
		const { event } = makeLoadEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			id: 'not-a-real-uuid'
		});

		let thrown: unknown;
		try {
			await load(event);
		} catch (e) {
			thrown = e;
		}

		expect(isHttpError(thrown)).toBe(true);
		expect((thrown as { status: number }).status).toBe(404);
		// The malformed id is rejected at the boundary — the read is never attempted.
		expect(getDogDetail).not.toHaveBeenCalled();
		expect(getSignedUrl).not.toHaveBeenCalled();
		expect(listReactionsForDogs).not.toHaveBeenCalled();
	});

	it('throws a 404 when the dog is not found (DOG_NOT_FOUND sentinel)', async () => {
		vi.mocked(getDogDetail).mockResolvedValue({ ok: false, error: DOG_NOT_FOUND });
		const { event } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		let thrown: unknown;
		try {
			await load(event);
		} catch (e) {
			thrown = e;
		}

		expect(isHttpError(thrown)).toBe(true);
		expect((thrown as { status: number }).status).toBe(404);
		// Nothing further is attempted once the dog is missing.
		expect(getSignedUrl).not.toHaveBeenCalled();
		expect(listReactionsForDogs).not.toHaveBeenCalled();
	});

	it('throws a 500 on a real read error (NOT a 404) without leaking SDK internals', async () => {
		vi.mocked(getDogDetail).mockResolvedValue({
			ok: false,
			error: 'permission denied for table hot_dogs'
		});
		const { event } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		let thrown: unknown;
		try {
			await load(event);
		} catch (e) {
			thrown = e;
		}

		expect(isHttpError(thrown)).toBe(true);
		expect((thrown as { status: number }).status).toBe(500);
		// The raw SDK message is logged server-side, not surfaced in the error body.
		const body = (thrown as { body: { message: string } }).body;
		expect(body.message).not.toMatch(/permission denied/i);
		expect(console.error).toHaveBeenCalled();
	});

	it('degrades a failed signed-URL mint to a null url (no throw, page not blanked)', async () => {
		vi.mocked(getSignedUrl).mockResolvedValue({
			ok: false,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			error: { message: 'sign failed' } as any
		});
		const { event } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await loadData(event);

		expect(result.signedUrl).toBeNull();
		// The dog + its stats still come through; the failure is logged.
		expect(result.dog).toEqual(DOG_DETAIL);
		expect(console.error).toHaveBeenCalled();
	});

	it('attaches the viewer-relative reaction summary aggregated from the dog rows', async () => {
		// 🌭 from the viewer + another member (count 2, reactedByMe true);
		// 🔥 from one other member (count 1, reactedByMe false).
		vi.mocked(listReactionsForDogs).mockResolvedValue({
			ok: true,
			data: [
				{ hot_dog_id: DOG_ID, emoji: '🌭', user_id: USER_ID },
				{ hot_dog_id: DOG_ID, emoji: '🌭', user_id: 'someone-else' },
				{ hot_dog_id: DOG_ID, emoji: '🔥', user_id: 'someone-else' }
			]
		});
		const { event } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await loadData(event);

		expect(listReactionsForDogs).toHaveBeenCalledWith(expect.anything(), [DOG_ID]);
		expect(result.reactions).toEqual([
			{ emoji: '🌭', count: 2, reactedByMe: true },
			{ emoji: '🔥', count: 1, reactedByMe: false }
		]);
	});

	it('degrades to empty reactions (page not blanked) when the reactions read fails', async () => {
		vi.mocked(listReactionsForDogs).mockResolvedValue({ ok: false, error: 'reactions boom' });
		const { event } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await loadData(event);

		expect(result.reactions).toEqual([]);
		// The dog + signed URL are unaffected by a reactions read failure.
		expect(result.dog).toEqual(DOG_DETAIL);
		expect(result.signedUrl).toBe('https://signed/owner-1/dog.webp');
		expect(console.error).toHaveBeenCalled();
	});

	// Burger-alarm wiring (TASK-071, decision #12/#15). The detail load reads the
	// anonymous per-dog aggregate with the SERVICE client (timestamps only — no
	// reporter id), derives the render-time alarm via the REAL summarizeBurgerAlarm,
	// reads the viewer's own report toggle with the RLS client, and flags whether the
	// viewer owns the dog (the report control is hidden on your own dog).
	it('attaches a render-time burger alarm from the SERVICE-client aggregate', async () => {
		const fresh = new Date().toISOString();
		// One fresh anonymous report -> active, low intensity.
		serviceAlarmRows = [{ hot_dog_id: DOG_ID, created_at: fresh }];
		const { event } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await loadData(event);

		expect(getServiceClient).toHaveBeenCalled();
		expect(result.alarm).toEqual({ active: true, reporterCount: 1, intensity: 'low' });
	});

	it('returns an inactive alarm when there are no in-window reports', async () => {
		serviceAlarmRows = [];
		const { event } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await loadData(event);

		expect(result.alarm).toEqual({ active: false, reporterCount: 0, intensity: 'none' });
	});

	it('the alarm aggregate exposes NO reporter ids on the page payload (anonymity)', async () => {
		const REPORTER_ID = '99999999-9999-4999-8999-999999999999';
		serviceAlarmRows = [
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ hot_dog_id: DOG_ID, created_at: new Date().toISOString(), reporter_id: REPORTER_ID } as any
		];
		const { event } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await loadData(event);

		const serialized = JSON.stringify(result);
		expect(serialized).not.toContain(REPORTER_ID);
		expect(serialized).not.toMatch(/reporter_?id/i);
		expect(Object.keys(result.alarm).sort()).toEqual(['active', 'intensity', 'reporterCount']);
	});

	it("surfaces the viewer's own report toggle (iReported) from the RLS client", async () => {
		myReportRows = [{ hot_dog_id: DOG_ID }];
		const { event } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await loadData(event);

		expect(result.iReported).toBe(true);
	});

	it('iReported is false when the viewer has not reported this dog', async () => {
		myReportRows = [];
		const { event } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await loadData(event);

		expect(result.iReported).toBe(false);
	});

	it('flags isOwnDog true when the viewer owns the dog (report control hidden)', async () => {
		vi.mocked(getDogDetail).mockResolvedValue({
			ok: true,
			data: { ...DOG_DETAIL, owner_id: USER_ID }
		});
		const { event } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await loadData(event);

		expect(result.isOwnDog).toBe(true);
	});

	it("flags isOwnDog false for another member's dog", async () => {
		// Default DOG_DETAIL.owner_id is 'owner-1', not the viewer.
		const { event } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await loadData(event);

		expect(result.isOwnDog).toBe(false);
	});

	it('degrades to no alarm (page not blanked) when the alarm aggregate read fails', async () => {
		(SERVICE_CLIENT as { from: ReturnType<typeof vi.fn> }).from.mockReturnValueOnce({
			select: vi.fn().mockReturnValue({
				in: vi.fn().mockResolvedValue({ data: null, error: { message: 'alarm boom' } })
			})
		});
		const { event } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await loadData(event);

		expect(result.alarm).toEqual({ active: false, reporterCount: 0, intensity: 'none' });
		// The dog + signed URL are unaffected.
		expect(result.dog).toEqual(DOG_DETAIL);
		expect(console.error).toHaveBeenCalled();
	});

	// 🍔 Hamburger Court verdict-resolved alarm state (TASK-073). A verdict RESOLVES the
	// render-time alarm: not_a_hamburger SUPPRESSES it ('cleared'); confirmed_hamburger
	// converts it to a persistent CONFIRMED stamp ('confirmed'). No verdict -> the
	// decaying alarm stands ('alarm'). The mapping is the REAL pure dogAlarmState; these
	// cases pin that the load surfaces the verdict-resolved state and degrades on failure.
	it("surfaces 'alarm' alarmState when there is no verdict (default)", async () => {
		const { event } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await loadData(event);

		expect(getVerdictsForDogs).toHaveBeenCalledWith(expect.anything(), [DOG_ID]);
		expect(result.alarmState).toBe('alarm');
	});

	it("surfaces 'cleared' alarmState for a dog ruled not_a_hamburger (alarm suppressed)", async () => {
		// The dog was flagged, then ruled NOT a hamburger -> the alarm is suppressed.
		const fresh = new Date().toISOString();
		serviceAlarmRows = [{ hot_dog_id: DOG_ID, created_at: fresh }];
		vi.mocked(getVerdictsForDogs).mockResolvedValue({
			ok: true,
			data: new Map([[DOG_ID, 'not_a_hamburger']])
		});
		const { event } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await loadData(event);

		expect(result.alarmState).toBe('cleared');
	});

	it("surfaces 'confirmed' alarmState for a dog ruled confirmed_hamburger (persistent stamp)", async () => {
		vi.mocked(getVerdictsForDogs).mockResolvedValue({
			ok: true,
			data: new Map([[DOG_ID, 'confirmed_hamburger']])
		});
		const { event } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await loadData(event);

		expect(result.alarmState).toBe('confirmed');
	});

	it('degrades to plain alarm behavior (alarmState) when the verdict read fails', async () => {
		vi.mocked(getVerdictsForDogs).mockResolvedValue({ ok: false, error: 'verdict read boom' });
		const { event } = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await loadData(event);

		// A verdict-read failure must not blank the page; the alarm falls back to its
		// own decay ('alarm') and the failure is logged.
		expect(result.alarmState).toBe('alarm');
		expect(result.dog).toEqual(DOG_DETAIL);
		expect(console.error).toHaveBeenCalled();
	});
});

// Burger-alarm report actions (TASK-071 — decision #12/#15: cosmetic flair, never
// touches vote_count / ranking / the crown). Same trust model as the feed report
// actions: the reporter is ANONYMOUS and derived from safeGetSession(); the client
// supplies ONLY the dog id (here from the form). A hostile client-supplied
// reporter_id MUST be ignored — the trust anchor is the session uid, never the
// payload. The wrappers run on the RLS-scoped event.locals.supabase; the own-dog
// RLS denial surfaces as CANNOT_REPORT_OWN, which the action passes through as
// friendly copy. Raw Supabase errors are mapped to friendly text by the wrapper,
// so the action never leaks SDK internals.
describe('dog detail report action', () => {
	it('reads the session via safeGetSession(), never raw getSession()', async () => {
		const { event, safeGetSession, rawGetSession } = makeActionEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: DOG_ID }
		});

		await report_(event);

		expect(safeGetSession).toHaveBeenCalledOnce();
		expect(rawGetSession).not.toHaveBeenCalled();
	});

	it('success: calls reportBurger with the SESSION user id + form dog id on event.locals.supabase, returns { reported: true }', async () => {
		const { event, supabase } = makeActionEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: DOG_ID }
		});

		const result = await report_(event);

		expect(reportBurger).toHaveBeenCalledWith(supabase, USER_ID, DOG_ID);
		expect(result).toEqual({ reported: true });
	});

	it('IGNORES a hostile client-supplied reporter_id: the reporter comes from the session, not the form', async () => {
		const { event } = makeActionEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: DOG_ID, reporter_id: 'attacker-uuid' }
		});

		await report_(event);

		// reportBurger(client, reporterId, dogId) — the reporterId is the trusted
		// session uid, NEVER the forged form value, and the forged value reaches no arg.
		const callArgs = vi.mocked(reportBurger).mock.calls[0];
		expect(callArgs[1]).toBe(USER_ID);
		expect(callArgs[1]).not.toBe('attacker-uuid');
		expect(callArgs[2]).toBe(DOG_ID);
		expect(callArgs).not.toContain('attacker-uuid');
	});

	it('rejects a missing dog id with a boundary 400; never calls reportBurger', async () => {
		const { event } = makeActionEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: {}
		});

		const result = await report_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect(reportBurger).not.toHaveBeenCalled();
	});

	it('rejects an empty dog id with a boundary 400; never calls reportBurger', async () => {
		const { event } = makeActionEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: '' }
		});

		const result = await report_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect(reportBurger).not.toHaveBeenCalled();
	});

	it('fails closed with 401 when unauthenticated; never calls reportBurger', async () => {
		const { event } = makeActionEvent({
			session: null,
			user: null,
			formFields: { id: DOG_ID }
		});

		const result = await report_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(401);
		expect(reportBurger).not.toHaveBeenCalled();
	});

	it('fails closed when a user is present but the session is null; never calls reportBurger', async () => {
		const { event } = makeActionEvent({
			session: null,
			user: VALID_USER,
			formFields: { id: DOG_ID }
		});

		const result = await report_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(401);
		expect(reportBurger).not.toHaveBeenCalled();
	});

	it('own-dog denial -> friendly CANNOT_REPORT_OWN fail() (not raw SDK text)', async () => {
		vi.mocked(reportBurger).mockResolvedValue({ ok: false, error: CANNOT_REPORT_OWN });
		const { event } = makeActionEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: DOG_ID }
		});

		const result = await report_(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { error: string } };
		expect(failure.status).toBe(400);
		expect(failure.data.error).toBe(CANNOT_REPORT_OWN);
		expect(failure.data.error).toMatch(/your own hot dog/i);
	});

	it('a wrapper error -> friendly fail() + server-side log (never raw SDK text)', async () => {
		vi.mocked(reportBurger).mockResolvedValue({
			ok: false,
			error: 'Could not report that hot dog right now.'
		});
		const { event } = makeActionEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: DOG_ID }
		});

		const result = await report_(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { error: string } };
		expect(failure.status).toBe(400);
		expect(failure.data.error).not.toMatch(/42501|23505|permission denied/i);
		expect(console.error).toHaveBeenCalled();
	});
});

describe('dog detail unreport action', () => {
	it('reads the session via safeGetSession(), never raw getSession()', async () => {
		const { event, safeGetSession, rawGetSession } = makeActionEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: DOG_ID }
		});

		await unreport_(event);

		expect(safeGetSession).toHaveBeenCalledOnce();
		expect(rawGetSession).not.toHaveBeenCalled();
	});

	it('success: calls unreportBurger with the SESSION user id + form dog id on event.locals.supabase, returns { unreported: true }', async () => {
		const { event, supabase } = makeActionEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: DOG_ID }
		});

		const result = await unreport_(event);

		expect(unreportBurger).toHaveBeenCalledWith(supabase, USER_ID, DOG_ID);
		expect(result).toEqual({ unreported: true });
	});

	it('IGNORES a hostile client-supplied reporter_id: the reporter comes from the session, not the form', async () => {
		const { event } = makeActionEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: DOG_ID, reporter_id: 'attacker-uuid' }
		});

		await unreport_(event);

		const callArgs = vi.mocked(unreportBurger).mock.calls[0];
		expect(callArgs[1]).toBe(USER_ID);
		expect(callArgs[1]).not.toBe('attacker-uuid');
		expect(callArgs[2]).toBe(DOG_ID);
		expect(callArgs).not.toContain('attacker-uuid');
	});

	it('rejects a missing dog id with a boundary 400; never calls unreportBurger', async () => {
		const { event } = makeActionEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: {}
		});

		const result = await unreport_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect(unreportBurger).not.toHaveBeenCalled();
	});

	it('fails closed with 401 when unauthenticated; never calls unreportBurger', async () => {
		const { event } = makeActionEvent({
			session: null,
			user: null,
			formFields: { id: DOG_ID }
		});

		const result = await unreport_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(401);
		expect(unreportBurger).not.toHaveBeenCalled();
	});

	it('a wrapper error -> friendly fail() + server-side log (never raw SDK text)', async () => {
		vi.mocked(unreportBurger).mockResolvedValue({
			ok: false,
			error: 'Could not retract your report right now.'
		});
		const { event } = makeActionEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: DOG_ID }
		});

		const result = await unreport_(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { error: string } };
		expect(failure.status).toBe(400);
		expect(failure.data.error).not.toMatch(/42501|23505|permission denied/i);
		expect(console.error).toHaveBeenCalled();
	});
});
