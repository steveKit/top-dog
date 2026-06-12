// Pure storage-path construction. No Supabase (or any other) imports — this
// module is deliberately dependency-free so the path shape can be unit-tested
// in isolation. Every storage object key in the app is produced here.
//
// Path convention (PROJECT.md decision #6): `{owner_id}/{file}`. The FIRST
// path segment must be the owning user's auth uid. The TASK-003 RLS policies
// gate writes on `(storage.foldername(name))[1] = auth.uid()::text`, so a path
// whose first segment is not the uploader's uid will be rejected by the DB.
// Constructing every path through these helpers keeps that invariant in one
// place instead of scattered string concatenation.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reports whether a value is a well-formed uuid. Shares the single `UUID_RE`
 * source of truth used by the storage-path owner-id guard, so callers that need
 * to pre-validate a uuid-shaped route param (before it reaches Postgres, where a
 * non-uuid would raise `22P02`) don't re-invent the pattern.
 */
export function isUuid(value: string): boolean {
	return UUID_RE.test(value);
}

/**
 * Validates that an id is a non-empty, slash-free path segment. Reused for both
 * the owner uid (the RLS-significant first segment) and the file id. Throwing
 * here prevents a malformed id from silently producing a path that lands in
 * the wrong owner prefix (or escapes it via an embedded `/`).
 */
function assertSegment(label: string, value: string): void {
	if (!value || value.includes('/')) {
		throw new Error(`Invalid ${label} for storage path: ${JSON.stringify(value)}`);
	}
}

/**
 * Builds the storage key for a hot dog image: `{ownerId}/{dogId}.webp`.
 * `ownerId` must be the uploader's auth uid to satisfy the hotdogs RLS write
 * policy. Images are WebP-encoded client-side (decision #8).
 */
export function hotdogPath(ownerId: string, dogId: string): string {
	assertOwnerId(ownerId);
	assertSegment('dogId', dogId);
	return `${ownerId}/${dogId}.webp`;
}

/**
 * Builds the storage key for an avatar image: `{ownerId}/avatar.webp`.
 * One avatar per user (overwritten on change), so the file id is fixed rather
 * than derived from a row id. `ownerId` must be the uploader's auth uid to
 * satisfy the avatars RLS write policy.
 */
export function avatarPath(ownerId: string): string {
	assertOwnerId(ownerId);
	return `${ownerId}/avatar.webp`;
}

/**
 * Asserts an owner id is a well-formed uuid. The first path segment is the
 * RLS-significant part (it must equal `auth.uid()`), so we hold it to the
 * uuid shape Supabase Auth issues rather than just "no slashes".
 */
function assertOwnerId(ownerId: string): void {
	if (!UUID_RE.test(ownerId)) {
		throw new Error(`Invalid ownerId for storage path (expected uuid): ${JSON.stringify(ownerId)}`);
	}
}
