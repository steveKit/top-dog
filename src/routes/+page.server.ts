import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * The root path has no landing surface of its own — The Procession (`/app/feed`)
 * is the app's home, and the `(protected)/app/+layout.server.ts` guard cascades
 * the auth/profile funnel (unauthenticated → /sign-in, profile-less → /sign-up
 * onboarding rite) before the feed renders. So `/` is an unconditional redirect
 * straight to the feed, skipping the now-retired bare `/app` hub hop (TASK-080).
 *
 * 307 (temporary) rather than 308 (permanent): the eventual destination is
 * user-dependent (the `/app` guard forwards to /sign-in or /sign-up based on
 * session/profile state), so this landing should not be cached as a permanent
 * mapping by browsers/proxies. The matching auth redirects in the app guard use
 * 303; 307 is the GET-preserving analogue for an always-redirect landing.
 */
export const load: PageServerLoad = () => {
	throw redirect(307, '/app/feed');
};
