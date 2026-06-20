import { describe, it, expect } from 'vitest';
import {
	SIGIL_IDS,
	SIGIL_PREFIX,
	DEFAULT_SIGIL,
	SIGIL_NAMES,
	SIGIL_LABELS,
	isSigilId,
	sigilAvatarValue,
	parseSigilId,
	type SigilId
} from './sigils';

// PURE sigil-id mapping (TASK-092): the rite stores a chosen sigil as a small
// prefixed id in the existing `avatar_path` column (no upload, no migration).
// These tests pin the id<->stored-value round-trip and the prefix parsing the
// render layer relies on to choose an inline <Sigil> over a storage <img>.

describe('sigil id set', () => {
	it('declares the five built-in sigils', () => {
		expect(SIGIL_IDS).toEqual(['cowled', 'haloed', 'shadowed', 'tube', 'candle']);
	});

	it('has a display name and a short label for every sigil', () => {
		for (const id of SIGIL_IDS) {
			expect(SIGIL_NAMES[id]).toBeTruthy();
			expect(SIGIL_LABELS[id]).toBeTruthy();
		}
	});

	it('defaults to a known sigil', () => {
		expect(isSigilId(DEFAULT_SIGIL)).toBe(true);
	});
});

describe('isSigilId', () => {
	it('accepts each known id', () => {
		for (const id of SIGIL_IDS) {
			expect(isSigilId(id)).toBe(true);
		}
	});

	it('rejects unknown / non-string values', () => {
		expect(isSigilId('mystery')).toBe(false);
		expect(isSigilId('')).toBe(false);
		expect(isSigilId(null)).toBe(false);
		expect(isSigilId(undefined)).toBe(false);
		expect(isSigilId(3)).toBe(false);
		// The prefixed STORED value is not itself an id.
		expect(isSigilId('sigil:tube')).toBe(false);
	});
});

describe('sigilAvatarValue', () => {
	it('prefixes a known id with the sigil namespace', () => {
		expect(sigilAvatarValue('tube')).toBe('sigil:tube');
		expect(sigilAvatarValue('cowled')).toBe(`${SIGIL_PREFIX}cowled`);
	});

	it('throws on an unknown id so a bad value is never persisted', () => {
		expect(() => sigilAvatarValue('mystery' as SigilId)).toThrow(/unknown sigil/i);
	});
});

describe('parseSigilId', () => {
	it('round-trips a stored sigil value back to its id', () => {
		for (const id of SIGIL_IDS) {
			expect(parseSigilId(sigilAvatarValue(id))).toBe(id);
		}
	});

	it('returns null for a real storage path', () => {
		expect(parseSigilId('11111111-1111-1111-1111-111111111111/avatar.webp')).toBeNull();
	});

	it('returns null for null / undefined / empty', () => {
		expect(parseSigilId(null)).toBeNull();
		expect(parseSigilId(undefined)).toBeNull();
		expect(parseSigilId('')).toBeNull();
	});

	it('returns null for a prefixed-but-unknown sigil id (legacy / tampered)', () => {
		expect(parseSigilId('sigil:mystery')).toBeNull();
		expect(parseSigilId('sigil:')).toBeNull();
	});
});
