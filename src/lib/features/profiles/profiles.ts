// Server-side profile wrappers. These run on the server (form actions / load
// functions) and take an RLS-scoped SupabaseClient *passed in* — never a
// client-side secret key. They return typed discriminated results rather than
// throwing, mirroring the invites/storage modules' conventions; callers branch
// on `ok`. Supabase errors are surfaced to the caller (which logs context
// server-side and shows a friendly message via fail()).

import type { SupabaseClient } from '@supabase/supabase-js';

/** Discriminated result for profile operations. */
export type ProfileResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * A profile row as the app reads it. Mirrors the `profiles` table from the
 * TASK-003 baseline migration. The server-maintained Top Dog fields are
 * read-only to clients (the UPDATE policy pins them); we surface them so the
 * profile page can render stats.
 */
export interface Profile {
	id: string;
	handle: string;
	display_name: string;
	avatar_path: string | null;
	joined_at: string;
	days_as_top_dog: number;
	is_current_top_dog: boolean;
	top_dog_since: string | null;
}

/** Columns selected for a full profile read. */
const PROFILE_COLUMNS =
	'id, handle, display_name, avatar_path, joined_at, days_as_top_dog, is_current_top_dog, top_dog_since';

/**
 * Postgres `unique_violation` SQLSTATE. The `profiles.handle` UNIQUE constraint
 * is the AUTHORITATIVE guard against duplicate handles (the pre-check in
 * `isHandleAvailable` is best-effort and racy). We translate this code into a
 * friendly "handle taken" result rather than leaking the raw constraint text.
 */
const UNIQUE_VIOLATION = '23505';

/** Sentinel signalling a duplicate-handle insert, branched on by callers. */
export const HANDLE_TAKEN = 'HANDLE_TAKEN' as const;

/**
 * Fetches a profile by its id (auth.uid()). Returns `{ ok: true, data: null }`
 * when no row exists (used by the onboarding/layout guard to detect a
 * profile-less, freshly-redeemed user). Real errors surface as `ok: false`.
 */
export async function getProfileById(
	supabase: SupabaseClient,
	id: string
): Promise<ProfileResult<Profile | null>> {
	const { data, error } = await supabase
		.from('profiles')
		.select(PROFILE_COLUMNS)
		.eq('id', id)
		.maybeSingle();

	if (error) {
		return { ok: false, error: error.message };
	}

	return { ok: true, data: (data as Profile | null) ?? null };
}

/**
 * Fetches a profile by handle (case-insensitive at the DB via citext). Returns
 * `{ ok: true, data: null }` when no such handle exists so the profile page can
 * 404 cleanly. Real errors surface as `ok: false`.
 */
export async function getProfileByHandle(
	supabase: SupabaseClient,
	handle: string
): Promise<ProfileResult<Profile | null>> {
	const { data, error } = await supabase
		.from('profiles')
		.select(PROFILE_COLUMNS)
		.eq('handle', handle)
		.maybeSingle();

	if (error) {
		return { ok: false, error: error.message };
	}

	return { ok: true, data: (data as Profile | null) ?? null };
}

/**
 * Best-effort pre-check that a handle is not already taken. Like the invite
 * pre-check, this is NOT the authoritative guard — a concurrent insert can win
 * the race after this returns true; the UNIQUE constraint in `createProfile`
 * remains authoritative. Returns `{ ok: true, data: true }` when free.
 */
export async function isHandleAvailable(
	supabase: SupabaseClient,
	handle: string
): Promise<ProfileResult<boolean>> {
	const { data, error } = await supabase
		.from('profiles')
		.select('id')
		.eq('handle', handle)
		.maybeSingle();

	if (error) {
		return { ok: false, error: error.message };
	}

	return { ok: true, data: data === null };
}

export interface CreateProfileInput {
	id: string;
	handle: string;
	displayName: string;
	avatarPath?: string | null;
}

/**
 * Inserts the caller's own profile row. The `profiles_insert_own` RLS policy
 * enforces `auth.uid() = id`, so this cannot forge a profile for another user;
 * the trusted `id` must be the validated session uid. Clients may only write
 * `id`, `handle`, `display_name`, `avatar_path` — the Top Dog fields default and
 * are pinned by the UPDATE policy.
 *
 * The handle UNIQUE constraint is the AUTHORITATIVE duplicate guard: a
 * `unique_violation` (23505) on insert is caught and surfaced as
 * `{ ok: false, error: HANDLE_TAKEN }` so the caller can show a friendly
 * "handle taken" message without leaking the constraint text. Other errors
 * surface their SDK message.
 */
export async function createProfile(
	supabase: SupabaseClient,
	{ id, handle, displayName, avatarPath = null }: CreateProfileInput
): Promise<ProfileResult<Profile>> {
	const { data, error } = await supabase
		.from('profiles')
		.insert({
			id,
			handle,
			display_name: displayName,
			avatar_path: avatarPath
		})
		.select(PROFILE_COLUMNS)
		.single();

	if (error) {
		if (error.code === UNIQUE_VIOLATION) {
			return { ok: false, error: HANDLE_TAKEN };
		}
		return { ok: false, error: error.message };
	}

	if (!data) {
		return { ok: false, error: 'Failed to create your profile.' };
	}

	return { ok: true, data: data as Profile };
}
