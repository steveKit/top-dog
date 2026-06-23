import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { createInvite } from '$lib/features/invites/invites';

// Invite generation for an authenticated member. The (protected) group is
// already guarded by hooks.server.ts + the app layout load, but we re-read the
// validated session here (never raw getSession()) so the inviter_id we write is
// the trusted auth.uid(), and we fail closed if the session is somehow absent.

export const actions: Actions = {
	create: async ({ locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { error: 'You must be signed in to create an invite.' });
		}

		const result = await createInvite(supabase, user.id);
		if (!result.ok) {
			console.error('[invites] createInvite failed', {
				inviterId: user.id,
				error: result.error
			});
			return fail(500, { error: 'Could not create an invite right now. Please try again.' });
		}

		return { token: result.data.token };
	}
};
