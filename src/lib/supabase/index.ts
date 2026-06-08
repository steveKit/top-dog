// Browser-side Supabase client factory.
//
// Uses only the PUBLIC_ publishable key — the secret key must never reach the
// browser. The actual isomorphic client (browser vs server) is constructed in
// `src/routes/+layout.ts`; this factory centralizes the browser variant so the
// publishable key and URL are read in one place.

import { createBrowserClient } from '@supabase/ssr';
import { getPublicSupabaseConfig } from './env';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client for use in the browser. The publishable key is
 * safe to expose; RLS enforces authorization at the database.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
	const { url, publishableKey } = getPublicSupabaseConfig();
	return createBrowserClient(url, publishableKey);
}
