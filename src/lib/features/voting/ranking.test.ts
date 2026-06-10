import { describe, it, expect } from 'vitest';

import { selectTopDog, type RankableDog } from './ranking';

// PROJECT.md decision #13 (Top Dog): the Top Dog is the user whose SINGLE
// highest-voted dog leads by vote count; ties break on stickiness (earliest to
// hold the crown), then on dog id for total determinism. These tests pin that
// contract at the DOG level — the winning dog's `ownerId` is the Top Dog user.

/**
 * Tiny builder so each test reads as the case it pins, not as object plumbing.
 * Defaults are an eligible-by-one-vote, never-crowned dog; tests override the
 * fields that matter for the case.
 */
function dog(overrides: Partial<RankableDog> = {}): RankableDog {
	return {
		id: 'dog-default',
		ownerId: 'owner-default',
		voteCount: 1,
		topDogSince: null,
		...overrides
	};
}

describe('selectTopDog — eligibility / no-votes edge case', () => {
	it('returns null for an empty array (no dogs)', () => {
		expect(selectTopDog([])).toBeNull();
	});

	it('returns null when every dog has zero votes', () => {
		const dogs = [
			dog({ id: 'a', voteCount: 0 }),
			dog({ id: 'b', voteCount: 0 }),
			dog({ id: 'c', voteCount: 0 })
		];
		expect(selectTopDog(dogs)).toBeNull();
	});

	it('returns null for a single dog with zero votes', () => {
		expect(selectTopDog([dog({ id: 'a', voteCount: 0 })])).toBeNull();
	});

	it('ignores zero-vote dogs and crowns the only eligible one', () => {
		const dogs = [
			dog({ id: 'a', voteCount: 0 }),
			dog({ id: 'b', voteCount: 1, ownerId: 'owner-b' }),
			dog({ id: 'c', voteCount: 0 })
		];
		const winner = selectTopDog(dogs);
		expect(winner?.id).toBe('b');
		expect(winner?.ownerId).toBe('owner-b');
	});
});

describe('selectTopDog — single eligible dog', () => {
	it('returns the dog when it has at least one vote', () => {
		const only = dog({ id: 'solo', voteCount: 1, ownerId: 'owner-solo' });
		const winner = selectTopDog([only]);
		expect(winner?.id).toBe('solo');
		expect(winner?.ownerId).toBe('owner-solo');
	});
});

describe('selectTopDog — clear winner (votes)', () => {
	it('returns the dog with the strictly-highest vote count', () => {
		const dogs = [
			dog({ id: 'a', voteCount: 3 }),
			dog({ id: 'b', voteCount: 9, ownerId: 'owner-b' }),
			dog({ id: 'c', voteCount: 5 })
		];
		const winner = selectTopDog(dogs);
		expect(winner?.id).toBe('b');
		expect(winner?.ownerId).toBe('owner-b');
	});

	it('votes beat stickiness — a higher-voted challenger overtakes the longtime holder (crown handoff)', () => {
		// holder has held the crown since 2024 but trails on votes; the challenger
		// has more votes and a null/never-crowned stickiness — votes still win.
		const holder = dog({ id: 'holder', voteCount: 10, topDogSince: '2024-01-01T00:00:00.000Z' });
		const challenger = dog({
			id: 'challenger',
			ownerId: 'owner-challenger',
			voteCount: 11,
			topDogSince: null
		});
		const winner = selectTopDog([holder, challenger]);
		expect(winner?.id).toBe('challenger');
		expect(winner?.ownerId).toBe('owner-challenger');
	});
});

