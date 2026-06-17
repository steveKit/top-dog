// Top Dog M6 render-time emoji composition layer — PURE module. No SvelteKit or
// Supabase imports so it stays unit-testable in isolation (CLAUDE.md Testing
// Strategy). Composes the lower-level filter.ts transforms into the two render
// surfaces that consume them, keeping the Svelte components dumb (one call each):
//
//   - WALL messages  → renderWallBody(body, id): filter THEN seeded sprinkle.
//   - DM bodies      → renderMessageBody(body):  filter ONLY (no sprinkle).
//
// The wall-vs-DM distinction is deliberate: TASK-060's AC scopes the random
// hot-dog sprinkle specifically to WALL messages, so DMs (thread + inbox
// preview) get the filter alone and never the sprinkle.
//
// PROJECT.md decision #16 governs: the filter/sprinkle run at RENDER time and the
// ORIGINAL stored body is NEVER mutated — these functions return NEW strings and
// have no DB / server-side write side effects.
//
// DW-019: isHotdogEmoji uses exact-string membership, so a VS16-decorated variant
// of a library emoji (e.g. '🔥' + U+FE0F) is REPLACED with '🌭' rather than
// preserved. We ACCEPT this behavior — the output is still a hot-dog emoji, so the
// outcome is benign and not worth a grapheme-normalization pass here. DW-019 can
// be closed on this basis (see implementer report).

import { filterToHotdog, sprinkleHotdog } from './filter';

/**
 * Deterministic string → uint32 hash (FNV-1a). Hand-written, no dependency. Used
 * to derive a stable numeric sprinkle seed from a message's immutable uuid `id`,
 * so a given wall message sprinkles the SAME way across every re-render (no
 * per-render jitter). Pure.
 */
export function stringToSeed(input: string): number {
	let hash = 0x811c9dc5; // FNV offset basis
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		// FNV prime multiply via Math.imul to stay in 32-bit space.
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

/**
 * Render a WALL message body: replace non-library emoji with hot-dog emoji, then
 * deterministically sprinkle hot-dog emoji using a seed derived from the message
 * id. Same (body, id) ⇒ same output. Pure; returns a NEW string.
 */
export function renderWallBody(body: string, id: string): string {
	return sprinkleHotdog(filterToHotdog(body), stringToSeed(id));
}

/**
 * Render a DM body (thread message or inbox preview): replace non-library emoji
 * with hot-dog emoji. No sprinkle — sprinkle is wall-scoped. Pure; returns a NEW
 * string.
 */
export function renderMessageBody(body: string): string {
	return filterToHotdog(body);
}
