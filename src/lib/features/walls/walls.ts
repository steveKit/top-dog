// Server-side wall-message wrappers. Like the other feature modules (reactions,
// mustard, voting, hotdogs, profiles), these run on the server (form actions /
// load functions), take an RLS-scoped SupabaseClient *passed in* — never a
// client-side secret key, and never a client-supplied author id (the trusted
// author id comes from safeGetSession()) — and return typed discriminated
// results rather than throwing; callers branch on `ok`.
//
// Wall messages are a COSMETIC / many-allowed surface (like reactions decision
// #12 and sprays decision #15): there is NO denormalized counter, so — unlike
// votes — these are plain owner-scoped RLS writes, not SECURITY DEFINER RPCs.
// The INSERT policy pins author_id = auth.uid(); we additionally pass the trusted
// authorId explicitly so the row matches the policy's auth.uid() check.
//
// We store the ORIGINAL body verbatim — M6 applies a render-time emoji filter;
// never persist filtered/transformed text.
//
// Known Postgres error states are mapped to typed handling keyed on SQLSTATE (the
// `code` field PostgREST surfaces), NEVER on message text.

import type { SupabaseClient } from '@supabase/supabase-js';

/** Discriminated result for wall operations. */
export type WallResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Maximum stored body length — mirrors the DB length CHECK backstop. */
export const MAX_WALL_BODY_LENGTH = 1000;

/** A wall message row as the profile render path reads it. */
export interface WallMessageRow {
	id: string;
	author_id: string;
	body: string;
	created_at: string;
	/** The author's handle, joined for display ("by @handle"). */
	author_handle: string;
	/** The author's display name, joined for display. */
	author_display_name: string;
}

// A CHECK-constraint violation (body too long) is SQLSTATE 23514. The app
// boundary validates length first, so this is only a backstop, but we map it to
// a friendly message rather than leaking the constraint text.
const CHECK_VIOLATION = '23514';

const EMPTY_BODY = 'Your message can’t be empty.';
const BODY_TOO_LONG = `Your message is too long (max ${MAX_WALL_BODY_LENGTH} characters).`;

/**
 * Posts a message on the target profile's wall. Validates `body` is non-empty
 * after trimming and within the length bound at this app boundary (the DB CHECK
 * is the backstop), then inserts `{ profile_id, author_id, body }` on the passed
 * RLS-scoped client. The original (trimmed) body is stored verbatim — M6 applies
 * a render-time emoji filter, never persisted here.
 *
 * The INSERT is RLS-gated so author_id is pinned to auth.uid(); the trusted
 * `authorId` must be the validated session uid (safeGetSession()), never a
 * client-supplied value. The wall owner (`profileId`) is unrestricted — posting
 * on OTHER members' walls is the point.
 */
export async function postWallMessage(
	supabase: SupabaseClient,
	authorId: string,
	profileId: string,
	body: string
): Promise<WallResult<null>> {
	const trimmed = body.trim();
	if (trimmed.length === 0) {
		return { ok: false, error: EMPTY_BODY };
	}
	if (trimmed.length > MAX_WALL_BODY_LENGTH) {
		return { ok: false, error: BODY_TOO_LONG };
	}

	const { error } = await supabase
		.from('wall_messages')
		.insert({ profile_id: profileId, author_id: authorId, body: trimmed });

	if (error) {
		if (error.code === CHECK_VIOLATION) {
			return { ok: false, error: BODY_TOO_LONG };
		}
		console.error('[walls] postWallMessage failed', {
			authorId,
			profileId,
			code: error.code,
			error: error.message
		});
		return { ok: false, error: 'Could not post your message right now.' };
	}

	return { ok: true, data: null };
}

/**
 * Fetches the latest `limit` messages on a profile's wall, newest first. Joins
 * the author's handle and display name for render. RLS exposes all wall messages
 * to authenticated members (public, like the feed), so no owner filter is needed.
 */
export async function listWallMessages(
	supabase: SupabaseClient,
	profileId: string,
	limit = 50
): Promise<WallResult<WallMessageRow[]>> {
	const { data, error } = await supabase
		.from('wall_messages')
		.select('id, author_id, body, created_at, author:profiles!author_id (handle, display_name)')
		.eq('profile_id', profileId)
		.order('created_at', { ascending: false })
		.limit(limit);

	if (error) {
		console.error('[walls] listWallMessages failed', {
			profileId,
			error: error.message
		});
		return { ok: false, error: 'Could not load the wall right now.' };
	}

	// The embedded `author` is a to-one relationship, but PostgREST's inferred
	// types surface an FK embed as an array; normalize either shape to a single
	// author object.
	type EmbeddedAuthor = { handle: string; display_name: string };
	type RawRow = {
		id: string;
		author_id: string;
		body: string;
		created_at: string;
		author: EmbeddedAuthor | EmbeddedAuthor[] | null;
	};

	const rows: WallMessageRow[] = ((data as unknown as RawRow[] | null) ?? []).map((row) => {
		const author = Array.isArray(row.author) ? (row.author[0] ?? null) : row.author;
		return {
			id: row.id,
			author_id: row.author_id,
			body: row.body,
			created_at: row.created_at,
			author_handle: author?.handle ?? '',
			author_display_name: author?.display_name ?? ''
		};
	});

	return { ok: true, data: rows };
}

/**
 * Deletes a wall message by id. The DELETE is RLS-gated so it succeeds only when
 * the caller is the message AUTHOR or the WALL OWNER (the policy's disjunction);
 * a non-author/non-owner delete affects zero rows. We do not need to re-check
 * authorization here — the RLS policy is authoritative — but the trusted caller
 * id must still come from the session, never the client.
 *
 * Idempotent: deleting a message that isn't there (or that the caller cannot
 * delete) affects zero rows and still succeeds.
 */
export async function deleteWallMessage(
	supabase: SupabaseClient,
	messageId: string
): Promise<WallResult<null>> {
	const { error } = await supabase.from('wall_messages').delete().eq('id', messageId);

	if (error) {
		console.error('[walls] deleteWallMessage failed', {
			messageId,
			code: error.code,
			error: error.message
		});
		return { ok: false, error: 'Could not delete that message right now.' };
	}

	return { ok: true, data: null };
}
