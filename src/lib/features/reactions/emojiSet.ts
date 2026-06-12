// Allowed hot-dog reaction emoji set — the AUTHORITATIVE app-boundary validation
// for cosmetic reactions (decision #12). The reactions DB table keeps only a
// length sanity CHECK, not a rigid enum, so this module is where "which emojis
// are allowed" actually lives.
//
// INTERIM SET: this is a small, hardcoded starter set. The full emoji library
// (render-time filter + sprinkle) arrives in M6 (src/lib/features/emoji/); when
// it lands, the allowed-reaction set can be sourced from there instead of this
// hardcoded array — the migration stays unchanged because the DB never enumerated
// emojis. Until then, this is the single source of truth.

/**
 * The reaction emojis a member may drop on a hot dog. Readonly so callers can't
 * mutate the shared set; the picker in the feed UI renders exactly these.
 */
export const REACTION_EMOJIS = ['🌭', '❤️', '🔥', '😂', '🤤', '👑'] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

// Set for O(1) membership checks. Typed as a plain string set so arbitrary input
// (form data) can be tested against it without a cast.
const ALLOWED: ReadonlySet<string> = new Set(REACTION_EMOJIS);

/**
 * Whether `emoji` is an allowed reaction emoji. Called at the wrapper boundary
 * (reactions.ts) and in the feed form actions to reject disallowed input BEFORE
 * touching the DB — the app boundary is authoritative, not a DB enum.
 */
export function isAllowedReactionEmoji(emoji: string): boolean {
	return ALLOWED.has(emoji);
}
