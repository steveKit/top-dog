<script lang="ts">
	// 🍔 HAMBURGER LIAR / HERETIC profile banner — a yellow/black police-tape strip
	// slapped across a member's PROFILE head when the Hamburger Court has ruled
	// against them (TASK-073). Generalizes HamburgerAlarmBanner's visual idiom to a
	// single labelled strip rendered on a profile (not a dog image).
	//
	//   - HAMBURGER LIAR   : the member reported a dog the Top Dog ruled NOT a
	//                        hamburger. Decays over ~7 days (the caller passes the
	//                        render-time `opacity` from summarizeLiarBrand).
	//   - HAMBURGER HERETIC: the member owns a dog confirmed to BE a hamburger.
	//                        Persistent (opacity defaults to 1, never decays).
	//
	// The strip is rotated by a stable, seeded angle (bannerAngle) so it looks
	// hand-slapped on but never jitters between re-renders. XSS-safe: the label is a
	// fixed string and the dynamic values (angle, opacity) are bound as inline style
	// numbers — no {@html}, no user-supplied content is ever rendered.

	import { bannerAngle } from '$lib/features/reports/angle';

	let {
		label,
		seed,
		opacity = 1
	}: {
		/** The fixed banner text, e.g. 'HAMBURGER LIAR' or 'HAMBURGER HERETIC'. */
		label: string;
		/** Stable seed for the tilt (e.g. `${profileId}:${label}`). */
		seed: string;
		/** Render-time opacity in [0,1]: <1 fades a decaying LIAR brand; 1 = persistent. */
		opacity?: number;
	} = $props();

	// Stable per (profile, label) tilt — same seed ⇒ same angle, no per-render jitter.
	const angle = $derived(bannerAngle(seed));
	// Clamp defensively so a bad input can't produce a negative / >1 opacity.
	const clampedOpacity = $derived(Math.min(1, Math.max(0, opacity)));
</script>

<div
	class="brand"
	role="alert"
	aria-label="{label}: the Hamburger Court has ruled"
	style="--angle: {angle}deg; --brand-opacity: {clampedOpacity}"
>
	<span class="tape-text">🍔 {label} 🍔 {label}</span>
</div>

<style>
	.brand {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		overflow: hidden;
		opacity: var(--brand-opacity, 1);
	}

	.tape-text {
		display: inline-block;
		width: 200%;
		transform: rotate(var(--angle, 0deg));
		padding: var(--space-2xs) var(--space-2xs);
		font-family: var(--font-display);
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--tape-stripe-dark);
		text-align: center;
		white-space: nowrap;
		text-transform: uppercase;
		background: repeating-linear-gradient(
			45deg,
			var(--tape-alarm) 0,
			var(--tape-alarm) 14px,
			var(--tape-stripe-dark) 14px,
			var(--tape-stripe-dark) 28px
		);
		border-top: 2px solid var(--tape-stripe-dark);
		border-bottom: 2px solid var(--tape-stripe-dark);
		/* Keep the text itself readable over the striped tape. */
		text-shadow:
			0 0 3px rgba(245, 197, 24, 0.95),
			0 0 3px rgba(245, 197, 24, 0.95);
	}
</style>
