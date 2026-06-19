<script lang="ts">
	// 🍔 CONFIRMED HAMBURGER stamp — the PERSISTENT police-tape overlay that replaces
	// the decaying HAMBURGER ALARM on a dog image once the Top Dog rules it a
	// confirmed_hamburger (TASK-073 confirmed-branch resolution). Mirrors
	// HamburgerAlarmBanner's two-strip idiom but is fixed-prominence and persistent
	// (driven by the verdict store, NOT the report-timestamp decay).
	//
	// Each strip is rotated by a stable, seeded angle (bannerAngle) so the banners
	// look hand-slapped on but never jitter. XSS-safe: labels are fixed strings; the
	// only dynamic value (angle) is bound as an inline style number — no {@html}.

	import { bannerAngle } from '$lib/features/reports/angle';

	let { dogId }: { dogId: string } = $props();

	const TOP_LABEL = 'CONFIRMED HAMBURGER';
	const BOTTOM_LABEL = 'RULED BY THE TOP DOG';

	const topAngle = $derived(bannerAngle(`${dogId}:${TOP_LABEL}`));
	const bottomAngle = $derived(bannerAngle(`${dogId}:${BOTTOM_LABEL}`));
</script>

<div
	class="stamp"
	role="alert"
	aria-label="Confirmed hamburger: the Top Dog ruled this is a hamburger, not a hot dog"
>
	<div class="tape tape-top" style="--angle: {topAngle}deg">
		<span class="tape-text">🍔 {TOP_LABEL} 🍔 {TOP_LABEL}</span>
	</div>
	<div class="tape tape-bottom" style="--angle: {bottomAngle}deg">
		<span class="tape-text">{BOTTOM_LABEL} · {BOTTOM_LABEL}</span>
	</div>
</div>

<style>
	.stamp {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-evenly;
		pointer-events: none;
		overflow: hidden;
		/* A confirmed verdict is a wax-stamp moment — pop it in on render. */
		animation: confirmedStamp var(--motion-entrance) var(--ease-out) both;
	}

	.tape {
		width: 160%;
		transform: rotate(var(--angle, 0deg));
		background: repeating-linear-gradient(
			45deg,
			var(--tape-confirmed) 0,
			var(--tape-confirmed) 14px,
			var(--tape-stripe-dark) 14px,
			var(--tape-stripe-dark) 28px
		);
		border-top: 2px solid var(--tape-stripe-dark);
		border-bottom: 2px solid var(--tape-stripe-dark);
		padding: var(--space-xs) 0;
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
	}

	.tape-text {
		display: inline-block;
		padding: 0.1rem var(--space-2xs);
		font-family: var(--font-display);
		font-weight: 700;
		letter-spacing: 0.08em;
		color: #fff;
		background: rgba(221, 17, 34, 0.92);
		text-transform: uppercase;
		font-size: 1.1em;
	}

	@keyframes confirmedStamp {
		0% {
			transform: scale(1.3);
			opacity: 0;
		}
		45% {
			transform: scale(0.88);
			opacity: 1;
		}
		100% {
			transform: scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.stamp {
			animation: none;
		}
	}
</style>
