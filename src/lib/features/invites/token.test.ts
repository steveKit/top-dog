import { describe, it, expect } from 'vitest';
import { bytesToBase64Url, generateInviteToken, isValidTokenFormat } from './token';

// Pure helpers — TDD-first per the project testing strategy. The tester will
// add the comprehensive suite; these cover the load-bearing invariants:
// URL-safety, entropy length, and the boundary shape check.

describe('bytesToBase64Url', () => {
	it('produces a URL-safe string (no +, /, or = padding)', () => {
		// Bytes chosen so standard base64 would contain + and /.
		const bytes = new Uint8Array([0xfb, 0xff, 0xbf]);
		const encoded = bytesToBase64Url(bytes);
		expect(encoded).not.toMatch(/[+/=]/);
	});

	it('is deterministic for the same input', () => {
		const bytes = new Uint8Array([1, 2, 3, 4, 5]);
		expect(bytesToBase64Url(bytes)).toBe(bytesToBase64Url(bytes));
	});

	it('translates standard base64 + and / to base64url - and _', () => {
		// 0xfb,0xff,0xbf -> standard base64 "+/+/" ; base64url must use - and _.
		const encoded = bytesToBase64Url(new Uint8Array([0xfb, 0xff, 0xbf]));
		expect(encoded).toBe('-_-_');
	});

	it('strips = padding that standard base64 would add', () => {
		// A single byte forces two padding chars in standard base64 ("AQ==").
		const encoded = bytesToBase64Url(new Uint8Array([1]));
		expect(encoded).toBe('AQ');
		expect(encoded).not.toContain('=');
	});

	it('encodes the empty array to the empty string', () => {
		expect(bytesToBase64Url(new Uint8Array([]))).toBe('');
	});

	it('round-trips back to the original bytes via base64url decode', () => {
		const bytes = new Uint8Array([0, 1, 127, 128, 255, 42, 200]);
		const encoded = bytesToBase64Url(bytes);
		// Reverse the url-safe transform, restore padding, then atob.
		const standard = encoded.replaceAll('-', '+').replaceAll('_', '/');
		const padded = standard + '='.repeat((4 - (standard.length % 4)) % 4);
		const decoded = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
		expect([...decoded]).toEqual([...bytes]);
	});
});

describe('generateInviteToken', () => {
	it('produces a token that passes the format check', () => {
		expect(isValidTokenFormat(generateInviteToken())).toBe(true);
	});

	it('produces distinct tokens across calls', () => {
		const a = generateInviteToken();
		const b = generateInviteToken();
		expect(a).not.toBe(b);
	});

	it('is long enough to satisfy the DB length CHECK (>= 16 chars)', () => {
		expect(generateInviteToken().length).toBeGreaterThanOrEqual(16);
	});

	it('fits within the DB length CHECK upper bound (<= 256 chars)', () => {
		expect(generateInviteToken().length).toBeLessThanOrEqual(256);
	});

	it('carries unguessable entropy: 32 random bytes -> ~43 base64url chars', () => {
		// 32 bytes -> ceil(32*4/3) = 43 unpadded base64url chars. This is the
		// load-bearing entropy invariant (256 bits); a regression that shortened
		// the token would silently weaken every invite link.
		expect(generateInviteToken().length).toBe(43);
	});

	it('produces no collisions across many calls (unguessable uniqueness)', () => {
		const tokens = new Set<string>();
		for (let i = 0; i < 1000; i++) {
			tokens.add(generateInviteToken());
		}
		expect(tokens.size).toBe(1000);
	});
});

describe('isValidTokenFormat', () => {
	it('accepts a well-formed base64url token', () => {
		expect(isValidTokenFormat('abcDEF012_-ghijkl')).toBe(true);
	});

	it('accepts a token at the minimum length boundary (16 chars)', () => {
		expect(isValidTokenFormat('a'.repeat(16))).toBe(true);
	});

	it('accepts a token at the maximum length boundary (256 chars)', () => {
		expect(isValidTokenFormat('a'.repeat(256))).toBe(true);
	});

	it('accepts a freshly generated token', () => {
		expect(isValidTokenFormat(generateInviteToken())).toBe(true);
	});

	it('rejects a token one char below the minimum (15 chars)', () => {
		expect(isValidTokenFormat('a'.repeat(15))).toBe(false);
	});

	it('rejects a token one char above the maximum (257 chars)', () => {
		expect(isValidTokenFormat('a'.repeat(257))).toBe(false);
	});

	it('rejects too-short tokens', () => {
		expect(isValidTokenFormat('short')).toBe(false);
	});

	it('rejects the empty string', () => {
		expect(isValidTokenFormat('')).toBe(false);
	});

	it('rejects tokens with disallowed characters', () => {
		expect(isValidTokenFormat('has spaces and !@#$ chars')).toBe(false);
	});

	it('rejects standard base64 padding/non-url-safe chars (+, /, =)', () => {
		// A 16+ char string that is valid standard base64 but not base64url.
		expect(isValidTokenFormat('abcd+efgh/ijkl==')).toBe(false);
	});

	it('rejects an otherwise-valid token containing a newline', () => {
		// Anchored regex: a trailing newline must not slip past ^...$.
		expect(isValidTokenFormat('abcDEF012_-ghijkl\n')).toBe(false);
	});

	it('rejects non-string input', () => {
		expect(isValidTokenFormat(undefined)).toBe(false);
		expect(isValidTokenFormat(null)).toBe(false);
		expect(isValidTokenFormat(12345)).toBe(false);
	});

	it('rejects object and array input', () => {
		expect(isValidTokenFormat({})).toBe(false);
		expect(isValidTokenFormat(['abcDEF012_-ghijkl'])).toBe(false);
	});
});
