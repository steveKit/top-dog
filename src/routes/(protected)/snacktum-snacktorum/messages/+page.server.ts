import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listConversations } from '$lib/features/dms/dms';

// Direct-message inbox (TASK-051). Lists the viewer's conversations — their
// distinct counterparties with the latest message and unread count — derived from
// the flat `dms` table by the pure summarizeConversations aggregator. The load is
// safeGetSession()-gated and reads on the RLS-scoped client, so the SELECT policy
// (sender-or-recipient only) already limits visibility to the viewer's own DMs;
// the viewer id comes from the validated session, never client input.

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		throw redirect(303, '/sign-in');
	}

	const result = await listConversations(supabase, user.id);
	if (!result.ok) {
		console.error('[dms] inbox load failed', {
			userId: user.id,
			error: result.error
		});
		throw error(500, 'Could not load your messages right now.');
	}

	return { conversations: result.data };
};
