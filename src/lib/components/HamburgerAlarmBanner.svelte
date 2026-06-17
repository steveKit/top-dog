<script lang="ts">
	// 🍔 HAMBURGER ALARM overlay — two yellow/black police-tape strips stretched
	// diagonally across an offending dog's image when its render-time alarm is
	// active (decision #12/#15 — cosmetic, render-time, ranking-inert). The caller
	// wraps the dog image in a positioned container and drops this component
	// alongside it; the overlay is absolutely positioned to cover the image.
	//
	// Each strip is rotated by a stable, seeded angle (bannerAngle) so the two
	// banners look hand-slapped on but never jitter between re-renders. Prominence
	// scales with intensity. XSS-safe: the banner text is a fixed string and the
	// dynamic values (count, angle) are bound as text / inline style numbers — no
	// {@html}, no user-supplied content is ever rendered.

	import { bannerAngle } from '$lib/features/reports/angle';
	import type { BurgerAlarmIntensity } from '$lib/features/reports/alarm';

	let {
		dogId,
		intensity = 'low',
		reporterCount = 1
	}: {
		dogId: string;
		intensity?: BurgerAlarmIntensity;
		reporterCount?: number;
	} = $props();

	const TOP_LABEL = 'HAMBURGER ALARM';
	const BOTTOM_LABEL = 'TOP DOG IS THE ADJUDICATOR';

	// Stable per (dog, label) tilt — same seed ⇒ same angle, no per-render jitter.
	const topAngle = $derived(bannerAngle(`${dogId}:${TOP_LABEL}`));
	const bottomAngle = $derived(bannerAngle(`${dogId}:${BOTTOM_LABEL}`));
</script>

<div
	class="alarm intensity-{intensity}"
	role="alert"
	aria-label="Hamburger alarm: {reporterCount} {reporterCount === 1
		? 'member reports'
		: 'members report'} this is a hamburger, not a hot dog"
>
	<div class="tape tape-top" style="--angle: {topAngle}deg">
		<span class="tape-text">🍔 {TOP_LABEL} 🍔 {TOP_LABEL}</span>
	</div>
	<div class="tape tape-bottom" style="--angle: {bottomAngle}deg">
		<span class="tape-text">{BOTTOM_LABEL} · {BOTTOM_LABEL}</span>
	</div>
</div>

<style>
	.alarm {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-evenly;
		pointer-events: none;
		overflow: hidden;
	}

	.tape {
		width: 160%;
		transform: rotate(var(--angle, 0deg));
		background: repeating-linear-gradient(45deg, #f5c518 0, #f5c518 14px, #111 14px, #111 28px);
		border-top: 2px solid #111;
		border-bottom: 2px solid #111;
		padding: 0.25rem 0;
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
	}

	.tape-text {
		display: inline-block;
		padding: 0.1rem 0.4rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: #111;
		background: rgba(245, 197, 24, 0.9);
		text-transform: uppercase;
	}

	/* Prominence scales with how many fresh members flagged the dog. */
	.intensity-low .tape {
		opacity: 0.8;
	}
	.intensity-medium .tape {
		opacity: 0.9;
		padding: 0.35rem 0;
	}
	.intensity-high .tape {
		opacity: 1;
		padding: 0.5rem 0;
	}
	.intensity-high .tape-text {
		font-size: 1.1em;
	}
</style>
