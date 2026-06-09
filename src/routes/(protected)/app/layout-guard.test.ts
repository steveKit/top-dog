import { describe, it, expect, vi } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { load } from './+layout.server';

// Defense-in-depth guard co-located with the protected route group. Even though
// `hooks.server.ts` already redirects, this load must independently refuse to
// render the app shell for an unauthenticated request, and must surface the
// validated user to nested loads when authenticated.
//
// TASK-011 added the profile funnel: an authenticated but profile-less user is
// redirected to /app/onboarding (unless already there). The load now also reads
// `locals.supabase` (to look up the profile) and `url.pathname` (to avoid the
// redirect loop), so the fake event supplies both.

const ONBOARDING_URL = new URL('https://x/app/onboarding');
const APP_URL = new URL('https://x/app');

/** A fake supabase whose profile lookup resolves the supplied row (or null). */
function makeSupabase(profileRow: unknown, error: unknown = null) {
	const maybeSingle = vi.fn().mockResolvedValue({ data: profileRow, error });
	const eq = vi.fn(() => ({ maybeSingle }));
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

describe('(protected)/app/+layout.server load', () => {
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

		expect(result).toEqual({ user, profile: A_PROFILE });
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

	it('redirects a profile-less authenticated user to /app/onboarding', async () => {
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
		expect((thrown as { location: string }).location).toBe('/app/onboarding');
	});

	it('does NOT redirect when a profile-less user is already on /app/onboarding (no loop)', async () => {
		const user = { id: 'u1', email: 'chef@topdog.test' };
		const session = { access_token: 'valid', user };
		const safeGetSession = vi.fn(async () => ({ session, user }));

		const result = await callLoad({
			safeGetSession,
			supabase: makeSupabase(null),
			url: ONBOARDING_URL
		});

		expect(result).toEqual({ user, profile: null });
	});

	it('redirects a profile-less user on a deep /app sub-path (not just /app)', async () => {
		const user = { id: 'u1', email: 'chef@topdog.test' };
		const session = { access_token: 'valid', user };
		const safeGetSession = vi.fn(async () => ({ session, user }));

		let thrown: unknown;
		try {
			await callLoad({
				safeGetSession,
				supabase: makeSupabase(null),
				url: new URL('https://x/app/profile/someone')
			});
		} catch (e) {
			thrown = e;
		}

		expect(isRedirect(thrown)).toBe(true);
		expect((thrown as { location: string }).location).toBe('/app/onboarding');
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

		expect(result).toEqual({ user, profile: null });
	});
});
