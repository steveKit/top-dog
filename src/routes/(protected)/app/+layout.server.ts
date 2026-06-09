import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getProfileById } from '$lib/features/profiles/profiles';

const ONBOARDING_PATH = '/app/onboarding';

/**
 * Guard for the authenticated app area. The global hook (`hooks.server.ts`)
 * already redirects unauthenticated requests under `/app`; this load is a
 * defense-in-depth check so the guard is co-located with the protected routes
 * and surfaces the validated user to nested loads.
 *
 * Profile-funnel integration (TASK-011): a freshly-redeemed user has an auth
 * account but no `profiles` row yet (sign-up only redeems the invite, then
 * redirects to /app). We look up the profile and, if none exists, funnel the
 * user into onboarding so they set a handle before using the app. The redirect
 * is suppressed when the request is ALREADY on `/app/onboarding`, which both
 * lets the onboarding page render and avoids a redirect loop. The profile (or
 * null) is surfaced to nested loads via the returned data.
 */
export const load: LayoutServerLoad = async ({ url, locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		throw redirect(303, '/sign-in');
	}

	const profileResult = await getProfileById(supabase, user.id);
	if (!profileResult.ok) {
		// Don't swallow the error — log context server-side. We let the request
		// continue (treating the profile as absent) rather than hard-failing the
		// whole app shell on a transient read error.
		console.error('[profiles] failed to load profile for app guard', {
			userId: user.id,
			error: profileResult.error
		});
	}

	const profile = profileResult.ok ? profileResult.data : null;

	// Funnel a profile-less user into onboarding, unless they're already there
	// (avoids a redirect loop and lets the onboarding page render).
	if (!profile && url.pathname !== ONBOARDING_PATH) {
		throw redirect(303, ONBOARDING_PATH);
	}

	return { user, profile };
};
