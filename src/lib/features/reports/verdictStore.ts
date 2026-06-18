// Server-side Hamburger Court verdict wrappers (TASK-073). Like the other feature
// modules, these run on the server (form actions / load functions), take a
// SupabaseClient *passed in* — never a client-side secret key, and never a
// client-supplied actor id (the adjudicating Top Dog is derived from auth.uid()
// INSIDE the render_burger_verdict RPC) — and return typed discriminated results
// rather than throwing; callers branch on `ok`.
//
// The verdict + LIAR rows are written EXCLUSIVELY through the SECURITY DEFINER
// render_burger_verdict RPC (the consuming-writes-via-RPC convention, like votes):
// there is no client write policy on burger_verdicts / hamburger_liars. The reads
// below run on the RLS-scoped client (both tables are SELECT-all for authenticated),
// EXCEPT where a render surface needs a privileged anonymous aggregate — but here all
// verdict/LIAR reads are public (no anonymity twist, unlike burger_alarms), so the
// RLS-scoped client suffices.
//
// Known Postgres error states from the RPC are mapped to typed sentinels keyed on
// SQLSTATE (the `code` field PostgREST surfaces), NEVER on message text.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BurgerVerdict } from './verdict';

/** Discriminated result for verdict operations. */
export type VerdictResult<T> = { ok: true; data: T } | { ok: false; error: string };

// SQLSTATEs the RPC raises (see the migration's error contract). Keyed on, never
// message text.
const UNAUTHENTICATED = '28000';
const NOT_TOP_DOG_CODE = '42501'; // insufficient_privilege: the EXISTS crown gate
const BAD_VERDICT = '22023'; // invalid_parameter_value
const NO_SUCH_DOG = 'P0002'; // no_data_found

/**
 * Typed sentinels for the known, user-meaningful verdict failures. Callers branch on
 * these to show a friendly message without parsing Postgres text.
 */
export const VERDICT_UNAUTHENTICATED = 'VERDICT_UNAUTHENTICATED' as const;
export const VERDICT_NOT_TOP_DOG = 'VERDICT_NOT_TOP_DOG' as const;
export const VERDICT_BAD_VALUE = 'VERDICT_BAD_VALUE' as const;
export const VERDICT_NO_SUCH_DOG = 'VERDICT_NO_SUCH_DOG' as const;

/** Friendly message when a non-Top-Dog tries to adjudicate. */
export const NOT_TOP_DOG = 'Only the current Top Dog may rule on a hamburger report.';

function verdictErrorFromCode(code: string | undefined): string | null {
	switch (code) {
		case UNAUTHENTICATED:
			return VERDICT_UNAUTHENTICATED;
		case NOT_TOP_DOG_CODE:
			return VERDICT_NOT_TOP_DOG;
		case BAD_VERDICT:
			return VERDICT_BAD_VALUE;
		case NO_SUCH_DOG:
			return VERDICT_NO_SUCH_DOG;
		default:
			return null;
	}
}

/**
 * Renders a Top-Dog verdict on a flagged dog via the `render_burger_verdict` SECURITY
 * DEFINER RPC (the sole write path). The actor is derived from auth.uid() inside the
 * function — this cannot forge a verdict as another member, and the RPC's EXISTS gate
 * on the non-client-writable is_current_top_dog rejects a non-Top-Dog caller.
 *
 * On `not_a_hamburger` the RPC brands every reporter a HAMBURGER LIAR; on
 * `confirmed_hamburger` it clears any stale LIAR brands (the HERETIC brand is derived
 * from the verdict). All in one transaction. Returns the verdict row id.
 *
 * Known failures map to typed sentinels: VERDICT_UNAUTHENTICATED, VERDICT_NOT_TOP_DOG,
 * VERDICT_BAD_VALUE, VERDICT_NO_SUCH_DOG.
 */
export async function renderBurgerVerdict(
	supabase: SupabaseClient,
	dogId: string,
	verdict: BurgerVerdict
): Promise<VerdictResult<string>> {
	const { data, error } = await supabase.rpc('render_burger_verdict', {
		target_dog: dogId,
		the_verdict: verdict
	});

	if (error) {
		const mapped = verdictErrorFromCode(error.code);
		if (!mapped) {
			console.error('[verdict] renderBurgerVerdict failed', {
				dogId,
				verdict,
				code: error.code,
				error: error.message
			});
		}
		return { ok: false, error: mapped ?? error.message };
	}

	if (!data) {
		return { ok: false, error: 'Could not record that verdict right now.' };
	}

	return { ok: true, data: data as string };
}

/**
 * Returns a map of dogId -> verdict for the given dog ids (the verdicts that exist;
 * un-adjudicated dogs are simply absent). Drives the render-time alarm clear/stamp
 * decision (dogAlarmState). Public read on the RLS-scoped client (verdicts are
 * SELECT-all). An empty id list short-circuits.
 */
export async function getVerdictsForDogs(
	supabase: SupabaseClient,
	dogIds: string[]
): Promise<VerdictResult<Map<string, BurgerVerdict>>> {
	if (dogIds.length === 0) {
		return { ok: true, data: new Map() };
	}

	const { data, error } = await supabase
		.from('burger_verdicts')
		.select('hot_dog_id, verdict')
		.in('hot_dog_id', dogIds);

	if (error) {
		console.error('[verdict] getVerdictsForDogs failed', {
			count: dogIds.length,
			error: error.message
		});
		return { ok: false, error: 'Could not load verdicts right now.' };
	}

	const rows = (data as { hot_dog_id: string; verdict: BurgerVerdict }[] | null) ?? [];
	const byDog = new Map<string, BurgerVerdict>();
	for (const row of rows) {
		byDog.set(row.hot_dog_id, row.verdict);
	}
	return { ok: true, data: byDog };
}

