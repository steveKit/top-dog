import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getProfileById } from '$lib/features/profiles/profiles';

// The onboarding funnel target is now the Snacktum Onboarding RITE at /sign-up
// (TASK-092). The standalone /snacktum-snacktorum/onboarding route was absorbed
// into the rite, so a profile-less member is funneled to /sign-up, where the rite
// detects their existing session and RESUMES at the naming/sigil (profile-creation)
// step.
const ONBOARDING_PATH = '/sign-up';

/**
 * Guard for the authenticated app area. The global hook (`hooks.server.ts`)
 * already redirects unauthenticated requests under `/snacktum-snacktorum`; this
 * load is a defense-in-depth check so the guard is co-located with the protected
 * routes and surfaces the validated user to nested loads.
 *
 * Profile-funnel integration (TASK-011, retargeted TASK-092): a freshly-redeemed
 * user has an auth account but no `profiles` row yet. We look up the profile and,
 * if none exists, funnel the user to /sign-up — the onboarding rite, which
 * resumes at the profile-creation step for an already-authenticated visitor (it
 * does not re-ask for invite/credentials). The funnel can't loop here because
 * /sign-up lives OUTSIDE the protected `/snacktum-snacktorum` group, so this guard
 * never runs for it. The profile (or null) is surfaced to nested loads via the
 * returned data.
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

	// Funnel a profile-less user into the onboarding rite at /sign-up. The
	// pathname guard is defensive only — /sign-up is outside this protected group,
	// so this load never runs for it and the funnel cannot loop.
	if (!profile && url.pathname !== ONBOARDING_PATH) {
		throw redirect(303, ONBOARDING_PATH);
	}

	return { user, profile };
};
