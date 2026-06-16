// Server-side direct-message wrappers. Like the other feature modules
// (walls, reactions, voting, hotdogs, profiles), these run on the server (form
// actions / load functions), take an RLS-scoped SupabaseClient *passed in* —
// never a client-side secret key, and never a client-supplied sender id (the
// trusted sender id comes from safeGetSession()) — and return typed discriminated
// results rather than throwing; callers branch on `ok`.
//
// DMs are a PRIVACY surface, not a cosmetic one: the load-bearing control is the
// SELECT RLS (sender-or-recipient only). But the WRITE path is still a PLAIN
// owner-scoped RLS write (NOT a SECURITY DEFINER RPC) — there is no denormalized
// counter to maintain, so send is a plain INSERT and mark-read is a single
// recipient-scoped read_at UPDATE (the column grant confines the UPDATE to
// read_at). Inbox unread counts are computed at READ time by the pure
// summarizeConversations helper, never stored.
//
// We store the ORIGINAL body verbatim — M6 applies a render-time emoji filter;
// never persist filtered/transformed text.
//
// Known Postgres error states are mapped to typed handling keyed on SQLSTATE (the
// `code` field PostgREST surfaces), NEVER on message text.

import type { SupabaseClient } from '@supabase/supabase-js';

import { summarizeConversations, type ConversationSummary, type DmRow } from './summarize';

/** Discriminated result for DM operations. */
export type DmResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Maximum stored body length — mirrors the DB length CHECK backstop. */
export const MAX_DM_BODY_LENGTH = 1000;

/** A single message in a thread, as the thread render path reads it. */
export interface ThreadMessage {
	id: string;
	sender_id: string;
	recipient_id: string;
	body: string;
	created_at: string;
	read_at: string | null;
}

// A CHECK-constraint violation (body too long, or self-DM) is SQLSTATE 23514. The
// app boundary validates length first, so the length case is only a backstop; we
// map it to a friendly message rather than leaking the constraint text.
const CHECK_VIOLATION = '23514';

const EMPTY_BODY = 'Your message can’t be empty.';
const BODY_TOO_LONG = `Your message is too long (max ${MAX_DM_BODY_LENGTH} characters).`;
const SELF_DM = 'You can’t message yourself.';

// The embedded counterparty profile shape PostgREST returns for the inbox join.
// An FK embed is surfaced as an array by the inferred types; we normalize.
type EmbeddedProfile = { id: string; handle: string; display_name: string };

function normalizeEmbed(embed: EmbeddedProfile | EmbeddedProfile[] | null): EmbeddedProfile | null {
	return Array.isArray(embed) ? (embed[0] ?? null) : embed;
}

/**
 * Sends a direct message. Validates `body` is non-empty after trimming and within
 * the length bound at this app boundary (the DB CHECK is the backstop), then
 * inserts `{ sender_id, recipient_id, body }` on the passed RLS-scoped client. The
 * original (trimmed) body is stored verbatim — M6 applies a render-time emoji
 * filter, never persisted here.
 *
 * The INSERT is RLS-gated so sender_id is pinned to auth.uid(); the trusted
 * `senderId` must be the validated session uid (safeGetSession()), never a
 * client-supplied value. `recipientId` is unrestricted (you DM other members); a
 * self-DM is rejected at the boundary and by the DB CHECK.
 */
export async function sendDm(
	supabase: SupabaseClient,
	senderId: string,
	recipientId: string,
	body: string
): Promise<DmResult<null>> {
	const trimmed = body.trim();
	if (trimmed.length === 0) {
		return { ok: false, error: EMPTY_BODY };
	}
	if (trimmed.length > MAX_DM_BODY_LENGTH) {
		return { ok: false, error: BODY_TOO_LONG };
	}
	if (senderId === recipientId) {
		return { ok: false, error: SELF_DM };
	}

	const { error } = await supabase
		.from('dms')
		.insert({ sender_id: senderId, recipient_id: recipientId, body: trimmed });

	if (error) {
		if (error.code === CHECK_VIOLATION) {
			// Either the length backstop or the self-DM CHECK. The boundary already
			// validated both, so this is a defensive map to a friendly message.
			return { ok: false, error: BODY_TOO_LONG };
		}
		console.error('[dms] sendDm failed', {
			senderId,
			recipientId,
			code: error.code,
			error: error.message
		});
		return { ok: false, error: 'Could not send your message right now.' };
	}

	return { ok: true, data: null };
}

