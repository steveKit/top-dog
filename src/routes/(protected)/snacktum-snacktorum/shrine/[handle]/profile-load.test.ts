import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isHttpError, isRedirect } from '@sveltejs/kit';

// Test-after coverage for the profile-by-handle load (TASK-011 + TASK-041 mustard
// spray/render contract change + TASK-050 wall load). The load now:
//   - reads the session via safeGetSession() and redirects unauth -> /sign-in;
//   - returns { profile, avatarUrl, sprays, canSpray, wallMessages, viewerId,
//     isWallOwner };
//   - 404s an unknown handle, 500s a profile read error (never swallowed);
//   - resolves a public avatar URL when avatar_path is set;
//   - computes canSpray from the VIEWER's OWN profile.is_current_top_dog
//     (server-maintained, non-client-writable — decision #25), true only when the
//     viewer holds the crown;
//   - passes the target's live sprays through, degrading to an empty mustard layer
//     (NOT a page failure) when the spray read fails;
//   - degrades canSpray to false (no spray affordance) when the viewer read fails.
//
// The profiles + sprays + walls feature modules are dependency-injected via their
// import surface, so we mock the network-touching wrappers (getProfileByHandle /
// getProfileById / listSpraysForProfile / listWallMessages) and the storage
// getPublicUrl, and assert the load's orchestration directly. The RLS Top-Dog
// INSERT gate is live-DB coverage (tests/mustard.e2e.ts); the wall author-pin /
// delete RLS is live-DB coverage (tests/walls.e2e.ts), both out of this unit
// test's reach. (Dedicated wall-load assertions live alongside the wall actions
// in wall-action.test.ts.)

vi.mock('$lib/features/profiles/profiles', () => ({
	getProfileByHandle: vi.fn(),
	getProfileById: vi.fn()
}));

vi.mock('$lib/features/mustard/sprays', () => ({
	// 6h overlay window (drives splat opacity).
	listSpraysForProfile: vi.fn(),
	// FULL persisted anoint history (drives the persisting anoint→wall notice, OQ-2e).
	listAnointmentsForProfile: vi.fn(),
	// Keep the real NOT_TOP_DOG sentinel so any action-layer mapping stays faithful.
	NOT_TOP_DOG: 'Only The Anointed Wiener may anoint a disciple in mustard.',
	addSpray: vi.fn()
}));

vi.mock('$lib/features/walls/walls', () => ({
	listWallMessages: vi.fn(),
	postWallMessage: vi.fn(),
	deleteWallMessage: vi.fn()
}));

vi.mock('$lib/storage', () => ({
	getPublicUrl: vi.fn()
}));

// 🍔 Hamburger Court profile brands (TASK-073, decision #12/#15 — cosmetic,
// ranking-inert, computed at RENDER time). The load derives two banners from
// verdictStore reads:
//   - HAMBURGER LIAR: decaying, from getLiarBrandTimestamps (the reporter's brand
//     timestamps) summarized by the REAL pure summarizeLiarBrand.
//   - HAMBURGER HERETIC: persistent, from getDogVerdictsForOwner (verdicts on the
//     owner's dogs) decided by the REAL pure isHamburgerHeretic.
// Only the two network-touching wrappers are mocked; the pure render-time math stays
// real so the banner derivation is exercised faithfully. Each read degrades to "no
// banner" (page not blanked) on failure.
vi.mock('$lib/features/reports/verdictStore', () => ({
	getLiarBrandTimestamps: vi.fn(),
	getDogVerdictsForOwner: vi.fn()
}));

// Derived stat ledger (TASK-093): read-only aggregates assembled by loadShrineStats.
// The aggregate queries are unit-tested in stats.test.ts; here we mock the assembler
// and assert the load surfaces its result as `stats`. A real failure degrades to 0s
// inside the module (the page is never blanked), so the load just passes it through.
vi.mock('$lib/features/profiles/stats', () => ({
	loadShrineStats: vi.fn(),
	EMPTY_SHRINE_STATS: {
		timesCrowned: 0,
		franksOffered: 0,
		totalDevotion: 0,
		highestBlessing: 0,
		disciplesSummoned: 0,
		anointingsReceived: 0,
		reactionsReceived: 0
	}
}));

