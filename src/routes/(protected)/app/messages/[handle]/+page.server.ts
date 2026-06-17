import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getProfileByHandle } from '$lib/features/profiles/profiles';
import { sendDm, listThread, markThreadRead } from '$lib/features/dms/dms';

// Direct-message thread (TASK-051) — the conversation with ONE other member plus a
// compose box. The counterparty is resolved from the TRUSTED route param handle
// (never a client-supplied id). The load lists the thread oldest-first and marks
// the viewer's RECEIVED unread messages read (the mark-read UPDATE is RLS-gated to
// recipient_id = auth.uid() and column-confined to read_at). The `send` action
// derives the sender from safeGetSession() — never client form input — so a sender
// cannot impersonate. All reads/writes are on the RLS-scoped client (DM content is
// text, gated by the SELECT policy; no service client needed).

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		throw redirect(303, '/sign-in');
	}

	const counterpartyResult = await getProfileByHandle(supabase, params.handle);
	if (!counterpartyResult.ok) {
		console.error('[dms] thread load: failed to resolve counterparty', {
			handle: params.handle,
			error: counterpartyResult.error
		});
		throw error(500, 'Could not load this conversation right now.');
	}
	if (!counterpartyResult.data) {
		throw error(404, 'No such chef.');
	}

	const counterparty = counterpartyResult.data;

	// You can't hold a conversation with yourself — funnel a self-thread back to
	// the inbox rather than rendering an empty self-DM compose box.
	if (counterparty.id === user.id) {
		throw redirect(303, '/app/messages');
	}

	const threadResult = await listThread(supabase, user.id, counterparty.id);
	if (!threadResult.ok) {
		console.error('[dms] thread load failed', {
			userId: user.id,
			counterpartyId: counterparty.id,
			error: threadResult.error
		});
		throw error(500, 'Could not load this conversation right now.');
	}

	// Mark the viewer's received unread messages from this counterparty read. A
	// failure here degrades to "unread badges linger" rather than failing the page.
	const markResult = await markThreadRead(supabase, user.id, counterparty.id);
	if (!markResult.ok) {
		console.error('[dms] markThreadRead failed on load', {
			userId: user.id,
			counterpartyId: counterparty.id,
			error: markResult.error
		});
	}

	return {
		counterparty: {
			id: counterparty.id,
			handle: counterparty.handle,
			display_name: counterparty.display_name
		},
		messages: threadResult.data,
		viewerId: user.id
	};
};

export const actions: Actions = {
	// Send a message to this thread's counterparty. The sender is derived from
	// safeGetSession() (never client-supplied); the recipient is resolved from the
	// TRUSTED route param handle. The body is validated at the app boundary
	// (sendDm), stored verbatim, and the INSERT is RLS-gated so sender_id =
	// auth.uid().
	send: async ({ request, params, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { message: 'You must be signed in to send a message.' });
		}

		const counterpartyResult = await getProfileByHandle(supabase, params.handle);
		if (!counterpartyResult.ok) {
			console.error('[dms] send: failed to resolve counterparty', {
				handle: params.handle,
				error: counterpartyResult.error
			});
			return fail(500, { message: 'Could not send your message right now.' });
		}
		if (!counterpartyResult.data) {
			return fail(404, { message: 'No such chef.' });
		}

		const formData = await request.formData();
		const body = String(formData.get('body') ?? '');

		const result = await sendDm(supabase, user.id, counterpartyResult.data.id, body);
		if (!result.ok) {
			console.error('[dms] send failed', {
				userId: user.id,
				recipientId: counterpartyResult.data.id,
				error: result.error
			});
			return fail(400, { message: result.error });
		}

		return { sent: true };
	}
};
