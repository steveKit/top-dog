import { describe, it, expect, vi } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { load } from './+layout.server';

// Defense-in-depth guard co-located with the protected route group. Even though
// `hooks.server.ts` already redirects, this load must independently refuse to
// render the app shell for an unauthenticated request, and must surface the
// validated user to nested loads when authenticated.
//
// TASK-011 added the profile funnel: an authenticated but profile-less user is
// redirected to the onboarding rite. TASK-092 absorbed the standalone
// /snacktum-snacktorum/onboarding route into the /sign-up rite, so the funnel
// target is now /sign-up (which lives OUTSIDE the protected group, so this guard
// never runs for it and cannot loop). The load reads `locals.supabase` (to look up
// the profile) and `url.pathname` (the defensive loop guard), so the fake event
// supplies both.

const ONBOARDING_URL = new URL('https://x/sign-up');
const APP_URL = new URL('https://x/snacktum-snacktorum');

/**
 * A fake supabase whose `profiles` reads are QUERY-AWARE: the load now issues two
 * distinct `profiles` lookups off the same client —
 *   - `getProfileById`     filters `.eq('id', <uid>)`
 *   - `getCurrentChampion` filters `.eq('is_current_top_dog', true)`
 * so a single shared `maybeSingle` mock would wrongly resolve the champion from
 * the profile-by-id row (and vice versa). We branch on the filtered COLUMN at
 * `.eq(...)`: the by-id query resolves `profileRow`; the champion query resolves
 * `championRow` (default `null` = empty throne). `error` applies to the by-id
 * lookup; `championError` to the champion lookup, so each degradation path can be
 * exercised independently.
 */
function makeSupabase(
	profileRow: unknown,
	error: unknown = null,
	opts: { championRow?: unknown; championError?: unknown } = {}
) {
	const { championRow = null, championError = null } = opts;
	const eq = vi.fn((column: string) => {
		const isChampionQuery = column === 'is_current_top_dog';
		const maybeSingle = vi
			.fn()
			.mockResolvedValue(
				isChampionQuery ? { data: championRow, error: championError } : { data: profileRow, error }
			);
		return { maybeSingle };
	});
	const select = vi.fn(() => ({ eq }));
	const from = vi.fn(() => ({ select }));
	return { from, eq };
}

