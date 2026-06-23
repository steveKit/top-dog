<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import snacktumHeader from '$lib/assets/brand/snacktum-snacktorum-header.svg';
	import Sigil from '$lib/components/Sigil.svelte';
	import { parseSigilId } from '$lib/features/profiles/sigils';

	// The persistent app shell (TASK-080, rebuilt to the App Chrome design).
	// Wraps every /snacktum-snacktorum route with a header + a champion sub-bar +
	// navigation so no page is a dead end. It is presentational + navigation only:
	// it READS the { user, profile, champion } already surfaced by
	// +layout.server.ts and adds NO second crown query. The ☩ Tribunal link is
	// gated on the live, server-derived crown flag (decision #25) exactly as the
	// old hub nav did — the gate is driven by data.profile.is_current_top_dog from
	// the parent load, with no crown logic in this component.
	//
	// The brand is the wordmark IMAGE (snacktum-snacktorum-header.svg), a
	// deliberate override of the mockup's icon+text lockup. Copy uses the
	// finalized cult labels (Epistles / Summon a Frank), not the mockup's older
	// strings. NO code identifier is renamed — labels/copy only.

	let { data, children } = $props();

	// The signed-in member's own avatar, for the header (right side). A
	// `sigil:<id>` value renders inline as a <Sigil> (no storage fetch); a real
	// uploaded avatar would render from its public URL — but the layout load only
	// surfaces the profile (not a resolved avatar URL), and onboarding avatars are
	// sigils, so we render a sigil when present and fall back to the 🌭 mark.
	const viewerSigilId = $derived(parseSigilId(data.profile?.avatar_path));
	const viewerHandle = $derived(data.profile?.handle ?? '');
	const viewerDisplayName = $derived(data.profile?.display_name ?? '');
	// Is the viewer themselves the reigning champion? (Crown the header avatar.)
	const viewerIsChampion = $derived(data.profile?.is_current_top_dog === true);

	// The reigning champion (The Anointed Wiener) for the sub-bar. May be null
	// (throne empty) — the bar renders a neutral "the throne sits empty" line.
	const champion = $derived(data.champion);

	// Mobile nav (the "unrolled scroll") open/closed state. Collapsed by default;
	// the ☰ toggle reveals the stacked nav on narrow viewports.
	let mobileOpen = $state(false);

	// Active-route highlight: mark the nav link whose target prefixes the current
	// path. Derived from the live pathname so it follows client-side navigation.
	// `'page' | undefined` feeds aria-current directly (a falsy attr is omitted).
	type Current = 'page' | undefined;
	const onFeed = $derived<Current>(
		page.url.pathname.startsWith('/snacktum-snacktorum/procession') ? 'page' : undefined
	);
	const onDogs = $derived<Current>(
		page.url.pathname.startsWith('/snacktum-snacktorum/litter') ? 'page' : undefined
	);
	const onMessages = $derived<Current>(
		page.url.pathname.startsWith('/snacktum-snacktorum/epistles') ? 'page' : undefined
	);
	const onHelp = $derived<Current>(
		page.url.pathname.startsWith('/snacktum-snacktorum/help') ? 'page' : undefined
	);
	const onTribunal = $derived<Current>(
		page.url.pathname.startsWith('/snacktum-snacktorum/tribunal') ? 'page' : undefined
	);

	function closeMobile() {
		mobileOpen = false;
	}

	// Route ids resolved through the path alias (CLAUDE.md convention). Linking
	// directly at /snacktum-snacktorum/procession skips the `/` → procession redirect hop.
	// Upload routes to the hot-dog gallery (the upload form lives on
	// /snacktum-snacktorum/litter).
	const feedHref = resolve('/(protected)/snacktum-snacktorum/procession');
	const dogsHref = resolve('/(protected)/snacktum-snacktorum/litter');
	const messagesHref = resolve('/(protected)/snacktum-snacktorum/epistles');
	const helpHref = resolve('/(protected)/snacktum-snacktorum/help');
	const tribunalHref = resolve('/(protected)/snacktum-snacktorum/tribunal');
	// The champion's profile, resolved from their handle (when crowned).
	const championHref = $derived(
		champion
			? resolve('/(protected)/snacktum-snacktorum/shrine/[handle]', { handle: champion.handle })
			: feedHref
	);
</script>

