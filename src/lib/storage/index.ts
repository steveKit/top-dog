// Swappable storage seam (PROJECT.md decisions #6, #7).
//
// This is the ONLY module in the app that may touch `supabase.storage`. Every
// other feature (hot dog upload, avatar upload, signed-URL reads, deletes)
// goes through this surface. When we outgrow Supabase Storage's 1 GB free cap
// (the documented R2 escape hatch, decision #7), only this file changes — the
// callers keep the same `StorageResult`-shaped contract.
//
// Client injection: the storage functions take a `SupabaseClient` argument
// rather than importing a client of their own. The caller passes
// `event.locals.supabase` for user-scoped, RLS-enforced operations (the common
// case — RLS pins writes to the `{owner_id}/` prefix), or the privileged
// service client from `$lib/server/supabase.ts` for trusted server-side work
// (e.g. signed-URL minting outside a request, cleanup jobs). Injecting the
// client keeps this module free of env/SSR concerns and makes it trivially
// mockable in tests — the seam stays clean for the eventual R2 swap.

import type { SupabaseClient } from '@supabase/supabase-js';

import { avatarPath, hotdogPath } from './paths';

export { avatarPath, hotdogPath };

/** The two buckets created by the TASK-003 migration. */
export const HOTDOGS_BUCKET = 'hotdogs' as const;
export const AVATARS_BUCKET = 'avatars' as const;

export type Bucket = typeof HOTDOGS_BUCKET | typeof AVATARS_BUCKET;

/**
 * Supabase's storage error type. We don't import it from `@supabase/storage-js`
 * because that package is only a transitive dependency (not declared in our
 * manifest), and `@supabase/supabase-js` doesn't re-export it. Instead we
 * derive it structurally from the `error` channel of a storage method's return
 * type — `remove` always returns `{ data, error }` — so the type tracks the
 * installed supabase-js version exactly with zero new imports.
 */
type StorageFileApi = ReturnType<SupabaseClient['storage']['from']>;
export type StorageError = NonNullable<Awaited<ReturnType<StorageFileApi['remove']>>['error']>;

/**
 * Discriminated result for storage operations. We surface errors as values
 * (rather than throwing) so callers — form actions, `+server.ts` endpoints —
 * can translate a failed storage op into a `fail()` / friendly message at the
 * boundary, per the project's error-handling convention. Supabase's own
 * storage methods already return `{ data, error }`; this normalizes that into
 * a discriminated union the rest of the app can `if (!result.ok)` against.
 */
export type StorageResult<T> = { ok: true; data: T } | { ok: false; error: StorageError };

/**
 * How long a hotdogs signed URL stays valid. One hour is plenty for a page
 * render and short enough that leaked URLs expire quickly.
 */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Uploads a blob to `bucket` at `path`. `path` must come from the pure path
 * helpers (`hotdogPath` / `avatarPath`) so its first segment is the uploader's
 * uid — required by the TASK-003 RLS write policies. `upsert` defaults to true
 * so re-uploading an avatar (fixed key) overwrites in place.
 */
export async function upload(
	client: SupabaseClient,
	bucket: Bucket,
	path: string,
	blob: Blob,
	options?: { upsert?: boolean }
): Promise<StorageResult<{ path: string }>> {
	const { data, error } = await client.storage.from(bucket).upload(path, blob, {
		contentType: blob.type || 'image/webp',
		upsert: options?.upsert ?? true
	});
	if (error) {
		return { ok: false, error };
	}
	return { ok: true, data: { path: data.path } };
}

/**
 * Mints a time-limited signed URL for a private `hotdogs` object. Private
 * content is never served via a public URL — readers without owner RLS access
 * (everyone but the owner) need a signed URL. Always reads the hotdogs bucket.
 */
export async function getSignedUrl(
	client: SupabaseClient,
	path: string,
	expiresInSeconds: number = SIGNED_URL_TTL_SECONDS
): Promise<StorageResult<{ signedUrl: string }>> {
	const { data, error } = await client.storage
		.from(HOTDOGS_BUCKET)
		.createSignedUrl(path, expiresInSeconds);
	if (error) {
		return { ok: false, error };
	}
	return { ok: true, data: { signedUrl: data.signedUrl } };
}

/**
 * Returns the public URL for a public-read `avatars` object. This is a pure
 * URL construction (no network call) — Supabase's `getPublicUrl` never errors,
 * so we return the string directly rather than a `StorageResult`. Always reads
 * the avatars bucket.
 */
export function getPublicUrl(client: SupabaseClient, path: string): string {
	return client.storage.from(AVATARS_BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Removes one or more objects from `bucket`. Used by the "delete one to add
 * another" cap and orphan-free deletes (decision #10) — the caller removes the
 * storage object in the same flow as the DB row. RLS pins deletes to the
 * owner's own prefix.
 */
export async function remove(
	client: SupabaseClient,
	bucket: Bucket,
	paths: string | string[]
): Promise<StorageResult<{ removed: number }>> {
	const list = Array.isArray(paths) ? paths : [paths];
	const { data, error } = await client.storage.from(bucket).remove(list);
	if (error) {
		return { ok: false, error };
	}
	return { ok: true, data: { removed: data.length } };
}
