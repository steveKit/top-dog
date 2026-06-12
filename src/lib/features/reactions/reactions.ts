// Server-side reaction wrappers. Like the other feature modules
// (voting/votes, voting/feed, hotdogs, profiles), these run on the server (form
// actions / load functions), take an RLS-scoped SupabaseClient *passed in* —
// never a client-side secret key, and never a client-supplied user id (the
// trusted viewer id comes from safeGetSession()) — and return typed discriminated
// results rather than throwing; callers branch on `ok`.
//
// Reactions are COSMETIC flair (decision #12): there is NO denormalized counter,
// so — unlike votes — these are plain RLS-scoped INSERT/DELETE writes, not
// SECURITY DEFINER RPCs. RLS pins user_id = auth.uid(); we additionally pass the
// trusted viewerId explicitly so the row matches the policy's auth.uid() check.
//
// Known Postgres error states are mapped to typed handling keyed on SQLSTATE (the
// `code` field PostgREST surfaces), NEVER on message text — matching
// createProfile's `error.code === UNIQUE_VIOLATION` style.

import type { SupabaseClient } from '@supabase/supabase-js';

import { isAllowedReactionEmoji } from './emojiSet';
import type { ReactionRow } from './summarize';

/** Discriminated result for reaction operations. */
export type ReactionResult<T> = { ok: true; data: T } | { ok: false; error: string };

// A duplicate add (this user already reacted with this emoji on this dog) raises
// unique_violation. Toggle-add is idempotent, so we treat it as a benign success
// rather than an error.
const UNIQUE_VIOLATION = '23505';

/** Rejected before touching the DB when the emoji is not in the allowed set. */
const DISALLOWED_EMOJI = 'That reaction is not allowed.';

/**
 * Adds the viewer's reaction (an idempotent toggle-on). Validates the emoji is in
 * the allowed set at this boundary (the app boundary is authoritative — the DB
 * keeps only a length sanity CHECK), then inserts
 * `{ user_id: viewerId, hot_dog_id, emoji }`. The insert is RLS-gated to the
 * viewer's own rows.
 *
 * Idempotent: a unique-violation (the viewer already reacted with this emoji on
 * this dog) maps to a benign success, NOT an error — re-reacting is a no-op.
 *
 * The trusted `viewerId` must be the validated session uid (safeGetSession()),
 * never a client-supplied value.
 */
export async function addReaction(
	supabase: SupabaseClient,
	viewerId: string,
	hotDogId: string,
	emoji: string
): Promise<ReactionResult<null>> {
	if (!isAllowedReactionEmoji(emoji)) {
		return { ok: false, error: DISALLOWED_EMOJI };
	}

	const { error } = await supabase
		.from('hotdog_reactions')
		.insert({ user_id: viewerId, hot_dog_id: hotDogId, emoji });

	if (error) {
		// Already reacted with this emoji — idempotent toggle-on, treat as success.
		if (error.code === UNIQUE_VIOLATION) {
			return { ok: true, data: null };
		}
		console.error('[reactions] addReaction failed', {
			viewerId,
			hotDogId,
			emoji,
			code: error.code,
			error: error.message
		});
		return { ok: false, error: 'Could not add your reaction right now.' };
	}

	return { ok: true, data: null };
}

/**
 * Removes the viewer's reaction (the toggle-off half). Validates the emoji is
 * allowed at this boundary, then deletes the matching
 * `(user_id, hot_dog_id, emoji)` row. The delete is RLS-gated to the viewer's own
 * rows and additionally scoped by `user_id = viewerId`.
 *
 * Idempotent: deleting a reaction that isn't there affects zero rows and still
 * succeeds.
 *
 * The trusted `viewerId` must be the validated session uid, never a client value.
 */
export async function removeReaction(
	supabase: SupabaseClient,
	viewerId: string,
	hotDogId: string,
	emoji: string
): Promise<ReactionResult<null>> {
	if (!isAllowedReactionEmoji(emoji)) {
		return { ok: false, error: DISALLOWED_EMOJI };
	}

	const { error } = await supabase
		.from('hotdog_reactions')
		.delete()
		.eq('user_id', viewerId)
		.eq('hot_dog_id', hotDogId)
		.eq('emoji', emoji);

	if (error) {
		console.error('[reactions] removeReaction failed', {
			viewerId,
			hotDogId,
			emoji,
			code: error.code,
			error: error.message
		});
		return { ok: false, error: 'Could not remove your reaction right now.' };
	}

	return { ok: true, data: null };
}

/**
 * Fetches reaction rows for a SET of hot dog ids — the feed load reads every
 * listed dog's reactions in one query, then summarizeReactions() aggregates them
 * per dog. Returns only the columns the aggregator needs (emoji, user_id) plus
 * hot_dog_id so the caller can bucket rows per dog. RLS exposes all reactions to
 * authenticated members (public flair), so no per-row owner filter is needed.
 *
 * An empty id list short-circuits to an empty result (no pointless query).
 */
export async function listReactionsForDogs(
	supabase: SupabaseClient,
	hotDogIds: string[]
): Promise<ReactionResult<(ReactionRow & { hot_dog_id: string })[]>> {
	if (hotDogIds.length === 0) {
		return { ok: true, data: [] };
	}

	const { data, error } = await supabase
		.from('hotdog_reactions')
		.select('hot_dog_id, emoji, user_id')
		.in('hot_dog_id', hotDogIds);

	if (error) {
		console.error('[reactions] listReactionsForDogs failed', {
			count: hotDogIds.length,
			error: error.message
		});
		return { ok: false, error: 'Could not load reactions right now.' };
	}

	const rows = (data as (ReactionRow & { hot_dog_id: string })[] | null) ?? [];
	return { ok: true, data: rows };
}