function callLoad(opts: { safeGetSession: () => Promise<unknown>; supabase?: unknown; url?: URL }) {
	return load({
		url: opts.url ?? APP_URL,
		locals: { supabase: opts.supabase ?? makeSupabase(null), safeGetSession: opts.safeGetSession }
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any);
}

const A_PROFILE = { id: 'u1', handle: 'chef', display_name: 'Chef' };

describe('(protected)/snacktum-snacktorum/+layout.server load', () => {
	it('redirects to /sign-in when there is no validated session', async () => {
		const safeGetSession = vi.fn(async () => ({ session: null, user: null }));

		let thrown: unknown;
		try {
			await callLoad({ safeGetSession });
		} catch (e) {
			thrown = e;
		}

		expect(isRedirect(thrown)).toBe(true);
		expect((thrown as { status: number }).status).toBe(303);
		expect((thrown as { location: string }).location).toBe('/sign-in');
	});

	it('returns the validated user and profile when a session and profile exist', async () => {
		const user = { id: 'u1', email: 'chef@topdog.test' };
		const session = { access_token: 'valid', user };
		const safeGetSession = vi.fn(async () => ({ session, user }));

		const result = await callLoad({ safeGetSession, supabase: makeSupabase(A_PROFILE) });

		// The shared fake's champion query (filtered on is_current_top_dog) returns
		// its own result — `null` by default (empty throne) — distinct from the
		// profile-by-id lookup, so `champion` must NOT leak A_PROFILE here.
		expect(result).toEqual({ user, profile: A_PROFILE, champion: null });
	});

	it('redirects even if a user object is present but the session is null', async () => {
		// A null session is the authoritative signal; never render on user alone.
		const safeGetSession = vi.fn(async () => ({
			session: null,
			user: { id: 'u1' }
		}));

		let thrown: unknown;
		try {
			await callLoad({ safeGetSession });
		} catch (e) {
			thrown = e;
		}

		expect(isRedirect(thrown)).toBe(true);
	});

	it('redirects a profile-less authenticated user to the /sign-up rite', async () => {
		const user = { id: 'u1', email: 'chef@topdog.test' };
		const session = { access_token: 'valid', user };
		const safeGetSession = vi.fn(async () => ({ session, user }));

		let thrown: unknown;
		try {
			await callLoad({ safeGetSession, supabase: makeSupabase(null), url: APP_URL });
		} catch (e) {
			thrown = e;
		}

		expect(isRedirect(thrown)).toBe(true);
		expect((thrown as { location: string }).location).toBe('/sign-up');
	});

	it('does NOT redirect when a profile-less request is already on the funnel target (no loop)', async () => {
		const user = { id: 'u1', email: 'chef@topdog.test' };
		const session = { access_token: 'valid', user };
		const safeGetSession = vi.fn(async () => ({ session, user }));

		const result = await callLoad({
			safeGetSession,
			supabase: makeSupabase(null),
			url: ONBOARDING_URL
		});

		expect(result).toEqual({ user, profile: null, champion: null });
	});

	it('redirects a profile-less user on a deep /snacktum-snacktorum sub-path (not just /snacktum-snacktorum)', async () => {
		const user = { id: 'u1', email: 'chef@topdog.test' };
		const session = { access_token: 'valid', user };
		const safeGetSession = vi.fn(async () => ({ session, user }));

		let thrown: unknown;
		try {
			await callLoad({
				safeGetSession,
				supabase: makeSupabase(null),
				url: new URL('https://x/snacktum-snacktorum/profile/someone')
			});
		} catch (e) {
			thrown = e;
		}

		expect(isRedirect(thrown)).toBe(true);
		expect((thrown as { location: string }).location).toBe('/sign-up');
	});

	it('looks the profile up by the trusted session uid', async () => {
		const user = { id: 'trusted-uid', email: 'chef@topdog.test' };
		const session = { access_token: 'valid', user };
		const safeGetSession = vi.fn(async () => ({ session, user }));
		const supabase = makeSupabase(A_PROFILE);

		await callLoad({ safeGetSession, supabase });

		expect(supabase.eq).toHaveBeenCalledWith('id', 'trusted-uid');
	});

	it('treats a profile read error as no profile but does not throw the error', async () => {
		const user = { id: 'u1', email: 'chef@topdog.test' };
		const session = { access_token: 'valid', user };
		const safeGetSession = vi.fn(async () => ({ session, user }));

		// On the onboarding path so the absent-profile result does not redirect.
		const result = await callLoad({
			safeGetSession,
			supabase: makeSupabase(null, { message: 'boom', code: '500' }),
			url: ONBOARDING_URL
		});

		expect(result).toEqual({ user, profile: null, champion: null });
	});
});

// The app-chrome champion sub-bar (TASK app-chrome-rebuild). The load reads the
// current Top Dog AFTER the profile-funnel guard and surfaces a thin view object
// — degrading to `champion: null` on an empty throne OR a champion-query error,
// never hard-failing the guard.
describe('(protected)/snacktum-snacktorum/+layout.server load — champion sub-bar', () => {
	const user = { id: 'u1', email: 'chef@topdog.test' };
	const session = { access_token: 'valid', user };
	const authed = () => vi.fn(async () => ({ session, user }));

	it('surfaces the current champion (sigil avatar resolved to a sigilId, no storage URL)', async () => {
		const champion = {
			id: 'champ',
			handle: 'topdog',
			display_name: 'The Top Dog',
			avatar_path: 'sigil:tube'
		};
		const supabase = makeSupabase(A_PROFILE, null, { championRow: champion });

		const result = await callLoad({ safeGetSession: authed(), supabase });

		expect(result).toEqual({
			user,
			profile: A_PROFILE,
			champion: {
				handle: 'topdog',
				displayName: 'The Top Dog',
				sigilId: 'tube',
				avatarUrl: null
			}
		});
	});

	it('resolves a real uploaded avatar to its public URL (non-sigil branch)', async () => {
		const champion = {
			id: 'champ',
			handle: 'topdog',
			display_name: 'The Top Dog',
			avatar_path: 'champ/avatar.webp'
		};
		// getPublicUrl reads the avatars bucket via client.storage; stub the chain so
		// the non-sigil branch resolves to a concrete public URL.
		const publicUrl = 'https://stack.local/storage/v1/object/public/avatars/champ/avatar.webp';
		const supabase = {
			...makeSupabase(A_PROFILE, null, { championRow: champion }),
			storage: {
				from: vi.fn(() => ({
					getPublicUrl: vi.fn(() => ({ data: { publicUrl } }))
				}))
			}
		};

		const result = await callLoad({ safeGetSession: authed(), supabase });

		expect(result).toEqual({
			user,
			profile: A_PROFILE,
			champion: {
				handle: 'topdog',
				displayName: 'The Top Dog',
				sigilId: null,
				avatarUrl: publicUrl
			}
		});
	});

	it('surfaces champion: null when the throne sits empty', async () => {
		// championRow defaults to null in the fake — empty throne.
		const supabase = makeSupabase(A_PROFILE);

		const result = await callLoad({ safeGetSession: authed(), supabase });

		expect(result).toEqual({ user, profile: A_PROFILE, champion: null });
	});

	it('degrades to champion: null on a champion-query error (never hard-fails the shell)', async () => {
		const supabase = makeSupabase(A_PROFILE, null, {
			championError: { message: 'champion boom', code: '500' }
		});

		const result = await callLoad({ safeGetSession: authed(), supabase });

		expect(result).toEqual({ user, profile: A_PROFILE, champion: null });
	});

	it('a champion-query error does NOT disturb the profile-funnel redirect (guard unaffected)', async () => {
		// Profile-less user on a deep app path: the !profile -> /sign-up redirect must
		// fire as normal even though the champion query errors. (In practice the
		// redirect throws before the champion read, but this pins that a champion
		// failure can never swallow or alter the funnel.)
		let thrown: unknown;
		try {
			await callLoad({
				safeGetSession: authed(),
				supabase: makeSupabase(null, null, {
					championError: { message: 'champion boom', code: '500' }
				}),
				url: new URL('https://x/snacktum-snacktorum/profile/someone')
			});
		} catch (e) {
			thrown = e;
		}

		expect(isRedirect(thrown)).toBe(true);
		expect((thrown as { location: string }).location).toBe('/sign-up');
	});
});
