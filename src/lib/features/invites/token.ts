// Pure token helpers for invites — no SvelteKit/Supabase imports, fully
// unit-testable. Token generation uses Web Crypto (zero new dependencies):
// 32 random bytes encoded base64url, giving 256 bits of entropy in a
// URL-safe string. The DB `invites_token_length` CHECK (16..256) and
// `isValidTokenFormat` below both back the shape we mint here.

const TOKEN_BYTES = 32;

/** Allowed token characters: base64url alphabet, no padding. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,256}$/;

/**
 * Encodes a byte array as an unpadded base64url string.
 * Kept separate from generation so it can be unit-tested deterministically.
 */
export function bytesToBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	// btoa produces standard base64; translate to base64url and strip padding.
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

/**
 * Generates an unguessable invite token (256 bits of entropy, base64url).
 * Uses the platform Web Crypto RNG — no third-party dependency.
 */
export function generateInviteToken(): string {
	const bytes = new Uint8Array(TOKEN_BYTES);
	crypto.getRandomValues(bytes);
	return bytesToBase64Url(bytes);
}

/**
 * Validates that a string is a plausibly well-formed invite token before we
 * spend a round-trip looking it up. This is a shape check at the boundary, not
 * an authority check — the DB RPC is the source of truth for validity.
 */
export function isValidTokenFormat(token: unknown): token is string {
	return typeof token === 'string' && TOKEN_PATTERN.test(token);
}
