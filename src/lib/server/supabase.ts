// Server-only Supabase client using the SECRET key (sb_secret_*).
//
// This client bypasses Row-Level Security and must NEVER reach the browser.
// SvelteKit guarantees `$lib/server/*` is never bundled into client code.
// Use this only for trusted server-side operations (e.g. privileged reads or
// writes that intentionally run outside a user's RLS context). For normal
// request-scoped, RLS-enforced access use `event.locals.supabase`.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env as publicEnv } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';

let client: SupabaseClient | undefined;

/**
 * Returns a lazily-instantiated singleton Supabase client authenticated with
 * the secret key. Server-only — importing this module from client-reachable
 * code is a build error by SvelteKit's `$lib/server` boundary.
 */
export function getServiceClient(): SupabaseClient {
	if (!client) {
		const url = publicEnv.PUBLIC_SUPABASE_URL;
		const secretKey = privateEnv.SUPABASE_SECRET_KEY;
		if (!url || !secretKey) {
			throw new Error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY env var');
		}
		client = createClient(url, secretKey, {
			auth: {
				autoRefreshToken: false,
				persistSession: false
			}
		});
	}
	return client;
}
