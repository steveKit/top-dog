import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isActionFailure, isRedirect } from '@sveltejs/kit';

// Test-after coverage for the global vote feed load + form actions (project
// strategy: test-after for form actions / route wiring). The feed is the
// vote-casting surface (TASK-024): it lists OTHER members' dogs, mints a signed
// URL per row with graceful degradation, surfaces the viewer's current vote, and
// wires the castVote / removeVote RPC wrappers into server-side actions gated by
// safeGetSession(). The voter is always derived from auth.uid() inside the RPC —
// the action passes only the trusted target dog id, never a client voter id.
//
// The feed + vote feature modules and the storage signer are dependency-injected
// via their import surface, so we mock them with vi.mock and assert the action's
// orchestration directly:
//   - load: unauth -> redirect /sign-in; auth -> votable dogs + currentVoteDogId;
//     a per-row signed-URL failure degrades that row to null (grid not blanked);
//     a list failure -> empty grid; a current-vote read failure degrades to null.
//   - vote: success forwards the form's target dog id to castVote; the known
//     sentinels map to friendly fail() (never raw SDK text); VOTE_UNAUTHENTICATED
//     / no session -> 401; a missing dog id -> boundary 400; an unrecognized error
//     -> generic friendly message + a server-side log (never raw error text).
//   - remove: success calls removeVote; unauth -> 401; idempotent no-active-vote
//     still succeeds.
//
// The RLS / real-signed-URL / RPC SQLSTATE guarantees remain live-DB coverage
// (the votes/tally Playwright suites), consistent with the tracked test gaps.

vi.mock('$lib/features/voting/feed', () => ({
	listVotableDogs: vi.fn(),
	getCurrentVote: vi.fn()
}));

vi.mock('$lib/features/voting/votes', async () => {
	// Keep the REAL sentinels so the action's mapping is exercised faithfully;
	// only the network-touching wrappers are mocked.
	const actual = await vi.importActual<typeof import('$lib/features/voting/votes')>(
		'$lib/features/voting/votes'
	);
	return {
		...actual,
		castVote: vi.fn(),
		removeVote: vi.fn()
	};
});

vi.mock('$lib/storage', () => ({
	getSignedUrl: vi.fn()
}));

// The per-row signed URLs are minted with the privileged service client (TASK-033
// P0 fix), NOT the viewer's RLS-scoped event.locals.supabase: the feed lists OTHER
// members' dogs, and the owner-only hotdogs SELECT policy means the viewer's RLS
// client can't sign a URL for a dog it doesn't own. We mock getServiceClient to a
// sentinel instance and assert getSignedUrl is called with it — the regression
// guard for the original "non-owner feed images come back null" P0.
vi.mock('$lib/server/supabase', () => ({
	getServiceClient: vi.fn()
}));

// Cosmetic reactions (TASK-030). The load calls listReactionsForDogs(supabase, …)
// and the react/unreact actions call addReaction/removeReaction on the RLS-scoped
// event.locals.supabase. We mock the network-touching wrappers; the pure
// summarizeReactions and isAllowedReactionEmoji stay REAL so the load's
// aggregation and the actions' emoji-boundary validation are exercised faithfully.
vi.mock('$lib/features/reactions/reactions', () => ({
	addReaction: vi.fn(),
	removeReaction: vi.fn(),
	listReactionsForDogs: vi.fn()
}));

// Burger-alarm report wrappers (TASK-071). The report/unreport ACTIONS call
// reportBurger/unreportBurger, so we mock those two to assert the action's
// orchestration (auth gate, dog-id boundary, no client-supplied reporter id,
// friendly fail() mapping). The LOAD path depends on the REAL aggregate wrappers
// (getBurgerAlarmCounts / getMyReportedDogIds) — which run against the faked
// `.from('burger_alarms')` chain — and on the REAL CANNOT_REPORT_OWN sentinel so
// the action's own-dog mapping is exercised faithfully. So we partial-mock: keep
// everything real except the two network-touching action wrappers.
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

// 🍔 Hamburger Court verdicts (TASK-073). The feed load reads per-dog verdicts via
// getVerdictsForDogs on the RLS-scoped client and resolves each dog's render-time
// alarm state through the REAL pure dogAlarmState (kept real so the verdict ->
// alarm-state mapping is exercised faithfully). Only the network-touching wrapper is
// mocked; the load degrades to "no verdict" (plain decaying alarm) when it fails.
vi.mock('$lib/features/reports/verdictStore', () => ({
	getVerdictsForDogs: vi.fn()
}));

import { actions, load } from './+page.server';
import { listVotableDogs, getCurrentVote } from '$lib/features/voting/feed';
import {
	castVote,
	removeVote,
	VOTE_SELF,
	VOTE_NO_SUCH_DOG,
	VOTE_UNAUTHENTICATED
} from '$lib/features/voting/votes';
import { getSignedUrl } from '$lib/storage';
import { getServiceClient } from '$lib/server/supabase';
import {
	addReaction,
	removeReaction,
	listReactionsForDogs
} from '$lib/features/reactions/reactions';
import { reportBurger, unreportBurger, CANNOT_REPORT_OWN } from '$lib/features/reports/reports';
import { getVerdictsForDogs } from '$lib/features/reports/verdictStore';

