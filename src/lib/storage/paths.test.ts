import { describe, it, expect } from 'vitest';

import { hotdogPath, avatarPath } from './paths';

// The owner-prefix invariant is the security-relevant property here: the first
// path segment is what the TASK-003 RLS policies match against `auth.uid()`, so
// a malformed owner id must NEVER produce a path that lands in (or escapes to)
// some other owner's prefix. These tests pin both the happy-path shape and the
// rejection of every way a bad id could subvert the `{owner_id}/` prefix.

const VALID_UUID = '00000000-0000-4000-8000-000000000000';
const OTHER_UUID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

describe('hotdogPath', () => {
	it('builds `{ownerId}/{dogId}.webp` for valid ids', () => {
		expect(hotdogPath(VALID_UUID, 'dog123')).toBe(`${VALID_UUID}/dog123.webp`);
	});

	it('places the owner uuid as the first (RLS-significant) segment', () => {
		const path = hotdogPath(VALID_UUID, 'dog123');
		expect(path.split('/')[0]).toBe(VALID_UUID);
	});

	it('appends the .webp extension to the dog id', () => {
		expect(hotdogPath(VALID_UUID, 'abc')).toMatch(/\/abc\.webp$/);
	});

	it('rejects a non-uuid ownerId', () => {
		expect(() => hotdogPath('not-a-uuid', 'dog123')).toThrow(/ownerId/);
	});

	it('rejects an empty ownerId', () => {
		expect(() => hotdogPath('', 'dog123')).toThrow(/ownerId/);
	});

	it('rejects an ownerId containing a slash (prefix-escape attempt)', () => {
		// `${OTHER_UUID}/../${VALID_UUID}`-style ids must not slip through; a slash
		// in the owner segment is the canonical way to escape the owner prefix.
		expect(() => hotdogPath(`${OTHER_UUID}/extra`, 'dog123')).toThrow(/ownerId/);
	});

	it('rejects an ownerId that is uuid-shaped but has a trailing path segment', () => {
		expect(() => hotdogPath(`${VALID_UUID}/evil`, 'dog123')).toThrow(/ownerId/);
	});

	it('rejects an empty dogId', () => {
		expect(() => hotdogPath(VALID_UUID, '')).toThrow(/dogId/);
	});

	it('rejects a dogId containing a slash (prefix-escape attempt)', () => {
		// A dog id like `../<other-uuid>/x` would re-anchor the path under a
		// different prefix; the dogId segment must stay slash-free.
		expect(() => hotdogPath(VALID_UUID, `../${OTHER_UUID}/x`)).toThrow(/dogId/);
	});
});

describe('avatarPath', () => {
	it('builds `{ownerId}/avatar.webp` for a valid owner uuid', () => {
		expect(avatarPath(VALID_UUID)).toBe(`${VALID_UUID}/avatar.webp`);
	});

	it('uses a fixed `avatar.webp` file name (one avatar per user)', () => {
		expect(avatarPath(VALID_UUID)).toMatch(/\/avatar\.webp$/);
	});

	it('places the owner uuid as the first (RLS-significant) segment', () => {
		expect(avatarPath(VALID_UUID).split('/')[0]).toBe(VALID_UUID);
	});

	it('rejects a non-uuid ownerId', () => {
		expect(() => avatarPath('not-a-uuid')).toThrow(/ownerId/);
	});

	it('rejects an empty ownerId', () => {
		expect(() => avatarPath('')).toThrow(/ownerId/);
	});

	it('rejects an ownerId containing a slash (prefix-escape attempt)', () => {
		expect(() => avatarPath(`${OTHER_UUID}/extra`)).toThrow(/ownerId/);
	});
});
