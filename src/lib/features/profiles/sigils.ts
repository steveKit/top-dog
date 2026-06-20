// Snacktum Onboarding rite — sigil avatars (TASK-092). PURE module: no SvelteKit
// / Supabase / DOM imports, so the id<->metadata mapping is fully unit-testable.
//
// The rite's "Choose Thy Sigil" step lets a new member pick one of five built-in
// SVG sigils as their starting avatar. We deliberately do NOT upload an image or
// add a migration: the chosen sigil is stored as a small, opaque id in the
// EXISTING `profiles.avatar_path` column, namespaced with a `sigil:` prefix so it
// can never be mistaken for a real storage object path.
//
//   avatar_path = 'sigil:tube'   -> render the built-in Tube sigil inline
//   avatar_path = '<uuid>/avatar.webp' -> a real uploaded avatar (deferred path)
//   avatar_path = null            -> the 🌭 placeholder
//
// The render layer (profile page, rite preview) reads the prefix to decide
// between an inline <Sigil> component and a storage <img>. Because a sigil id is
// just text, it needs no storage upload and no new column — it reuses the same
// owner-writable `avatar_path` grant the onboarding insert already had.

/** The five built-in sigil ids. Stored (prefixed) in `avatar_path`. */
export const SIGIL_IDS = ['cowled', 'haloed', 'shadowed', 'tube', 'candle'] as const;

export type SigilId = (typeof SIGIL_IDS)[number];

/** Namespacing prefix that distinguishes a sigil id from a storage object path. */
export const SIGIL_PREFIX = 'sigil:' as const;

/** The default sigil a member starts on before they pick (the cult's first face). */
export const DEFAULT_SIGIL: SigilId = 'cowled';

/** Liturgical display names for each sigil, shown in the rite. */
export const SIGIL_NAMES: Record<SigilId, string> = {
	cowled: 'The Cowled Initiate',
	haloed: 'The Haloed Saint',
	shadowed: 'The Shadowed Acolyte',
	tube: 'The Tube Sigil',
	candle: 'The Candle Bearer'
};

/** Short labels under each sigil swatch in the picker grid. */
export const SIGIL_LABELS: Record<SigilId, string> = {
	cowled: 'Cowled',
	haloed: 'Haloed',
	shadowed: 'Shadowed',
	tube: 'Tube Sigil',
	candle: 'Candle'
};

/** Type guard: is `value` one of the five known sigil ids? */
export function isSigilId(value: unknown): value is SigilId {
	return typeof value === 'string' && (SIGIL_IDS as readonly string[]).includes(value);
}

/**
 * Build the value to store in `avatar_path` for a chosen sigil — the id with the
 * `sigil:` namespace prefix (e.g. `sigil:tube`). Throws on an unknown id so a bad
 * value can never be persisted.
 */
export function sigilAvatarValue(id: SigilId): string {
	if (!isSigilId(id)) {
		throw new Error(`Unknown sigil id: ${String(id)}`);
	}
	return `${SIGIL_PREFIX}${id}`;
}

/**
 * Parse a stored `avatar_path`: returns the `SigilId` when the value is a
 * well-formed `sigil:<id>` for a KNOWN sigil, otherwise `null` (a real storage
 * path, a null avatar, or an unrecognized/legacy sigil id all return null so the
 * caller falls back to the storage/placeholder path).
 */
export function parseSigilId(avatarPath: string | null | undefined): SigilId | null {
	if (typeof avatarPath !== 'string' || !avatarPath.startsWith(SIGIL_PREFIX)) {
		return null;
	}
	const id = avatarPath.slice(SIGIL_PREFIX.length);
	return isSigilId(id) ? id : null;
}