// The feed load now reads the anonymous per-dog burger-alarm aggregate with the
// SERVICE client (getBurgerAlarmCounts: `.from('burger_alarms').select('hot_dog_id,
// created_at').in('hot_dog_id', …)`) and the viewer's own reported-dog set with the
// RLS client (getMyReportedDogIds: `.from('burger_alarms').select('hot_dog_id')
// .in('hot_dog_id', …)`). These are the REAL reports wrappers — only the underlying
// SupabaseClient query builder is faked (per-table branch below) — so the
// anonymity-preserving aggregate (timestamps only, NEVER reporter ids) and the
// render-time alarm summary are exercised faithfully through the load.

/**
 * A fake `.from('burger_alarms').select(cols).in(col, ids)` chain that resolves the
 * given rows. Used to back both the service-client aggregate read and the RLS-client
 * own-reports read on the sentinel clients below.
 */
function burgerAlarmsFrom(rows: Record<string, unknown>[]) {
	const inFn = vi.fn().mockResolvedValue({ data: rows, error: null });
	const select = vi.fn().mockReturnValue({ in: inFn });
	return { select };
}

// Mutable per-test report fixtures, reset in beforeEach. `serviceAlarmRows` backs
// the anonymous aggregate read (hot_dog_id + created_at, no reporter id);
// `myReportRows` backs the viewer's own-reported-dog set on the RLS client.
let serviceAlarmRows: { hot_dog_id: string; created_at: string }[] = [];
let myReportRows: { hot_dog_id: string }[] = [];

/**
 * Sentinel service-client instance — distinct from event.locals.supabase. Its only
 * method is `.from('burger_alarms')` (the anonymous aggregate read); getSignedUrl is
 * mocked, so it never needs storage methods.
 */
const SERVICE_CLIENT = {
	__brand: 'service-client',
	from: vi.fn((table: string) => {
		if (table === 'burger_alarms') return burgerAlarmsFrom(serviceAlarmRows);
		throw new Error(`unexpected service-client table: ${table}`);
	})
} as unknown;

const vote_ = actions.vote;
const remove_ = actions.remove;
const react_ = actions.react;
const unreact_ = actions.unreact;
const report_ = actions.report;
const unreport_ = actions.unreport;

const USER_ID = '11111111-1111-4111-8111-111111111111';
const VALID_USER = { id: USER_ID, email: 'chef@topdog.test' };
const VALID_SESSION = { access_token: 'valid', user: VALID_USER };

function aDog(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: 'dog-a',
		owner_id: 'owner-a',
		image_path: 'owner-a/dog-a.webp',
		caption: 'frank',
		vote_count: 3,
		// peak_votes is selected/mapped by listVotableDogs (TASK-031) and carried
		// through the load onto each tile; the fixture supplies a value >= vote_count.
		peak_votes: 7,
		owner_handle: 'sausage_king',
		owner_display_name: 'Sausage King',
		...overrides
	};
}

/**
 * Builds a fake action event. `formFields` is appended to FormData so we can pass
 * (or omit) the target dog id. `rawGetSession` is exposed to prove the action
 * never reaches for the unvalidated session.
 */
