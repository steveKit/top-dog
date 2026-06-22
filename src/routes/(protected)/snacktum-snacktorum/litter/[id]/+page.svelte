<script lang="ts">
	import { resolve } from '$app/paths';
	import TopDogBadge from '$lib/components/TopDogBadge.svelte';
	import HamburgerAlarmBanner from '$lib/components/HamburgerAlarmBanner.svelte';
	import ConfirmedHamburgerStamp from '$lib/components/ConfirmedHamburgerStamp.svelte';
	import BurgerReportControl from '$lib/components/BurgerReportControl.svelte';

	// The Relic — the enshrined-frank detail view, rebuilt from
	// design/pages/The Relic.dc.html (M8 TASK-096). This is a RE-SKIN of the
	// unchanged detail data flow: +page.server.ts (the load + the report/unreport
	// actions) is preserved byte-identical, every value re-wired into the relic-frame
	// markup. The mockup's header / Anointed-Wiener chrome ribbon belong to the
	// persistent app shell (+layout.svelte) and are NOT re-rendered here; this page
	// owns the relic column (back-link → eyebrow → relic frame → caption → owner →
	// stats → reactions → heresy control).
	//
	// The signed URL for this CROSS-MEMBER private-bucket image is minted SERVER-SIDE
	// with the service client (decision #27) in +page.server.ts; this page only renders
	// the already-signed data.signedUrl — it never touches a storage client.

	let { data } = $props();

	const dog = $derived(data.dog);
	const owner = $derived(data.dog.owner);

	// The relic image's alt text — the caption, or a neutral fallback. The caption
	// renders auto-escaped as text everywhere (no {@html}); this is its alt copy.
	const imageAlt = $derived(dog.caption ?? 'A consecrated frank');
</script>

