// Server-side mustard-spray wrappers. Like the other feature modules
// (reactions, voting, hotdogs, profiles), these run on the server (form actions
// / load functions), take an RLS-scoped SupabaseClient *passed in* — never a
// client-side secret key, and never a client-supplied user id (the trusted
// sprayer id comes from safeGetSession()) — and return typed discriminated
// results rather than throwing; callers branch on `ok`.
//
// Mustard sprays are COSMETIC flair (decision #15): there is NO denormalized
// counter, so — like reactions and unlike votes — these are plain RLS-scoped
// writes, not SECURITY DEFINER RPCs. The INSERT policy additionally gates to the
// current Top Dog; we map that RLS WITH-CHECK denial to a friendly message.
//
// Known Postgres error states are mapped to typed handling keyed on SQLSTATE
// (the `code` field PostgREST surfaces), NEVER on message text.

import type { SupabaseClient } from '@supabase/supabase-js';

import { MUSTARD_LIFESPAN_MS } from './decay';

/** Discriminated result for spray operations. */
export type SprayResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** A spray row as the profile render path reads it (decay is computed client-side). */
export interface SprayRow {
	id: string;
	x: number;
	y: number;
	sprayed_at: string;
}

// PostgREST surfaces a row-level-security WITH CHECK denial as SQLSTATE 42501
// (insufficient_privilege). For mustard_sprays that means the caller is not the
// current Top Dog (or tried to forge another sprayer_id) — we map it to a
// friendly, non-leaky message.
const INSUFFICIENT_PRIVILEGE = '42501';

// A CHECK-constraint violation (x/y out of [0,1]) is SQLSTATE 23514. The app
// boundary validates the range first, so this is only a backstop, but we map it
// to a friendly position error rather than leaking the constraint text.
const CHECK_VIOLATION = '23514';

/** Friendly message when a non-Top-Dog tries to spray (exported so the form action can map it to a 403). */
export const NOT_TOP_DOG = 'Only the current Top Dog can spray mustard.';
const BAD_POSITION = 'That spray position is invalid.';

/** True when n is a finite number within the inclusive [0,1] range. */
function isUnitFraction(n: number): boolean {
	return Number.isFinite(n) && n >= 0 && n <= 1;
}

/**
 * Records a mustard spray on the target profile at the relative (x,y) position.
 * Validates `x` and `y` are finite numbers in [0,1] at this app boundary (the DB
 * CHECK is the backstop), then inserts
 * `{ sprayer_id, target_profile_id, x, y }` on the passed RLS-scoped client. The
 * INSERT is RLS-gated so only the current Top Dog succeeds, and sprayer_id is
 * pinned to auth.uid() in the policy.
 *
 * The trusted `sprayerId` must be the validated session uid (safeGetSession()),
 * never a client-supplied value. Self-spray (sprayerId === targetProfileId) is
 * allowed — a Top Dog mustarding their own profile is harmless cosmetic.
 */
export async function addSpray(
	supabase: SupabaseClient,
	sprayerId: string,
	targetProfileId: string,
	x: number,
	y: number
): Promise<SprayResult<null>> {
	if (!isUnitFraction(x) || !isUnitFraction(y)) {
		return { ok: false, error: BAD_POSITION };
	}

	const { error } = await supabase
		.from('mustard_sprays')
		.insert({ sprayer_id: sprayerId, target_profile_id: targetProfileId, x, y });

	if (error) {
		if (error.code === INSUFFICIENT_PRIVILEGE) {
			return { ok: false, error: NOT_TOP_DOG };
		}
		if (error.code === CHECK_VIOLATION) {
			return { ok: false, error: BAD_POSITION };
		}
		console.error('[mustard] addSpray failed', {
			sprayerId,
			targetProfileId,
			code: error.code,
			error: error.message
		});
		return { ok: false, error: 'Could not spray mustard right now.' };
	}

	return { ok: true, data: null };
}

/**
 * Fetches the live (not-yet-fully-faded) sprays on a target profile, ordered by
 * spray time. Filtered to the last MUSTARD_LIFESPAN_MS (24h) so fully-decayed
 * sprays — which render at opacity 0 anyway — aren't shipped to the client and
 * the payload stays bounded. RLS exposes all sprays to authenticated members
 * (public flair), so no owner filter is needed.
 */
export async function listSpraysForProfile(
	supabase: SupabaseClient,
	targetProfileId: string
): Promise<SprayResult<SprayRow[]>> {
	const cutoff = new Date(Date.now() - MUSTARD_LIFESPAN_MS).toISOString();

	const { data, error } = await supabase
		.from('mustard_sprays')
		.select('id, x, y, sprayed_at')
		.eq('target_profile_id', targetProfileId)
		.gte('sprayed_at', cutoff)
		.order('sprayed_at', { ascending: true });

	if (error) {
		console.error('[mustard] listSpraysForProfile failed', {
			targetProfileId,
			error: error.message
		});
		return { ok: false, error: 'Could not load mustard right now.' };
	}

	const rows = (data as SprayRow[] | null) ?? [];
	return { ok: true, data: rows };
}
