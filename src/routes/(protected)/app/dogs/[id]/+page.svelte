<script lang="ts">
	import { resolve } from '$app/paths';
	import TopDogBadge from '$lib/components/TopDogBadge.svelte';

	let { data } = $props();

	const dog = $derived(data.dog);
	const owner = $derived(data.dog.owner);
</script>

<p><a href={resolve('/(protected)/app/feed')}>← Back to the feed</a></p>

{#if owner.is_current_top_dog}
	<TopDogBadge label="Top Dog" />
{/if}

{#if data.signedUrl}
	<img src={data.signedUrl} alt={dog.caption ?? 'A hot dog'} width="480" />
{:else}
	<p>Image unavailable</p>
{/if}

{#if dog.caption}
	<p>{dog.caption}</p>
{/if}

<p>
	by <a href={resolve('/(protected)/app/profile/[handle]', { handle: owner.handle })}
		>@{owner.handle || owner.display_name}</a
	>
</p>

<section aria-label="Stats">
	<h2>Stats</h2>
	<p>Peak votes: {dog.peak_votes}</p>
	<p>Current votes: {dog.vote_count}</p>
</section>

{#if data.reactions.length > 0}
	<section aria-label="Reactions">
		<h2>Reactions</h2>
		<ul>
			{#each data.reactions as summary (summary.emoji)}
				<li>{summary.emoji} {summary.count}</li>
			{/each}
		</ul>
	</section>
{/if}
