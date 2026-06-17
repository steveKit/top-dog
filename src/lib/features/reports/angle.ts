// Top Dog 🍔 HAMBURGER ALARM banner angle — PURE module. No SvelteKit or Supabase
// imports so the seeded angle is unit-testable in isolation.
//
// Each police-tape banner is rotated by a small, deterministic, jaunty angle so
// the two strips look hand-slapped across the photo rather than perfectly level —
// but it must be STABLE per (dog, label) so the banners don't jitter between
// re-renders. We derive the angle from a seed string via the same FNV-1a +
// mulberry32 approach the emoji module uses (src/lib/features/emoji/render.ts &
// filter.ts), so given the same seed the angle is always identical.

/** Banners tilt within ±MAX_BANNER_ANGLE_DEG of horizontal. */
export const MAX_BANNER_ANGLE_DEG = 8;

/**
 * Deterministic string → uint32 hash (FNV-1a). Hand-written, no dependency —
 * mirrors stringToSeed in src/lib/features/emoji/render.ts. Pure.
 */
function stringToSeed(input: string): number {
	let hash = 0x811c9dc5; // FNV offset basis
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		// FNV prime multiply via Math.imul to stay in 32-bit space.
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

/**
 * Hand-written mulberry32 PRNG — deterministic, no dependency. Mirrors the emoji
 * module's PRNG. Given the same seed it yields the same first value, so a seed
 * string maps to one stable angle.
 */
function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Deterministic banner tilt in degrees within [-MAX_BANNER_ANGLE_DEG,
 * +MAX_BANNER_ANGLE_DEG]. The same `seed` always yields the same angle (no
 * per-render jitter); different seeds spread across the range. The caller seeds
 * with `${dogId}:${label}` so each banner on a dog gets its own stable tilt.
 *
 * Pure: no side effects, no I/O.
 */
export function bannerAngle(seed: string): number {
	const rng = mulberry32(stringToSeed(seed));
	// rng() ∈ [0,1) → map to [-MAX, +MAX].
	return (rng() * 2 - 1) * MAX_BANNER_ANGLE_DEG;
}