// The redeemed-invites head-count runs on the SERVICE client (after the gate), so
// the load constructs one via getServiceClient() and passes it into loadShrineStats.
// Mock it to a sentinel so we can assert it's threaded through.
const SERVICE_CLIENT = { __service: true };
vi.mock('$lib/server/supabase', () => ({
	getServiceClient: vi.fn(() => SERVICE_CLIENT)
}));

import { load } from './+page.server';
import { getProfileByHandle, getProfileById } from '$lib/features/profiles/profiles';
import { listSpraysForProfile, listAnointmentsForProfile } from '$lib/features/mustard/sprays';
import { listWallMessages } from '$lib/features/walls/walls';
import { getPublicUrl } from '$lib/storage';
import { getLiarBrandTimestamps, getDogVerdictsForOwner } from '$lib/features/reports/verdictStore';
import { LIAR_BRAND_WINDOW_MS } from '$lib/features/reports/verdict';
import { loadShrineStats } from '$lib/features/profiles/stats';
import { computeBadges, type BadgeState } from '$lib/features/badges/badges';

// A representative non-zero ledger the mocked assembler returns by default, so the
// load's passthrough of every field is exercised.
const STATS = {
	timesCrowned: 3,
	franksOffered: 4,
	totalDevotion: 2354,
	highestBlessing: 1400,
	disciplesSummoned: 6,
	anointingsReceived: 12,
	reactionsReceived: 488
};

const VIEWER_ID = '11111111-1111-4111-8111-111111111111';
const VALID_USER = { id: VIEWER_ID, email: 'viewer@topdog.test' };
const VALID_SESSION = { access_token: 'valid', user: VALID_USER };

const TARGET_PROFILE = {
	id: 'target-uuid',
	handle: 'ChefDog',
	display_name: 'Chef Dog',
	avatar_path: null as string | null,
	joined_at: '2026-06-09T00:00:00Z',
	days_as_top_dog: 0,
	is_current_top_dog: false,
	top_dog_since: null as string | null
};

function aViewerProfile(overrides: Partial<typeof TARGET_PROFILE> = {}) {
	return {
		id: VIEWER_ID,
		handle: 'Viewer',
		display_name: 'The Viewer',
		avatar_path: null,
		joined_at: '2026-06-01T00:00:00Z',
		days_as_top_dog: 0,
		is_current_top_dog: false,
		top_dog_since: null,
		...overrides
	};
}

const A_SPRAY = { id: 'spray-1', x: 0.25, y: 0.5, sprayed_at: '2026-06-16T10:00:00Z' };

// The Reliquary's `inquisitor` badge adds ONE new read-only RLS-scoped query on the
// load's supabase client: a head-count of burger_verdicts where decided_by = the
// member (TASK-094-R). The fake event below threads a configurable result through a
// minimal from().select().eq() chain so the load's count read resolves; tests
// override it via `verdictCountResult`. A failure must degrade only the inquisitor
// relic to locked, never the page.
let verdictCountResult: { count: number | null; error: { message: string } | null } = {
	count: 0,
	error: null
};

/**
 * Builds a fake load event. `rawGetSession` is exposed so we can prove the load
 * never reaches for the unvalidated session. The supabase mock also answers the
 * Reliquary inquisitor head-count (from('burger_verdicts').select().eq()).
 */