<header class="shell-header">
	<div class="shell-glow glow-orb" aria-hidden="true"></div>

	<!-- The header background + bottom border are FULL-BLEED (the .shell-header
	     spans the viewport). This inner wrapper re-centers the brand/nav/actions at
	     --measure-shell (1600px) so the content aligns with the centered column. -->
	<div class="shell-inner">
		<a class="shell-brand" href={feedHref} onclick={closeMobile}>
			<img class="shell-brand-mark" src={snacktumHeader} alt="Snacktum Snacktorum" />
		</a>

		<nav class="shell-nav shell-nav-desktop" aria-label="Primary">
			<a href={feedHref} aria-current={onFeed}>The Procession</a>
			<a href={dogsHref} aria-current={onDogs}>Your Litter</a>
			<a href={messagesHref} aria-current={onMessages}>Epistles</a>
			<a href={helpHref} aria-current={onHelp}>The Catechism</a>
			<!-- The ☩ Tribunal of the Holy Tube is the current Top Dog's alone. Gated on
			     the live, non-client-writable crown flag (decision #25); the tribunal
			     route's own load + the DB RPC re-check it authoritatively. -->
			{#if data.profile?.is_current_top_dog}
				<a class="shell-nav-court" href={tribunalHref} aria-current={onTribunal}>☩ The Tribunal</a>
			{/if}
		</nav>

		<div class="shell-actions">
			<a class="shell-upload btn-relic" href={dogsHref} onclick={closeMobile}>＋ Summon a Frank</a>

			<span class="shell-actions-divider" aria-hidden="true"></span>

			<!-- The signed-in member's own sigil avatar; the champion gets the crown +
			     glow-ring treatment. A real link to their own profile. -->
			<a
				class="shell-avatar"
				class:is-champion={viewerIsChampion}
				href={resolve('/(protected)/snacktum-snacktorum/shrine/[handle]', {
					handle: viewerHandle
				})}
				onclick={closeMobile}
				aria-label="Your sanctum, {viewerDisplayName}"
			>
				{#if viewerIsChampion}
					<svg class="shell-avatar-crown" viewBox="0 0 24 16" aria-hidden="true">
						<path
							d="M2 14 L2 5 L7 9 L12 2 L17 9 L22 5 L22 14 Z"
							fill="var(--accent)"
							stroke="var(--color-bg)"
							stroke-width="1.2"
							stroke-linejoin="round"
						/>
					</svg>
				{/if}
				<span class="shell-avatar-disc">
					{#if viewerSigilId}
						<Sigil id={viewerSigilId} size={38} />
					{:else}
						<span class="shell-avatar-placeholder" aria-hidden="true">🌭</span>
					{/if}
				</span>
			</a>
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
	</div>
</header>

<!-- The champion sub-bar — the persistent banner under the header on every page.
     Announces The Anointed Wiener (current Top Dog): chevron crown + label +
     their sigil + @handle. Hidden gracefully when the throne sits empty. -->
<div class="shell-champion">
	<!-- The sub-bar band/background is FULL-BLEED like the header; this inner wrapper
	     re-centers its content at --measure-shell so it aligns with the header. -->
	<div class="shell-inner shell-champion-inner">
		<svg class="shell-champion-crown" viewBox="0 0 24 16" aria-hidden="true">
			<path
				d="M2 14 L2 5 L7 9 L12 2 L17 9 L22 5 L22 14 Z"
				fill="var(--accent)"
				stroke="var(--color-bg)"
				stroke-width="1.2"
				stroke-linejoin="round"
			/>
		</svg>
		<span class="shell-champion-label">The Anointed Wiener</span>
		{#if champion}
			<span class="shell-champion-divider" aria-hidden="true"></span>
			<span class="shell-champion-disc">
				{#if champion.sigilId}
					<Sigil id={champion.sigilId} size={20} />
				{:else if champion.avatarUrl}
					<img src={champion.avatarUrl} alt="" width="20" height="20" />
				{:else}
					<span class="shell-champion-placeholder" aria-hidden="true">🌭</span>
				{/if}
			</span>
			<a class="shell-champion-handle" href={championHref} onclick={closeMobile}>
				{champion.handle}
			</a>
			<span class="shell-champion-reign">reigning</span>
		{:else}
			<span class="shell-champion-divider" aria-hidden="true"></span>
			<span class="shell-champion-empty">the throne sits empty</span>
		{/if}
	</div>
</div>

{#if mobileOpen}
	<div id="shell-mobile-nav" class="shell-scroll unroll">
		<span class="shell-scroll-roller shell-scroll-roller-top" aria-hidden="true"></span>

		<nav class="shell-nav shell-nav-mobile" aria-label="Primary">
			<a href={feedHref} aria-current={onFeed} onclick={closeMobile}>The Procession</a>
			<a href={dogsHref} aria-current={onDogs} onclick={closeMobile}>Your Litter</a>
			<a href={messagesHref} aria-current={onMessages} onclick={closeMobile}>Epistles</a>
			<a href={helpHref} aria-current={onHelp} onclick={closeMobile}>The Catechism</a>
			{#if data.profile?.is_current_top_dog}
				<a
					class="shell-nav-court"
					href={tribunalHref}
					aria-current={onTribunal}
					onclick={closeMobile}>☩ The Tribunal</a
				>
			{/if}
		</nav>

		<div class="shell-scroll-foot">
			<a class="shell-upload btn-relic" href={dogsHref} onclick={closeMobile}>＋ Summon a Frank</a>

			<a
				class="shell-sanctum"
				class:is-champion={viewerIsChampion}
				href={resolve('/(protected)/snacktum-snacktorum/shrine/[handle]', {
					handle: viewerHandle
				})}
				onclick={closeMobile}
			>
				<span class="shell-sanctum-disc">
					{#if viewerIsChampion}
						<svg class="shell-avatar-crown" viewBox="0 0 24 16" aria-hidden="true">
							<path
								d="M2 14 L2 5 L7 9 L12 2 L17 9 L22 5 L22 14 Z"
								fill="var(--accent)"
								stroke="var(--surface-temple)"
								stroke-width="1.2"
								stroke-linejoin="round"
							/>
						</svg>
					{/if}
					{#if viewerSigilId}
						<Sigil id={viewerSigilId} size={36} />
					{:else}
						<span class="shell-avatar-placeholder" aria-hidden="true">🌭</span>
					{/if}
				</span>
				<span class="shell-sanctum-text">
					<span class="shell-sanctum-label">
						{viewerIsChampion ? 'The Anointed Wiener' : 'Your sanctum'}
					</span>
					<span class="shell-sanctum-handle">{viewerDisplayName}</span>
				</span>
			</a>
		</div>

		<span class="shell-scroll-roller shell-scroll-roller-bottom" aria-hidden="true"></span>
	</div>
{/if}

<div class="shell-content">
	{@render children()}
</div>

<style>
	/* The header is a FULL-BLEED gold-divided chrome bar at the top of every
	   /snacktum-snacktorum page. The .page-container goes full width + zero padding
	   via the :has(.shell-header) rule in app.css, so this bar's background + bottom
	   border reach the viewport edges; the glow orb is pinned behind it. The flex
	   layout of brand/nav/actions lives on the inner wrapper, which re-centers them
	   at --measure-shell. All values reference theme tokens. */
	.shell-header {
		position: relative;
		border-bottom: 1px solid var(--accent-divider);
		overflow: hidden;
	}

	/* The centered inner content column shared by the header and champion sub-bar.
	   Caps the content at --measure-shell (1600px) and centers it, with a horizontal
	   gutter so content never kisses the viewport edge. The header's flex layout
	   (brand · nav · actions) lives here; the champion bar tunes its own gutter via
	   .shell-champion-inner. */
	.shell-inner {
		display: flex;
		align-items: center;
		gap: var(--space-lg);
		width: 100%;
		max-width: var(--measure-shell);
		margin-inline: auto;
		padding: var(--space-xl) var(--space-lg) var(--space-md);
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

	/* The brand wordmark image — sized by HEIGHT (width: auto) so it scales
	   proportionally and sits within the wider header chrome. */
	.shell-brand-mark {
		display: block;
		height: 3rem;
		width: auto;
	}

	.shell-nav {
		display: flex;
		align-items: center;
	}

	.shell-nav-desktop {
		position: relative;
		z-index: 1;
		flex: 1;
		justify-content: center;
		flex-wrap: wrap;
		gap: var(--space-sm) var(--space-lg);
	}

	.shell-nav a {
		position: relative;
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

	/* The active route reads in the accent AND carries a 2px underline bar beneath
	   (the mockup's bottom:-7px bar) — so the active cue is never color-alone for
	   AT users (it also keeps aria-current="page"). The desktop bar hangs below
	   the link; the mobile stacked nav inverts it (see .shell-nav-mobile). */
	.shell-nav a[aria-current='page'] {
		color: var(--accent);
	}

	.shell-nav-desktop a[aria-current='page']::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: -7px;
		height: 2px;
		background: var(--accent);
	}

	.shell-nav-court {
		color: var(--accent);
	}

	.shell-actions {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		gap: var(--space-md);
		flex: none;
	}

	/* Trim the shared relic button down to a compact chrome control. */
	.shell-upload {
		padding: var(--space-sm) var(--space-lg);
	}

	.shell-actions-divider {
		width: 1px;
		height: 1.875rem;
		background: var(--accent-border);
	}

	/* The signed-in member's avatar — a sigil disc in a thin accent ring on the
	   right of the header. The champion variant gets a thicker ring, a soft glow
	   halo, and a chevron crown perched on top. */
	.shell-avatar {
		position: relative;
		display: block;
		flex: none;
		line-height: 0;
		border-radius: var(--radius-pill);
		text-decoration: none;
	}

	.shell-avatar-disc {
		display: block;
		width: 2.625rem;
		height: 2.625rem;
		border-radius: var(--radius-pill);
		overflow: hidden;
		border: 1.5px solid var(--accent);
		background: var(--color-bg-lift);
	}

	.shell-avatar.is-champion .shell-avatar-disc {
		border-width: 2px;
		box-shadow: 0 0 0 3px var(--accent-fill-strong);
	}

	.shell-avatar-crown {
		position: absolute;
		top: -11px;
		left: 50%;
		transform: translateX(-50%);
		width: 1.375rem;
		height: 0.9375rem;
		z-index: 2;
	}

	.shell-avatar-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		font-size: var(--text-lg);
		line-height: 1;
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

	/* The champion sub-bar — the persistent banner under the header. A FULL-BLEED
	   gold-on-dark band naming The Anointed Wiener; its background + bottom border
	   span the viewport while its content re-centers at --measure-shell via
	   .shell-champion-inner. */
	.shell-champion {
		position: relative;
		z-index: 2;
		margin-bottom: var(--space-xl);
		background: linear-gradient(var(--color-bg-mid), var(--color-bg-deep));
		border-bottom: 1px solid var(--accent-soft);
	}

	/* The champion bar's centered content row: override the shared .shell-inner
	   layout (which is sized for the header) with the sub-bar's own centered, wrap,
	   tighter-gap strip and its compact vertical padding. */
	.shell-champion-inner {
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-sm);
		padding: var(--space-xs) var(--space-lg);
	}

	.shell-champion-crown {
		width: 1.0625rem;
		height: 0.6875rem;
		flex: none;
	}

	.shell-champion-label {
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 600;
		letter-spacing: var(--tracking-eyebrow);
		text-transform: uppercase;
		color: var(--accent);
		white-space: nowrap;
	}

	.shell-champion-divider {
		width: 1px;
		height: 0.9375rem;
		background: var(--accent-soft);
	}

	.shell-champion-disc {
		display: block;
		width: 1.375rem;
		height: 1.375rem;
		border-radius: var(--radius-pill);
		overflow: hidden;
		border: 1px solid var(--accent);
		flex: none;
		line-height: 0;
	}

	.shell-champion-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		font-size: var(--text-label);
		line-height: 1;
	}

	.shell-champion-handle {
		font-family: var(--font-display);
		font-size: var(--text-label);
		font-weight: 600;
		letter-spacing: var(--tracking-tight);
		color: var(--color-heading);
		text-decoration: none;
		white-space: nowrap;
	}

	.shell-champion-handle:hover {
		color: var(--accent);
	}

	.shell-champion-reign,
	.shell-champion-empty {
		font-family: var(--font-body);
		font-style: italic;
		font-size: var(--text-sm);
		color: var(--accent-strong);
		white-space: nowrap;
	}

	.shell-champion-empty {
		color: var(--color-text-faint);
	}

	/* The mobile "unrolled scroll" — a gold-rollered parchment panel that drops
	   under the champion sub-bar when the ☰ toggle opens. Holds the stacked nav,
	   the ＋ action, and the viewer's sanctum footer. */
	.shell-scroll {
		position: relative;
		z-index: 1;
		/* The container is now full-bleed (no horizontal padding); the scroll panel
		   (mobile only) carries its own horizontal gutter so it doesn't span the
		   viewport edge-to-edge, and re-caps at --measure-shell on wider widths. */
		max-width: var(--measure-shell);
		margin: 0 var(--space-lg) var(--space-xl);
		border: 1px solid var(--accent-plaque-border);
		border-radius: var(--radius-card);
		background: var(--color-bg-lift);
		box-shadow: var(--shadow-plaque);
		overflow: hidden;
	}

	/* The gold roller bars top + bottom (the "scroll" rods). */
	.shell-scroll-roller {
		display: block;
		height: 0.6875rem;
		background: linear-gradient(var(--accent), var(--accent-dim));
	}

	.shell-scroll-roller-top {
		box-shadow: inset 0 -2px 3px rgba(0, 0, 0, 0.3);
	}

	.shell-scroll-roller-bottom {
		background: linear-gradient(var(--accent-dim), var(--accent));
		box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.3);
	}

	/* The stacked mobile nav — a vertical list of rows inside the scroll. */
	.shell-nav-mobile {
		flex-direction: column;
		align-items: stretch;
		gap: 0;
		padding: var(--space-2xs) 0;
	}

	.shell-nav-mobile a {
		padding: var(--space-md) var(--space-lg);
		border-bottom: 1px solid var(--accent-divider);
		color: var(--color-text);
	}

	.shell-nav-mobile a:last-child {
		border-bottom: none;
	}

	.shell-nav-mobile a:hover {
		color: var(--accent);
	}

	/* The active row in the stacked nav: accent text + a left accent bar (the
	   non-color cue, since the desktop underline doesn't fit a stacked row). */
	.shell-nav-mobile a[aria-current='page'] {
		color: var(--accent);
		box-shadow: inset 3px 0 0 var(--accent);
	}

	.shell-scroll-foot {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		padding: var(--space-sm) var(--space-lg) var(--space-lg);
	}

	.shell-scroll-foot .shell-upload {
		width: 100%;
	}

	/* The viewer's sanctum footer in the unrolled scroll: sigil + handle, with the
	   champion crown treatment when the viewer reigns. */
	.shell-sanctum {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding-top: var(--space-md);
		border-top: 1px solid var(--accent-divider);
		text-decoration: none;
	}

	.shell-sanctum-disc {
		position: relative;
		display: block;
		width: 2.375rem;
		height: 2.375rem;
		border-radius: var(--radius-pill);
		overflow: visible;
		flex: none;
		line-height: 0;
	}

	.shell-sanctum-disc :global(.sigil) {
		border-radius: var(--radius-pill);
		border: 1.5px solid var(--accent);
	}

	.shell-sanctum.is-champion .shell-sanctum-disc :global(.sigil) {
		border-width: 2px;
		box-shadow: 0 0 0 2px var(--accent-fill-strong);
	}

	.shell-sanctum-text {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.shell-sanctum-label {
		font-family: var(--font-display);
		font-size: var(--text-label);
		font-weight: 600;
		letter-spacing: var(--tracking-tight);
		color: var(--color-heading);
		text-transform: uppercase;
	}

	.shell-sanctum.is-champion .shell-sanctum-label {
		color: var(--accent);
	}

	.shell-sanctum-handle {
		font-family: var(--font-body);
		font-style: italic;
		font-size: var(--text-sm);
		color: var(--color-text-faint);
	}

	/* Page content stays at the reading measure even though the chrome spans the full
	   viewport; centered under the full-bleed chrome bars. The container no longer
	   supplies a horizontal gutter (it's full-bleed for the chrome), so the content
	   column adds its own padding so it never touches the viewport edges on narrow
	   screens. box-sizing keeps the padding inside the --measure-content cap. */
	.shell-content {
		box-sizing: border-box;
		width: 100%;
		max-width: var(--measure-content);
		margin-inline: auto;
		padding-inline: var(--space-lg);
	}

	/* Responsive: collapse the desktop nav + inline actions into the toggle on
	   narrow viewports; the unrolled scroll takes over. */
	@media (max-width: 48rem) {
		.shell-nav-desktop,
		.shell-actions {
			display: none;
		}

		.shell-toggle {
			display: flex;
			margin-left: auto;
		}

		/* Shrink the wordmark a touch on narrow viewports so it sits comfortably
		   beside the ☰ toggle without crowding it. */
		.shell-brand-mark {
			height: 2.25rem;
		}
	}

	/* The glow orb disables its pulse under prefers-reduced-motion via app.css;
	   the .unroll scroll likewise. Nothing extra needed here. */
</style>
