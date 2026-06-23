<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import snacktumHeader from '$lib/assets/brand/snacktum-snacktorum-header.svg';

	// The Lost Pilgrim — the root error boundary, built from
	// design/pages/The Lost Pilgrim.dc.html (M8 TASK-101). There is no other
	// +error.svelte in the tree, so this catches every unhandled error and 404
	// (errors/404s previously fell back to SvelteKit's default unstyled boundary).
	//
	// The root +layout.svelte is minimal (favicons + nav indicator + a
	// .page-container wrapper) with NO brand/nav chrome, so this page renders its
	// own minimal brand header — matching the mockup — rather than appearing bare.
	//
	// SECURITY (L2 / OWASP security-misconfiguration): we render ONLY the friendly
	// fixed cult copy + the numeric status. We deliberately do NOT render
	// page.error.message or any internal error detail to the visitor — server logs
	// hold the detail. No {@html} anywhere.

	// A 404 ("Thou Hast Strayed") gets the corridor copy; any other status
	// (500 / 403 / etc.) gets the generic "A Disturbance in the Tube" treatment,
	// showing the ACTUAL page.status numeral rather than a hardcoded 500.
	const notFound = $derived(page.status === 404);

	const eyebrow = $derived(notFound ? 'Thou Hast Strayed' : 'A Disturbance in the Tube');

	const line = $derived(
		notFound
			? 'This corridor of the Snacktum leads nowhere, pilgrim. The link thou sought is not among the sacred.'
			: 'A disturbance in the Tube — the Order is set upon it. Tarry a moment, then seek the gates anew.'
	);
</script>

<header class="pilgrim-header">
	<a class="pilgrim-brand" href={resolve('/')}>
		<img src={snacktumHeader} alt="Snacktum Snacktorum" />
	</a>
</header>

<main class="pilgrim" aria-labelledby="pilgrim-heading">
	<div class="glow-orb" aria-hidden="true"></div>

	<svg
		class="pilgrim-mark"
		viewBox="0 0 200 200"
		width="140"
		height="140"
		fill="none"
		stroke="currentColor"
		stroke-width="3"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<g stroke-width="2.5" opacity="0.9">
			<line x1="100" y1="30" x2="100" y2="12" />
			<line x1="74" y1="36" x2="64" y2="20" />
			<line x1="126" y1="36" x2="136" y2="20" />
			<line x1="52" y1="50" x2="38" y2="38" />
			<line x1="148" y1="50" x2="162" y2="38" />
			<line x1="40" y1="70" x2="24" y2="66" />
			<line x1="160" y1="70" x2="176" y2="66" />
		</g>
		<ellipse cx="100" cy="58" rx="42" ry="11" />
		<rect x="52" y="98" width="96" height="26" rx="13" fill="var(--accent-fill-strong)" />
		<path d="M66 110 q8 -7 16 0 q8 7 16 0 q8 -7 16 0 q8 7 16 0" stroke-width="2.6" />
		<path
			d="M44 122 q0 -4 6 -4 h100 q6 0 6 4 v6 q0 18 -22 18 h-68 q-22 0 -22 -18 z"
			fill="var(--accent-fill)"
		/>
	</svg>

	<!-- A single semantic heading announces the error: the eyebrow kicker plus the
	     status numeral, wrapped together so a screen reader reads e.g.
	     "Thou Hast Strayed 404". The numeral itself is plain text (not error
	     detail), safe to surface. -->
	<h1 id="pilgrim-heading" class="pilgrim-heading">
		<span class="eyebrow">{eyebrow}</span>
		<span class="pilgrim-status">{page.status}</span>
	</h1>

	<p class="pilgrim-line">{line}</p>

	<a class="btn-relic" href={resolve('/')}>Return to the Procession →</a>
</main>

<style>
	/* The Lost Pilgrim is a centered, narrow temple column (the mockup caps <main>
	   at ~560px). It renders directly inside the root .page-container, so it
	   self-caps and centers. Every value references theme tokens — no magic hex/px;
	   the gold accent themes via [data-accent]. */

	/* Minimal brand header — the root layout has no chrome, so the page supplies
	   its own wordmark-home link (mirroring the mockup's header). */
	.pilgrim-header {
		position: relative;
		z-index: 2;
		display: flex;
		align-items: center;
		padding-bottom: var(--space-lg);
		margin-bottom: var(--space-xl);
		border-bottom: 1px solid var(--accent-border);
	}

	.pilgrim-brand {
		display: inline-flex;
		align-items: center;
		border-radius: var(--radius-control);
		text-decoration: none;
	}

	.pilgrim-brand img {
		display: block;
		height: 1.75rem;
		width: auto;
	}

	.pilgrim {
		position: relative;
		max-width: var(--measure-form); /* ~560px, matching the mockup's <main> cap */
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: var(--space-lg);
		padding: var(--space-3xl) var(--space-lg) var(--space-2xl);
	}

	/* The haloed relic mark — decorative; the accent stroke themes via currentColor. */
	.pilgrim-mark {
		position: relative;
		z-index: 1;
		display: block;
		color: var(--accent);
		opacity: 0.92;
	}

	.pilgrim-heading,
	.pilgrim-line,
	.pilgrim .btn-relic {
		position: relative;
		z-index: 1;
	}

	/* The semantic heading stacks the eyebrow kicker over the big status numeral. */
	.pilgrim-heading {
		margin: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-md);
		font-weight: 400;
	}

	.pilgrim-status {
		font-family: var(--font-display);
		font-size: clamp(4.5rem, 16vw, 8rem); /* one-off hero numeral, matching the mock's clamp */
		font-weight: 700;
		line-height: 0.9;
		letter-spacing: var(--tracking-label);
		color: var(--color-heading);
		text-shadow: var(--text-shadow-hero);
	}

	.pilgrim-line {
		max-width: 28.75rem;
		margin: 0;
		font-family: var(--font-body);
		font-size: var(--text-lg);
		line-height: 1.55;
		color: var(--color-text-muted);
		text-wrap: pretty;
	}

	.pilgrim .btn-relic {
		margin-top: var(--space-sm);
	}
</style>
