// Per-request Supabase SSR setup + auth guard.
//
// Creates a request-scoped Supabase client backed by the request cookies, and
// exposes a `safeGetSession()` helper on `event.locals` that validates the JWT
// by calling `getUser()` (the server cannot trust `getSession()` alone, which
// only decodes the cookie without verifying it against the auth server).

import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';
import { type Handle, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { getPublicSupabaseConfig } from '$lib/supabase/env';

export const supabase: Handle = async ({ event, resolve }) => {
	const { url, publishableKey } = getPublicSupabaseConfig();

	const cookies: CookieMethodsServer = {
		getAll: () => event.cookies.getAll(),
		setAll: (cookiesToSet) => {
			cookiesToSet.forEach(({ name, value, options }) => {
				// `path` is required by SvelteKit's cookie API.
				event.cookies.set(name, value, { ...options, path: '/' });
			});
		}
	};

	event.locals.supabase = createServerClient(url, publishableKey, { cookies });

	/**
	 * Validates the session by verifying the JWT with the auth server via
	 * `getUser()`, then returns the (now-trusted) session alongside the user.
	 * Returns nulls when there is no session or the JWT is invalid.
	 */
	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		if (!session) {
			return { session: null, user: null };
		}

		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error || !user) {
			// JWT validation failed — treat as unauthenticated.
			return { session: null, user: null };
		}

		return { session, user };
	};

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			// Supabase needs the content-range and content-encoding headers to
			// be forwarded for storage range requests.
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};

export const authGuard: Handle = async ({ event, resolve }) => {
	const { session, user } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.user = user;

	// Protect everything under the (protected) route group.
	if (!session && event.url.pathname.startsWith('/app')) {
		throw redirect(303, '/sign-in');
	}

	return resolve(event);
};

export const handle: Handle = sequence(supabase, authGuard);