describe('selectTopDog — sticky tie-break (earliest topDogSince)', () => {
	it('breaks an exact vote tie by the EARLIEST topDogSince', () => {
		const earlier = dog({
			id: 'earlier',
			ownerId: 'owner-earlier',
			voteCount: 7,
			topDogSince: '2025-01-01T00:00:00.000Z'
		});
		const later = dog({
			id: 'later',
			ownerId: 'owner-later',
			voteCount: 7,
			topDogSince: '2025-06-01T00:00:00.000Z'
		});
		const winner = selectTopDog([later, earlier]);
		expect(winner?.id).toBe('earlier');
		expect(winner?.ownerId).toBe('owner-earlier');
	});

	it('a non-null topDogSince (current/previous holder) beats a null one (never crowned) on a tie', () => {
		// null sorts AFTER any real timestamp: the previously-crowned dog keeps the
		// crown on an exact vote tie against a never-crowned challenger.
		const holder = dog({
			id: 'holder',
			ownerId: 'owner-holder',
			voteCount: 4,
			topDogSince: '2025-03-01T00:00:00.000Z'
		});
		const newcomer = dog({
			id: 'newcomer',
			ownerId: 'owner-newcomer',
			voteCount: 4,
			topDogSince: null
		});
		const winner = selectTopDog([newcomer, holder]);
		expect(winner?.id).toBe('holder');
		expect(winner?.ownerId).toBe('owner-holder');
	});
});

describe('selectTopDog — final deterministic tie-break (ascending id)', () => {
	it('breaks a tie with both topDogSince null by ascending id', () => {
		const dogs = [
			dog({ id: 'zeta', voteCount: 5, topDogSince: null }),
			dog({ id: 'alpha', voteCount: 5, topDogSince: null }),
			dog({ id: 'mike', voteCount: 5, topDogSince: null })
		];
		expect(selectTopDog(dogs)?.id).toBe('alpha');
	});

	it('breaks a tie with identical topDogSince timestamps by ascending id', () => {
		const ts = '2025-02-02T00:00:00.000Z';
		const dogs = [
			dog({ id: 'dog-9', voteCount: 6, topDogSince: ts }),
			dog({ id: 'dog-1', voteCount: 6, topDogSince: ts }),
			dog({ id: 'dog-5', voteCount: 6, topDogSince: ts })
		];
		expect(selectTopDog(dogs)?.id).toBe('dog-1');
	});
});

describe('selectTopDog — determinism / order independence', () => {
	it('returns the same winner regardless of input order', () => {
		const a = dog({ id: 'a', voteCount: 8, topDogSince: '2025-01-10T00:00:00.000Z' });
		const b = dog({ id: 'b', voteCount: 8, topDogSince: '2025-01-05T00:00:00.000Z' }); // earliest -> winner
		const c = dog({ id: 'c', voteCount: 8, topDogSince: null });
		const d = dog({ id: 'd', voteCount: 3, topDogSince: '2024-01-01T00:00:00.000Z' });

		const orderings: RankableDog[][] = [
			[a, b, c, d],
			[d, c, b, a],
			[c, a, d, b],
			[b, d, a, c]
		];

		for (const ordering of orderings) {
			expect(selectTopDog(ordering)?.id).toBe('b');
		}
	});
});

describe('selectTopDog — input validation (house style)', () => {
	it('throws a TypeError for a negative vote count', () => {
		expect(() => selectTopDog([dog({ id: 'a', voteCount: -1 })])).toThrow(TypeError);
	});

	it('throws a TypeError for a NaN vote count', () => {
		expect(() => selectTopDog([dog({ id: 'a', voteCount: NaN })])).toThrow(TypeError);
	});

	it('throws a TypeError for an Infinity vote count', () => {
		expect(() => selectTopDog([dog({ id: 'a', voteCount: Infinity })])).toThrow(TypeError);
	});

	it('throws a TypeError for a -Infinity vote count', () => {
		expect(() => selectTopDog([dog({ id: 'a', voteCount: -Infinity })])).toThrow(TypeError);
	});

	it('validates every dog, not just the first — a later bad voteCount still throws', () => {
		const dogs = [dog({ id: 'a', voteCount: 5 }), dog({ id: 'b', voteCount: NaN })];
		expect(() => selectTopDog(dogs)).toThrow(TypeError);
	});
});
