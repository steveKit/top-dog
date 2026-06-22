import { describe, it, expect } from 'vitest';

import {
	computeBadges,
	countEarnedHonors,
	countTotalHonors,
	BADGE_TIERS,
	CENTURION_THRESHOLD,
	ELDER_CUTOFF_ISO,
	type BadgeInputs,
	type BadgeId,
	type BadgeState
} from './badges';

// The Reliquary — pure derived-honors logic (M8 TASK-094-R). These tests pin the
// earned/locked boundary of every v1 badge, every tier boundary of the tiered ones,
// the all-locked (brand-new member) and all-earned cases, and defensive handling of
// zero / missing / undefined / negative inputs. Pure value-in / value-out — no I/O,
// no mocks. Reporter anonymity (decision #27) is structural here: there is no
// reporter-side input to test, only the member's OWN consequences/actions.

// A brand-new member: everything locked, no shame, the all-zero baseline.
const NEW_MEMBER: BadgeInputs = {
	franksOffered: 0,
	daysAsTopDog: 0,
	highestBlessing: 0,
	disciplesSummoned: 0,
	anointingsReceived: 0,
	verdictsRendered: 0,
	isHeretic: false,
	hasBeenLiarBranded: false,
	// Sworn well AFTER the Elder cutoff -> not an Elder.
	joinedAt: '2027-01-01T00:00:00.000Z'
};

function byId(badges: BadgeState[], id: BadgeId): BadgeState {
	const found = badges.find((b) => b.id === id);
	if (!found) throw new Error(`badge ${id} missing from computeBadges output`);
	return found;
}

describe('computeBadges — shape & set', () => {
	it('returns exactly the v1 badge set, in shelf order (honors then shame marks)', () => {
		const ids = computeBadges(NEW_MEMBER).map((b) => b.id);
		expect(ids).toEqual([
			'first_frank',
			'crowned',
			'centurion',
			'summoner',
			'drenched',
			'inquisitor',
			'elder',
			'heretic',
			'liar'
		]);
	});

	it('tags heretic and liar as shame, everything else as honor', () => {
		const badges = computeBadges(NEW_MEMBER);
		expect(byId(badges, 'heretic').kind).toBe('shame');
		expect(byId(badges, 'liar').kind).toBe('shame');
		for (const id of [
			'first_frank',
			'crowned',
			'centurion',
			'summoner',
			'drenched',
			'inquisitor',
			'elder'
		] as BadgeId[]) {
			expect(byId(badges, id).kind).toBe('honor');
		}
	});
});

describe('all-locked (brand-new member)', () => {
	it('earns nothing', () => {
		const badges = computeBadges(NEW_MEMBER);
		for (const b of badges) {
			expect(b.earned).toBe(false);
		}
	});

	it('tiered badges sit at tier 0 with the first threshold as next', () => {
		const badges = computeBadges(NEW_MEMBER);
		expect(byId(badges, 'crowned')).toMatchObject({ tier: 0, maxTier: 3, nextThreshold: 1 });
		expect(byId(badges, 'summoner')).toMatchObject({ tier: 0, maxTier: 3, nextThreshold: 1 });
		expect(byId(badges, 'drenched')).toMatchObject({ tier: 0, maxTier: 3, nextThreshold: 1 });
		expect(byId(badges, 'inquisitor')).toMatchObject({ tier: 0, maxTier: 3, nextThreshold: 1 });
	});

	it('counts 0 of the honor total (7 honors, shame excluded)', () => {
		const badges = computeBadges(NEW_MEMBER);
		expect(countEarnedHonors(badges)).toBe(0);
		expect(countTotalHonors(badges)).toBe(7);
	});
});

describe('first_frank — earned at >= 1 frank', () => {
	it('locked at 0', () => {
		expect(byId(computeBadges({ ...NEW_MEMBER, franksOffered: 0 }), 'first_frank').earned).toBe(
			false
		);
	});
	it('earned at exactly 1', () => {
		expect(byId(computeBadges({ ...NEW_MEMBER, franksOffered: 1 }), 'first_frank').earned).toBe(
			true
		);
	});
	it('earned above 1', () => {
		expect(byId(computeBadges({ ...NEW_MEMBER, franksOffered: 42 }), 'first_frank').earned).toBe(
			true
		);
	});
});

describe('centurion — earned at >= 100 highest blessing', () => {
	it('locked just below the threshold (99)', () => {
		expect(
			byId(computeBadges({ ...NEW_MEMBER, highestBlessing: CENTURION_THRESHOLD - 1 }), 'centurion')
				.earned
		).toBe(false);
	});
	it('earned exactly at the threshold (100)', () => {
		expect(
			byId(computeBadges({ ...NEW_MEMBER, highestBlessing: CENTURION_THRESHOLD }), 'centurion')
				.earned
		).toBe(true);
	});
	it('earned above the threshold (101)', () => {
		expect(
			byId(computeBadges({ ...NEW_MEMBER, highestBlessing: CENTURION_THRESHOLD + 1 }), 'centurion')
				.earned
		).toBe(true);
	});
});

