import { describe, it, expect } from 'vitest';

import { storageGuardStatus, evaluateUpload } from './guard';

// PROJECT.md decision #11 (adversarial finding D): graceful degradation before
// Supabase's hard ~1 GiB free-tier cap. Thresholds are binary megabytes (MiB).
// We compute every boundary explicitly from 1024*1024 so the test pins the
// *intended* units rather than re-deriving them from the implementation.
const MiB = 1024 * 1024;
const WARN_AT = 800 * MiB; // 800 MiB: ok -> warn boundary (inclusive)
const BLOCK_AT = 950 * MiB; // 950 MiB: warn -> block boundary (inclusive)

describe('storageGuardStatus', () => {
	it('returns "ok" for 0 bytes', () => {
		expect(storageGuardStatus(0)).toBe('ok');
	});

	it('returns "ok" just below the warn threshold (799 MiB)', () => {
		expect(storageGuardStatus(799 * MiB)).toBe('ok');
	});

	it('returns "ok" one byte below the warn threshold', () => {
		expect(storageGuardStatus(WARN_AT - 1)).toBe('ok');
	});

	it('returns "warn" exactly at the warn threshold (800 MiB)', () => {
		expect(storageGuardStatus(WARN_AT)).toBe('warn');
	});

	it('returns "warn" just inside the warn band (801 MiB)', () => {
		expect(storageGuardStatus(801 * MiB)).toBe('warn');
	});

	it('returns "warn" just below the block threshold (949 MiB)', () => {
		expect(storageGuardStatus(949 * MiB)).toBe('warn');
	});

	it('returns "warn" one byte below the block threshold', () => {
		expect(storageGuardStatus(BLOCK_AT - 1)).toBe('warn');
	});

	it('returns "block" exactly at the block threshold (950 MiB)', () => {
		expect(storageGuardStatus(BLOCK_AT)).toBe('block');
	});

	it('returns "block" above the block threshold (951 MiB)', () => {
		expect(storageGuardStatus(951 * MiB)).toBe('block');
	});

	it('returns "block" at the hard cap (1024 MiB)', () => {
		expect(storageGuardStatus(1024 * MiB)).toBe('block');
	});

	// Validate-at-boundary (project convention): a negative or non-finite byte
	// total is a programming/upstream error, not a quota state. Throw rather than
	// silently classifying it.
	it('throws a TypeError for a negative byte total', () => {
		expect(() => storageGuardStatus(-1)).toThrow(TypeError);
	});

	it('throws a TypeError for NaN', () => {
		expect(() => storageGuardStatus(NaN)).toThrow(TypeError);
	});

	it('throws a TypeError for Infinity', () => {
		expect(() => storageGuardStatus(Infinity)).toThrow(TypeError);
	});

	it('throws a TypeError for -Infinity', () => {
		expect(() => storageGuardStatus(-Infinity)).toThrow(TypeError);
	});
});

describe('evaluateUpload', () => {
	it('allows an upload when usage is "ok" (0 bytes)', () => {
		const result = evaluateUpload(0);
		expect(result.allowed).toBe(true);
		expect(result.status).toBe('ok');
	});

	it('allows an upload when usage is "warn" (800 MiB)', () => {
		const result = evaluateUpload(WARN_AT);
		expect(result.allowed).toBe(true);
		expect(result.status).toBe('warn');
	});

	it('blocks an upload when usage is "block" (950 MiB)', () => {
		const result = evaluateUpload(BLOCK_AT);
		expect(result.allowed).toBe(false);
		expect(result.status).toBe('block');
	});

	it('surfaces a non-empty, user-facing message when blocked', () => {
		const result = evaluateUpload(BLOCK_AT);
		expect(result.message).toBeTruthy();
		expect(typeof result.message).toBe('string');
		expect((result.message ?? '').length).toBeGreaterThan(0);
	});

	it('does not require a message when the upload is allowed (ok)', () => {
		// We only assert blocking carries a message; allowed paths may omit it.
		// This pins that "allowed" never depends on message presence.
		expect(evaluateUpload(0).allowed).toBe(true);
	});

	it('reports a status that matches storageGuardStatus for the same input', () => {
		for (const used of [0, 799 * MiB, WARN_AT, 949 * MiB, BLOCK_AT, 1024 * MiB]) {
			expect(evaluateUpload(used).status).toBe(storageGuardStatus(used));
		}
	});

	it('throws a TypeError for invalid input (negative bytes)', () => {
		expect(() => evaluateUpload(-1)).toThrow(TypeError);
	});

	it('throws a TypeError for invalid input (NaN)', () => {
		expect(() => evaluateUpload(NaN)).toThrow(TypeError);
	});
});
