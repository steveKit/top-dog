<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ReactionBar from '$lib/components/ReactionBar.svelte';
	import HamburgerAlarmBanner from '$lib/components/HamburgerAlarmBanner.svelte';
	import ConfirmedHamburgerStamp from '$lib/components/ConfirmedHamburgerStamp.svelte';
	import BurgerReportControl from '$lib/components/BurgerReportControl.svelte';

	// The Procession: Standings of the Blessed — rebuilt from
	// design/pages/The Procession.dc.html (M8 TASK-091). This is a RE-SKIN of the
	// unchanged feed data flow: +page.server.ts (load + the six actions) is
	// preserved, every one re-wired into the temple-column markup. The mockup's
	// header / Anointed-Wiener chrome ribbon belong to the persistent app shell
	// (+layout.svelte) and are NOT re-rendered here; this page owns the temple
	// column (eyebrow → h1 → ✦ divider → lead) and the ranked № frank cards.

	let { data, form } = $props();

	// Which dog currently has a vote action in flight (disables that row's button
	// and shows a pending label). Reset after the action settles.
	let pending = $state<string | null>(null);

	// Cast / move the vote on a specific dog, then refresh so vote counts and any
	// crown handoff reflect immediately (default action, then invalidateAll).
	const submitVote = (id: string) => {
		pending = id;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			pending = null;
			await invalidateAll();
		};
	};

	// Retract the viewer's active vote, then refresh.
	const submitRemove = () => {
		pending = 'remove';
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			pending = null;
			await invalidateAll();
		};
	};

	const hasVote = $derived(data.currentVoteDogId !== null);

	// Champion ("The Anointed Wiener") ribbon source. The mockup marks the
	// crown-holder's frank with the Anointed-Wiener ribbon (isChampion ↔ the
	// non-client-writable `is_current_top_dog` crown, decision #25). The load
	// surfaces `championDogId` — the highest-ranked listed dog whose owner reigns,
	// or null when none — and the ribbon renders on that one frank.
	const isChampionDog = (dog: { id: string }): boolean => {
		return data.championDogId != null && data.championDogId === dog.id;
	};
</script>

