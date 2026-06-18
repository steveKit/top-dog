<script lang="ts">
	import { navigating } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();

	// Lightweight global navigation indicator (Part B): show a thin top strip
	// whenever a page navigation is in flight, so a slow load doesn't look frozen.
	const isNavigating = $derived(navigating.to !== null);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if isNavigating}
	<div class="nav-indicator" role="status" aria-label="Loading"></div>
{/if}

<div class="page-container">
	{@render children()}
</div>
