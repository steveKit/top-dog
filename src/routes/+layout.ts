import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr';
import { getPublicSupabaseConfig } from '$lib/supabase/env';
import type { LayoutLoad } from './$types';

/**
 * Builds an isomorphic Supabase client: a real browser client when running in
 * the browser, and a cookie-backed server client during SSR (reusing the
 * cookies forwarded by the server load). Exposes `supabase` and the validated
 * `session` to every page/layout via `data`.
 */
export const load: LayoutLoad = async ({ data, depends, fetch }) => {
	// Invalidate this load (and dependent loads) on auth state changes.
	depends('supabase:auth');

	const { url, publishableKey } = getPublicSupabaseConfig();

	const supabase = isBrowser()
		? createBrowserClient(url, publishableKey, {
				global: { fetch }
			})
		: createServerClient(url, publishableKey, {
				global: { fetch },
				cookies: {
					getAll: () => data.cookies
				}
			});

	return { supabase, session: data.session };
};
