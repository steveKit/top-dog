<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ReactionBar from '$lib/components/ReactionBar.svelte';
	import HamburgerAlarmBanner from '$lib/components/HamburgerAlarmBanner.svelte';
	import ConfirmedHamburgerStamp from '$lib/components/ConfirmedHamburgerStamp.svelte';
	import BurgerReportControl from '$lib/components/BurgerReportControl.svelte';

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
</script>

<h1>The feed</h1>
<p>Vote for your favourite — you get one vote. Casting on a different dog moves it.</p>

{#if form?.error}
	<p role="alert">{form.error}</p>
{/if}

{#if data.dogs.length === 0}
	<p>No other hot dogs to vote on yet.</p>
{:else}
	<ul>
		{#each data.dogs as dog (dog.id)}
			{@const isVoted = dog.id === data.currentVoteDogId}
			<li>
				<p>@{dog.owner_handle || dog.owner_display_name}</p>
				{#if dog.signedUrl}
					<div class="dog-image">
						<img src={dog.signedUrl} alt={dog.caption ?? 'A hot dog'} width="240" />
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
					</div>
				{:else}
					<span>Image unavailable</span>
				{/if}
				<!-- DW-022: once the Hamburger Court has adjudicated this dog (verdict
				     'cleared' or 'confirmed'), the report toggle would be stale — the
				     verdict, not the live report, drives the display. Hide the control and
				     show a small adjudicated note instead of a misleading active toggle. -->
				{#if dog.alarmState === 'alarm'}
					<BurgerReportControl dogId={dog.id} iReported={dog.iReported} />
				{:else}
					<p class="adjudicated-note">🍔 The Hamburger Court has ruled.</p>
				{/if}
				{#if dog.caption}
					<p>{dog.caption}</p>
				{/if}
				<p>{dog.vote_count} {dog.vote_count === 1 ? 'vote' : 'votes'}</p>
				<p>Peak: {dog.peak_votes}</p>
				<p><a href={resolve('/(protected)/app/dogs/[id]', { id: dog.id })}>View details</a></p>

				<ReactionBar dogId={dog.id} summaries={dog.reactions} />

				{#if isVoted}
					<p class="voted-marker">Voted ✓</p>
					<form method="POST" action="?/remove" use:enhance={submitRemove}>
						<button type="submit" class="btn-text" disabled={pending !== null}>
							{pending === 'remove' ? 'Removing…' : 'Remove vote'}
						</button>
					</form>
				{:else}
					<form method="POST" action="?/vote" use:enhance={() => submitVote(dog.id)}>
						<input type="hidden" name="id" value={dog.id} />
						<button type="submit" class="btn-relic" disabled={pending !== null}>
							{#if pending === dog.id}
								Saving…
							{:else if hasVote}
								Move vote here
							{:else}
								Vote
							{/if}
						</button>
					</form>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	/* Ranked feed as gold-edged plaque cards. */
	ul {
		list-style: none;
		margin: var(--space-xl) 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	li {
		border: 1px solid var(--accent-plaque-border);
		background: var(--accent-fill);
		border-radius: var(--radius-card);
		padding: var(--space-lg);
	}

	/* Positioned wrapper so the absolutely-positioned alarm overlay covers the
	   dog image exactly (the banner component is inset:0 within this box). */
	.dog-image {
		position: relative;
		display: inline-block;
		line-height: 0;
		border: 1px solid var(--accent-plaque-border);
		border-radius: var(--radius-card);
		overflow: hidden;
	}

	.voted-marker {
		font-family: var(--font-display);
		font-size: var(--text-label);
		font-weight: 600;
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: var(--accent);
	}

	.adjudicated-note {
		font-style: italic;
		color: var(--color-text-muted);
	}
</style>
