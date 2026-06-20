<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	// The persistent app shell (TASK-080). Wraps every /snacktum-snacktorum route
	// with a header + navigation so no page is a dead end. It is presentational +
	// navigation only:
	// it READS the { user, profile } already surfaced by +layout.server.ts and adds
	// NO second crown query. The 🍔 Tribunal link is gated on the live,
	// server-derived crown flag (decision #25) exactly as the old hub nav did —
	// the gate is driven by data.profile.is_current_top_dog from the parent load,
	// with no crown logic in this component (mirrors TASK-074's "gate at the
	// parent" pattern).
	//
	// Copy follows the M8 "Snacktum Snacktorum" rebrand; TASK-081 owns final
	// strings, so the display labels below are confirmed-name placeholders pending
	// that task. NO code identifier is renamed — labels/copy only.

	let { data, children } = $props();

	// Mobile nav (the "unrolled scroll") open/closed state. Collapsed by default;
	// the ☰ toggle reveals the stacked nav on narrow viewports.
	let mobileOpen = $state(false);

	// Active-route highlight: mark the nav link whose target prefixes the current
	// path. Derived from the live pathname so it follows client-side navigation.
	// `'page' | undefined` feeds aria-current directly (a falsy attr is omitted).
	type Current = 'page' | undefined;
	const onFeed = $derived<Current>(
		page.url.pathname.startsWith('/snacktum-snacktorum/feed') ? 'page' : undefined
	);
	const onDogs = $derived<Current>(
		page.url.pathname.startsWith('/snacktum-snacktorum/dogs') ? 'page' : undefined
	);
	const onMessages = $derived<Current>(
		page.url.pathname.startsWith('/snacktum-snacktorum/messages') ? 'page' : undefined
	);
	const onHelp = $derived<Current>(
		page.url.pathname.startsWith('/snacktum-snacktorum/help') ? 'page' : undefined
	);
	const onCourt = $derived<Current>(
		page.url.pathname.startsWith('/snacktum-snacktorum/court') ? 'page' : undefined
	);

	function closeMobile() {
		mobileOpen = false;
	}

	// Route ids resolved through the path alias (CLAUDE.md convention). Linking
	// directly at /snacktum-snacktorum/feed skips the `/` → feed redirect hop.
	// Upload routes to the hot-dog gallery (the upload form lives on
	// /snacktum-snacktorum/dogs).
	const feedHref = resolve('/(protected)/snacktum-snacktorum/feed');
	const dogsHref = resolve('/(protected)/snacktum-snacktorum/dogs');
	const messagesHref = resolve('/(protected)/snacktum-snacktorum/messages');
	const helpHref = resolve('/(protected)/snacktum-snacktorum/help');
	const courtHref = resolve('/(protected)/snacktum-snacktorum/court');
</script>