<main class="procession">
	<div class="glow-orb" aria-hidden="true"></div>

	<header class="procession-head">
		<span class="eyebrow">Standings of the Blessed</span>
		<h1>The Procession</h1>
		<div class="ornament-divider" aria-hidden="true">✦</div>
		<p class="procession-lead">Cast thy vote upon the worthiest link.</p>
	</header>

	{#if form?.error}
		<p class="procession-error" role="alert">{form.error}</p>
	{/if}

	{#if data.dogs.length === 0}
		<div class="empty">
			<div class="empty-rule" aria-hidden="true">
				<span class="empty-rule-label">The Procession · Empty</span>
			</div>
			<div class="empty-card">
				<p>No other links yet await thy judgment.</p>
			</div>
		</div>
	{:else}
		<ol class="procession-list">
			{#each data.dogs as dog, i (dog.id)}
				{@const isVoted = dog.id === data.currentVoteDogId}
				{@const isChampion = isChampionDog(dog)}
				<li>
					<article class="frank fade-up" class:is-champion={isChampion}>
						{#if isChampion}
							<span class="champion-ribbon" role="status">
								<svg
									class="champion-mark"
									viewBox="0 0 24 16"
									width="15"
									height="10"
									aria-hidden="true"
								>
									<path
										d="M2 14 L2 5 L7 9 L12 2 L17 9 L22 5 L22 14 Z"
										fill="currentColor"
										stroke="currentColor"
										stroke-width="1"
										stroke-linejoin="round"
									/>
								</svg>
								The Anointed Wiener
							</span>
						{/if}

						<div class="frank-relic">
							<span class="frank-rank">№ {i + 1}</span>
							<div class="frank-image">
								{#if dog.signedUrl}
									<img src={dog.signedUrl} alt={dog.caption ?? 'A hot dog'} />
									<!-- 🍔 Hamburger Court display (TASK-073). A verdict overrides the
									     decaying alarm: 'confirmed' -> persistent stamp; 'cleared' ->
									     nothing; otherwise the decaying report alarm shows. -->
									{#if dog.alarmState === 'confirmed'}
										<ConfirmedHamburgerStamp dogId={dog.id} />
									{:else if dog.alarmState === 'alarm' && dog.alarm.active}
										<HamburgerAlarmBanner
											dogId={dog.id}
											intensity={dog.alarm.intensity}
											reporterCount={dog.alarm.reporterCount}
										/>
									{/if}
								{:else}
									<span class="frank-image-missing">Image unavailable</span>
								{/if}
							</div>
						</div>

						<div class="frank-body">
							<div class="frank-meta">
								<span class="frank-handle">@{dog.owner_handle || dog.owner_display_name}</span>
								<div class="frank-tally">
									<span class="frank-votes">
										<span class="frank-votes-num">{dog.vote_count}</span>
										<span class="frank-votes-label">{dog.vote_count === 1 ? 'vote' : 'votes'}</span>
									</span>
									<span class="frank-peak">peak {dog.peak_votes}</span>
								</div>
							</div>

							{#if dog.caption}
								<p class="frank-caption">{dog.caption}</p>
							{/if}

							<div class="frank-vote">
								{#if isVoted}
									<span class="vote-state voted">Voted ✓</span>
									<form method="POST" action="?/remove" use:enhance={submitRemove}>
										<button type="submit" class="vote-remove" disabled={pending !== null}>
											{pending === 'remove' ? 'Removing…' : 'Remove vote'}
										</button>
									</form>
								{:else}
									<form method="POST" action="?/vote" use:enhance={() => submitVote(dog.id)}>
										<input type="hidden" name="id" value={dog.id} />
										<button
											type="submit"
											class="vote-cast"
											class:vote-move={hasVote}
											disabled={pending !== null}
										>
											{#if pending === dog.id}
												Saving…
											{:else if hasVote}
												Move vote here <span aria-hidden="true">→</span>
											{:else}
												Vote <span aria-hidden="true">→</span>
											{/if}
										</button>
									</form>
								{/if}
							</div>

							<ReactionBar dogId={dog.id} summaries={dog.reactions} />

							<div class="frank-foot">
								<!-- DW-022: once the Hamburger Court has adjudicated this dog (verdict
								     'cleared' or 'confirmed'), the report toggle would be stale — the
								     verdict, not the live report, drives the display. Hide the control and
								     show a small adjudicated note instead of a misleading active toggle. -->
								{#if dog.alarmState === 'alarm'}
									<BurgerReportControl dogId={dog.id} iReported={dog.iReported} />
								{:else}
									<p class="adjudicated-note">the Tribunal of the Holy Tube has ruled.</p>
								{/if}
								<a
									class="frank-relic-link"
									href={resolve('/(protected)/snacktum-snacktorum/litter/[id]', { id: dog.id })}
									>View the relic <span aria-hidden="true">→</span></a
								>
							</div>
						</div>
					</article>
				</li>
			{/each}
		</ol>
	{/if}
</main>

<style>
	/* The Procession is a centered temple column. All values reference theme
	   tokens (no magic hex/px); the gold accent themes via [data-accent]. */
	.procession {
		position: relative;
		max-width: var(--measure-content);
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	/* The hero glow sits behind the column heading. */
	.procession .glow-orb {
		top: -200px;
	}

	.procession-head {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		margin-bottom: var(--space-2xl);
	}

	.procession-head h1 {
		margin: var(--space-sm) 0 0;
	}

	.procession-head .ornament-divider {
		margin: var(--space-lg) 0 0;
	}

	.procession-lead {
		max-width: 32rem;
		margin: var(--space-md) 0 0;
		font-size: var(--text-lg);
		font-style: italic;
		color: var(--color-text-muted);
	}

	.procession-error {
		width: 100%;
		margin: 0 0 var(--space-lg);
		text-align: center;
	}

	/* Ranked procession of gold-edged plaque cards. Numbered list for semantics +
	   the visible № rank; list markers are removed (the № is rendered explicitly). */
	.procession-list {
		width: 100%;
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.frank {
		position: relative;
		display: flex;
		gap: var(--space-lg);
		padding: var(--space-lg);
		background: var(--color-bg-mid);
		border: 1px solid var(--accent-plaque-border);
		border-radius: var(--radius-card);
		box-shadow: var(--shadow-plaque);
	}

	/* The champion frank carries an inset gold halo + the Anointed-Wiener ribbon. */
	.frank.is-champion {
		border-color: var(--accent);
		box-shadow:
			var(--shadow-plaque),
			0 0 0 4px var(--accent-fill-strong);
	}

	.champion-ribbon {
		position: absolute;
		top: calc(-1 * var(--space-sm));
		right: var(--space-lg);
		z-index: 3;
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-2xs) var(--space-sm);
		background: var(--accent);
		color: var(--color-on-accent);
		border-radius: var(--radius-control);
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 700;
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		box-shadow: var(--shadow-button-glow);
	}

	.champion-mark {
		display: block;
	}

	/* Left rail: the № rank above the framed relic image. */
	.frank-relic {
		flex: none;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-sm);
		width: 150px;
	}

	.frank-rank {
		font-family: var(--font-display);
		font-size: var(--text-xl);
		font-weight: 700;
		letter-spacing: var(--tracking-tight);
		color: var(--accent);
	}

	/* Positioned wrapper so the absolutely-positioned alarm/stamp overlay covers
	   the dog image exactly (the components are inset:0 within this box). */
	.frank-image {
		position: relative;
		width: 150px;
		height: 150px;
		border: 2px solid var(--accent-soft);
		border-radius: var(--radius-control);
		overflow: hidden;
		background: var(--color-bg-deep);
		line-height: 0;
	}

	.frank-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.frank-image-missing {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		padding: var(--space-sm);
		font-size: var(--text-sm);
		font-style: italic;
		color: var(--color-text-faint);
		text-align: center;
		line-height: 1.3;
	}

	/* Right column: handle + tally, caption, vote control, reactions, foot. */
	.frank-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.frank-meta {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-md);
	}

	.frank-handle {
		font-family: var(--font-display);
		font-size: var(--text-sm);
		font-weight: 600;
		letter-spacing: var(--tracking-tight);
		color: var(--color-heading);
	}

	.frank-tally {
		flex: none;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: var(--space-2xs);
	}

	.frank-votes {
		display: flex;
		align-items: baseline;
		gap: var(--space-xs);
	}

	.frank-votes-num {
		font-family: var(--font-display);
		font-size: var(--text-xl);
		font-weight: 700;
		color: var(--accent);
		line-height: 1;
	}

	.frank-votes-label {
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 600;
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: var(--color-text-faint);
	}

	.frank-peak {
		font-size: var(--text-sm);
		font-style: italic;
		color: var(--color-text-faint);
	}

	.frank-caption {
		margin: 0;
		color: var(--color-text-muted);
	}

	/* The vote / move / voted control row. */
	.frank-vote {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-md);
	}

	.frank-vote form {
		margin: 0;
	}

	/* Primary "Vote →" — a compact gold relic button. */
	.vote-cast {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-sm) var(--space-lg);
		background: var(--accent);
		color: var(--color-on-accent);
		border: none;
		border-radius: var(--radius-control);
		font-family: var(--font-display);
		font-size: var(--text-label);
		font-weight: 600;
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		cursor: pointer;
		box-shadow: var(--shadow-button-glow);
	}

	.vote-cast:hover:not(:disabled) {
		filter: brightness(1.08);
	}

	/* "Move vote here" reads as an outline variant (a vote already cast). */
	.vote-cast.vote-move {
		background: transparent;
		color: var(--accent);
		border: 1.5px solid var(--accent);
		box-shadow: none;
	}

	.vote-cast.vote-move:hover:not(:disabled) {
		background: var(--accent-fill-strong);
		filter: none;
	}

	.vote-cast:disabled {
		opacity: 0.45;
		cursor: not-allowed;
		filter: none;
	}

	/* The current vote's marker pill (paired with the explicit "✓" glyph, so the
	   state cue is never color-alone). */
	.vote-state.voted {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-sm) var(--space-lg);
		background: var(--accent-fill-strong);
		color: var(--accent);
		border: 1.5px solid var(--accent);
		border-radius: var(--radius-control);
		font-family: var(--font-display);
		font-size: var(--text-label);
		font-weight: 700;
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
	}

	.vote-remove {
		background: none;
		border: none;
		padding: 0;
		font-family: var(--font-body);
		font-size: var(--text-sm);
		font-style: italic;
		color: var(--color-text-faint);
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}

	.vote-remove:hover:not(:disabled) {
		color: var(--color-text);
	}

	.vote-remove:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	/* Foot: the report toggle / adjudicated note on the left, relic link on the
	   right, divided from the body by a faint gold rule. */
	.frank-foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-md);
		margin-top: var(--space-2xs);
		padding-top: var(--space-sm);
		border-top: 1px solid var(--accent-divider);
	}

	.adjudicated-note {
		margin: 0;
		font-style: italic;
		color: var(--color-error);
	}

	.frank-relic-link {
		flex: none;
		font-family: var(--font-body);
		font-size: var(--text-sm);
		font-style: italic;
		text-decoration: none;
	}

	.frank-relic-link:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	/* Empty state — a dashed plaque under a labeled rule. */
	.empty {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-lg);
	}

	.empty-rule {
		display: flex;
		align-items: center;
		width: 100%;
		gap: var(--space-md);
		color: var(--accent);
	}

	.empty-rule::before,
	.empty-rule::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--accent-divider);
	}

	.empty-rule-label {
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 600;
		letter-spacing: var(--tracking-eyebrow);
		text-transform: uppercase;
	}

	.empty-card {
		width: 100%;
		padding: var(--space-3xl) var(--space-lg);
		border: 1px dashed var(--accent-border);
		border-radius: var(--radius-card);
		background: var(--accent-fill);
		text-align: center;
	}

	.empty-card p {
		margin: 0;
		font-size: var(--text-lg);
		font-style: italic;
		color: var(--color-text-muted);
	}

	/* Responsive: stack the relic above the body on narrow viewports. */
	@media (max-width: 36rem) {
		.frank {
			flex-direction: column;
			align-items: center;
		}

		.frank-body {
			width: 100%;
		}

		.champion-ribbon {
			right: var(--space-md);
		}
	}
</style>
