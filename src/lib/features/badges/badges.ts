// The Reliquary — PURE derived-honors module (M8 TASK-094-R). No SvelteKit or
// Supabase imports, so the badge-derivation logic can be unit-tested in isolation
// — same shape as src/lib/features/voting/ranking.ts, src/lib/features/mustard/
// decay.ts, and src/lib/features/reports/verdict.ts.
//
// Every badge is DERIVED at render time from facts the app already keeps. There is
// NO new schema, NO migration, NO new write path, NO new RPC, NO new dependency.
// A badge is simply a relic that lights up once an existing record crosses a
// threshold; nothing here is client-settable, so the honors are UN-FORGEABLE by
// construction. The route load assembles a `BadgeInputs` value object from
// already-loaded member facts (the Shrine stat ledger + the existing liar/heretic
// reads + two tiny new read-only reads); THIS module only computes — it touches
// no I/O and no clock except the explicit `now`/`joinedAt` inputs it is given.
//
// ‼️ Reporter anonymity (decision #27) is preserved BY CONSTRUCTION: no input here
// keys on the reporter side of a report. `heretic` keys on the member's OWN dogs'
// verdicts; `liar` (display "False Witness") on the member's OWN brand; `inquisitor`
// on `decided_by` = the member (the adjudicator's own, public action). There is
// deliberately no "heresies you've called" badge.
//
// OUT OF v1 (flagged, NOT built — logged as Discovered Work):
//   - a "total votes ever" honor: the `votes` table keeps only the ONE current vote
//     per voter (UNIQUE(voter_id)), so a lifetime-votes-cast count is not derivable
//     from existing data without new tracking;
//   - reign-STREAK honors (e.g. "reigned N consecutive days"): `top_dog_days`
//     records discrete calendar days reigned, not streak/consecutive-run metadata,
//     so a streak honor is likewise not derivable without new tracking.
// Both would require new persisted state, which this purely-derived feature forbids.

/**
 * The v1 badge ids. Code identifiers are NEUTRAL (HARD SCOPE constraint); the cult
 * names ("First Frank", "The Drenched", "False Witness", …) are display labels only,
 * applied by the Reliquary component, never here.
 */
export type BadgeId =
	| 'first_frank'
	| 'crowned'
	| 'centurion'
	| 'summoner'
	| 'drenched'
	| 'heretic'
	| 'liar'
	| 'inquisitor'
	| 'elder';

/**
 * Whether a badge is a gilded HONOR or a shame MARK. The two shame marks
 * (`heretic`, `liar`) render in a distinct disgrace register and are excluded from
 * the "earned N of M honors" count (you do not "earn" a disgrace).
 */
export type BadgeKind = 'honor' | 'shame';

/**
 * Centurion threshold — a single frank that ever bore ≥100 blessings (votes).
 * `highestBlessing` is max(peak_votes) across the member's dogs (decision #24:
 * peak_votes is server-maintained, so this read is un-forgeable).
 */
export const CENTURION_THRESHOLD = 100;

/**
 * Elder cutoff — a member is an Elder if they were sworn (joined) on or before this
 * instant: among the first of the Faithful. Single source of truth for the
 * early-member threshold (not a scattered magic number). Snacktum Snacktorum is
 * pre-launch / invite-only; this date brackets the founding cohort. A future tune
 * of the cutoff changes ONLY this constant.
 */
export const ELDER_CUTOFF_ISO = '2026-09-01T00:00:00.000Z';

/**
 * Tier thresholds per tiered badge, ascending. The member's current tier is the
 * highest threshold their count meets or exceeds (tier 0 = locked, below the first
 * threshold); the next threshold (if any) is the first one they have not yet met.
 *
 *   - crowned   1 / 7 / 30   (days as The Anointed Wiener — the reign-length relic;
 *                             ranks fixed by the design + AC)
 *   - summoner  1 / 5 / 25   (redeemed invites — design copy: "next rank at twenty-five")
 *   - drenched  1 / 10 / 50  (anointings received — design copy: "ten times over … next at fifty")
 *   - inquisitor 1 / 5 / 25  (verdicts rendered as The Anointed Wiener)
 */
export const BADGE_TIERS: Record<'crowned' | 'summoner' | 'drenched' | 'inquisitor', number[]> = {
	crowned: [1, 7, 30],
	summoner: [1, 5, 25],
	drenched: [1, 10, 50],
	inquisitor: [1, 5, 25]
};

/**
 * The member facts the module computes over. The route load assembles this from
 * already-loaded values (the Shrine stat ledger + the liar/heretic reads + the two
 * new reads); the module never queries. All counts default-safe: a missing /
 * undefined / negative / non-finite numeric input is treated as 0 (a failed read
 * degrades that badge to locked, never throws — defensive like summarizeLiarBrand).
 */