// Tier boundary coverage shared by every tiered badge: at / just-below / just-above
// each threshold, plus the top-tier nextThreshold === null.
const TIERED: {
	id: 'crowned' | 'summoner' | 'drenched' | 'inquisitor';
	field: keyof BadgeInputs;
}[] = [
	{ id: 'crowned', field: 'daysAsTopDog' },
	{ id: 'summoner', field: 'disciplesSummoned' },
	{ id: 'drenched', field: 'anointingsReceived' },
	{ id: 'inquisitor', field: 'verdictsRendered' }
];

describe.each(TIERED)('tiered badge $id', ({ id, field }) => {
	const [t1, t2, t3] = BADGE_TIERS[id];

	function at(count: number): BadgeState {
		return byId(computeBadges({ ...NEW_MEMBER, [field]: count }), id);
	}

	it(`locked just below tier 1 (${t1 - 1})`, () => {
		expect(at(t1 - 1)).toMatchObject({ earned: false, tier: 0, nextThreshold: t1 });
	});

	it(`tier 1 exactly at ${t1}`, () => {
		expect(at(t1)).toMatchObject({ earned: true, tier: 1, nextThreshold: t2 });
	});

	it(`still tier 1 just below tier 2 (${t2 - 1})`, () => {
		expect(at(t2 - 1)).toMatchObject({ earned: true, tier: 1, nextThreshold: t2 });
	});

	it(`tier 2 exactly at ${t2}`, () => {
		expect(at(t2)).toMatchObject({ earned: true, tier: 2, nextThreshold: t3 });
	});

	it(`tier 3 (top) exactly at ${t3}, nextThreshold null`, () => {
		expect(at(t3)).toMatchObject({ earned: true, tier: 3, maxTier: 3, nextThreshold: null });
	});

	it(`stays top tier above ${t3}`, () => {
		expect(at(t3 + 100)).toMatchObject({ tier: 3, nextThreshold: null });
	});
});

describe('crowned uses the AC-pinned 1/7/30 ranks', () => {
	it('1 day = tier 1, 7 = tier 2, 30 = tier 3', () => {
		expect(BADGE_TIERS.crowned).toEqual([1, 7, 30]);
		expect(byId(computeBadges({ ...NEW_MEMBER, daysAsTopDog: 7 }), 'crowned').tier).toBe(2);
		expect(byId(computeBadges({ ...NEW_MEMBER, daysAsTopDog: 30 }), 'crowned').tier).toBe(3);
	});
});

describe('heretic — shame, from the member owning a confirmed_hamburger', () => {
	it('locked when not a heretic', () => {
		expect(byId(computeBadges({ ...NEW_MEMBER, isHeretic: false }), 'heretic').earned).toBe(false);
	});
	it('earned when a heretic', () => {
		expect(byId(computeBadges({ ...NEW_MEMBER, isHeretic: true }), 'heretic').earned).toBe(true);
	});
});

describe('liar / False Witness — shame, EVER-branded', () => {
	it('locked when never branded', () => {
		expect(byId(computeBadges({ ...NEW_MEMBER, hasBeenLiarBranded: false }), 'liar').earned).toBe(
			false
		);
	});
	it('earned when ever branded (even if the live banner has since faded)', () => {
		expect(byId(computeBadges({ ...NEW_MEMBER, hasBeenLiarBranded: true }), 'liar').earned).toBe(
			true
		);
	});
});

describe('elder — earned by joining on/before the cutoff', () => {
	const cutoffMs = Date.parse(ELDER_CUTOFF_ISO);

	it('earned exactly at the cutoff instant', () => {
		expect(byId(computeBadges({ ...NEW_MEMBER, joinedAt: ELDER_CUTOFF_ISO }), 'elder').earned).toBe(
			true
		);
	});
	it('earned just before the cutoff', () => {
		const justBefore = new Date(cutoffMs - 1000).toISOString();
		expect(byId(computeBadges({ ...NEW_MEMBER, joinedAt: justBefore }), 'elder').earned).toBe(true);
	});
	it('locked just after the cutoff', () => {
		const justAfter = new Date(cutoffMs + 1000).toISOString();
		expect(byId(computeBadges({ ...NEW_MEMBER, joinedAt: justAfter }), 'elder').earned).toBe(false);
	});
	it('accepts a Date and epoch ms, not only an ISO string', () => {
		expect(
			byId(computeBadges({ ...NEW_MEMBER, joinedAt: new Date(cutoffMs) }), 'elder').earned
		).toBe(true);
		expect(byId(computeBadges({ ...NEW_MEMBER, joinedAt: cutoffMs }), 'elder').earned).toBe(true);
	});
});

