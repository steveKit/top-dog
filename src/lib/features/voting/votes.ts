// Server-side vote wrappers. These run on the server (form actions / endpoints)
// and take an RLS-scoped SupabaseClient *passed in* — never a client-side secret
// key, and never a client-supplied voter id (the RPC derives the voter from
// auth.uid()). They call the SECURITY DEFINER vote RPCs (cast_vote / remove_vote)
// and return typed discriminated results rather than throwing, mirroring the
// invites/storage modules' result convention; callers branch on `ok`.
//
// Known Postgres error states from the RPCs are mapped to typed sentinels keyed
// on SQLSTATE (the `code` field PostgREST surfaces), NEVER on message text —
// matching createProfile's `error.code === UNIQUE_VIOLATION` style.
//
// Live wiring: these wrappers are consumed by the vote-casting feed
// (/snacktum-snacktorum/feed) — its +page.server.ts form actions wire castVote / removeVote into
// the production vote surface (TASK-024).

import type { SupabaseClient } from '@supabase/supabase-js';

/** Discriminated result for vote operations. */
export type VoteResult<T> = { ok: true; data: T } | { ok: false; error: string | VoteErrorCode };

// SQLSTATEs the vote RPCs raise (see the migration's error contract). Keyed on,
// never message text.
const UNAUTHENTICATED = '28000';
const SELF_VOTE = '23514'; // check_violation: RPC pre-check + row-level trigger
const NO_SUCH_DOG = 'P0002'; // no_data_found

/**
 * Typed sentinels for the known, user-meaningful vote failures. Callers can
 * branch on these to show a friendly message without parsing Postgres text.
 */
export const VOTE_UNAUTHENTICATED = 'VOTE_UNAUTHENTICATED' as const;
export const VOTE_SELF = 'VOTE_SELF' as const;
export const VOTE_NO_SUCH_DOG = 'VOTE_NO_SUCH_DOG' as const;

export type VoteErrorCode =
	| typeof VOTE_UNAUTHENTICATED
	| typeof VOTE_SELF
	| typeof VOTE_NO_SUCH_DOG;

/**
 * Maps a known RPC SQLSTATE to its typed sentinel, or `null` when the code is
 * not one of the recognised vote failures (the caller then surfaces the raw
 * SDK message).
 */
function voteErrorFromCode(code: string | undefined): VoteErrorCode | null {
	switch (code) {
		case UNAUTHENTICATED:
			return VOTE_UNAUTHENTICATED;
		case SELF_VOTE:
			return VOTE_SELF;
		case NO_SUCH_DOG:
			return VOTE_NO_SUCH_DOG;
		default:
			return null;
	}
}

/**
 * Casts — or MOVES — the caller's single active vote to `targetDogId`, via the
 * `cast_vote` SECURITY DEFINER RPC. The voter is derived from auth.uid() inside
 * the function, so this cannot forge a vote as another user. Because of
 * UNIQUE(voter_id), re-casting at a different dog moves the existing vote; the
 * RPC recomputes both dogs' vote_count and the crown in one transaction.
 *
 * Returns the vote id on success. Known failures map to typed sentinels:
 * `VOTE_UNAUTHENTICATED`, `VOTE_SELF` (voting for your own dog), `VOTE_NO_SUCH_DOG`.
 */
export async function castVote(
	supabase: SupabaseClient,
	targetDogId: string
): Promise<VoteResult<string>> {
	const { data, error } = await supabase.rpc('cast_vote', { target_dog: targetDogId });

	if (error) {
		return { ok: false, error: voteErrorFromCode(error.code) ?? error.message };
	}

	if (!data) {
		return { ok: false, error: 'Failed to cast your vote.' };
	}

	return { ok: true, data: data as string };
}

/**
 * Removes the caller's active vote (if any), via the `remove_vote` SECURITY
 * DEFINER RPC. The voter is derived from auth.uid(). Idempotent: removing when
 * there is no active vote succeeds with `data: null`. On success the RPC has
 * recomputed the affected dog's vote_count and the crown in one transaction.
 *
 * Returns the hot_dog_id the vote was removed from, or `null` when there was no
 * active vote. The only known typed failure is `VOTE_UNAUTHENTICATED`.
 */
export async function removeVote(supabase: SupabaseClient): Promise<VoteResult<string | null>> {
	const { data, error } = await supabase.rpc('remove_vote');

	if (error) {
		return { ok: false, error: voteErrorFromCode(error.code) ?? error.message };
	}

	// The RPC returns the removed hot_dog_id, or NULL when there was no vote.
	return { ok: true, data: (data as string | null) ?? null };
}
