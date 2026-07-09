import { describe, it, expect } from 'vitest';

import {
	isValidHandle,
	validateHandle,
	normalizeHandle,
	HANDLE_MIN_LENGTH,
	HANDLE_MAX_LENGTH,
	HANDLE_PATTERN_SOURCE
} from './handle';

// Unit tests for the PURE handle validator (the required app-boundary charset
// enforcement the DB CHECK does not provide). Covers the allowlist
// (alphanumeric + underscore), the length bounds (agreeing with the DB CHECK),
// trimming via normalize, and that casing is preserved (uniqueness is
// case-insensitive at the DB, not here).

describe('normalizeHandle', () => {
	it('trims surrounding whitespace', () => {
		expect(normalizeHandle('  chef  ')).toBe('chef');
	});

	it('preserves internal casing (does not lowercase)', () => {
		expect(normalizeHandle('ChefDog')).toBe('ChefDog');
	});

	it('collapses non-string input to an empty string', () => {
		expect(normalizeHandle(undefined)).toBe('');
		expect(normalizeHandle(null)).toBe('');
		expect(normalizeHandle(42)).toBe('');
	});
});

describe('isValidHandle', () => {
	it('accepts alphanumerics and underscores', () => {
		expect(isValidHandle('chef_dog_99')).toBe(true);
		expect(isValidHandle('ChefDog')).toBe(true);
		expect(isValidHandle('a1')).toBe(true);
	});

	it('accepts the boundary lengths', () => {
		expect(isValidHandle('a'.repeat(HANDLE_MIN_LENGTH))).toBe(true);
		expect(isValidHandle('a'.repeat(HANDLE_MAX_LENGTH))).toBe(true);
	});

	it('rejects too-short and too-long handles', () => {
		expect(isValidHandle('a'.repeat(HANDLE_MIN_LENGTH - 1))).toBe(false);
		expect(isValidHandle('a'.repeat(HANDLE_MAX_LENGTH + 1))).toBe(false);
	});

	it('rejects whitespace, punctuation, and control chars', () => {
		expect(isValidHandle('chef dog')).toBe(false);
		expect(isValidHandle('chef-dog')).toBe(false);
		expect(isValidHandle('chef.dog')).toBe(false);
		expect(isValidHandle('chef@dog')).toBe(false);
		expect(isValidHandle('chef\tdog')).toBe(false);
	});

	it('rejects emoji and non-ascii characters', () => {
		expect(isValidHandle('hot🌭dog')).toBe(false);
		expect(isValidHandle('café')).toBe(false);
	});

	it('rejects embedded control characters (newline, null)', () => {
		expect(isValidHandle('chef\ndog')).toBe(false);
		expect(isValidHandle('chef\x00dog')).toBe(false);
	});

	it('accepts an underscore-only handle (allowlist, not a wordlist)', () => {
		expect(isValidHandle('__')).toBe(true);
	});

	it('rejects a handle that is only whitespace (collapses to empty after trim)', () => {
		expect(isValidHandle('   ')).toBe(false);
	});

	it('rejects exactly length 1 and length 33 (the off-by-one boundaries)', () => {
		expect(isValidHandle('a')).toBe(false);
		expect(isValidHandle('a'.repeat(33))).toBe(false);
	});

	it('trims before validating (surrounding space is allowed input)', () => {
		expect(isValidHandle('  chef  ')).toBe(true);
	});

	it('rejects non-string input', () => {
		expect(isValidHandle(undefined)).toBe(false);
		expect(isValidHandle(null)).toBe(false);
	});
});

describe('validateHandle', () => {
	it('returns the trimmed, case-preserved value on success', () => {
		expect(validateHandle('  ChefDog  ')).toEqual({ ok: true, value: 'ChefDog' });
	});

	it('reports an empty handle distinctly', () => {
		const result = validateHandle('   ');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toMatch(/choose a handle/i);
		}
	});

	it('reports a too-short handle', () => {
		const result = validateHandle('a');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toMatch(/at least/i);
		}
	});

	it('reports a too-long handle', () => {
		const result = validateHandle('a'.repeat(HANDLE_MAX_LENGTH + 1));
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toMatch(/at most/i);
		}
	});

	it('reports a bad charset', () => {
		const result = validateHandle('chef dog!');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toMatch(/letters, numbers, and underscores/i);
		}
	});
});

describe('HANDLE_PATTERN_SOURCE', () => {
	// Invariant: the exported pattern source (consumed by the sign-up page's HTML
	// `pattern` attribute) and the server validator MUST agree, so a future edit
	// to one without the other fails here. HTML `pattern` is unanchored /
	// implicitly full-match, so the source carries no `^`/`$`; anchor it to
	// mirror how the browser applies it. Compare over already-trimmed inputs —
	// `validateHandle` trims first, whereas the raw pattern does not, so we test
	// the charset+length agreement on normalized values.
	const anchored = new RegExp(`^${HANDLE_PATTERN_SOURCE}$`);

	const samples = [
		'chef_dog_99',
		'ChefDog',
		'a1',
		'__',
		'a'.repeat(HANDLE_MIN_LENGTH),
		'a'.repeat(HANDLE_MAX_LENGTH),
		'a', // too short
		'a'.repeat(HANDLE_MAX_LENGTH + 1), // too long
		'chef dog',
		'chef-dog',
		'chef.dog',
		'chef@dog',
		'hot🌭dog',
		'café'
	];

	it('carries no regex anchors (HTML pattern is implicitly full-match)', () => {
		expect(HANDLE_PATTERN_SOURCE.startsWith('^')).toBe(false);
		expect(HANDLE_PATTERN_SOURCE.endsWith('$')).toBe(false);
	});

	it('embeds the shared length bounds (single source of truth)', () => {
		expect(HANDLE_PATTERN_SOURCE).toContain(`{${HANDLE_MIN_LENGTH},${HANDLE_MAX_LENGTH}}`);
	});

	it('pins the exact charset literal so a broadening of the SOURCE itself is caught', () => {
		// The cross-check below derives BOTH `anchored` and (indirectly) validateHandle's
		// internal regex from HANDLE_PATTERN_SOURCE, so broadening the source's CHARSET
		// (e.g. adding a space) moves both sides together and slips past that check. Pin
		// the charset literal directly here — the bounds still track the shared constants,
		// but `[A-Za-z0-9_]` is an independent literal, so any charset edit to the source
		// fails HERE regardless of the validator. This is the real anti-tautology guard.
		expect(HANDLE_PATTERN_SOURCE).toBe(`[A-Za-z0-9_]{${HANDLE_MIN_LENGTH},${HANDLE_MAX_LENGTH}}`);
	});

	it('accepts/rejects the same normalized handles as validateHandle', () => {
		for (const sample of samples) {
			expect(anchored.test(sample)).toBe(validateHandle(sample).ok);
		}
	});
});
