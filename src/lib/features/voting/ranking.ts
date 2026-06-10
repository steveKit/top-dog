// Top Dog crown-selection — PURE module. No SvelteKit or Supabase imports so the
// ranking + sticky tie-break logic can be unit-tested in isolation (CLAUDE.md
// Testing Strategy: vote ranking + sticky tie-break is TDD-first).
//
// PROJECT.md decision #13 (Top Dog): the Top Dog is the user whose SINGLE
// highest-voted dog leads by vote count. Modeling at the DOG level naturally
// satisfies "single highest-voted dog" — each dog is one entry, and the winning
// dog's `ownerId` is the Top Dog user. Ties break on stickiness (earliest to
// hold the crown), then on dog id for total determinism.
//
// NOTE: this is a STUB. The real ranking algorithm is implemented by the
// implementer in the TDD-verify pass. The placeholder body below makes the file
// type-check and the co-located tests run RED.

export interface RankableDog {
	/** hot dog id — stable identity / final deterministic tie-break */
	id: string;
	/** owner profile id (the eventual "Top Dog" user) */
	ownerId: string;
	/** denormalized vote_count */
	voteCount: number;
	/** ISO-8601 timestamp the OWNER has held the crown since, or null if never crowned */
	topDogSince: string | null;
}

/**
 * Selects the Top Dog from a set of rankable dogs.
 *
 * Eligibility: a dog needs `voteCount >= 1` to be crownable. Among eligible
 * dogs the winner is, in order:
 *   1. strictly-highest `voteCount`;
 *   2. on a tie, earliest (oldest) `topDogSince` (sticky) — a non-null
 *      `topDogSince` beats a `null` one (`null` sorts after any real timestamp);
 *   3. still tied, ascending `id` (lexicographic) for total determinism.
 *
 * Returns `null` when no dog is eligible (empty input, or all `voteCount === 0`).
 *
 * Validate-at-boundary (mirrors src/lib/storage/guard.ts and
 * src/lib/image/compress.ts): a negative or non-finite `voteCount` is an
 * upstream programming error, so we throw a TypeError rather than misrank.
 */
export function selectTopDog(dogs: readonly RankableDog[]): RankableDog | null {
	// Validate-at-boundary: every dog's voteCount must be a non-negative finite
	// number. A negative or non-finite count is an upstream programming error, so
	// we throw rather than misrank. Validate the WHOLE input before ranking so a
	// bad count anywhere — not just the first dog — is caught.
	for (const dog of dogs) {
		if (!Number.isFinite(dog.voteCount) || dog.voteCount < 0) {
			throw new TypeError(
				`selectTopDog: voteCount must be a non-negative finite number, got ${dog.voteCount} (dog ${dog.id})`
			);
		}
	}

	let best: RankableDog | null = null;
	for (const dog of dogs) {
		// Eligibility: a dog needs at least one vote to be crownable.
		if (dog.voteCount < 1) {
			continue;
		}
		if (best === null || isBetterCandidate(dog, best)) {
			best = dog;
		}
	}
	return best;
}

/**
 * Strict ordering: is `candidate` a better Top Dog than the current `best`?
 *   1. higher voteCount wins;
 *   2. on a tie, earlier topDogSince wins — a non-null timestamp beats null
 *      (null sorts after any real timestamp);
 *   3. still tied, smaller (ascending lexicographic) id wins.
 * This comparator is a total order, so the result is input-order independent.
 */
function isBetterCandidate(candidate: RankableDog, best: RankableDog): boolean {
	if (candidate.voteCount !== best.voteCount) {
		return candidate.voteCount > best.voteCount;
	}

	if (candidate.topDogSince !== best.topDogSince) {
		// null sorts after any real timestamp: a null candidate can never win the
		// stickiness tie, and a real candidate always beats a null incumbent.
		if (candidate.topDogSince === null) {
			return false;
		}
		if (best.topDogSince === null) {
			return true;
		}
		return candidate.topDogSince < best.topDogSince;
	}

	// Final deterministic tie-break: ascending lexicographic id.
	return candidate.id < best.id;
}
