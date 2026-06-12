// PURE reaction aggregator. No SvelteKit / Supabase imports — plain data in,
// plain data out — so it is fully unit-testable in isolation (TDD-first per the
// project testing strategy). The feed load calls this per dog to turn raw
// reaction rows into the per-emoji chips the UI renders.
//
// Reactions are cosmetic flair (decision #12): this aggregation is the ENTIRE
// "count" mechanism — there is no denormalized DB counter — and it deliberately
// has nothing to do with vote_count or ranking.

/**
 * The minimal shape of a reaction row this aggregator needs. The DB row has more
 * columns (id, hot_dog_id, created_at); we depend only on emoji + user_id so the
 * function stays decoupled from the table's full shape.
 */
export interface ReactionRow {
	emoji: string;
	user_id: string;
}

/**
 * One per-emoji summary entry for a single hot dog: the emoji, how many distinct
 * members reacted with it, and whether the viewer is one of them (drives the
 * "reacted by me" highlight + the toggle direction in the UI).
 */
export interface ReactionSummary {
	emoji: string;
	count: number;
	reactedByMe: boolean;
}

/**
 * Aggregates raw reaction rows for ONE hot dog into a deterministically-sorted
 * list of per-emoji summaries.
 *
 * - `count` is the number of rows for that emoji (UNIQUE(user_id, hot_dog_id,
 *   emoji) guarantees one row per member per emoji, so this is a distinct-member
 *   count).
 * - `reactedByMe` is true when `viewerId` appears among the rows for that emoji.
 * - Sort is stable and deterministic: count DESC, then emoji ASC (so equal-count
 *   chips render in a consistent order regardless of input order).
 *
 * `viewerId` may be null (e.g. an unauthenticated render path); every
 * `reactedByMe` is then false.
 */
export function summarizeReactions(
	rows: ReactionRow[],
	viewerId: string | null
): ReactionSummary[] {
	const counts = new Map<string, number>();
	const mine = new Set<string>();

	for (const row of rows) {
		counts.set(row.emoji, (counts.get(row.emoji) ?? 0) + 1);
		if (viewerId !== null && row.user_id === viewerId) {
			mine.add(row.emoji);
		}
	}

	const summaries: ReactionSummary[] = [];
	for (const [emoji, count] of counts) {
		summaries.push({ emoji, count, reactedByMe: mine.has(emoji) });
	}

	summaries.sort((a, b) => {
		if (b.count !== a.count) {
			return b.count - a.count; // count DESC
		}
		return a.emoji < b.emoji ? -1 : a.emoji > b.emoji ? 1 : 0; // emoji ASC
	});

	return summaries;
}
