import { describe, it, expect, vi } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { load } from './+layout.server';

// Defense-in-depth guard co-located with the protected route group. Even though
// `hooks.server.ts` already redirects, this load must independently refuse to
// render the app shell for an unauthenticated request, and must surface the
// validated user to nested loads when authenticated.
//
// `load` only reads `locals.safeGetSession`, so we hand it a fake event with a
// stubbed helper and assert on the redirect / returned data.

function callLoad(safeGetSession: () => Promise<unknown>) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return load({ locals: { safeGetSession } } as any);
}

describe('(protected)/app/+layout.server load', () => {
	it('redirects to /sign-in when there is no validated session', async () => {
		const safeGetSession = vi.fn(async () => ({ session: null, user: null }));

		let thrown: unknown;
		try {
			await callLoad(safeGetSession);
		} catch (e) {
			thrown = e;
		}

		expect(isRedirect(thrown)).toBe(true);
		expect((thrown as { status: number }).status).toBe(303);
		expect((thrown as { location: string }).location).toBe('/sign-in');
	});

	it('returns the validated user when a session exists', async () => {
		const user = { id: 'u1', email: 'chef@topdog.test' };
		const session = { access_token: 'valid', user };
		const safeGetSession = vi.fn(async () => ({ session, user }));

		const result = await callLoad(safeGetSession);

		expect(result).toEqual({ user });
	});

	it('redirects even if a user object is present but the session is null', async () => {
		// A null session is the authoritative signal; never render on user alone.
		const safeGetSession = vi.fn(async () => ({
			session: null,
			user: { id: 'u1' }
		}));

		let thrown: unknown;
		try {
			await callLoad(safeGetSession);
		} catch (e) {
			thrown = e;
		}

		expect(isRedirect(thrown)).toBe(true);
	});
});