<main class="relic-page">
	<div class="glow-orb" aria-hidden="true"></div>

	<a class="relic-back" href={resolve('/(protected)/snacktum-snacktorum/procession')}>
		<span aria-hidden="true">←</span> Back to the Procession
	</a>

	<span class="eyebrow relic-eyebrow">A Relic of the Order</span>

	<!-- ===== RELIC FRAME ===== -->
	<div class="relic-frame fade-up">
		{#if data.signedUrl}
			<div class="dog-image">
				<img src={data.signedUrl} alt={imageAlt} />
				<!-- 🍔 Hamburger Court display (TASK-073). A verdict overrides the decaying
				     alarm: 'confirmed' -> persistent CONFIRMED HAMBURGER stamp; 'cleared' ->
				     nothing (adjudicated). Only when there is NO verdict ('alarm') does the
				     decaying report alarm show. -->
				{#if data.alarmState === 'confirmed'}
					<ConfirmedHamburgerStamp dogId={dog.id} />
				{:else if data.alarmState === 'alarm' && data.alarm.active}
					<HamburgerAlarmBanner
						dogId={dog.id}
						intensity={data.alarm.intensity}
						reporterCount={data.alarm.reporterCount}
					/>
				{/if}
			</div>
		{:else}
			<div class="dog-image relic-image-missing">
				<span>The sacred link is veiled.</span>
			</div>
		{/if}
	</div>

	{#if dog.caption}
		<p class="relic-caption">&ldquo;{dog.caption}&rdquo;</p>
	{/if}

	<div class="relic-owner">
		<span class="relic-owner-pre">venerated by</span>
		<a
			class="relic-owner-handle"
			href={resolve('/(protected)/snacktum-snacktorum/shrine/[handle]', { handle: owner.handle })}
			>@{owner.handle || owner.display_name}</a
		>
		{#if owner.is_current_top_dog}
			<TopDogBadge label="The Anointed Wiener" />
		{/if}
	</div>

	<!-- ===== STATS =====
	     The "Stats" heading + the "Peak votes: N" / "Current votes: N" copy are
	     load-bearing E2E anchors (tests/feed-detail.e2e.ts) — keep the heading text
	     and the visible "<label>: <number>" form. -->
	<section class="relic-stats" aria-label="Stats">
		<h2 class="visually-hidden">Stats</h2>
		<div class="stat">
			<span class="stat-num stat-num-accent">{dog.peak_votes}</span>
			<span class="stat-label">Peak votes: {dog.peak_votes}</span>
		</div>
		<div class="stat">
			<span class="stat-num">{dog.vote_count}</span>
			<span class="stat-label">Current votes: {dog.vote_count}</span>
		</div>
	</section>

	<!-- ===== REACTIONS (read-only flair, decision #12) ===== -->
	{#if data.reactions.length > 0}
		<section class="relic-reactions" aria-label="Reactions">
			<h2 class="relic-section-label">The Faithful Reacted</h2>
			<ul class="reaction-chips">
				{#each data.reactions as summary (summary.emoji)}
					<li class="reaction-chip">
						<span class="reaction-emoji">{summary.emoji}</span>
						<span class="reaction-count">{summary.count}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- ===== HERESY CONTROL =====
	     DW-022: show the report toggle on another member's dog ONLY while it's still
	     unadjudicated ('alarm'). Once the Tribunal has ruled ('cleared' / 'confirmed'),
	     the verdict drives the display, so show a small adjudicated note instead of a
	     stale live toggle. The viewer cannot report their own dog. -->
	{#if !data.isOwnDog}
		<div class="relic-heresy">
			{#if data.alarmState === 'alarm'}
				<BurgerReportControl dogId={dog.id} iReported={data.iReported} />
				<p class="relic-heresy-note">
					An accusation summons the Tribunal of the Holy Tube — choose wisely.
				</p>
			{:else}
				<p class="relic-ruled-note">the Tribunal of the Holy Tube has ruled.</p>
			{/if}
		</div>
	{:else if data.alarmState === 'alarm'}
		<div class="relic-heresy">
			<p class="relic-await-note">Thy relic stands accused — the Tribunal shall rule.</p>
		</div>
	{/if}
</main>

<style>
	/* The Relic is a centered relic column. All values reference theme tokens (no
	   magic hex/px); the gold accent themes via [data-accent]. Self-caps to the
	   reading measure per the App Chrome full-bleed invariant. */
	.relic-page {
		position: relative;
		max-width: var(--measure-content);
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.relic-page .glow-orb {
		top: -200px;
	}

	/* Back-link sits flush left above the relic. */
	.relic-back {
		position: relative;
		z-index: 1;
		align-self: flex-start;
		font-family: var(--font-body);
		font-size: var(--text-base);
		font-style: italic;
		color: var(--color-text-faint);
		text-decoration: none;
		margin-bottom: var(--space-xl);
	}

	.relic-back:hover {
		color: var(--accent);
	}

	.relic-eyebrow {
		position: relative;
		z-index: 1;
		letter-spacing: var(--tracking-wide);
		margin-bottom: var(--space-lg);
	}

	/* The gold-framed reliquary around the consecrated image. */
	.relic-frame {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 27.5rem;
		padding: var(--space-sm);
		background: var(--color-bg-mid);
		border: 2px solid var(--accent);
		border-radius: var(--radius-card);
		box-shadow:
			0 0 0 6px var(--accent-fill-strong),
			var(--shadow-card);
	}

	/* Positioned wrapper so the absolutely-positioned alarm/stamp overlay covers
	   the dog image exactly (the overlay components are inset:0 within this box).
	   `.dog-image` is also the E2E locator scope (tests/feed-detail.e2e.ts targets
	   `.dog-image img`, NOT a bare page-wide img). */
	.dog-image {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		border: 1px solid var(--accent-soft);
		border-radius: var(--radius-control);
		overflow: hidden;
		background: var(--color-bg-deep);
		line-height: 0;
	}

	.dog-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.relic-image-missing {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-lg);
		line-height: 1.4;
	}

	.relic-image-missing span {
		font-size: var(--text-sm);
		font-style: italic;
		color: var(--color-text-faint);
		text-align: center;
	}

	/* The quoted caption, set in italic display prose under the relic. */
	.relic-caption {
		max-width: 28.75rem;
		margin: var(--space-xl) 0 0;
		font-size: var(--text-xl);
		font-style: italic;
		color: var(--color-text);
		text-align: center;
	}

	.relic-owner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		margin-top: var(--space-md);
	}

	.relic-owner-pre {
		font-size: var(--text-base);
		font-style: italic;
		color: var(--color-text-muted);
	}

	.relic-owner-handle {
		font-family: var(--font-display);
		font-size: var(--text-sm);
		font-weight: 600;
		letter-spacing: var(--tracking-tight);
		color: var(--accent);
		text-decoration: none;
	}

	.relic-owner-handle:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	/* The two-cell stat plinth: peak + current votes. */
	.relic-stats {
		display: flex;
		gap: 1px;
		margin-top: var(--space-2xl);
		border: 1px solid var(--accent-plaque-border);
		border-radius: var(--radius-card);
		overflow: hidden;
		background: var(--accent-fill-strong);
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2xs);
		padding: var(--space-lg) var(--space-2xl);
		background: var(--color-bg-mid);
	}

	.stat-num {
		font-family: var(--font-display);
		font-size: var(--text-h2);
		font-weight: 700;
		line-height: 1;
		color: var(--color-heading);
	}

	.stat-num-accent {
		color: var(--accent);
	}

	.stat-label {
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 600;
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: var(--color-text-faint);
	}

	/* Visually-hidden but accessible "Stats" heading — the section is labeled in
	   the design by the stat plinth itself, but the heading is kept for semantics
	   AND as the E2E anchor (getByRole('heading', { name: 'Stats' })). */
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	/* Read-only reaction chips. */
	.relic-reactions {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-sm);
		margin-top: var(--space-2xl);
	}

	.relic-section-label {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 600;
		letter-spacing: var(--tracking-eyebrow);
		text-transform: uppercase;
		color: var(--accent-strong);
	}

	.reaction-chips {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-xs);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.reaction-chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-2xs) var(--space-sm);
		background: var(--accent-fill);
		border: 1px solid var(--accent-border);
		border-radius: var(--radius-pill);
	}

	.reaction-emoji {
		font-size: var(--text-base);
		line-height: 1;
	}

	.reaction-count {
		font-family: var(--font-display);
		font-size: var(--text-label);
		font-weight: 700;
		color: var(--color-text-muted);
	}

	/* The heresy / report control row, divided from the body by a faint gold rule. */
	.relic-heresy {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-sm);
		margin-top: var(--space-2xl);
		padding-top: var(--space-xl);
		border-top: 1px solid var(--accent-divider);
	}

	.relic-heresy-note {
		margin: 0;
		font-size: var(--text-sm);
		font-style: italic;
		color: var(--color-text-faint);
		text-align: center;
	}

	.relic-ruled-note,
	.relic-await-note {
		margin: 0;
		font-style: italic;
		text-align: center;
	}

	.relic-ruled-note {
		color: var(--color-error);
	}

	.relic-await-note {
		color: var(--accent-strong);
	}

	/* Responsive: tighten the stat plinth gutters on narrow viewports. */
	@media (max-width: 30rem) {
		.stat {
			padding: var(--space-md) var(--space-lg);
		}
	}
</style>
