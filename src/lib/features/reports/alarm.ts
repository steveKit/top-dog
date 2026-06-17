// Top Dog 🍔 HAMBURGER ALARM render-time logic — PURE module. No SvelteKit or
// Supabase imports so the alarm math can be unit-tested in isolation (CLAUDE.md
// Testing Strategy: render-time decay math is TDD-first; PROJECT.md decision #15:
// the alarm state is computed at RENDER time from the stored report timestamps —
// the DB stores only raw rows, never the decayed alarm state).
//
// A member taps 🍔 on another member's dog to report it as a hamburger. Enough
// FRESH reports trip the alarm. Reports auto-quiet 24h after the last one, so an
// old report on a dog nobody's flagged recently no longer rings the alarm.
//
// Live wiring: the report rows come from getBurgerAlarmCounts (server-side,
// anonymous aggregate); this pure summarizer turns the per-dog timestamps into
// the { active, reporterCount, intensity } the banner component renders.

/** A report stops contributing to the alarm 24h after it lands. */
export const BURGER_ALARM_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Alarm intensity — scales the banner's prominence with how many fresh reporters
 * have flagged the dog. `none` means no active alarm (zero in-window reports).
 */
export type BurgerAlarmIntensity = 'none' | 'low' | 'medium' | 'high';

/** Per-dog render-time alarm summary. */
export interface BurgerAlarmSummary {
	/** True iff at least one report landed within the last BURGER_ALARM_WINDOW_MS. */
	active: boolean;
	/** Number of reports within the window (the fresh reporter count). */
	reporterCount: number;
	/** Banner prominence scale derived from reporterCount. */
	intensity: BurgerAlarmIntensity;
}

/** Maps an in-window reporter count to a prominence scale. */
function intensityFor(count: number): BurgerAlarmIntensity {
	if (count <= 0) return 'none';
	if (count === 1) return 'low';
	if (count <= 3) return 'medium';
	return 'high';
}

/**
 * Summarizes a single hot dog's report timestamps into its render-time alarm
 * state.
 *
 * - `active` is true iff ≥1 report landed within the last
 *   BURGER_ALARM_WINDOW_MS (the alarm auto-quiets 24h after the last report).
 * - `reporterCount` counts the in-window reports.
 * - `intensity` scales with `reporterCount`: none (0) / low (1) / medium (2-3) /
 *   high (4+).
 *
 * A report exactly at the window edge (age === BURGER_ALARM_WINDOW_MS) has just
 * expired and does NOT count. A report "in the future" (clock skew) counts as
 * fresh. Invalid / unparseable timestamps are skipped (defensive — never throws),
 * so one bad row can't blank a dog's alarm.
 *
 * Inputs accept Date objects or ISO timestamp strings (as Postgres timestamptz
 * returns).
 */
export function summarizeBurgerAlarm(
	reportTimestamps: (Date | string)[],
	now: Date | string | number
): BurgerAlarmSummary {
	const nowMs = toEpochMs(now);

	let reporterCount = 0;
	for (const ts of reportTimestamps) {
		const ms = tryEpochMs(ts);
		if (ms === null) continue; // skip unparseable rows defensively
		const ageMs = nowMs - ms;
		// In-window: fresh now (ageMs <= 0, clock skew) through just under the
		// window edge. At exactly the edge the report has expired.
		if (ageMs < BURGER_ALARM_WINDOW_MS) {
			reporterCount++;
		}
	}

	return {
		active: reporterCount > 0,
		reporterCount,
		intensity: intensityFor(reporterCount)
	};
}

/** Normalize a Date | ISO string | epoch-ms input to epoch ms; throw on NaN. */
function toEpochMs(value: Date | string | number): number {
	const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
	if (Number.isNaN(ms)) {
		throw new Error(`summarizeBurgerAlarm: invalid "now" input: ${String(value)}`);
	}
	return ms;
}

/** Like toEpochMs but returns null on an unparseable report timestamp (skip it). */
function tryEpochMs(value: Date | string): number | null {
	const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
	return Number.isNaN(ms) ? null : ms;
}