<header class="shell-header">
	<div class="shell-glow glow-orb" aria-hidden="true"></div>

	<a class="shell-brand" href={feedHref} onclick={closeMobile}>
		<span class="shell-brand-mark" aria-hidden="true">🌭</span>
		<span class="shell-brand-text">
			<span class="shell-brand-title">Snacktum Snacktorum</span>
			<span class="shell-brand-sub">Order of the Holy Tube</span>
		</span>
	</a>

	<nav class="shell-nav shell-nav-desktop" aria-label="Primary">
		<a href={feedHref} aria-current={onFeed}>The Procession</a>
		<a href={dogsHref} aria-current={onDogs}>Your Litter</a>
		<a href={messagesHref} aria-current={onMessages}>Epistles</a>
		<a href={helpHref} aria-current={onHelp}>The Catechism</a>
		<!-- The 🍔 Tribunal of the Holy Tube is the current Top Dog's alone. Gated on
		     the live, non-client-writable crown flag (decision #25); the court
		     route's own load + the DB RPC re-check it authoritatively. -->
		{#if data.profile?.is_current_top_dog}
			<a class="shell-nav-court" href={courtHref} aria-current={onCourt}>☩ The Tribunal</a>
		{/if}
	</nav>

	<div class="shell-actions">
		<a class="shell-upload btn-relic" href={dogsHref} onclick={closeMobile}>＋ Summon a Frank</a>
	</div>

	<button
		class="shell-toggle"
		type="button"
		aria-expanded={mobileOpen}
		aria-controls="shell-mobile-nav"
		aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
		onclick={() => (mobileOpen = !mobileOpen)}
	>
		{#if mobileOpen}
			<span class="shell-toggle-x" aria-hidden="true">✕</span>
		{:else}
			<span class="shell-toggle-bar" aria-hidden="true"></span>
			<span class="shell-toggle-bar" aria-hidden="true"></span>
			<span class="shell-toggle-bar" aria-hidden="true"></span>
		{/if}
	</button>
</header>

{#if mobileOpen}
	<nav id="shell-mobile-nav" class="shell-nav shell-nav-mobile unroll" aria-label="Primary">
		<a href={feedHref} onclick={closeMobile}>The Procession</a>
		<a href={dogsHref} onclick={closeMobile}>Your Litter</a>
		<a href={messagesHref} onclick={closeMobile}>Epistles</a>
		<a href={helpHref} onclick={closeMobile}>The Catechism</a>
		{#if data.profile?.is_current_top_dog}
			<a class="shell-nav-court" href={courtHref} onclick={closeMobile}>☩ The Tribunal</a>
		{/if}
		<a class="shell-upload btn-relic" href={dogsHref} onclick={closeMobile}>＋ Summon a Frank</a>
	</nav>
{/if}

{@render children()}

<style>
	/* The header is a gold-divided chrome bar at the top of every /snacktum-snacktorum
	   page. It spans the root .page-container's content column; the glow orb is pinned
	   behind it. All values reference theme tokens (no magic hex/px). */
	.shell-header {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-lg);
		padding-bottom: var(--space-md);
		margin-bottom: var(--space-xl);
		border-bottom: 1px solid var(--accent-divider);
		overflow: hidden;
	}

	/* Reuse the shared .glow-orb but pin it smaller, behind the header chrome. */
	.shell-glow {
		top: -220px;
		width: 420px;
		height: 300px;
		filter: blur(18px);
	}

	.shell-brand {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		flex: none;
		text-decoration: none;
	}

	.shell-brand:hover {
		color: inherit;
	}

	.shell-brand-mark {
		font-size: var(--text-xl);
		line-height: 1;
	}

	.shell-brand-text {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.shell-brand-title {
		font-family: var(--font-display);
		font-size: var(--text-label);
		font-weight: 600;
		letter-spacing: var(--tracking-eyebrow);
		text-transform: uppercase;
		color: var(--color-heading);
		white-space: nowrap;
	}

	.shell-brand-sub {
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 400;
		letter-spacing: var(--tracking-eyebrow);
		text-transform: uppercase;
		color: var(--accent);
		white-space: nowrap;
	}

	.shell-nav {
		display: flex;
		align-items: center;
	}

	.shell-nav-desktop {
		position: relative;
		z-index: 1;
		flex-wrap: wrap;
		gap: var(--space-sm) var(--space-lg);
	}

	.shell-nav a {
		font-family: var(--font-display);
		font-size: var(--text-label);
		font-weight: 600;
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: var(--color-text-muted);
		text-decoration: none;
		white-space: nowrap;
		padding: var(--space-2xs) 0;
	}

	.shell-nav a:hover {
		color: var(--color-heading);
	}

	/* The active route reads in the gold accent (in addition to aria-current, so
	   the cue is not color-alone for AT users). */
	.shell-nav a[aria-current='page'] {
		color: var(--accent);
	}

	.shell-nav-court {
		color: var(--accent);
	}

	.shell-actions {
		position: relative;
		z-index: 1;
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: var(--space-md);
		flex: none;
	}

	/* Trim the shared relic button down to a compact chrome control. */
	.shell-upload {
		padding: var(--space-sm) var(--space-lg);
	}

	/* The mobile ☰/✕ toggle — hidden on wide screens. */
	.shell-toggle {
		position: relative;
		z-index: 1;
		display: none;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-2xs);
		width: 2.75rem;
		height: 2.75rem;
		flex: none;
		background: none;
		border: 1px solid var(--accent-border);
		border-radius: var(--radius-control);
		cursor: pointer;
	}

	.shell-toggle-bar {
		width: 1.25rem;
		height: 2px;
		background: var(--accent);
	}

	.shell-toggle-x {
		font-family: var(--font-display);
		font-size: var(--text-xl);
		line-height: 1;
		color: var(--accent);
	}

	/* The stacked mobile nav — a vertical list shown when the toggle is open. */
	.shell-nav-mobile {
		flex-direction: column;
		align-items: stretch;
		gap: 0;
		margin-bottom: var(--space-xl);
		border: 1px solid var(--accent-plaque-border);
		border-radius: var(--radius-card);
		background: var(--accent-fill);
		box-shadow: var(--shadow-plaque);
		overflow: hidden;
	}

	.shell-nav-mobile a:not(.shell-upload) {
		padding: var(--space-md) var(--space-lg);
		border-bottom: 1px solid var(--accent-divider);
	}

	.shell-nav-mobile .shell-upload {
		margin: var(--space-md) var(--space-lg);
	}

	/* Responsive: collapse the desktop nav + inline upload into the toggle on
	   narrow viewports; the stacked .shell-nav-mobile takes over. */
	@media (max-width: 48rem) {
		.shell-nav-desktop,
		.shell-actions {
			display: none;
		}

		.shell-toggle {
			display: flex;
			margin-left: auto;
		}
	}

	/* The glow orb already disables its pulse under prefers-reduced-motion via
	   app.css; the .unroll scroll likewise. Nothing extra needed here. */
</style>
