import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/**
 * Guard for the authenticated app area. The global hook (`hooks.server.ts`)
 * already redirects unauthenticated requests under `/app`; this load is a
 * defense-in-depth check so the guard is co-located with the protected routes
 * and surfaces the validated user to nested loads.
 */
export const load: LayoutServerLoad = async ({ locals: { safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session) {
		throw redirect(303, '/sign-in');
	}
	return { user };
};