function makeEvent(opts: { session: unknown; user: unknown; formFields?: Record<string, string> }) {
	const form = new FormData();
	for (const [k, v] of Object.entries(opts.formFields ?? {})) {
		form.append(k, v);
	}
	const request = { formData: vi.fn(async () => form) };
	const safeGetSession = vi.fn(async () => ({ session: opts.session, user: opts.user }));
	const rawGetSession = vi.fn(async () => ({ data: { session: null }, error: null }));

	const event = {
		request,
		locals: {
			supabase: { auth: { getSession: rawGetSession } },
			safeGetSession
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;

	return { event, safeGetSession, rawGetSession };
}

function makeLoadEvent(opts: { session: unknown; user: unknown }) {
	const safeGetSession = vi.fn(async () => ({ session: opts.session, user: opts.user }));
	// A branded RLS client so the signer-identity assertion can prove getSignedUrl
	// is NOT called with event.locals.supabase. It carries a `burger_alarms` branch
	// for getMyReportedDogIds — the viewer's own-reported set runs on THIS RLS client
	// (the owner-scoped SELECT policy means it can only ever return the viewer's rows).
	return {
		locals: {
			supabase: {
				__brand: 'rls-client',
				from: vi.fn((table: string) => {
					if (table === 'burger_alarms') return burgerAlarmsFrom(myReportRows);
					throw new Error(`unexpected rls-client table: ${table}`);
				})
			},
			safeGetSession
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;
}

type ReactionSummary = { emoji: string; count: number; reactedByMe: boolean };
type AlarmSummary = { active: boolean; reporterCount: number; intensity: string };
type LoadData = {
	dogs: {
		id: string;
		peak_votes: number;
		signedUrl: string | null;
		reactions: ReactionSummary[];
		alarm: AlarmSummary;
		alarmState: 'alarm' | 'cleared' | 'confirmed';
		iReported: boolean;
	}[];
	currentVoteDogId: string | null;
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
	// Default: no burger reports (no alarm, nothing reported by the viewer).
	serviceAlarmRows = [];
	myReportRows = [];
	// Default happy-path stubs; individual tests override as needed.
	vi.mocked(listVotableDogs).mockResolvedValue({ ok: true, data: [] });
	vi.mocked(getCurrentVote).mockResolvedValue({ ok: true, data: null });
	vi.mocked(getSignedUrl).mockResolvedValue({
		ok: true,
		data: { signedUrl: 'https://signed/x' }
	});
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	vi.mocked(getServiceClient).mockReturnValue(SERVICE_CLIENT as any);
	vi.mocked(castVote).mockResolvedValue({ ok: true, data: 'vote-1' });
	vi.mocked(removeVote).mockResolvedValue({ ok: true, data: 'dog-a' });
	// Reactions default to "none"; individual tests override as needed.
	vi.mocked(listReactionsForDogs).mockResolvedValue({ ok: true, data: [] });
	vi.mocked(addReaction).mockResolvedValue({ ok: true, data: null });
	vi.mocked(removeReaction).mockResolvedValue({ ok: true, data: null });
	// Report action wrappers default to success; individual tests override.
	vi.mocked(reportBurger).mockResolvedValue({ ok: true, data: null });
	vi.mocked(unreportBurger).mockResolvedValue({ ok: true, data: null });
	// No verdicts by default: every dog falls through to its decaying report alarm
	// ('alarm'). Verdict-specific tests override with a populated Map.
	vi.mocked(getVerdictsForDogs).mockResolvedValue({ ok: true, data: new Map() });
});

describe('feed load', () => {
	it('reads the session via safeGetSession()', async () => {
		const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		await loadData(event);

		expect(event.locals.safeGetSession).toHaveBeenCalledOnce();
	});

	it('redirects to /sign-in when unauthenticated', async () => {
		const event = makeLoadEvent({ session: null, user: null });

		let thrown: unknown;
		try {
			await load(event);
		} catch (e) {
			thrown = e;
		}

		expect(isRedirect(thrown)).toBe(true);
		expect((thrown as { location: string }).location).toBe('/sign-in');
	});

	it('returns votable dogs (with signed URLs) scoped to the trusted user id', async () => {
		const dogA = aDog();
		const dogB = aDog({ id: 'dog-b', image_path: 'owner-b/dog-b.webp' });
		vi.mocked(listVotableDogs).mockResolvedValue({ ok: true, data: [dogA, dogB] });
		vi.mocked(getSignedUrl).mockImplementation(async (_c, path) => ({
			ok: true,
			data: { signedUrl: `https://signed/${path}` }
		}));

		const result = await loadData(makeLoadEvent({ session: VALID_SESSION, user: VALID_USER }));

		expect(listVotableDogs).toHaveBeenCalledWith(expect.anything(), USER_ID);
		const INACTIVE_ALARM = { active: false, reporterCount: 0, intensity: 'none' };
		expect(result.dogs).toEqual([
			{
				...dogA,
				signedUrl: `https://signed/${dogA.image_path}`,
				reactions: [],
				alarm: INACTIVE_ALARM,
				alarmState: 'alarm',
				iReported: false
			},
			{
				...dogB,
				signedUrl: `https://signed/${dogB.image_path}`,
				reactions: [],
				alarm: INACTIVE_ALARM,
				alarmState: 'alarm',
				iReported: false
			}
		]);
		// peak_votes (TASK-031) is carried through onto each tile for the per-tile
		// peak indicator — the load must not drop it.
		expect(result.dogs[0].peak_votes).toBe(dogA.peak_votes);
		expect(result.dogs[1].peak_votes).toBe(dogB.peak_votes);
	});

	it('surfaces the viewer current vote as currentVoteDogId', async () => {
		vi.mocked(listVotableDogs).mockResolvedValue({ ok: true, data: [aDog()] });
		vi.mocked(getCurrentVote).mockResolvedValue({ ok: true, data: 'dog-a' });

		const result = await loadData(makeLoadEvent({ session: VALID_SESSION, user: VALID_USER }));

		expect(getCurrentVote).toHaveBeenCalledWith(expect.anything(), USER_ID);
		expect(result.currentVoteDogId).toBe('dog-a');
	});

	it('degrades a failed per-row signed URL to null without blanking the grid', async () => {
		const dogA = aDog();
		const dogB = aDog({ id: 'dog-b', image_path: 'owner-b/dog-b.webp' });
		vi.mocked(listVotableDogs).mockResolvedValue({ ok: true, data: [dogA, dogB] });
		vi.mocked(getSignedUrl).mockImplementation(async (_c, path) => {
			if (path === dogA.image_path) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				return { ok: false, error: { message: 'sign failed' } as any };
			}
			return { ok: true, data: { signedUrl: `https://signed/${path}` } };
		});

		const result = await loadData(makeLoadEvent({ session: VALID_SESSION, user: VALID_USER }));

		expect(result.dogs[0].signedUrl).toBeNull();
		expect(result.dogs[1].signedUrl).toBe(`https://signed/${dogB.image_path}`);
	});

	it('mints each signed URL with the SERVICE client, NOT the RLS-scoped event.locals.supabase (TASK-033 P0 guard)', async () => {
		const dogA = aDog();
		const dogB = aDog({ id: 'dog-b', image_path: 'owner-b/dog-b.webp' });
		vi.mocked(listVotableDogs).mockResolvedValue({ ok: true, data: [dogA, dogB] });
		const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		await loadData(event);

		// The feed shows OTHER members' dogs; the owner-only hotdogs_select_own policy
		// means the viewer's RLS client can't sign a URL for a dog it doesn't own. If a
		// regression reverts the signer to event.locals.supabase, non-owner images come
		// back null — the original P0. The service client is constructed once and used
		// for EVERY row.
		expect(getServiceClient).toHaveBeenCalled();
		expect(getSignedUrl).toHaveBeenCalledTimes(2);
		for (const call of vi.mocked(getSignedUrl).mock.calls) {
			expect(call[0]).toBe(SERVICE_CLIENT);
			expect(call[0]).not.toBe(event.locals.supabase);
		}
		// The dog/owner/reaction QUERIES stay RLS-scoped on event.locals.supabase.
		expect(listVotableDogs).toHaveBeenCalledWith(event.locals.supabase, USER_ID);
	});

	it('returns an empty grid (no crash) when the list query fails', async () => {
		vi.mocked(listVotableDogs).mockResolvedValue({ ok: false, error: 'list boom' });

		const result = await loadData(makeLoadEvent({ session: VALID_SESSION, user: VALID_USER }));

		expect(result.dogs).toEqual([]);
		expect(result.currentVoteDogId).toBeNull();
		// No dogs -> nothing to sign.
		expect(getSignedUrl).not.toHaveBeenCalled();
	});

	it('degrades gracefully (currentVoteDogId null) when the current-vote read fails', async () => {
		vi.mocked(listVotableDogs).mockResolvedValue({ ok: true, data: [aDog()] });
		vi.mocked(getCurrentVote).mockResolvedValue({ ok: false, error: 'vote read boom' });

		const result = await loadData(makeLoadEvent({ session: VALID_SESSION, user: VALID_USER }));

		expect(result.currentVoteDogId).toBeNull();
		// The grid is unaffected by a current-vote read failure.
		expect(result.dogs.length).toBe(1);
	});

	it('attaches per-dog reaction summaries (viewer-relative) aggregated from the listed rows', async () => {
		const dogA = aDog();
		const dogB = aDog({ id: 'dog-b', image_path: 'owner-b/dog-b.webp' });
		vi.mocked(listVotableDogs).mockResolvedValue({ ok: true, data: [dogA, dogB] });
		// dog-a: 🌭 from the viewer + another member (count 2, reactedByMe true);
		// dog-b: 🔥 from one other member (count 1, reactedByMe false).
		vi.mocked(listReactionsForDogs).mockResolvedValue({
			ok: true,
			data: [
				{ hot_dog_id: 'dog-a', emoji: '🌭', user_id: USER_ID },
				{ hot_dog_id: 'dog-a', emoji: '🌭', user_id: 'someone-else' },
				{ hot_dog_id: 'dog-b', emoji: '🔥', user_id: 'someone-else' }
			]
		});

		const result = await loadData(makeLoadEvent({ session: VALID_SESSION, user: VALID_USER }));

		expect(listReactionsForDogs).toHaveBeenCalledWith(expect.anything(), ['dog-a', 'dog-b']);
		expect(result.dogs[0].reactions).toEqual([{ emoji: '🌭', count: 2, reactedByMe: true }]);
		expect(result.dogs[1].reactions).toEqual([{ emoji: '🔥', count: 1, reactedByMe: false }]);
	});

	it('degrades to empty per-dog reactions (grid not blanked) when the reactions read fails', async () => {
		vi.mocked(listVotableDogs).mockResolvedValue({ ok: true, data: [aDog()] });
		vi.mocked(listReactionsForDogs).mockResolvedValue({ ok: false, error: 'reactions boom' });

		const result = await loadData(makeLoadEvent({ session: VALID_SESSION, user: VALID_USER }));

		expect(result.dogs).toHaveLength(1);
		expect(result.dogs[0].reactions).toEqual([]);
		// The grid (and its signed URL) is unaffected by a reactions read failure.
		expect(result.dogs[0].signedUrl).toBe('https://signed/x');
		expect(console.error).toHaveBeenCalled();
	});

	// Burger-alarm wiring (TASK-071, decision #12/#15). The anonymous per-dog
	// aggregate is read with the SERVICE client; the render-time alarm is derived by
	// the REAL summarizeBurgerAlarm; the viewer's own report set comes from the RLS
	// client. The page payload must carry ONLY the alarm summary + the viewer's own
	// toggle bit — NEVER reporter ids.
	it('attaches a render-time burger alarm derived from the SERVICE-client aggregate', async () => {
		const dogA = aDog();
		const dogB = aDog({ id: 'dog-b', image_path: 'owner-b/dog-b.webp' });
		vi.mocked(listVotableDogs).mockResolvedValue({ ok: true, data: [dogA, dogB] });
		const fresh = new Date().toISOString();
		// dog-a flagged by two fresh anonymous reporters (medium); dog-b not flagged.
		serviceAlarmRows = [
			{ hot_dog_id: 'dog-a', created_at: fresh },
			{ hot_dog_id: 'dog-a', created_at: fresh }
		];

		const result = await loadData(makeLoadEvent({ session: VALID_SESSION, user: VALID_USER }));

		expect(getServiceClient).toHaveBeenCalled();
		expect(result.dogs[0].alarm).toEqual({ active: true, reporterCount: 2, intensity: 'medium' });
		expect(result.dogs[1].alarm).toEqual({ active: false, reporterCount: 0, intensity: 'none' });
	});

	it('the alarm aggregate carries NO reporter ids onto the page payload (anonymity)', async () => {
		const dogA = aDog();
		vi.mocked(listVotableDogs).mockResolvedValue({ ok: true, data: [dogA] });
		// The aggregate query selects only (hot_dog_id, created_at) — never reporter_id.
		// If a regression widened the SELECT, this fixture's reporter id would surface.
		const REPORTER_ID = '99999999-9999-4999-8999-999999999999';
		serviceAlarmRows = [
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ hot_dog_id: 'dog-a', created_at: new Date().toISOString(), reporter_id: REPORTER_ID } as any
		];

		const result = await loadData(makeLoadEvent({ session: VALID_SESSION, user: VALID_USER }));

		// The alarm summary is the ONLY report-derived data on the tile — counts and
		// activity, never WHO reported. The render-time summarizer keeps only counts,
		// so no reporter id (key or value) can reach the page payload.
		const serialized = JSON.stringify(result);
		expect(serialized).not.toContain(REPORTER_ID);
		expect(serialized).not.toMatch(/reporter_?id/i);
		expect(Object.keys(result.dogs[0].alarm).sort()).toEqual([
			'active',
			'intensity',
			'reporterCount'
		]);
	});

	it("surfaces the viewer's own report toggle (iReported) from the RLS client", async () => {
		const dogA = aDog();
		const dogB = aDog({ id: 'dog-b', image_path: 'owner-b/dog-b.webp' });
		vi.mocked(listVotableDogs).mockResolvedValue({ ok: true, data: [dogA, dogB] });
		// The viewer has reported dog-a but not dog-b.
		myReportRows = [{ hot_dog_id: 'dog-a' }];

		const result = await loadData(makeLoadEvent({ session: VALID_SESSION, user: VALID_USER }));

		expect(result.dogs[0].iReported).toBe(true);
		expect(result.dogs[1].iReported).toBe(false);
	});

	it('degrades to no alarm (grid not blanked) when the alarm aggregate read fails', async () => {
		const dogA = aDog();
		vi.mocked(listVotableDogs).mockResolvedValue({ ok: true, data: [dogA] });
		// Force getBurgerAlarmCounts to return an error result by failing the query.
		(SERVICE_CLIENT as { from: ReturnType<typeof vi.fn> }).from.mockReturnValueOnce({
			select: vi.fn().mockReturnValue({
				in: vi.fn().mockResolvedValue({ data: null, error: { message: 'alarm boom' } })
			})
		});

		const result = await loadData(makeLoadEvent({ session: VALID_SESSION, user: VALID_USER }));

		expect(result.dogs).toHaveLength(1);
		expect(result.dogs[0].alarm).toEqual({ active: false, reporterCount: 0, intensity: 'none' });
		// The grid + signed URL are unaffected by an alarm read failure.
		expect(result.dogs[0].signedUrl).toBe('https://signed/x');
		expect(console.error).toHaveBeenCalled();
	});

	// 🍔 Hamburger Court verdict-resolved alarm state (TASK-073). A verdict RESOLVES
	// the render-time alarm: a not_a_hamburger verdict SUPPRESSES it ('cleared'); a
	// confirmed_hamburger verdict converts it to a persistent CONFIRMED stamp
	// ('confirmed'). With no verdict the alarm stands ('alarm'). The mapping itself is
	// the REAL pure dogAlarmState — these cases pin that the load surfaces the
	// verdict-resolved state per dog, and degrades to plain 'alarm' when the read fails.
	it("surfaces 'cleared' alarmState for a dog the Top Dog ruled not_a_hamburger", async () => {
		const dogA = aDog();
		const dogB = aDog({ id: 'dog-b', image_path: 'owner-b/dog-b.webp' });
		vi.mocked(listVotableDogs).mockResolvedValue({ ok: true, data: [dogA, dogB] });
		// dog-a was flagged and then ruled NOT a hamburger -> the alarm is suppressed.
		const fresh = new Date().toISOString();
		serviceAlarmRows = [{ hot_dog_id: 'dog-a', created_at: fresh }];
		vi.mocked(getVerdictsForDogs).mockResolvedValue({
			ok: true,
			data: new Map([['dog-a', 'not_a_hamburger']])
		});

		const result = await loadData(makeLoadEvent({ session: VALID_SESSION, user: VALID_USER }));

		expect(getVerdictsForDogs).toHaveBeenCalledWith(expect.anything(), ['dog-a', 'dog-b']);
		expect(result.dogs[0].alarmState).toBe('cleared');
		// dog-b carries no verdict -> the plain decaying alarm stands.
		expect(result.dogs[1].alarmState).toBe('alarm');
	});

	it("surfaces 'confirmed' alarmState for a dog the Top Dog ruled confirmed_hamburger", async () => {
		const dogA = aDog();
		vi.mocked(listVotableDogs).mockResolvedValue({ ok: true, data: [dogA] });
		vi.mocked(getVerdictsForDogs).mockResolvedValue({
			ok: true,
			data: new Map([['dog-a', 'confirmed_hamburger']])
		});

		const result = await loadData(makeLoadEvent({ session: VALID_SESSION, user: VALID_USER }));

		expect(result.dogs[0].alarmState).toBe('confirmed');
	});

	it('degrades to plain alarm behavior (alarmState) when the verdict read fails', async () => {
		const dogA = aDog();
		vi.mocked(listVotableDogs).mockResolvedValue({ ok: true, data: [dogA] });
		vi.mocked(getVerdictsForDogs).mockResolvedValue({ ok: false, error: 'verdict read boom' });

		const result = await loadData(makeLoadEvent({ session: VALID_SESSION, user: VALID_USER }));

		// A verdict-read failure must not blank the grid; the dog falls back to the
		// plain decaying-alarm state and the failure is logged.
		expect(result.dogs).toHaveLength(1);
		expect(result.dogs[0].alarmState).toBe('alarm');
		expect(result.dogs[0].signedUrl).toBe('https://signed/x');
		expect(console.error).toHaveBeenCalled();
	});
});

describe('feed vote action', () => {
	it('reads the session via safeGetSession(), never raw getSession()', async () => {
		const { event, safeGetSession, rawGetSession } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'dog-target' }
		});

		await vote_(event);

		expect(safeGetSession).toHaveBeenCalledOnce();
		expect(rawGetSession).not.toHaveBeenCalled();
	});

	it('success: calls castVote with the form target dog id and returns { voted: true }', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'dog-target' }
		});

		const result = await vote_(event);

		expect(castVote).toHaveBeenCalledWith(expect.anything(), 'dog-target');
		expect(result).toEqual({ voted: true });
	});

	it('does NOT pass a client-supplied voter id through to castVote', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'dog-target', voter_id: 'attacker-uuid' }
		});

		await vote_(event);

		// castVote is called with (client, targetDogId) only — no voter id.
		const callArgs = vi.mocked(castVote).mock.calls[0];
		expect(callArgs[1]).toBe('dog-target');
		expect(callArgs).toHaveLength(2);
	});

	it('fails closed with 401 when unauthenticated; never calls castVote', async () => {
		const { event } = makeEvent({
			session: null,
			user: null,
			formFields: { id: 'dog-target' }
		});

		const result = await vote_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(401);
		expect(castVote).not.toHaveBeenCalled();
	});

	it('fails closed when a user is present but the session is null', async () => {
		const { event } = makeEvent({
			session: null,
			user: VALID_USER,
			formFields: { id: 'dog-target' }
		});

		const result = await vote_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(401);
		expect(castVote).not.toHaveBeenCalled();
	});

	it('rejects a missing dog id with a boundary 400; never calls castVote', async () => {
		const { event } = makeEvent({ session: VALID_SESSION, user: VALID_USER, formFields: {} });

		const result = await vote_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect(castVote).not.toHaveBeenCalled();
	});

	it('VOTE_SELF -> friendly fail() (not raw sentinel text)', async () => {
		vi.mocked(castVote).mockResolvedValue({ ok: false, error: VOTE_SELF });
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'my-own-dog' }
		});

		const result = await vote_(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { error: string } };
		expect(failure.data.error).toMatch(/your own hot dog/i);
		// The raw sentinel constant is never surfaced to the user.
		expect(failure.data.error).not.toContain(VOTE_SELF);
	});

	it('VOTE_NO_SUCH_DOG -> friendly fail() (not raw sentinel text)', async () => {
		vi.mocked(castVote).mockResolvedValue({ ok: false, error: VOTE_NO_SUCH_DOG });
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'ghost-dog' }
		});

		const result = await vote_(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { error: string } };
		expect(failure.data.error).toMatch(/no longer exists/i);
		expect(failure.data.error).not.toContain(VOTE_NO_SUCH_DOG);
	});

	it('VOTE_UNAUTHENTICATED from the RPC -> 401 friendly fail()', async () => {
		vi.mocked(castVote).mockResolvedValue({ ok: false, error: VOTE_UNAUTHENTICATED });
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'dog-target' }
		});

		const result = await vote_(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { error: string } };
		expect(failure.status).toBe(401);
		expect(failure.data.error).toMatch(/signed in/i);
		expect(failure.data.error).not.toContain(VOTE_UNAUTHENTICATED);
	});

	it('an unrecognized Supabase error -> generic friendly message + server-side log (no raw text)', async () => {
		vi.mocked(castVote).mockResolvedValue({ ok: false, error: 'relation votes does not exist' });
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'dog-target' }
		});

		const result = await vote_(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { error: string } };
		// Generic friendly copy — never the raw SDK text.
		expect(failure.data.error).not.toMatch(/relation votes does not exist/i);
		expect(failure.data.error).toMatch(/try again/i);
		// The raw error is logged server-side for debugging.
		expect(console.error).toHaveBeenCalled();
	});
});

