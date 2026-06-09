// Pure handle validation/normalization for profiles — no SvelteKit/Supabase
// imports, fully unit-testable.
//
// Discovered-Work (TASK-003 reviewer): the `profiles.handle` column is
// `extensions.citext` with a CHECK on LENGTH 2..32 only — it enforces no
// CHARACTER SET. Without an app-level allowlist a handle could contain
// whitespace, control chars, punctuation, or emoji (all length-legal) and slip
// past the DB. This module is the REQUIRED application-boundary enforcement of
// the allowed handle charset; the optional DB CHECK is defense-in-depth.
//
// Allowlist: alphanumeric + underscore, 2..32 chars (`^[A-Za-z0-9_]{2,32}$`).
// This rejects whitespace, control chars, punctuation, and emoji. The length
// bounds mirror the DB CHECK so the two agree. Uniqueness is case-INsensitive
// at the DB (citext UNIQUE), so we deliberately do NOT lowercase-store: a user
// keeps the casing they chose for display while `Chef` and `chef` still
// collide. `normalizeHandle` only trims surrounding whitespace before
// validation — it never changes case.

/** Allowed handle characters and length, agreeing with the DB length CHECK. */
const HANDLE_PATTERN = /^[A-Za-z0-9_]{2,32}$/;

export const HANDLE_MIN_LENGTH = 2;
export const HANDLE_MAX_LENGTH = 32;

/** Discriminated result for handle validation. */
export type HandleValidation = { ok: true; value: string } | { ok: false; reason: string };

/**
 * Trims surrounding whitespace from a raw handle input. Does NOT change case
 * (uniqueness is case-insensitive at the DB via citext; we preserve the user's
 * chosen casing for display). Non-string input collapses to an empty string so
 * the validator can reject it uniformly.
 */
export function normalizeHandle(raw: unknown): string {
	return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * Pure predicate: is `raw` a well-formed handle? Normalizes (trim) first, then
 * tests the allowlist + length. Use `validateHandle` when you want the reason.
 */
export function isValidHandle(raw: unknown): boolean {
	return HANDLE_PATTERN.test(normalizeHandle(raw));
}

/**
 * Validates a raw handle at the application boundary and returns either the
 * normalized (trimmed, case-preserved) value or a friendly, user-facing reason.
 * The reasons are safe to surface verbatim in a `fail()` message.
 */
export function validateHandle(raw: unknown): HandleValidation {
	const value = normalizeHandle(raw);

	if (value.length === 0) {
		return { ok: false, reason: 'Please choose a handle.' };
	}
	if (value.length < HANDLE_MIN_LENGTH) {
		return {
			ok: false,
			reason: `Your handle must be at least ${HANDLE_MIN_LENGTH} characters.`
		};
	}
	if (value.length > HANDLE_MAX_LENGTH) {
		return {
			ok: false,
			reason: `Your handle must be at most ${HANDLE_MAX_LENGTH} characters.`
		};
	}
	if (!HANDLE_PATTERN.test(value)) {
		return {
			ok: false,
			reason: 'Handles can only contain letters, numbers, and underscores.'
		};
	}

	return { ok: true, value };
}
