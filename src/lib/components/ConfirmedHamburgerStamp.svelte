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
	}

	.tape {
		width: 160%;
		transform: rotate(var(--angle, 0deg));
		background: repeating-linear-gradient(45deg, #d12 0, #d12 14px, #111 14px, #111 28px);
		border-top: 2px solid #111;
		border-bottom: 2px solid #111;
		padding: 0.5rem 0;
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
	}

	.tape-text {
		display: inline-block;
		padding: 0.1rem 0.4rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: #fff;
		background: rgba(221, 17, 34, 0.92);
		text-transform: uppercase;
		font-size: 1.1em;
	}
</style>