describe('feed remove action', () => {
	it('reads the session via safeGetSession(), never raw getSession()', async () => {
		const { event, safeGetSession, rawGetSession } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER
		});

		await remove_(event);

		expect(safeGetSession).toHaveBeenCalledOnce();
		expect(rawGetSession).not.toHaveBeenCalled();
	});

	it('success: calls removeVote and returns { removed: true }', async () => {
		const { event } = makeEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await remove_(event);

		expect(removeVote).toHaveBeenCalledWith(expect.anything());
		expect(result).toEqual({ removed: true });
	});

	it('idempotent: a no-active-vote removal (data: null) still succeeds', async () => {
		vi.mocked(removeVote).mockResolvedValue({ ok: true, data: null });
		const { event } = makeEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await remove_(event);

		expect(result).toEqual({ removed: true });
	});

	it('fails closed with 401 when unauthenticated; never calls removeVote', async () => {
		const { event } = makeEvent({ session: null, user: null });

		const result = await remove_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(401);
		expect(removeVote).not.toHaveBeenCalled();
	});

	it('an unrecognized Supabase error -> generic friendly message + server-side log', async () => {
		vi.mocked(removeVote).mockResolvedValue({ ok: false, error: 'permission denied' });
		const { event } = makeEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await remove_(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { data: { error: string } };
		expect(failure.data.error).not.toMatch(/permission denied/i);
		expect(failure.data.error).toMatch(/try again/i);
		expect(console.error).toHaveBeenCalled();
	});
});

