// Top Dog 🍔 HAMBURGER COURT verdict render-time logic — PURE module. No SvelteKit
// or Supabase imports so the LIAR-decay / HERETIC-persist / verdict→state math can be
// unit-tested in isolation (CLAUDE.md Testing Strategy: render-time decay math is
// TDD-first; PROJECT.md decision #15: the displayed brand state is computed at RENDER
// time from the stored raw timestamps + the raw verdict — the DB stores only raw rows
// and the raw verdict, never the decayed/derived display state).
//
// TASK-073 is the moderation half of the Hamburger Court. The current Top Dog rules on
// a flagged dog (render_burger_verdict RPC), producing a per-dog verdict and a
// consequence on each branch:
//   - not_a_hamburger     -> every REPORTER is branded a HAMBURGER LIAR (this banner
//                            DECAYS over ~7 days from the brand's created_at);
//   - confirmed_hamburger -> the dog's OWNER is branded a HAMBURGER HERETIC (PERSISTENT,
//                            derived from the verdict — never decays).
//
// This module also maps a per-dog verdict to the dog's render-time alarm STATE so the
// feed/detail/gallery surfaces can clear or convert the TASK-071 HAMBURGER ALARM once a
// verdict exists (the confirmed-branch resolution: cleared on not_a_hamburger, a
// persistent CONFIRMED HAMBURGER stamp on confirmed_hamburger).

/** The two verdict values, matching the burger_verdicts CHECK constraint. */
export type BurgerVerdict = 'confirmed_hamburger' | 'not_a_hamburger';

// ---------------------------------------------------------------------------
// HAMBURGER LIAR brand — decays over ~7 days (render-time)
// ---------------------------------------------------------------------------

/** A LIAR brand stops showing 7 days after it was minted. */
export const LIAR_BRAND_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Render-time summary of a profile's HAMBURGER LIAR brand. */
export interface LiarBrandSummary {
	/** True iff at least one LIAR brand landed within the last LIAR_BRAND_WINDOW_MS. */
	active: boolean;
	/** Number of in-window brands (a member liar-branded on multiple dogs stacks). */
	brandCount: number;
	/**
	 * Fade fraction in [0,1] of the FRESHEST in-window brand — 1.0 just-minted,
	 * approaching 0 at the 7-day edge. Drives the banner's opacity so the brand
	 * visibly fades over the week. 0 when there is no active brand.
	 */
	intensity: number;
}

/**
 * Summarizes a profile's HAMBURGER LIAR brand timestamps into its render-time banner
 * state. A brand decays over ~7 days: `active` is true iff ≥1 brand landed within the
 * last LIAR_BRAND_WINDOW_MS, and `intensity` is the linear fade of the FRESHEST
 * in-window brand (1.0 just-minted → 0 at the window edge), so the banner fades over
 * the week.
 *
 * A brand exactly at the window edge (age === LIAR_BRAND_WINDOW_MS) has just expired
 * and does NOT count. A brand "in the future" (clock skew) counts as fully fresh
 * (intensity clamped to 1). Invalid / unparseable timestamps are skipped defensively
 * (never throws), so one bad row can't blank or fake a brand.
 *
 * Inputs accept Date objects or ISO timestamp strings (as Postgres timestamptz
 * returns).
 */
export function summarizeLiarBrand(
	brandTimestamps: (Date | string)[],
	now: Date | string | number
): LiarBrandSummary {
	const nowMs = toEpochMs(now);

	let brandCount = 0;
	let freshestFade = 0;
	for (const ts of brandTimestamps) {
		const ms = tryEpochMs(ts);
		if (ms === null) continue; // skip unparseable rows defensively
		const ageMs = nowMs - ms;
		// In-window: fresh now (ageMs <= 0, clock skew) through just under the window
		// edge. At exactly the edge the brand has expired.
		if (ageMs < LIAR_BRAND_WINDOW_MS) {
			brandCount++;
			// Linear fade: 1.0 at age 0, 0 at the edge. Clamp future-dated to 1.
			const fade = Math.min(1, Math.max(0, 1 - ageMs / LIAR_BRAND_WINDOW_MS));
			if (fade > freshestFade) {
				freshestFade = fade;
			}
		}
	}

	return {
		active: brandCount > 0,
		brandCount,
		intensity: brandCount > 0 ? freshestFade : 0
	};
}

// ---------------------------------------------------------------------------
// HAMBURGER HERETIC brand — persistent (derived from the verdict, never decays)
// ---------------------------------------------------------------------------

/**
 * Whether a profile is a HAMBURGER HERETIC — true iff ANY of their dogs has a
 * `confirmed_hamburger` verdict. PERSISTENT: there is no decay, so this takes only the
 * set of verdicts on the profile's dogs, not a clock. A confirmed offense is a lasting
 * brand (PROJECT.md / TASK-073 scope: "persistent — a confirmed offense is a lasting
 * brand").
 *
 * Pure: no I/O, no time input.
 */
export function isHamburgerHeretic(dogVerdicts: BurgerVerdict[]): boolean {
	return dogVerdicts.includes('confirmed_hamburger');
}

// ---------------------------------------------------------------------------
// Verdict → dog alarm render-state (confirmed-branch resolution)
// ---------------------------------------------------------------------------

/**
 * The render-time display state of a flagged dog's HAMBURGER ALARM, after accounting
 * for any verdict. This is what the feed/detail/gallery surfaces switch on:
 *   - 'alarm'     : no verdict yet — show the decaying TASK-071 HAMBURGER ALARM if its
 *                   own (report-timestamp) summary is active.
 *   - 'cleared'   : ruled not_a_hamburger — the alarm is adjudicated/SUPPRESSED.
 *   - 'confirmed' : ruled confirmed_hamburger — show a PERSISTENT "CONFIRMED HAMBURGER"
 *                   stamp instead of the decaying alarm.
 */
export type DogAlarmState = 'alarm' | 'cleared' | 'confirmed';

/**
 * Maps a dog's verdict (or its absence) to the alarm display state. This is the
 * confirmed-branch resolution: a verdict RESOLVES the render-time alarm — cleared on
 * not_a_hamburger, converted to a persistent CONFIRMED HAMBURGER stamp on
 * confirmed_hamburger. With no verdict the alarm falls through to its own
 * report-timestamp decay (summarizeBurgerAlarm), so this returns 'alarm'.
 *
 * Pure: no I/O.
 */
export function dogAlarmState(verdict: BurgerVerdict | null | undefined): DogAlarmState {
	if (verdict === 'confirmed_hamburger') return 'confirmed';
	if (verdict === 'not_a_hamburger') return 'cleared';
	return 'alarm';
}

// ---------------------------------------------------------------------------
// shared time helpers (mirror src/lib/features/reports/alarm.ts)
// ---------------------------------------------------------------------------

/** Normalize a Date | ISO string | epoch-ms input to epoch ms; throw on NaN. */
function toEpochMs(value: Date | string | number): number {
	const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
	if (Number.isNaN(ms)) {
		throw new Error(`verdict: invalid "now" input: ${String(value)}`);
	}
	return ms;
}

/** Like toEpochMs but returns null on an unparseable brand timestamp (skip it). */
function tryEpochMs(value: Date | string): number | null {
	const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
	return Number.isNaN(ms) ? null : ms;
}
