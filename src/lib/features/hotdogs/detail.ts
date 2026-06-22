// Server-side per-dog detail query (TASK-031). Like the other feature query
// modules (hotdogs, voting/feed, profiles), this runs on the server (the detail
// load function), takes an RLS-scoped SupabaseClient *passed in*, and returns a
// typed discriminated result rather than throwing; callers branch on `ok`.
//
// It backs the dog detail view (/snacktum-snacktorum/litter/[id]), surfacing per-dog stats —
// principally `peak_votes` (the all-time high, maintained by the M2 vote RPC)
// alongside the current `vote_count` — plus the owner's public identity and
// live crown state. SELECT on hot_dogs is allowed for authenticated members, so
// this is a plain RLS-scoped read; counters are read-only to clients.

import type { SupabaseClient } from '@supabase/supabase-js';

/** Discriminated result for the detail query. */
export type DetailResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * The owner's public identity + live crown state, joined from `profiles` via the
 * `hot_dogs.owner_id -> profiles.id` FK. `is_current_top_dog` / `top_dog_since`
 * are the server-maintained crown fields (read-only to clients); the detail view
 * renders the Top Dog badge when the owner currently holds the crown.
 */
export interface DogDetailOwner {
	id: string;
	handle: string;
	display_name: string;
	is_current_top_dog: boolean;
	top_dog_since: string | null;
}

/**
 * A single hot dog as the detail view reads it: the dog's stats + content plus
 * its owner's public identity. `vote_count` and `peak_votes` are the
 * server-maintained denormalized counters (read-only to clients); the detail
 * view displays both.
 */
export interface DogDetail {
	id: string;
	owner_id: string;
	image_path: string;
	caption: string | null;
	created_at: string;
	vote_count: number;
	peak_votes: number;
	owner: DogDetailOwner;
}

/**
 * The shape PostgREST returns for the embedded-profile select. supabase-js infers
 * the embed as an ARRAY of the related rows even for a to-one FK relationship, so
 * we type it that way and read the first element (there is exactly one owner per
 * dog via the NOT NULL FK; we guard defensively for the empty case anyway).
 */
interface DogDetailRow {
	id: string;
	owner_id: string;
	image_path: string;
	caption: string | null;
	created_at: string;
	vote_count: number;
	peak_votes: number;
	profiles: DogDetailOwner[] | DogDetailOwner | null;
}

/** Sentinel: no such dog is visible to the viewer. Callers map this to a 404. */
export const DOG_NOT_FOUND = 'DOG_NOT_FOUND' as const;

/**
 * Fetches a single hot dog by id with its owner's public identity + live crown
 * state, for the detail view. RLS exposes all hot_dogs to authenticated members,
 * so the only filter is the id. Distinguishes not-found
 * (`{ ok: false, error: DOG_NOT_FOUND }`) from a real read error so the route can
 * `error(404, …)` on the former and surface a friendly 500 on the latter.
 *
 * `viewerId` is the validated session uid (safeGetSession()); it is accepted for
 * symmetry with the other read wrappers and future viewer-relative reads, but the
 * read itself is RLS-scoped on the passed-in client — never a client-supplied id.
 */
export async function getDogDetail(
	supabase: SupabaseClient,
	dogId: string,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	viewerId: string
): Promise<DetailResult<DogDetail>> {
	const { data, error } = await supabase
		.from('hot_dogs')
		.select(
			'id, owner_id, image_path, caption, created_at, vote_count, peak_votes, ' +
				'profiles(id, handle, display_name, is_current_top_dog, top_dog_since)'
		)
		.eq('id', dogId)
		.maybeSingle();

	if (error) {
		return { ok: false, error: error.message };
	}

	if (!data) {
		return { ok: false, error: DOG_NOT_FOUND };
	}

	const row = data as unknown as DogDetailRow;
	// Normalize the embed: PostgREST may surface it as an array (to-one inferred as
	// a list) or a single object — take the owner row either way.
	const owner = Array.isArray(row.profiles) ? (row.profiles[0] ?? null) : row.profiles;
	if (!owner) {
		// A dog with no readable owner is a not-found case from the viewer's POV.
		return { ok: false, error: DOG_NOT_FOUND };
	}

	return {
		ok: true,
		data: {
			id: row.id,
			owner_id: row.owner_id,
			image_path: row.image_path,
			caption: row.caption,
			created_at: row.created_at,
			vote_count: row.vote_count,
			peak_votes: row.peak_votes,
			owner: {
				id: owner.id,
				handle: owner.handle,
				display_name: owner.display_name,
				is_current_top_dog: owner.is_current_top_dog,
				top_dog_since: owner.top_dog_since
			}
		}
	};
}