describe('all-earned member', () => {
	const ELDER_MEMBER: BadgeInputs = {
		franksOffered: 10,
		daysAsTopDog: 30,
		highestBlessing: 250,
		disciplesSummoned: 25,
		anointingsReceived: 50,
		verdictsRendered: 25,
		isHeretic: true,
		hasBeenLiarBranded: true,
		joinedAt: '2026-06-01T00:00:00.000Z' // before the cutoff
	};

	it('lights every badge', () => {
		const badges = computeBadges(ELDER_MEMBER);
		for (const b of badges) {
			expect(b.earned).toBe(true);
		}
	});

	it('puts every tiered badge at its top tier', () => {
		const badges = computeBadges(ELDER_MEMBER);
		for (const { id } of TIERED) {
			expect(byId(badges, id)).toMatchObject({ tier: 3, nextThreshold: null });
		}
	});

	it('counts all 7 honors earned (the 2 shame marks are not honors)', () => {
		const badges = computeBadges(ELDER_MEMBER);
		expect(countEarnedHonors(badges)).toBe(7);
		expect(countTotalHonors(badges)).toBe(7);
	});
});

describe('defensive — missing / undefined / negative / non-finite inputs', () => {
	// Simulates a degraded read that left numeric fields undefined/null and joinedAt
	// unparseable: every badge must lock rather than throw or falsely light.
	const DEGRADED = {
		franksOffered: undefined,
		daysAsTopDog: null,
		highestBlessing: undefined,
		disciplesSummoned: -5,
		anointingsReceived: Number.NaN,
		verdictsRendered: Number.POSITIVE_INFINITY,
		isHeretic: false,
		hasBeenLiarBranded: false,
		joinedAt: 'not-a-date'
	} as unknown as BadgeInputs;

	it('does not throw and locks every badge', () => {
		const badges = computeBadges(DEGRADED);
		for (const b of badges) {
			expect(b.earned).toBe(false);
		}
	});

	it('treats a negative count as tier 0 (locked, next at threshold 1)', () => {
		const badges = computeBadges(DEGRADED);
		expect(byId(badges, 'summoner')).toMatchObject({ tier: 0, nextThreshold: 1 });
	});

	it('treats NaN / Infinity counts as 0, not as crossing a threshold', () => {
		const badges = computeBadges(DEGRADED);
		expect(byId(badges, 'drenched').tier).toBe(0);
		expect(byId(badges, 'inquisitor').tier).toBe(0);
	});

	it('locks elder on an unparseable / missing joinedAt', () => {
		expect(byId(computeBadges(DEGRADED), 'elder').earned).toBe(false);
		expect(byId(computeBadges({ ...NEW_MEMBER, joinedAt: undefined }), 'elder').earned).toBe(false);
		expect(byId(computeBadges({ ...NEW_MEMBER, joinedAt: null }), 'elder').earned).toBe(false);
	});

	// The two non-tiered numeric badges (first_frank, centurion) share the same
	// safeCount coercion as the tiered ones, but go through the simple >= path rather
	// than tieredState — so pin their defensive handling explicitly (a non-finite or
	// negative count must lock, never falsely light, and never throw).
	it('locks first_frank on negative / NaN / Infinity / undefined frank counts', () => {
		for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY, undefined, null]) {
			expect(
				byId(
					computeBadges({ ...NEW_MEMBER, franksOffered: bad as unknown as number }),
					'first_frank'
				).earned
			).toBe(false);
		}
	});

	it('locks centurion on negative / NaN / Infinity / undefined highest-blessing', () => {
		// Infinity must NOT be read as "crosses the 100 threshold" — safeCount maps it to 0.
		for (const bad of [-50, Number.NaN, Number.POSITIVE_INFINITY, undefined, null]) {
			expect(
				byId(
					computeBadges({ ...NEW_MEMBER, highestBlessing: bad as unknown as number }),
					'centurion'
				).earned
			).toBe(false);
		}
	});

	it('coerces the boolean shame inputs strictly (only true lights heretic/liar)', () => {
		// isHeretic / hasBeenLiarBranded use === true, so a truthy non-boolean (e.g. 1,
		// 'x') from a degraded read must NOT light the shame mark.
		const heretic = byId(
			computeBadges({ ...NEW_MEMBER, isHeretic: 1 as unknown as boolean }),
			'heretic'
		);
		const liar = byId(
			computeBadges({ ...NEW_MEMBER, hasBeenLiarBranded: 'yes' as unknown as boolean }),
			'liar'
		);
		expect(heretic.earned).toBe(false);
		expect(liar.earned).toBe(false);
	});
});
