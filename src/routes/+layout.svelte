<script lang="ts">
	import { navigating } from '$app/state';
	import '../app.css';

	let { children } = $props();

	// Lightweight global navigation indicator (Part B): show a thin top strip
	// whenever a page navigation is in flight, so a slow load doesn't look frozen.
	const isNavigating = $derived(navigating.to !== null);
</script>

<svelte:head>
	<!-- Brand favicons live in static/ (served at the site root). SVG is the
	     primary mark; the PNG sizes and apple-touch-icon cover legacy and iOS. -->
	<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
	<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
	<link rel="icon" type="image/png" sizes="64x64" href="/favicon-64.png" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
</svelte:head>

{#if isNavigating}
	<div class="nav-indicator" role="status" aria-label="Loading"></div>
{/if}

<div class="page-container">
	{@render children()}
</div>
