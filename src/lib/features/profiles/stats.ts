// Server-side Shrine stat-ledger aggregates (TASK-093). Like the other feature
// modules, this runs on the server (load functions), takes an RLS-scoped
// SupabaseClient *passed in* — never a client-side secret key — and reads ONLY.
// There is NO write path and NO new schema: every value is a read-only aggregate
// over EXISTING tables, surfaced as the derived stat ledger on The Shrine.
//
// Almost all reads run on the RLS-scoped client (event.locals.supabase). The ONE
// exception is the redeemed-invites head-count ("Disciples Summoned"): the only
// `invites` SELECT policy is `invites_select_own` (auth.uid() = inviter_id), so on
// the normal CROSS-MEMBER Shrine view RLS would silently filter out 100% of the
// target's invite rows and the count would read 0. That single count therefore
// runs on the service client (passed in AFTER the safeGetSession() gate, the
// established service-client-after-gate pattern), as a HEAD-count (no rows shipped)
// filtered to this member's own redeemed invites — so it does NOT widen exposure
// and is decision-#27-safe (the member's own summoning-contribution stat, public on
// the Shrine, and the future "Summoner" badge input).
//
// None of these are anonymity-sensitive (decision #27): only consequences BORNE by
// the member are public (anointings received, reactions received). The reporter
// side is NEVER surfaced here — there is deliberately no "reports made" / "heresies
// called" aggregate.
//
// Graceful degradation: each aggregate degrades to 0 on a read failure rather
// than failing the whole page, mirroring the load's spray/wall/brand handling.

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The derived stat ledger for a member's Shrine. Every field is a read-only
 * aggregate over existing data:
 *   - timesCrowned         : count of top_dog_days rows (one per calendar day reigned)
 *   - franksOffered        : count of the member's hot_dogs
 *   - totalDevotion        : sum of vote_count across the member's hot_dogs
 *   - highestBlessing      : max peak_votes across the member's hot_dogs
 *   - disciplesSummoned    : count of the member's REDEEMED invites (consumed_at not null)
 *   - anointingsReceived   : count of mustard_sprays targeting the member
 *   - reactionsReceived    : count of hotdog_reactions on the member's hot_dogs
 *
 * (Days as The Anointed Wiener is read directly off profiles.days_as_top_dog and
 * is NOT duplicated here.)
 */
export interface ShrineStats {
	timesCrowned: number;
	franksOffered: number;
	totalDevotion: number;
	highestBlessing: number;
	disciplesSummoned: number;
	anointingsReceived: number;
	reactionsReceived: number;
}

/** The all-zero ledger — the default a brand-new member (or a full read failure) shows. */
export const EMPTY_SHRINE_STATS: ShrineStats = {
	timesCrowned: 0,
	franksOffered: 0,
	totalDevotion: 0,
	highestBlessing: 0,
	disciplesSummoned: 0,
	anointingsReceived: 0,
	reactionsReceived: 0
};

/** Head-count of rows matching a single equality filter; degrades to 0 on error. */
async function countWhere(
	supabase: SupabaseClient,
	table: string,
	column: string,
	value: string
): Promise<number> {
	const { count, error } = await supabase
		.from(table)
		.select('*', { count: 'exact', head: true })
		.eq(column, value);

	if (error) {
		console.error('[stats] count failed', { table, column, error: error.message });
		return 0;
	}
	return count ?? 0;
}

/**
 * Loads the derived stat ledger for a member by profile id. Read-only aggregates
 * over existing tables; each degrades to 0 independently so a single failing read
 * never blanks the page. The hot-dog vote_count / peak_votes are server-maintained
 * (decision #24) — summing/maxing them here is a pure read, no write path.
 *
 * `supabase` is the RLS-scoped request client (event.locals.supabase) and runs
 * every aggregate EXCEPT the redeemed-invites head-count. `serviceClient` is the
 * service-role client (constructed AFTER the safeGetSession() gate) and runs ONLY
 * that one count, because `invites_select_own` RLS would zero it out on a
 * cross-member Shrine view (see the module header).
 *
 * `inviterUserId` is the member's auth user id (invites.inviter_id references
 * auth.users, not profiles — though for a member the two ids coincide). It is
 * accepted explicitly so the caller passes the trusted session/profile id rather
 * than this module inferring it.
 */