export interface BadgeInputs {
	/** Count of the member's hot_dogs (franksOffered). first_frank ≥ 1. */
	franksOffered: number;
	/** profiles.days_as_top_dog — drives the tiered `crowned` relic. */
	daysAsTopDog: number;
	/** max(peak_votes) across the member's dogs — drives `centurion`. */
	highestBlessing: number;
	/** Redeemed invites the member sent (disciplesSummoned) — tiered `summoner`. */
	disciplesSummoned: number;
	/** mustard_sprays targeting the member (anointingsReceived) — tiered `drenched`. */
	anointingsReceived: number;
	/** burger_verdicts where decided_by = the member — tiered `inquisitor`. */
	verdictsRendered: number;
	/** True iff the member owns a confirmed_hamburger dog (isHamburgerHeretic). */
	isHeretic: boolean;
	/** True iff the member has EVER been hamburger_liars-branded (see note below). */
	hasBeenLiarBranded: boolean;
	/**
	 * The member's profiles.joined_at (ISO string, Date, or epoch ms). `elder` is
	 * earned when this is on/before ELDER_CUTOFF_ISO. Undefined / unparseable =>
	 * not an Elder (defensive — a bad read degrades to locked).
	 */
	joinedAt: string | Date | number | null | undefined;
}

/**
 * The computed render state of one badge.
 *   - `id`     : the neutral badge id;
 *   - `kind`   : 'honor' (gilded) | 'shame' (disgrace mark);
 *   - `earned` : whether the relic is lit;
 *   - tiered badges also carry `tier` (0 = locked, 1..N), `maxTier` (N), and
 *     `nextThreshold` (the count needed for the next tier, or null at the top).
 */
export interface BadgeState {
	id: BadgeId;
	kind: BadgeKind;
	earned: boolean;
	/** Present only on tiered badges: current rank, 0 when locked. */
	tier?: number;
	/** Present only on tiered badges: the highest rank (number of thresholds). */
	maxTier?: number;
	/** Present only on tiered badges: count needed for the next tier, or null at top. */
	nextThreshold?: number | null;
}

/** Coerce a possibly-missing numeric input to a safe non-negative integer count. */
function safeCount(value: number | null | undefined): number {
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
		return 0;
	}
	return value;
}

/**
 * Resolves the tier state for a count against an ascending threshold list. The tier
 * is the number of thresholds the count meets or exceeds; the next threshold is the
 * first one not yet met (null once at the top tier). Earned iff tier ≥ 1.
 */
function tieredState(id: BadgeId, count: number, thresholds: number[]): BadgeState {
	const n = safeCount(count);
	let tier = 0;
	for (const threshold of thresholds) {
		if (n >= threshold) {
			tier++;
		}
	}
	const nextThreshold = tier < thresholds.length ? thresholds[tier] : null;
	return {
		id,
		kind: 'honor',
		earned: tier >= 1,
		tier,
		maxTier: thresholds.length,
		nextThreshold
	};
}

/** Normalize a Date | ISO string | epoch-ms to epoch ms; null on unparseable. */
function tryEpochMs(value: string | Date | number | null | undefined): number | null {
	if (value === null || value === undefined) return null;
	const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
	return Number.isNaN(ms) ? null : ms;
}

/**
 * Computes the full v1 badge set from a member's already-loaded facts. Pure:
 * value-in / value-out, no I/O. The returned order is the shelf's display order
 * (honors first, then the two shame marks). Tiered badges carry tier/next-threshold;
 * the rest are simple earned/not-earned.
 *
 * NOTE on `liar` (display "False Witness"): it is earned on EVER-branded, not
 * currently-branded — a relic shelf records that the member once bore false witness,
 * even after the decaying banner has faded. (The decaying BANNER on the shrine head
 * is a separate, currently-active derivation via summarizeLiarBrand; this relic is
 * the lasting record.) The load supplies `hasBeenLiarBranded` from the presence of
 * ANY hamburger_liars row (getLiarBrandTimestamps non-empty).
 */
export function computeBadges(inputs: BadgeInputs): BadgeState[] {
	const elderMs = tryEpochMs(inputs.joinedAt);
	const elderEarned = elderMs !== null && elderMs <= Date.parse(ELDER_CUTOFF_ISO);

	return [
		{
			id: 'first_frank',
			kind: 'honor',
			earned: safeCount(inputs.franksOffered) >= 1
		},
		tieredState('crowned', inputs.daysAsTopDog, BADGE_TIERS.crowned),
		{
			id: 'centurion',
			kind: 'honor',
			earned: safeCount(inputs.highestBlessing) >= CENTURION_THRESHOLD
		},
		tieredState('summoner', inputs.disciplesSummoned, BADGE_TIERS.summoner),
		tieredState('drenched', inputs.anointingsReceived, BADGE_TIERS.drenched),
		tieredState('inquisitor', inputs.verdictsRendered, BADGE_TIERS.inquisitor),
		{
			id: 'elder',
			kind: 'honor',
			earned: elderEarned
		},
		// Shame marks (disgrace register) — last, excluded from the honor tally.
		{
			id: 'heretic',
			kind: 'shame',
			earned: inputs.isHeretic === true
		},
		{
			id: 'liar',
			kind: 'shame',
			earned: inputs.hasBeenLiarBranded === true
		}
	];
}

/** Count of EARNED honor badges (shame marks excluded — you don't earn disgrace). */
export function countEarnedHonors(badges: BadgeState[]): number {
	return badges.filter((b) => b.kind === 'honor' && b.earned).length;
}

/** Total number of honor badges on the shelf (shame marks excluded). */
export function countTotalHonors(badges: BadgeState[]): number {
	return badges.filter((b) => b.kind === 'honor').length;
}
