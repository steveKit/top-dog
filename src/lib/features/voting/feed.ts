// Server-side feed/leaderboard query wrappers. Like the other feature modules
// (hotdogs/profiles/invites/storage), these run on the server (load functions /
// form actions), take an RLS-scoped SupabaseClient *passed in*, and return typed
// discriminated results rather than throwing; callers branch on `ok`.
//
// These back the global vote feed (TASK-024): the surface that lists OTHER
// members' hot dogs so a member can actually cast/move/remove a vote. The feed
// doubles as the live leaderboard (sorted by vote_count desc), so the ordering
// here matches the leaderboard reading — but the AUTHORITATIVE crown is still the
// vote RPC's recompute_top_dog(), never this read.

import type { SupabaseClient } from '@supabase/supabase-js';

/** Discriminated result for feed queries. */
export type FeedResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * A votable hot dog as the feed reads it: the dog plus its owner's public
 * identity (handle / display_name), joined from `profiles` via the
 * `hot_dogs.owner_id -> profiles.id` FK. `vote_count` is the server-maintained
 * denormalized counter (read-only to clients); the feed sorts and displays it.
 */
export interface VotableDog {
	id: string;
	owner_id: string;
	image_path: string;
	caption: string | null;
	vote_count: number;
	owner_handle: string;
	owner_display_name: string;
}

/**
 * The shape PostgREST returns for the embedded-profile select. supabase-js infers
 * the embed as an ARRAY of the related rows even for a to-one FK relationship, so
 * we type it that way and read the first element (there is exactly one owner per
 * dog via the NOT NULL FK; we guard defensively for the empty case anyway).
 */
interface VotableDogRow {
	id: string;
	owner_id: string;
	image_path: string;
	caption: string | null;
	vote_count: number;
	profiles:
		| { handle: string; display_name: string }[]
		| { handle: string; display_name: string }
		| null;
}

/**
 * Lists every hot dog the viewer can vote for — i.e. ALL hot dogs EXCEPT the
 * viewer's own — sorted by vote_count desc (so this read doubles as the live
 * leaderboard). Each row is joined to its owner's `profiles.handle` /
 * `display_name`. RLS exposes all hot_dogs to authenticated members, so the only
 * filter is `owner_id != viewerId` (a self-vote is rejected by the RPC anyway,
 * but the feed never even offers the viewer's own dogs).
 *
 * The trusted `viewerId` must be the validated session uid (safeGetSession()),
 * never a client-supplied value.
 */
export async function listVotableDogs(
	supabase: SupabaseClient,
	viewerId: string
): Promise<FeedResult<VotableDog[]>> {
	const { data, error } = await supabase
		.from('hot_dogs')
		.select('id, owner_id, image_path, caption, vote_count, profiles(handle, display_name)')
		.neq('owner_id', viewerId)
		.order('vote_count', { ascending: false })
		.order('id', { ascending: true });

	if (error) {
		return { ok: false, error: error.message };
	}

	const rows = (data as unknown as VotableDogRow[] | null) ?? [];
	const dogs: VotableDog[] = rows.map((row) => {
		// Normalize the embed: PostgREST may surface it as an array (to-one inferred
		// as a list) or a single object — take the owner row either way.
		const owner = Array.isArray(row.profiles) ? (row.profiles[0] ?? null) : row.profiles;
		return {
			id: row.id,
			owner_id: row.owner_id,
			image_path: row.image_path,
			caption: row.caption,
			vote_count: row.vote_count,
			owner_handle: owner?.handle ?? '',
			owner_display_name: owner?.display_name ?? ''
		};
	});

	return { ok: true, data: dogs };
}

/**
 * Fetches the viewer's CURRENT active vote — the `hot_dog_id` they are voting
 * for, or `null` when they have no active vote. The `votes` table is SELECT-able
 * by authenticated members; we scope to the viewer's own row via
 * `voter_id = viewerId` (which is unique — at most one active vote per user).
 *
 * The trusted `viewerId` must be the validated session uid, never a client value.
 * Used by the feed to indicate the voted dog and label the "Move vote here"
 * affordance on the others.
 */
export async function getCurrentVote(
	supabase: SupabaseClient,
	viewerId: string
): Promise<FeedResult<string | null>> {
	const { data, error } = await supabase
		.from('votes')
		.select('hot_dog_id')
		.eq('voter_id', viewerId)
		.maybeSingle();

	if (error) {
		return { ok: false, error: error.message };
	}

	const row = data as { hot_dog_id: string } | null;
	return { ok: true, data: row?.hot_dog_id ?? null };
}
