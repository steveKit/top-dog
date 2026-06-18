import { describe, it, expect, vi } from 'vitest';
import { DISMISSED_KEY, isNoticeDismissed, persistNoticeDismissed } from './topDogPrivilegesNotice';

/** Minimal in-memory Storage stub — enough for the helpers under test. */
function makeStorage(initial: Record<string, string> = {}): Storage {
	const map = new Map(Object.entries(initial));
	return {
		get length() {
			return map.size;
		},
		clear: () => map.clear(),
		getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
		key: (i: number) => Array.from(map.keys())[i] ?? null,
		removeItem: (k: string) => void map.delete(k),
		setItem: (k: string, v: string) => void map.set(k, v)
	};
}

describe('isNoticeDismissed', () => {
	it('returns false when storage is null (SSR)', () => {
		expect(isNoticeDismissed(null)).toBe(false);
	});

	it('returns false when the key is absent', () => {
		expect(isNoticeDismissed(makeStorage())).toBe(false);
	});

	it('returns true once the dismissal flag is set', () => {
		expect(isNoticeDismissed(makeStorage({ [DISMISSED_KEY]: '1' }))).toBe(true);
	});

	it('returns false for an unexpected stored value', () => {
		expect(isNoticeDismissed(makeStorage({ [DISMISSED_KEY]: 'nope' }))).toBe(false);
	});

	it('swallows storage read errors and returns false', () => {
		const throwing = makeStorage();
		vi.spyOn(throwing, 'getItem').mockImplementation(() => {
			throw new Error('storage disabled');
		});
		expect(isNoticeDismissed(throwing)).toBe(false);
	});
});

describe('persistNoticeDismissed', () => {
	it('is a no-op when storage is null (SSR)', () => {
		expect(() => persistNoticeDismissed(null)).not.toThrow();
	});

	it('persists the flag so a subsequent read is dismissed', () => {
		const storage = makeStorage();
		persistNoticeDismissed(storage);
		expect(isNoticeDismissed(storage)).toBe(true);
	});

	it('swallows storage write errors', () => {
		const throwing = makeStorage();
		vi.spyOn(throwing, 'setItem').mockImplementation(() => {
			throw new Error('quota exceeded');
		});
		expect(() => persistNoticeDismissed(throwing)).not.toThrow();
	});
});