/**
 * Lists the viewer's conversations for the inbox. Reads every DM the viewer sent
 * OR received (the SELECT RLS already limits rows to those, but we filter
 * explicitly so the query is intention-revealing), embeds BOTH parties' profiles
 * so the pure aggregator can pick the counterparty, then derives the
 * per-counterparty list (latest message + unread count) via summarizeConversations.
 */
export async function listConversations(
	supabase: SupabaseClient,
	viewerId: string
): Promise<DmResult<ConversationSummary[]>> {
	const { data, error } = await supabase
		.from('dms')
		.select(
			'sender_id, recipient_id, body, created_at, read_at, ' +
				'sender:profiles!sender_id (id, handle, display_name), ' +
				'recipient:profiles!recipient_id (id, handle, display_name)'
		)
		.order('created_at', { ascending: false });

	if (error) {
		console.error('[dms] listConversations failed', {
			viewerId,
			error: error.message
		});
		return { ok: false, error: 'Could not load your messages right now.' };
	}

	type RawRow = {
		sender_id: string;
		recipient_id: string;
		body: string;
		created_at: string;
		read_at: string | null;
		sender: EmbeddedProfile | EmbeddedProfile[] | null;
		recipient: EmbeddedProfile | EmbeddedProfile[] | null;
	};

	const rows: DmRow[] = ((data as unknown as RawRow[] | null) ?? []).map((row) => {
		// The counterparty is the OTHER party relative to the viewer.
		const counterpartyEmbed = normalizeEmbed(
			row.sender_id === viewerId ? row.recipient : row.sender
		);
		return {
			sender_id: row.sender_id,
			recipient_id: row.recipient_id,
			body: row.body,
			created_at: row.created_at,
			read_at: row.read_at,
			counterparty_handle: counterpartyEmbed?.handle ?? '',
			counterparty_display_name: counterpartyEmbed?.display_name ?? ''
		};
	});

	return { ok: true, data: summarizeConversations(rows, viewerId) };
}

/**
 * Lists the messages between the viewer and one other member, oldest-first (the
 * natural thread reading order). The SELECT RLS limits visibility to the viewer's
 * own conversations; we additionally scope to the two parties (both directions)
 * via an .or filter so only this thread's rows return.
 */
export async function listThread(
	supabase: SupabaseClient,
	viewerId: string,
	counterpartyId: string
): Promise<DmResult<ThreadMessage[]>> {
	const { data, error } = await supabase
		.from('dms')
		.select('id, sender_id, recipient_id, body, created_at, read_at')
		.or(
			`and(sender_id.eq.${viewerId},recipient_id.eq.${counterpartyId}),` +
				`and(sender_id.eq.${counterpartyId},recipient_id.eq.${viewerId})`
		)
		.order('created_at', { ascending: true });

	if (error) {
		console.error('[dms] listThread failed', {
			viewerId,
			counterpartyId,
			error: error.message
		});
		return { ok: false, error: 'Could not load this conversation right now.' };
	}

	const rows = (data as ThreadMessage[] | null) ?? [];
	return { ok: true, data: rows };
}

/**
 * Marks the viewer's received unread messages in a thread as read. Sets `read_at`
 * to now() on every row where the viewer is the RECIPIENT, the counterparty is the
 * SENDER, and the row is still unread (`read_at is null`). The UPDATE is RLS-gated
 * (recipient_id = auth.uid()) and the column grant confines it to `read_at`, so it
 * can only mark-read — never rewrite the body.
 *
 * Idempotent: a thread with nothing unread updates zero rows and still succeeds.
 */
export async function markThreadRead(
	supabase: SupabaseClient,
	viewerId: string,
	counterpartyId: string
): Promise<DmResult<null>> {
	const { error } = await supabase
		.from('dms')
		.update({ read_at: new Date().toISOString() })
		.eq('recipient_id', viewerId)
		.eq('sender_id', counterpartyId)
		.is('read_at', null);

	if (error) {
		console.error('[dms] markThreadRead failed', {
			viewerId,
			counterpartyId,
			code: error.code,
			error: error.message
		});
		return { ok: false, error: 'Could not update this conversation right now.' };
	}

	return { ok: true, data: null };
}