/** A flagged dog awaiting (or carrying) a verdict, for the adjudication surface. */
export interface FlaggedDog {
	id: string;
	owner_id: string;
	owner_handle: string;
	caption: string | null;
	image_path: string;
	reportCount: number;
	verdict: BurgerVerdict | null;
}

/**
 * Lists the dogs that have at least one burger report, with their current report
 * count, owner handle, and any existing verdict — the data the Top-Dog adjudication
 * surface renders. MUST be called with the SERVICE client AFTER the safeGetSession() +
 * Top-Dog gate (like getBurgerAlarmCounts): burger_alarms' SELECT is owner-scoped to
 * the reporter, so an RLS-scoped client could only see the caller's own reports, not
 * the full per-dog set. Only aggregate counts + dog/owner metadata are returned —
 * reporter ids NEVER leave this module (reporter anonymity is preserved).
 */
export async function listFlaggedDogs(
	serviceClient: SupabaseClient
): Promise<VerdictResult<FlaggedDog[]>> {
	// Reports per dog (anonymous aggregate; reporter ids deliberately NOT selected).
	const { data: reportRows, error: reportError } = await serviceClient
		.from('burger_alarms')
		.select('hot_dog_id');

	if (reportError) {
		console.error('[verdict] listFlaggedDogs: report read failed', {
			error: reportError.message
		});
		return { ok: false, error: 'Could not load flagged dogs right now.' };
	}

	const counts = new Map<string, number>();
	for (const row of (reportRows as { hot_dog_id: string }[] | null) ?? []) {
		counts.set(row.hot_dog_id, (counts.get(row.hot_dog_id) ?? 0) + 1);
	}

	const dogIds = [...counts.keys()];
	if (dogIds.length === 0) {
		return { ok: true, data: [] };
	}

	// Dog + owner metadata for the flagged dogs.
	const { data: dogRows, error: dogError } = await serviceClient
		.from('hot_dogs')
		.select('id, owner_id, caption, image_path, owner:profiles!owner_id (handle)')
		.in('id', dogIds);

	if (dogError) {
		console.error('[verdict] listFlaggedDogs: dog read failed', { error: dogError.message });
		return { ok: false, error: 'Could not load flagged dogs right now.' };
	}

	// Existing verdicts for the flagged dogs (to mark already-ruled dogs).
	const verdictsResult = await getVerdictsForDogs(serviceClient, dogIds);
	const verdicts = verdictsResult.ok ? verdictsResult.data : new Map<string, BurgerVerdict>();

	type DogRow = {
		id: string;
		owner_id: string;
		caption: string | null;
		image_path: string;
		owner: { handle: string } | { handle: string }[] | null;
	};

	const flagged: FlaggedDog[] = ((dogRows as DogRow[] | null) ?? []).map((row) => {
		// PostgREST returns the embedded relation as an object (to-one) or array
		// depending on inference; normalize defensively.
		const ownerHandle = Array.isArray(row.owner)
			? (row.owner[0]?.handle ?? '')
			: (row.owner?.handle ?? '');
		return {
			id: row.id,
			owner_id: row.owner_id,
			owner_handle: ownerHandle,
			caption: row.caption,
			image_path: row.image_path,
			reportCount: counts.get(row.id) ?? 0,
			verdict: verdicts.get(row.id) ?? null
		};
	});

	// Sort: un-ruled dogs first (the work queue), then by report count desc.
	flagged.sort((a, b) => {
		if ((a.verdict === null) !== (b.verdict === null)) {
			return a.verdict === null ? -1 : 1;
		}
		return b.reportCount - a.reportCount;
	});

	return { ok: true, data: flagged };
}

/**
 * Returns the LIAR-brand timestamps for a single profile (the reporter), for the
 * render-time decaying banner (summarizeLiarBrand). Public read on the RLS-scoped
 * client. Returns an empty array when the profile carries no brands.
 */
export async function getLiarBrandTimestamps(
	supabase: SupabaseClient,
	profileId: string
): Promise<VerdictResult<string[]>> {
	const { data, error } = await supabase
		.from('hamburger_liars')
		.select('created_at')
		.eq('reporter_id', profileId);

	if (error) {
		console.error('[verdict] getLiarBrandTimestamps failed', {
			profileId,
			error: error.message
		});
		return { ok: false, error: 'Could not load brand state right now.' };
	}

	const rows = (data as { created_at: string }[] | null) ?? [];
	return { ok: true, data: rows.map((row) => row.created_at) };
}

/**
 * Returns the verdicts on a single profile's dogs, for the persistent HERETIC
 * derivation (isHamburgerHeretic). Joins burger_verdicts to the owner via hot_dogs.
 * Public read on the RLS-scoped client. An empty result means the profile is not a
 * heretic.
 */
export async function getDogVerdictsForOwner(
	supabase: SupabaseClient,
	ownerId: string
): Promise<VerdictResult<BurgerVerdict[]>> {
	const { data, error } = await supabase
		.from('burger_verdicts')
		.select('verdict, hot_dogs!inner(owner_id)')
		.eq('hot_dogs.owner_id', ownerId);

	if (error) {
		console.error('[verdict] getDogVerdictsForOwner failed', {
			ownerId,
			error: error.message
		});
		return { ok: false, error: 'Could not load verdict state right now.' };
	}

	const rows = (data as { verdict: BurgerVerdict }[] | null) ?? [];
	return { ok: true, data: rows.map((row) => row.verdict) };
}