function makeLoadEvent(opts: { session: unknown; user: unknown; handle?: string }) {
	const safeGetSession = vi.fn(async () => ({ session: opts.session, user: opts.user }));
	const rawGetSession = vi.fn(async () => ({ data: { session: null }, error: null }));
	const eq = vi.fn(async () => verdictCountResult);
	const select = vi.fn(() => ({ eq }));
	const from = vi.fn(() => ({ select }));
	return {
		params: { handle: opts.handle ?? 'ChefDog' },
		locals: {
			supabase: { __brand: 'rls-client', auth: { getSession: rawGetSession }, from },
			safeGetSession
		},
		safeGetSession,
		rawGetSession
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;
}

type LoadData = {
	profile: typeof TARGET_PROFILE;
	avatarUrl: string | null;
	sigilId: string | null;
	sprays: { id: string; x: number; y: number; sprayed_at: string }[];
	anointments: { id: string; x: number; y: number; sprayed_at: string }[];
	canSpray: boolean;
	wallMessages: unknown[];
	viewerId: string;
	isWallOwner: boolean;
	liarBrand: { active: boolean; brandCount: number; intensity: number };
	isHeretic: boolean;
	stats: typeof STATS;
	badges: BadgeState[];
};

async function callLoad(event: unknown): Promise<LoadData> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const result = await load(event as any);
	return result as LoadData;
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(console, 'error').mockImplementation(() => {});
	// Happy-path defaults; individual tests override as needed.
	vi.mocked(getProfileByHandle).mockResolvedValue({ ok: true, data: TARGET_PROFILE });
	vi.mocked(getProfileById).mockResolvedValue({ ok: true, data: aViewerProfile() });
	vi.mocked(listSpraysForProfile).mockResolvedValue({ ok: true, data: [] });
	vi.mocked(listAnointmentsForProfile).mockResolvedValue({ ok: true, data: [] });
	vi.mocked(listWallMessages).mockResolvedValue({ ok: true, data: [] });
	vi.mocked(getPublicUrl).mockReturnValue('https://cdn/avatar.webp');
	// Default: the profile carries no LIAR brands and owns no confirmed-hamburger dog
	// (no banners). Brand-specific tests override.
	vi.mocked(getLiarBrandTimestamps).mockResolvedValue({ ok: true, data: [] });
	vi.mocked(getDogVerdictsForOwner).mockResolvedValue({ ok: true, data: [] });
	// Default: the assembler returns the representative non-zero ledger.
	vi.mocked(loadShrineStats).mockResolvedValue(STATS);
	// Default: the inquisitor head-count reads 0 (no verdicts rendered).
	verdictCountResult = { count: 0, error: null };
});

// The badges the load is expected to compute for the default fixtures: the STATS
// ledger + TARGET_PROFILE (days_as_top_dog 0, joined 2026-06-09 — before the Elder
// cutoff) + no heretic/liar + the inquisitor count. computeBadges is pure and unit-
// tested in badges.test.ts; reusing it here keeps the load's passthrough faithful
// without re-asserting the derivation. `verdictsRendered` defaults to 0.
function expectedBadges(
	overrides: { isHeretic?: boolean; hasBeenLiarBranded?: boolean; verdictsRendered?: number } = {}
): BadgeState[] {
	return computeBadges({
		franksOffered: STATS.franksOffered,
		daysAsTopDog: TARGET_PROFILE.days_as_top_dog,
		highestBlessing: STATS.highestBlessing,
		disciplesSummoned: STATS.disciplesSummoned,
		anointingsReceived: STATS.anointingsReceived,
		verdictsRendered: overrides.verdictsRendered ?? 0,
		isHeretic: overrides.isHeretic ?? false,
		hasBeenLiarBranded: overrides.hasBeenLiarBranded ?? false,
		joinedAt: TARGET_PROFILE.joined_at
	});
}