// Cosmetic reaction actions (TASK-030 — decision #12: flair only, never touches
// vote_count / ranking / the crown). The reacting user is derived from
// safeGetSession() and passed to the wrapper; the client supplies ONLY the dog id
// + emoji. The emoji is validated against the allowed set BEFORE any DB write, and
// a hostile client-supplied user_id in the form MUST be ignored (the trust anchor
// is the session uid, not the payload). The wrappers run on the RLS-scoped
// event.locals.supabase.
const ALLOWED_EMOJI = '🌭';
const DISALLOWED_EMOJI = '💩';

describe('feed react action', () => {
	it('reads the session via safeGetSession(), never raw getSession()', async () => {
		const { event, safeGetSession, rawGetSession } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'dog-target', emoji: ALLOWED_EMOJI }
		});

		await react_(event);

		expect(safeGetSession).toHaveBeenCalledOnce();
		expect(rawGetSession).not.toHaveBeenCalled();
	});

	it('success: calls addReaction with the SESSION user id, dog id, emoji, on event.locals.supabase', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'dog-target', emoji: ALLOWED_EMOJI }
		});

		const result = await react_(event);

		expect(addReaction).toHaveBeenCalledWith(
			event.locals.supabase,
			USER_ID,
			'dog-target',
			ALLOWED_EMOJI
		);
		expect(result).toEqual({ reacted: true });
	});

	it('IGNORES a hostile client-supplied user_id: the viewer id comes from the session, not the form', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'dog-target', emoji: ALLOWED_EMOJI, user_id: 'attacker-uuid' }
		});

		await react_(event);

		// addReaction(client, viewerId, dogId, emoji) — the viewerId is the trusted
		// session uid, NEVER the forged form value.
		const callArgs = vi.mocked(addReaction).mock.calls[0];
		expect(callArgs[1]).toBe(USER_ID);
		expect(callArgs[1]).not.toBe('attacker-uuid');
	});

	it('rejects a disallowed emoji with a boundary 400; never calls addReaction', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'dog-target', emoji: DISALLOWED_EMOJI }
		});

		const result = await react_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect(addReaction).not.toHaveBeenCalled();
	});

	it('rejects a missing dog id with a boundary 400; never calls addReaction', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { emoji: ALLOWED_EMOJI }
		});

		const result = await react_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect(addReaction).not.toHaveBeenCalled();
	});

	it('fails closed with 401 when unauthenticated; never calls addReaction', async () => {
		const { event } = makeEvent({
			session: null,
			user: null,
			formFields: { id: 'dog-target', emoji: ALLOWED_EMOJI }
		});

		const result = await react_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(401);
		expect(addReaction).not.toHaveBeenCalled();
	});

	it('a wrapper failure -> friendly fail() + server-side log', async () => {
		vi.mocked(addReaction).mockResolvedValue({
			ok: false,
			error: 'Could not add your reaction right now.'
		});
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'dog-target', emoji: ALLOWED_EMOJI }
		});

		const result = await react_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect(console.error).toHaveBeenCalled();
	});
});

