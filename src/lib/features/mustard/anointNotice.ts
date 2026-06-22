// "Anoint → wall notice" — PURE module. No SvelteKit or Supabase imports so the
// render-time coalescing can be unit-tested in isolation (same shape as
// mustard/decay.ts, reports/verdict.ts, voting/ranking.ts).
//
// M8 TASK-094 / OQ-2e. When the reigning champion ("The Anointed Wiener") anoints
// a disciple (a mustard spray on their profile), the disciple's wall surfaces a
// SYNTHESIZED notice — "The Anointed Wiener anointed you ×N" — coalescing a burst
// of anointings into a single line. This notice is DERIVED at render time from the
// existing `mustard_sprays` rows: there is NO new table, NO new column, NO write
// path. It is un-forgeable by construction — exactly like decay/verdict/ranking,
// the only inputs are rows a member already cannot forge (the spray INSERT is
// gated to the crown, decision #25).
//
// Grouping (OQ-2e): a ROLLING 24h window that RESETS at each anointing. Sprays are
// walked in chronological order; each spray within 24h of the PREVIOUS spray in
// the run extends the same notice; a gap of MORE than 24h since the previous spray
// starts a NEW notice. So a steady drip never expires the run, but a >24h lull
// closes it and the next anointing opens a fresh notice.
//
// PERSISTENCE (decision #29): unlike the overlay splat (which decays to invisible
// over 6h, mustard/decay.ts), the notice does NOT decay — it persists. Its source
// rows persist too: the daily prune job is retired (TASK-094), so anoint rows are
// never deleted. The notice is timestamped at the LAST anointing in its run, so it
// sorts chronologically among real wall messages by the most recent activity.

/** The rolling window that coalesces a run of anointings into one notice. */
export const ANOINT_NOTICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** The minimal anointing (spray) shape this module groups over. */
export interface AnointRow {
	/** Stable id of the spray row — used to derive a stable notice id. */
	id: string;
	/** ISO timestamp (as Postgres timestamptz returns) of when the anointing landed. */
	sprayed_at: string;
}

/**
 * A synthesized, coalesced anoint notice for the wall render. One per run of
 * anointings within the rolling 24h window.
 */
export interface AnointNotice {
	/** Stable id derived from the run's last anointing — safe as an #each key. */
	id: string;
	/** How many anointings this notice coalesces (the "×N"). */
	count: number;
	/** ISO timestamp of the FIRST anointing in the run (when the run opened). */
	firstAt: string;
	/** ISO timestamp of the LAST anointing in the run — its chronological sort key. */
	lastAt: string;
}

/** Normalize an ISO timestamp string to epoch ms; throw on an unparseable value. */
function toEpochMs(iso: string): number {
	const ms = new Date(iso).getTime();
	if (Number.isNaN(ms)) {
		throw new Error(`anointNotice: invalid sprayed_at: ${String(iso)}`);
	}
	return ms;
}

/**
 * Coalesces a member's anointing (spray) rows into wall notices, grouped by a
 * rolling 24h window that resets at each anointing.
 *
 * - Empty input → no notices.
 * - Rows need not be pre-sorted; they are ordered chronologically by `sprayed_at`
 *   before grouping (defensive — the caller's query order is not trusted).
 * - Each run is a maximal chain of anointings where consecutive timestamps are
 *   ≤ ANOINT_NOTICE_WINDOW_MS apart. A larger gap closes the run and opens a new one.
 * - Returned notices are ordered by `lastAt` ascending (oldest run first), matching
 *   how they merge chronologically into the wall.
 */
export function coalesceAnointNotices(rows: AnointRow[]): AnointNotice[] {
	if (rows.length === 0) return [];

	// Validate every timestamp upfront (a single-row input never reaches the sort
	// comparator or the loop, so parse here to fail fast on a bad value).
	for (const row of rows) {
		toEpochMs(row.sprayed_at);
	}

	// Defensive chronological sort — never trust the query's order. Tie-break on id
	// so equal timestamps order deterministically.
	const sorted = [...rows].sort((a, b) => {
		const da = toEpochMs(a.sprayed_at);
		const db = toEpochMs(b.sprayed_at);
		if (da !== db) return da - db;
		return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
	});

	const notices: AnointNotice[] = [];
	let runStart = sorted[0];
	let runEnd = sorted[0];
	let count = 1;

	const closeRun = () => {
		notices.push({
			// Derive the notice id from the run's last anointing so it is stable across
			// renders and unique among notices.
			id: `anoint:${runEnd.id}`,
			count,
			firstAt: runStart.sprayed_at,
			lastAt: runEnd.sprayed_at
		});
	};

	for (let i = 1; i < sorted.length; i += 1) {
		const row = sorted[i];
		const gap = toEpochMs(row.sprayed_at) - toEpochMs(runEnd.sprayed_at);
		if (gap > ANOINT_NOTICE_WINDOW_MS) {
			// A lull longer than the rolling window closes the current run and opens a
			// fresh notice at this anointing.
			closeRun();
			runStart = row;
			runEnd = row;
			count = 1;
		} else {
			// Within the rolling window — extend the current run and reset the window
			// to this anointing.
			runEnd = row;
			count += 1;
		}
	}
	closeRun();

	return notices;
}
