import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * The root path has no landing surface of its own — `/app` is the single app
 * entry point and its `(protected)/app/+layout.server.ts` already cascades the
 * auth/profile funnel (unauthenticated → /sign-in, profile-less → onboarding).
 * So `/` is an unconditional redirect to `/app`.
 *
 * 307 (temporary) rather than 308 (permanent): the eventual destination is
 * user-dependent (the `/app` guard forwards to /sign-in or /onboarding based on
 * session/profile state), so this landing should not be cached as a permanent
 * mapping by browsers/proxies. The matching auth redirects in the app guard use
 * 303; 307 is the GET-preserving analogue for an always-redirect landing.
 */
export const load: PageServerLoad = () => {
	throw redirect(307, '/app');
};