describe('feed unreact action', () => {
	it('reads the session via safeGetSession(), never raw getSession()', async () => {
		const { event, safeGetSession, rawGetSession } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'dog-target', emoji: ALLOWED_EMOJI }
		});

		await unreact_(event);

		expect(safeGetSession).toHaveBeenCalledOnce();
		expect(rawGetSession).not.toHaveBeenCalled();
	});

	it('success: calls removeReaction with the SESSION user id, dog id, emoji, on event.locals.supabase', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'dog-target', emoji: ALLOWED_EMOJI }
		});

		const result = await unreact_(event);

		expect(removeReaction).toHaveBeenCalledWith(
			event.locals.supabase,
			USER_ID,
			'dog-target',
			ALLOWED_EMOJI
		);
		expect(result).toEqual({ unreacted: true });
	});

	it('IGNORES a hostile client-supplied user_id: the viewer id comes from the session, not the form', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'dog-target', emoji: ALLOWED_EMOJI, user_id: 'attacker-uuid' }
		});

		await unreact_(event);

		const callArgs = vi.mocked(removeReaction).mock.calls[0];
		expect(callArgs[1]).toBe(USER_ID);
		expect(callArgs[1]).not.toBe('attacker-uuid');
	});

	it('rejects a disallowed emoji with a boundary 400; never calls removeReaction', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'dog-target', emoji: DISALLOWED_EMOJI }
		});

		const result = await unreact_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect(removeReaction).not.toHaveBeenCalled();
	});

	it('fails closed with 401 when unauthenticated; never calls removeReaction', async () => {
		const { event } = makeEvent({
			session: null,
			user: null,
			formFields: { id: 'dog-target', emoji: ALLOWED_EMOJI }
		});

		const result = await unreact_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(401);
		expect(removeReaction).not.toHaveBeenCalled();
	});
});

