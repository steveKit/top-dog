// Validated accessors for the public Supabase env vars.
//
// `$env/dynamic/public` types every value as `string | undefined` (values are
// resolved at runtime, not build time). We validate presence at this boundary
// so the rest of the app can treat the URL and publishable key as guaranteed
// strings. Works isomorphically (browser + server) because both read from
// `$env/dynamic/public`.

import { env } from '$env/dynamic/public';

function required(name: string, value: string | undefined): string {
	if (!value) {
		throw new Error(`Missing required public env var: ${name}`);
	}
	return value;
}

export function getPublicSupabaseConfig(): { url: string; publishableKey: string } {
	return {
		url: required('PUBLIC_SUPABASE_URL', env.PUBLIC_SUPABASE_URL),
		publishableKey: required('PUBLIC_SUPABASE_PUBLISHABLE_KEY', env.PUBLIC_SUPABASE_PUBLISHABLE_KEY)
	};
}
