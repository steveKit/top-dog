<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

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
					<img src={dog.signedUrl} alt={dog.caption ?? 'A hot dog'} width="240" />
				{:else}
					<span>Image unavailable</span>
				{/if}
				{#if dog.caption}
					<p>{dog.caption}</p>
				{/if}
				<p>{dog.vote_count} {dog.vote_count === 1 ? 'vote' : 'votes'}</p>

				{#if isVoted}
					<p>Voted ✓</p>
					<form method="POST" action="?/remove" use:enhance={submitRemove}>
						<button type="submit" disabled={pending !== null}>
							{pending === 'remove' ? 'Removing…' : 'Remove vote'}
						</button>
					</form>
				{:else}
					<form method="POST" action="?/vote" use:enhance={() => submitVote(dog.id)}>
						<input type="hidden" name="id" value={dog.id} />
						<button type="submit" disabled={pending !== null}>
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