// Burger-alarm report actions (TASK-071 — decision #12/#15: cosmetic flair, never
// touches vote_count / ranking / the crown). The reporter is ANONYMOUS and derived
// from safeGetSession(); the client supplies ONLY the dog id. A hostile client-
// supplied reporter_id in the form MUST be ignored — the trust anchor is the
// session uid, never the payload (this is the anonymity / no-forge anchor). The
// wrappers run on the RLS-scoped event.locals.supabase; the own-dog RLS denial
// surfaces as the CANNOT_REPORT_OWN sentinel, which the action passes through as
// friendly copy. Raw Supabase errors are mapped to a friendly message by the
// wrapper, so the action never leaks SDK text.
describe('feed report action', () => {
	it('reads the session via safeGetSession(), never raw getSession()', async () => {
		const { event, safeGetSession, rawGetSession } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'dog-target' }
		});

		await report_(event);

		expect(safeGetSession).toHaveBeenCalledOnce();
		expect(rawGetSession).not.toHaveBeenCalled();
	});

	it('success: calls reportBurger with the SESSION user id + form dog id on event.locals.supabase, returns { reported: true }', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'dog-target' }
		});

		const result = await report_(event);

		expect(reportBurger).toHaveBeenCalledWith(event.locals.supabase, USER_ID, 'dog-target');
		expect(result).toEqual({ reported: true });
	});

	it('IGNORES a hostile client-supplied reporter_id: the reporter comes from the session, not the form', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'dog-target', reporter_id: 'attacker-uuid' }
		});

		await report_(event);

		// reportBurger(client, reporterId, dogId) — the reporterId is the trusted
		// session uid, NEVER the forged form value, and the forged value reaches no arg.
		const callArgs = vi.mocked(reportBurger).mock.calls[0];
		expect(callArgs[1]).toBe(USER_ID);
		expect(callArgs[1]).not.toBe('attacker-uuid');
		expect(callArgs[2]).toBe('dog-target');
		expect(callArgs).not.toContain('attacker-uuid');
	});

	it('rejects a missing dog id with a boundary 400; never calls reportBurger', async () => {
		const { event } = makeEvent({ session: VALID_SESSION, user: VALID_USER, formFields: {} });

		const result = await report_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect(reportBurger).not.toHaveBeenCalled();
	});

	it('rejects an empty dog id with a boundary 400; never calls reportBurger', async () => {
		const { event } = makeEvent({
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
		const { event } = makeEvent({
			session: null,
			user: null,
			formFields: { id: 'dog-target' }
		});

		const result = await report_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(401);
		expect(reportBurger).not.toHaveBeenCalled();
	});

	it('fails closed when a user is present but the session is null; never calls reportBurger', async () => {
		const { event } = makeEvent({
			session: null,
			user: VALID_USER,
			formFields: { id: 'dog-target' }
		});

		const result = await report_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(401);
		expect(reportBurger).not.toHaveBeenCalled();
	});

	it('own-dog denial -> friendly CANNOT_REPORT_OWN fail() (not raw SDK text)', async () => {
		vi.mocked(reportBurger).mockResolvedValue({ ok: false, error: CANNOT_REPORT_OWN });
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'my-own-dog' }
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
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'dog-target' }
		});

		const result = await report_(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { error: string } };
		expect(failure.status).toBe(400);
		// The friendly wrapper message is surfaced; no raw SQLSTATE / SDK text leaks.
		expect(failure.data.error).not.toMatch(/42501|23505|permission denied/i);
		expect(console.error).toHaveBeenCalled();
	});
});

