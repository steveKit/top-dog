import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isRedirect, isHttpError } from '@sveltejs/kit';

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
//   - DOG_NOT_FOUND -> a 404 HttpError (distinct from a read error);
//   - a real read error -> a 500 HttpError (no raw SDK internals leaked);
//   - a found dog -> { dog (stats + owner), signedUrl, reactions };
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
	getSignedUrl: vi.fn()
}));

vi.mock('$lib/features/reactions/reactions', () => ({
	listReactionsForDogs: vi.fn()
}));

import { load } from './+page.server';
import { getDogDetail, DOG_NOT_FOUND } from '$lib/features/hotdogs/detail';
import { getSignedUrl } from '$lib/storage';
import { listReactionsForDogs } from '$lib/features/reactions/reactions';

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
	const supabase = { auth: { getSession: rawGetSession } };
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
	// Default happy-path stubs; individual tests override as needed.
	vi.mocked(getDogDetail).mockResolvedValue({ ok: true, data: DOG_DETAIL });
	vi.mocked(getSignedUrl).mockResolvedValue({
		ok: true,
		data: { signedUrl: 'https://signed/owner-1/dog.webp' }
	});
	vi.mocked(listReactionsForDogs).mockResolvedValue({ ok: true, data: [] });
});

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
		// The signed URL is minted for the dog's private image path.
		expect(getSignedUrl).toHaveBeenCalledWith(expect.anything(), DOG_DETAIL.image_path);
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
});
