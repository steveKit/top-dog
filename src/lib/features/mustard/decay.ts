// Top Dog mustard decay — PURE module. No SvelteKit or Supabase imports so the
// render-time opacity math can be unit-tested in isolation (CLAUDE.md Testing
// Strategy: mustard decay/opacity math is TDD-first; PROJECT.md decision #15:
// opacity is computed at RENDER time from the stored timestamp — no cron).
//
// TDD STUB (RED phase, TASK-040): signatures + JSDoc only. The real decay math
// is the implementer's job in the GREEN phase — these bodies intentionally do
// NOT satisfy the behavior.

/** A mustard spray fully fades 24h after it lands. */
export const MUSTARD_LIFESPAN_MS = 24 * 60 * 60 * 1000;

/**
 * Render-time opacity of a single mustard spray, in the range [0, 1].
 * - Returns 1.0 at spray time (age 0).
 * - Decays linearly to 0.0 across MUSTARD_LIFESPAN_MS.
 * - Clamps to 0.0 once age >= MUSTARD_LIFESPAN_MS (expired).
 * - Future-timestamp guard: if now < sprayedAt (e.g. client/server clock skew),
 *   clamp to 1.0 (treat as freshly sprayed).
 * - Throws on an invalid / unparseable date input (NaN time).
 *
 * Inputs accept a Date, an ISO timestamp string (as Postgres timestamptz
 * returns), or epoch milliseconds.
 */
export function mustardOpacity(
	sprayedAt: Date | string | number,
	now: Date | string | number
): number {
	const sprayedMs = toEpochMs(sprayedAt);
	const nowMs = toEpochMs(now);

	const ageMs = nowMs - sprayedMs;
	// Clock skew: a spray that lands "in the future" reads as freshly applied.
	if (ageMs <= 0) return 1.0;
	// Past its lifespan the spray has fully faded — clamp, never go negative.
	if (ageMs >= MUSTARD_LIFESPAN_MS) return 0.0;

	return 1 - ageMs / MUSTARD_LIFESPAN_MS;
}

/** Normalize a Date | ISO string | epoch-ms input to epoch ms; throw on NaN. */
function toEpochMs(value: Date | string | number): number {
	const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
	if (Number.isNaN(ms)) {
		throw new Error(`mustardOpacity: invalid date input: ${String(value)}`);
	}
	return ms;
}
