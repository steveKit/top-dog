// Server-side hot dog wrappers. These run on the server (form actions / load
// functions) and take an RLS-scoped SupabaseClient *passed in* — never a
// client-side secret key. They return typed discriminated results rather than
// throwing, mirroring the invites/profiles/storage modules' conventions;
// callers branch on `ok`. Supabase errors are surfaced to the caller (which
// logs context server-side and shows a friendly message via fail()).
//
// The denormalized counters (vote_count, peak_votes) are server-maintained and
// not client-writable (column-level privileges in the migration), so insert
// never sets them — they default to 0.

import type { SupabaseClient } from '@supabase/supabase-js';

/** Discriminated result for hot dog operations. */
export type HotDogResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * A hot dog row as the app reads it. Mirrors the `hot_dogs` table from the
 * TASK-013 migration. `vote_count`/`peak_votes` are server-maintained (read-only
 * to clients); we surface them so the grid/profile can render stats later.
 */
export interface HotDog {
	id: string;
	owner_id: string;
	image_path: string;
	caption: string | null;
	created_at: string;
	vote_count: number;
	peak_votes: number;
	byte_size: number;
}

/** Columns selected for a full hot dog read. */
const HOT_DOG_COLUMNS =
	'id, owner_id, image_path, caption, created_at, vote_count, peak_votes, byte_size';

/**
 * Per-user cap on hot dogs (decision #10): 100 dogs, "delete one to add
 * another". Enforced in the upload action via countByOwner AND, as the
 * authoritative backstop, by the `hot_dogs_per_user_cap` BEFORE INSERT trigger
 * (TASK-070) — keep this in sync with the literal 100 in the trigger function.
 */
export const PER_USER_CAP = 100;

/**
 * Per-file upload hard cap (TASK-070): 2 MiB. Single source of truth on the TS
 * side; the upload action rejects oversized files early for friendly UX. The
 * authoritative server-side enforcement is the Storage API `file_size_limit` on
 * the buckets (real object bytes) plus the `hot_dogs_byte_size_max` DB CHECK on
 * the declared `byte_size` — see the upload_limits migration. Keep this in sync
 * with the 2097152 literal there.
 */
export const MAX_UPLOAD_BYTES = 2097152;

/**
 * PURE cap predicate (unit-testable without a client): is the user already at
 * (or over) the per-user cap, so a new upload must be rejected? Kept pure so
 * the threshold logic is covered independently of the DB count query.
 */
export function isAtCap(currentCount: number): boolean {
	return currentCount >= PER_USER_CAP;
}

export interface CreateHotDogInput {
	id: string;
	ownerId: string;
	imagePath: string;
	byteSize: number;
	caption?: string | null;
}

/**
 * Inserts the caller's own hot dog row. The `hot_dogs_insert_own` RLS policy
 * enforces `auth.uid() = owner_id`, so this cannot forge a row for another user;
 * the trusted `ownerId` must be the validated session uid. The id is generated
 * server-side so the storage object key and the row id agree. Counters default
 * to 0 (and are not client-writable), so they are never set here.
 */
export async function createHotDog(
	supabase: SupabaseClient,
	{ id, ownerId, imagePath, byteSize, caption = null }: CreateHotDogInput
): Promise<HotDogResult<HotDog>> {
	const { data, error } = await supabase
		.from('hot_dogs')
		.insert({
			id,
			owner_id: ownerId,
			image_path: imagePath,
			byte_size: byteSize,
			caption
		})
		.select(HOT_DOG_COLUMNS)
		.single();

	if (error) {
		return { ok: false, error: error.message };
	}

	if (!data) {
		return { ok: false, error: 'Failed to save your hot dog.' };
	}

	return { ok: true, data: data as HotDog };
}

/**
 * Lists the given owner's hot dogs, newest first. RLS exposes all rows to
 * authenticated members, so the explicit owner_id filter scopes this to the
 * owner's own dogs (the upload-page grid). Returns the rows on success.
 */
export async function listHotDogsByOwner(
	supabase: SupabaseClient,
	ownerId: string
): Promise<HotDogResult<HotDog[]>> {
	const { data, error } = await supabase
		.from('hot_dogs')
		.select(HOT_DOG_COLUMNS)
		.eq('owner_id', ownerId)
		.order('created_at', { ascending: false });

	if (error) {
		return { ok: false, error: error.message };
	}

	return { ok: true, data: (data as HotDog[] | null) ?? [] };
}

/**
 * Counts the given owner's hot dogs, for the per-user cap check (decision #10).
 * Uses a head count (no rows fetched). Returns the count on success.
 */
export async function countByOwner(
	supabase: SupabaseClient,
	ownerId: string
): Promise<HotDogResult<number>> {
	const { count, error } = await supabase
		.from('hot_dogs')
		.select('id', { count: 'exact', head: true })
		.eq('owner_id', ownerId);

	if (error) {
		return { ok: false, error: error.message };
	}

	return { ok: true, data: count ?? 0 };
}

/**
 * Fetches a single hot dog by id (used to resolve its image_path before a
 * delete so the storage object can be removed too). Returns
 * `{ ok: true, data: null }` when no such row is visible. RLS scopes deletes to
 * the owner; this read is global-readable but the delete that follows is
 * owner-pinned.
 */
export async function getHotDogById(
	supabase: SupabaseClient,
	id: string
): Promise<HotDogResult<HotDog | null>> {
	const { data, error } = await supabase
		.from('hot_dogs')
		.select(HOT_DOG_COLUMNS)
		.eq('id', id)
		.maybeSingle();

	if (error) {
		return { ok: false, error: error.message };
	}

	return { ok: true, data: (data as HotDog | null) ?? null };
}

/**
 * Deletes the caller's own hot dog row by id. The `hot_dogs_delete_own` RLS
 * policy pins this to `auth.uid() = owner_id`, so a non-owner delete simply
 * affects zero rows. Returns the number of rows deleted so the caller can tell a
 * real delete from a no-op (e.g. wrong id / not owned). The caller removes the
 * storage object separately (orphan-free delete, decision #10).
 */
export async function deleteHotDog(
	supabase: SupabaseClient,
	id: string
): Promise<HotDogResult<{ deleted: number }>> {
	const { data, error } = await supabase.from('hot_dogs').delete().eq('id', id).select('id');

	if (error) {
		return { ok: false, error: error.message };
	}

	return { ok: true, data: { deleted: (data as unknown[] | null)?.length ?? 0 } };
}

/**
 * Returns the global storage usage in bytes (sum of byte_size across ALL
 * hot_dogs) via the `app_storage_bytes` SECURITY DEFINER RPC. The upload path
 * passes this into evaluateUpload() before accepting a new upload (decision
 * #11). The RPC returns a bigint, which supabase-js surfaces as a number for
 * values within the safe-integer range (well under the 1 GiB cap).
 */
export async function appStorageBytes(supabase: SupabaseClient): Promise<HotDogResult<number>> {
	const { data, error } = await supabase.rpc('app_storage_bytes');

	if (error) {
		return { ok: false, error: error.message };
	}

	return { ok: true, data: Number(data ?? 0) };
}