describe('profile [handle] load', () => {
	it('reads the session via safeGetSession(), never raw getSession()', async () => {
		const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		await callLoad(event);

		expect(event.safeGetSession).toHaveBeenCalledOnce();
		expect(event.rawGetSession).not.toHaveBeenCalled();
	});

	it('redirects to /sign-in when unauthenticated; never queries the profile', async () => {
		const event = makeLoadEvent({ session: null, user: null });

		let thrown: unknown;
		try {
			await load(event);
		} catch (e) {
			thrown = e;
		}

		expect(isRedirect(thrown)).toBe(true);
		expect((thrown as { location: string }).location).toBe('/sign-in');
		expect(getProfileByHandle).not.toHaveBeenCalled();
	});

	it('returns { profile, null avatarUrl, sprays, canSpray } when no avatar is set', async () => {
		const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await callLoad(event);

		expect(getProfileByHandle).toHaveBeenCalledWith(event.locals.supabase, 'ChefDog');
		expect(result).toEqual({
			profile: TARGET_PROFILE,
			avatarUrl: null,
			// No avatar_path => not a sigil either.
			sigilId: null,
			sprays: [],
			anointments: [],
			canSpray: false,
			wallMessages: [],
			// The viewer is not the target profile, so they do not own this wall.
			viewerId: VIEWER_ID,
			isWallOwner: false,
			// No LIAR brands and no confirmed-hamburger dog -> both banners off.
			liarBrand: { active: false, brandCount: 0, intensity: 0 },
			isHeretic: false,
			// The derived stat ledger is surfaced from the assembler unchanged.
			stats: STATS,
			// The Reliquary's derived badge state (TASK-094-R), computed from the
			// ledger + profile + brand/inquisitor inputs (the pure derivation is
			// covered in badges.test.ts; here we assert the load surfaces it).
			badges: expectedBadges()
		});
		// No avatar_path => no public-URL resolution.
		expect(getPublicUrl).not.toHaveBeenCalled();
	});

	it('resolves a public avatar URL when avatar_path is set', async () => {
		const withAvatar = { ...TARGET_PROFILE, avatar_path: 'target-uuid/avatar.webp' };
		vi.mocked(getProfileByHandle).mockResolvedValue({ ok: true, data: withAvatar });
		vi.mocked(getPublicUrl).mockReturnValue('https://cdn/target-uuid/avatar.webp');
		const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await callLoad(event);

		expect(getPublicUrl).toHaveBeenCalledWith(event.locals.supabase, 'target-uuid/avatar.webp');
		expect(result.profile).toEqual(withAvatar);
		expect(result.avatarUrl).toBe('https://cdn/target-uuid/avatar.webp');
		// A real uploaded avatar is not a sigil.
		expect(result.sigilId).toBeNull();
	});

	it('surfaces a built-in sigil id (no storage URL) when avatar_path is a sigil', async () => {
		// The onboarding rite stores a chosen sigil as `sigil:<id>` in avatar_path
		// (TASK-092). The load parses it to a sigilId the page renders inline and
		// must NOT resolve a storage public URL for it.
		const withSigil = { ...TARGET_PROFILE, avatar_path: 'sigil:tube' };
		vi.mocked(getProfileByHandle).mockResolvedValue({ ok: true, data: withSigil });
		const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await callLoad(event);

		expect(result.sigilId).toBe('tube');
		expect(result.avatarUrl).toBeNull();
		expect(getPublicUrl).not.toHaveBeenCalled();
	});

	it('404s for an unknown handle', async () => {
		vi.mocked(getProfileByHandle).mockResolvedValue({ ok: true, data: null });
		const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER, handle: 'nobody' });

		let thrown: unknown;
		try {
			await load(event);
		} catch (e) {
			thrown = e;
		}

		expect(isHttpError(thrown)).toBe(true);
		expect((thrown as { status: number }).status).toBe(404);
	});

	it('500s on a profile read error (does not swallow)', async () => {
		vi.mocked(getProfileByHandle).mockResolvedValue({ ok: false, error: 'boom' });
		const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

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

	describe('canSpray (viewer crown gate)', () => {
		it('is true ONLY when the viewer’s OWN profile holds the crown', async () => {
			vi.mocked(getProfileById).mockResolvedValue({
				ok: true,
				data: aViewerProfile({ is_current_top_dog: true })
			});
			const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

			const result = await callLoad(event);

			// The crown flag is read off the VIEWER's profile (user.id), not the target's.
			expect(getProfileById).toHaveBeenCalledWith(event.locals.supabase, VIEWER_ID);
			expect(result.canSpray).toBe(true);
		});

		it('is false when the viewer does NOT hold the crown, even if the TARGET does', async () => {
			// A non-Top-Dog viewing the current Top Dog's profile still cannot spray.
			vi.mocked(getProfileByHandle).mockResolvedValue({
				ok: true,
				data: { ...TARGET_PROFILE, is_current_top_dog: true }
			});
			vi.mocked(getProfileById).mockResolvedValue({
				ok: true,
				data: aViewerProfile({ is_current_top_dog: false })
			});
			const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

			const result = await callLoad(event);

			expect(result.canSpray).toBe(false);
		});

		it('degrades canSpray to false (no affordance) when the viewer profile read fails', async () => {
			vi.mocked(getProfileById).mockResolvedValue({ ok: false, error: 'viewer read boom' });
			const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

			const result = await callLoad(event);

			// A viewer-read failure must not block the page — it just hides the spray UI.
			expect(result.canSpray).toBe(false);
			expect(result.profile).toEqual(TARGET_PROFILE);
			expect(console.error).toHaveBeenCalled();
		});
	});

	describe('sprays passthrough + graceful degradation', () => {
		it('passes the target profile’s live sprays through (read on the target id)', async () => {
			const sprays = [
				A_SPRAY,
				{ id: 'spray-2', x: 0.9, y: 0.1, sprayed_at: '2026-06-16T11:00:00Z' }
			];
			vi.mocked(listSpraysForProfile).mockResolvedValue({ ok: true, data: sprays });
			const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

			const result = await callLoad(event);

			// Sprays are fetched for the TARGET profile id, not the viewer's.
			expect(listSpraysForProfile).toHaveBeenCalledWith(event.locals.supabase, TARGET_PROFILE.id);
			expect(result.sprays).toEqual(sprays);
		});

		it('degrades to an empty mustard layer (page not failed) when the spray read fails', async () => {
			vi.mocked(listSpraysForProfile).mockResolvedValue({ ok: false, error: 'spray read boom' });
			const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

			const result = await callLoad(event);

			expect(result.sprays).toEqual([]);
			// The rest of the page is intact — only the mustard layer degraded.
			expect(result.profile).toEqual(TARGET_PROFILE);
			expect(console.error).toHaveBeenCalled();
		});
	});

	// The PERSISTING anoint→wall notice (OQ-2e, decision #29) derives from the FULL
	// anoint history, NOT the 6h overlay `sprays` window. The load surfaces it as a
	// SEPARATE `anointments` field, fetched on the TARGET profile id via
	// listAnointmentsForProfile, degrading to an empty history (page not failed) on a
	// read error — mirroring the overlay sprays degradation but on its own field.
	describe('anointments passthrough (persisting notice source) + graceful degradation', () => {
		it('passes the target profile’s FULL anoint history through (read on the target id)', async () => {
			const anointments = [
				A_SPRAY,
				{ id: 'spray-old', x: 0.9, y: 0.1, sprayed_at: '2026-01-01T11:00:00Z' }
			];
			vi.mocked(listAnointmentsForProfile).mockResolvedValue({ ok: true, data: anointments });
			const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

			const result = await callLoad(event);

			// The anoint history is fetched for the TARGET profile id, not the viewer's.
			expect(listAnointmentsForProfile).toHaveBeenCalledWith(
				event.locals.supabase,
				TARGET_PROFILE.id
			);
			expect(result.anointments).toEqual(anointments);
		});

		it('degrades to an empty anoint history (page not failed) when the read fails', async () => {
			vi.mocked(listAnointmentsForProfile).mockResolvedValue({
				ok: false,
				error: 'anoint read boom'
			});
			const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

			const result = await callLoad(event);

			expect(result.anointments).toEqual([]);
			// The rest of the page is intact — only the notice source degraded.
			expect(result.profile).toEqual(TARGET_PROFILE);
			expect(console.error).toHaveBeenCalled();
		});
	});

	// 🍔 Hamburger Court profile banners (TASK-073). Both are cosmetic / ranking-inert
	// and computed at render time. The LIAR banner is DECAYING (from the reporter's
	// brand timestamps); the HERETIC banner is PERSISTENT (from the verdicts on the
	// profile owner's dogs). Each read is keyed on the TARGET profile id and degrades
	// to "no banner" (page not blanked) on failure — mirroring the spray/wall
	// degradation. The pure summarizeLiarBrand / isHamburgerHeretic stay REAL.
	describe('HAMBURGER LIAR banner (decaying)', () => {
		it('reads the liar brand timestamps for the TARGET profile id', async () => {
			const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

			await callLoad(event);

			expect(getLiarBrandTimestamps).toHaveBeenCalledWith(event.locals.supabase, TARGET_PROFILE.id);
		});

		it('surfaces an ACTIVE, decaying liar brand from a fresh in-window timestamp', async () => {
			// A brand minted ~halfway through the 7-day window -> active, ~0.5 intensity.
			const halfAgeMs = LIAR_BRAND_WINDOW_MS / 2;
			const brandTs = new Date(Date.now() - halfAgeMs).toISOString();
			vi.mocked(getLiarBrandTimestamps).mockResolvedValue({ ok: true, data: [brandTs] });
			const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

			const result = await callLoad(event);

			expect(result.liarBrand.active).toBe(true);
			expect(result.liarBrand.brandCount).toBe(1);
			// Decaying: intensity is a fraction in (0,1), roughly half-faded here.
			expect(result.liarBrand.intensity).toBeGreaterThan(0);
			expect(result.liarBrand.intensity).toBeLessThan(1);
		});

		it('an expired (out-of-window) brand does not light the banner', async () => {
			// Older than the 7-day window -> no active brand.
			const expiredTs = new Date(Date.now() - LIAR_BRAND_WINDOW_MS - 60_000).toISOString();
			vi.mocked(getLiarBrandTimestamps).mockResolvedValue({ ok: true, data: [expiredTs] });
			const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

			const result = await callLoad(event);

			expect(result.liarBrand.active).toBe(false);
			expect(result.liarBrand.intensity).toBe(0);
		});

		it('degrades to no liar banner (page not blanked) when the brand read fails', async () => {
			vi.mocked(getLiarBrandTimestamps).mockResolvedValue({ ok: false, error: 'liar read boom' });
			const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

			const result = await callLoad(event);

			// The banner degrades to off; the rest of the page is intact.
			expect(result.liarBrand).toEqual({ active: false, brandCount: 0, intensity: 0 });
			expect(result.profile).toEqual(TARGET_PROFILE);
			expect(console.error).toHaveBeenCalled();
		});
	});

	describe('HAMBURGER HERETIC banner (persistent)', () => {
		it('reads the dog verdicts for the TARGET profile (owner) id', async () => {
			const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

			await callLoad(event);

			expect(getDogVerdictsForOwner).toHaveBeenCalledWith(event.locals.supabase, TARGET_PROFILE.id);
		});

		it('marks the owner a HERETIC when ANY of their dogs is confirmed_hamburger', async () => {
			vi.mocked(getDogVerdictsForOwner).mockResolvedValue({
				ok: true,
				data: ['not_a_hamburger', 'confirmed_hamburger']
			});
			const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

			const result = await callLoad(event);

			expect(result.isHeretic).toBe(true);
		});

		it('is NOT a heretic when no dog is confirmed_hamburger', async () => {
			vi.mocked(getDogVerdictsForOwner).mockResolvedValue({
				ok: true,
				data: ['not_a_hamburger', 'not_a_hamburger']
			});
			const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

			const result = await callLoad(event);

			expect(result.isHeretic).toBe(false);
		});

		it('degrades to NOT-a-heretic (page not blanked) when the verdict read fails', async () => {
			vi.mocked(getDogVerdictsForOwner).mockResolvedValue({ ok: false, error: 'heresy read boom' });
			const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

			const result = await callLoad(event);

			expect(result.isHeretic).toBe(false);
			expect(result.profile).toEqual(TARGET_PROFILE);
			expect(console.error).toHaveBeenCalled();
		});
	});

	// Derived stat ledger (TASK-093). The load assembles read-only aggregates via
	// loadShrineStats keyed on the TARGET profile id (which IS the member's auth user
	// id — profiles.id references auth.users — so it's passed as both the profile id
	// and the inviter user id for the redeemed-invites count) and surfaces the result
	// as `stats`. The RLS-scoped client runs every aggregate except the redeemed-invites
	// head-count, which runs on the SERVICE client (passed second, after the gate). The
	// aggregate queries themselves are unit-tested in stats.test.ts.
	describe('derived stat ledger', () => {
		it('assembles the ledger for the TARGET profile id and surfaces it as stats', async () => {
			const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

			const result = await callLoad(event);

			expect(loadShrineStats).toHaveBeenCalledWith(
				event.locals.supabase,
				SERVICE_CLIENT,
				TARGET_PROFILE.id,
				TARGET_PROFILE.id
			);
			expect(result.stats).toEqual(STATS);
		});
	});

	// The Reliquary (TASK-094-R): a purely DERIVED honors shelf. The load adds ONE new
	// read-only RLS-scoped query (the inquisitor head-count keyed on
	// burger_verdicts.decided_by = the member) and otherwise REUSES the stat ledger +
	// the existing liar/heretic reads to assemble BadgeInputs, then surfaces the pure
	// computeBadges result as `badges`. Reporter anonymity (decision #27) is structural:
	// inquisitor keys on decided_by (the member's OWN action), heretic on the member's
	// OWN dogs, liar on the member's OWN brand — no reporter-side key.
	describe('reliquary badges (derived honors)', () => {
		it('surfaces the derived badge state for the default fixtures', async () => {
			const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

			const result = await callLoad(event);

			expect(result.badges).toEqual(expectedBadges());
		});

		it('queries the inquisitor head-count on burger_verdicts.decided_by = the member', async () => {
			verdictCountResult = { count: 25, error: null };
			const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

			const result = await callLoad(event);

			expect(event.locals.supabase.from).toHaveBeenCalledWith('burger_verdicts');
			// 25 verdicts rendered -> the top inquisitor tier is lit.
			expect(result.badges).toEqual(expectedBadges({ verdictsRendered: 25 }));
		});

		it('degrades the inquisitor relic to locked (page intact) when the count read fails', async () => {
			verdictCountResult = { count: null, error: { message: 'verdict count boom' } };
			const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

			const result = await callLoad(event);

			// A failed read => verdictsRendered 0 => inquisitor locked; page intact.
			expect(result.badges).toEqual(expectedBadges({ verdictsRendered: 0 }));
			expect(result.profile).toEqual(TARGET_PROFILE);
			expect(console.error).toHaveBeenCalled();
		});

		it('lights the HERETIC shame relic when the member owns a confirmed_hamburger dog', async () => {
			vi.mocked(getDogVerdictsForOwner).mockResolvedValue({
				ok: true,
				data: ['confirmed_hamburger']
			});
			const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

			const result = await callLoad(event);

			expect(result.badges).toEqual(expectedBadges({ isHeretic: true }));
		});

		it('lights the FALSE WITNESS relic on EVER-branded (any liar brand, even faded)', async () => {
			// An OUT-OF-WINDOW brand: the decaying banner is OFF (liarBrand.active false)
			// but the relic is still lit because it records EVER-branded.
			const expiredTs = new Date(Date.now() - LIAR_BRAND_WINDOW_MS - 60_000).toISOString();
			vi.mocked(getLiarBrandTimestamps).mockResolvedValue({ ok: true, data: [expiredTs] });
			const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

			const result = await callLoad(event);

			// The live banner is off...
			expect(result.liarBrand.active).toBe(false);
			// ...but the relic remembers (ever-branded).
			expect(result.badges).toEqual(expectedBadges({ hasBeenLiarBranded: true }));
		});

		it('does NOT light the liar relic when the brand read failed (locked, not faked)', async () => {
			vi.mocked(getLiarBrandTimestamps).mockResolvedValue({ ok: false, error: 'liar read boom' });
			const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

			const result = await callLoad(event);

			expect(result.badges).toEqual(expectedBadges({ hasBeenLiarBranded: false }));
		});
	});
});
