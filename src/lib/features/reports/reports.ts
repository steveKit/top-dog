// Server-side burger-alarm report wrappers. Like the other feature modules
// (reactions, mustard, voting, hotdogs, profiles), these run on the server (form
// actions / load functions), take a SupabaseClient *passed in* — never a
// client-side secret key, and never a client-supplied user id (the trusted
// reporter id comes from safeGetSession() / auth.uid()) — and return typed
// discriminated results rather than throwing; callers branch on `ok`.
//
// Burger alarms are COSMETIC flair (decision #12): there is NO denormalized
// counter, so — like reactions/mustard and unlike votes — these are plain
// RLS-scoped INSERT/DELETE writes, not SECURITY DEFINER RPCs. The INSERT policy
// pins reporter_id = auth.uid() and blocks reporting your OWN dog.
//
// ANONYMITY: the per-dog aggregate read (getBurgerAlarmCounts) runs with the
// SERVICE client AFTER the safeGetSession() gate (TASK-033 pattern) — the
// owner-scoped SELECT policy means an RLS-scoped client could only ever see the
// viewer's own rows, never the full per-dog count. getBurgerAlarmCounts returns
// ONLY per-dog timestamp aggregates; reporter ids NEVER leave this module.
//
// Known Postgres error states are mapped to typed handling keyed on SQLSTATE
// (the `code` field PostgREST surfaces), NEVER on message text.

import type { SupabaseClient } from '@supabase/supabase-js';

/** Discriminated result for report operations. */
export type ReportResult<T> = { ok: true; data: T } | { ok: false; error: string };

// A duplicate report (this member already flagged this dog) raises
// unique_violation. The report toggle is idempotent, so we treat it as a benign
// success rather than an error.
const UNIQUE_VIOLATION = '23505';

// PostgREST surfaces a row-level-security WITH CHECK denial as SQLSTATE 42501
// (insufficient_privilege). For burger_alarms that means the caller tried to
// report their OWN dog (or forge another reporter_id) — map it to a friendly,
// non-leaky message.
const INSUFFICIENT_PRIVILEGE = '42501';

/** Friendly message when a member tries to report their own dog. */
export const CANNOT_REPORT_OWN = "You can't report your own hot dog.";

/**
 * Records the viewer's burger report on a dog (an idempotent toggle-on). Inserts
 * `{ reporter_id: viewerId, hot_dog_id: dogId }` on the passed RLS-scoped client.
 * RLS pins reporter_id to auth.uid() and blocks reporting a dog you own.
 *
 * Idempotent: a unique-violation (the viewer already reported this dog) maps to a
 * benign success, NOT an error — re-reporting is a no-op.
 *
 * The trusted `viewerId` must be the validated session uid (safeGetSession()),
 * never a client-supplied value.
 */
export async function reportBurger(
	supabase: SupabaseClient,
	viewerId: string,
	dogId: string
): Promise<ReportResult<null>> {
	const { error } = await supabase
		.from('burger_alarms')
		.insert({ reporter_id: viewerId, hot_dog_id: dogId });

	if (error) {
		// Already reported — idempotent toggle-on, treat as success.
		if (error.code === UNIQUE_VIOLATION) {
			return { ok: true, data: null };
		}
		// RLS blocked the insert: reporting your own dog (or a forged reporter_id).
		if (error.code === INSUFFICIENT_PRIVILEGE) {
			return { ok: false, error: CANNOT_REPORT_OWN };
		}
		console.error('[reports] reportBurger failed', {
			viewerId,
			dogId,
			code: error.code,
			error: error.message
		});
		return { ok: false, error: 'Could not report that hot dog right now.' };
	}

	return { ok: true, data: null };
}

/**
 * Retracts the viewer's burger report on a dog (the toggle-off half). Deletes the
 * matching `(reporter_id, hot_dog_id)` row, RLS-gated to the viewer's own rows
 * and additionally scoped by `reporter_id = viewerId`.
 *
 * Idempotent: retracting a report that isn't there affects zero rows and still
 * succeeds.
 *
 * The trusted `viewerId` must be the validated session uid, never a client value.
 */
export async function unreportBurger(
	supabase: SupabaseClient,
	viewerId: string,
	dogId: string
): Promise<ReportResult<null>> {
	const { error } = await supabase
		.from('burger_alarms')
		.delete()
		.eq('reporter_id', viewerId)
		.eq('hot_dog_id', dogId);

	if (error) {
		console.error('[reports] unreportBurger failed', {
			viewerId,
			dogId,
			code: error.code,
			error: error.message
		});
		return { ok: false, error: 'Could not retract your report right now.' };
	}

	return { ok: true, data: null };
}

/**
 * Returns the set of dog ids (from the given list) the VIEWER has reported, for
 * the report/retract toggle state. Runs on the RLS-scoped client — the
 * owner-scoped SELECT policy means it can only ever return the viewer's own rows,
 * so this is anonymity-safe by construction. An empty id list short-circuits.
 */
export async function getMyReportedDogIds(
	supabase: SupabaseClient,
	dogIds: string[]
): Promise<ReportResult<Set<string>>> {
	if (dogIds.length === 0) {
		return { ok: true, data: new Set() };
	}

	const { data, error } = await supabase
		.from('burger_alarms')
		.select('hot_dog_id')
		.in('hot_dog_id', dogIds);

	if (error) {
		console.error('[reports] getMyReportedDogIds failed', {
			count: dogIds.length,
			error: error.message
		});
		return { ok: false, error: 'Could not load your reports right now.' };
	}

	const rows = (data as { hot_dog_id: string }[] | null) ?? [];
	return { ok: true, data: new Set(rows.map((row) => row.hot_dog_id)) };
}

/**
 * Reads burger-alarm reports for a SET of dog ids and returns ONLY per-dog
 * aggregates — a map of dogId → in-window report timestamps. Reporter ids are
 * NEVER returned: this is the anonymity-preserving aggregate read.
 *
 * MUST be called with the SERVICE client AFTER the safeGetSession() gate
 * (TASK-033 pattern): the owner-scoped SELECT policy means an RLS-scoped client
 * could only see the viewer's own rows, so the full per-dog count requires the
 * privileged client. The caller feeds each dog's timestamps to
 * summarizeBurgerAlarm to derive { active, reporterCount, intensity }.
 *
 * An empty id list short-circuits to an empty map (no pointless query).
 */
export async function getBurgerAlarmCounts(
	serviceClient: SupabaseClient,
	dogIds: string[]
): Promise<ReportResult<Map<string, string[]>>> {
	if (dogIds.length === 0) {
		return { ok: true, data: new Map() };
	}

	// Select ONLY hot_dog_id + created_at — deliberately NOT reporter_id, so a
	// reporter's identity never even enters this server's working set, let alone
	// the page payload.
	const { data, error } = await serviceClient
		.from('burger_alarms')
		.select('hot_dog_id, created_at')
		.in('hot_dog_id', dogIds);

	if (error) {
		console.error('[reports] getBurgerAlarmCounts failed', {
			count: dogIds.length,
			error: error.message
		});
		return { ok: false, error: 'Could not load burger alarms right now.' };
	}

	const rows = (data as { hot_dog_id: string; created_at: string }[] | null) ?? [];
	const byDog = new Map<string, string[]>();
	for (const row of rows) {
		const bucket = byDog.get(row.hot_dog_id);
		if (bucket) {
			bucket.push(row.created_at);
		} else {
			byDog.set(row.hot_dog_id, [row.created_at]);
		}
	}

	return { ok: true, data: byDog };
}