export async function loadShrineStats(
	supabase: SupabaseClient,
	serviceClient: SupabaseClient,
	profileId: string,
	inviterUserId: string
): Promise<ShrineStats> {
	// Times Crowned — one top_dog_days row per calendar day reigned.
	const timesCrownedP = countWhere(supabase, 'top_dog_days', 'profile_id', profileId);

	// Disciples Summoned — REDEEMED invites the member sent. `consumed_at` is the
	// authoritative spent-signal (never nulled by FK), NOT `consumed_by`. Runs on the
	// SERVICE client: `invites_select_own` RLS would zero this out on a cross-member
	// Shrine view. A HEAD-count ships no rows, so this is decision-#27-safe. Degrades
	// to 0 on error, like every other aggregate.
	const disciplesP = (async () => {
		const { count, error } = await serviceClient
			.from('invites')
			.select('*', { count: 'exact', head: true })
			.eq('inviter_id', inviterUserId)
			.not('consumed_at', 'is', null);
		if (error) {
			console.error('[stats] disciples count failed', { error: error.message });
			return 0;
		}
		return count ?? 0;
	})();

	// Anointings Received — mustard sprays targeting the member.
	const anointingsP = countWhere(supabase, 'mustard_sprays', 'target_profile_id', profileId);

	// Franks Offered + Total Devotion + Highest Blessing — derived from the
	// member's hot_dogs rows in one read (count + sum(vote_count) + max(peak_votes)
	// computed in TS over the returned counter columns).
	const dogsP = (async (): Promise<{
		franksOffered: number;
		totalDevotion: number;
		highestBlessing: number;
	}> => {
		const { data, error } = await supabase
			.from('hot_dogs')
			.select('vote_count, peak_votes')
			.eq('owner_id', profileId);
		if (error) {
			console.error('[stats] hot_dogs aggregate failed', { error: error.message });
			return { franksOffered: 0, totalDevotion: 0, highestBlessing: 0 };
		}
		const rows = (data as { vote_count: number; peak_votes: number }[] | null) ?? [];
		let totalDevotion = 0;
		let highestBlessing = 0;
		for (const row of rows) {
			totalDevotion += row.vote_count ?? 0;
			if ((row.peak_votes ?? 0) > highestBlessing) {
				highestBlessing = row.peak_votes ?? 0;
			}
		}
		return { franksOffered: rows.length, totalDevotion, highestBlessing };
	})();

	// Reactions Received — hotdog_reactions on the member's hot_dogs. The reaction
	// rows reference hot_dog_id, so we filter through the owning dog via an inner
	// join on hot_dogs (head-count, no rows shipped).
	const reactionsP = (async () => {
		const { count, error } = await supabase
			.from('hotdog_reactions')
			.select('hot_dogs!inner(owner_id)', { count: 'exact', head: true })
			.eq('hot_dogs.owner_id', profileId);
		if (error) {
			console.error('[stats] reactions count failed', { error: error.message });
			return 0;
		}
		return count ?? 0;
	})();

	const [timesCrowned, disciplesSummoned, anointingsReceived, dogs, reactionsReceived] =
		await Promise.all([timesCrownedP, disciplesP, anointingsP, dogsP, reactionsP]);

	// Seed from the all-zero ledger (the degradation baseline) and overlay the
	// resolved aggregates, so any field a future read leaves unset stays at its 0
	// default rather than going undefined.
	return {
		...EMPTY_SHRINE_STATS,
		timesCrowned,
		disciplesSummoned,
		anointingsReceived,
		reactionsReceived,
		franksOffered: dogs.franksOffered,
		totalDevotion: dogs.totalDevotion,
		highestBlessing: dogs.highestBlessing
	};
}