describe('feed unreport action', () => {
	it('reads the session via safeGetSession(), never raw getSession()', async () => {
		const { event, safeGetSession, rawGetSession } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'dog-target' }
		});

		await unreport_(event);

		expect(safeGetSession).toHaveBeenCalledOnce();
		expect(rawGetSession).not.toHaveBeenCalled();
	});

	it('success: calls unreportBurger with the SESSION user id + form dog id on event.locals.supabase, returns { unreported: true }', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'dog-target' }
		});

		const result = await unreport_(event);

		expect(unreportBurger).toHaveBeenCalledWith(event.locals.supabase, USER_ID, 'dog-target');
		expect(result).toEqual({ unreported: true });
	});

	it('IGNORES a hostile client-supplied reporter_id: the reporter comes from the session, not the form', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'dog-target', reporter_id: 'attacker-uuid' }
		});

		await unreport_(event);

		const callArgs = vi.mocked(unreportBurger).mock.calls[0];
		expect(callArgs[1]).toBe(USER_ID);
		expect(callArgs[1]).not.toBe('attacker-uuid');
		expect(callArgs[2]).toBe('dog-target');
		expect(callArgs).not.toContain('attacker-uuid');
	});

	it('rejects a missing dog id with a boundary 400; never calls unreportBurger', async () => {
		const { event } = makeEvent({ session: VALID_SESSION, user: VALID_USER, formFields: {} });

		const result = await unreport_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect(unreportBurger).not.toHaveBeenCalled();
	});

	it('fails closed with 401 when unauthenticated; never calls unreportBurger', async () => {
		const { event } = makeEvent({
			session: null,
			user: null,
			formFields: { id: 'dog-target' }
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
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'dog-target' }
		});

		const result = await unreport_(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { error: string } };
		expect(failure.status).toBe(400);
		expect(failure.data.error).not.toMatch(/42501|23505|permission denied/i);
		expect(console.error).toHaveBeenCalled();
	});
});
