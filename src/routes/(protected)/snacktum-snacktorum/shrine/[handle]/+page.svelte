<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import TopDogBadge from '$lib/components/TopDogBadge.svelte';
	import ProfilePoliceBanner from '$lib/components/ProfilePoliceBanner.svelte';
	import Sigil from '$lib/components/Sigil.svelte';
	import { mustardOpacity } from '$lib/features/mustard/decay';
	import { renderWallBody } from '$lib/features/emoji/render';
	import { createFormValidation } from '$lib/features/forms/formValidation.svelte';
	import { errorSlideFade } from '$lib/motion/reducedMotion';

	// The Shrine (profile) — rebuilt from design/pages/The Shrine.dc.html (M8
	// TASK-093). A display-name-forward temple profile. This is a RE-SKIN of the
	// unchanged profile data flow: +page.server.ts (load + spray/post/deleteMessage
	// actions) is preserved, every wiring re-connected. The mockup's header /
	// Anointed-Wiener chrome ribbon belong to the persistent app shell
	// (+layout.svelte) and are NOT re-rendered here; this page owns the shrine hero
	// (sigil ring + Anoint splat surface), the display-name header, the stat ledger,
	// the Reliquary shelf slot (TASK-094-R fills it), and the wall.

	let { data, form } = $props();

	const profile = $derived(data.profile);
	const avatarUrl = $derived(data.avatarUrl);
	// A built-in sigil avatar (chosen in the onboarding rite) renders inline; a real
	// uploaded avatar renders from its public storage URL.
	const sigilId = $derived(data.sigilId);
	const sprays = $derived(data.sprays);
	const canSpray = $derived(data.canSpray);
	const wallMessages = $derived(data.wallMessages);
	const viewerId = $derived(data.viewerId);
	const isWallOwner = $derived(data.isWallOwner);
	// 🍔 Hamburger Court brands (TASK-073): the decaying FALSE WITNESS brand summary
	// and the persistent HERETIC flag, both computed server-side at render time.
	const liarBrand = $derived(data.liarBrand);
	const isHeretic = $derived(data.isHeretic);
	// Derived stat ledger (TASK-093) — read-only aggregates assembled in the load.
	const stats = $derived(data.stats);

	// Display-name-forward: the human name is the header; @handle is the URL-safe
	// id beneath. Fall back to @handle when display name is blank.
	const displayName = $derived(
		profile.display_name && profile.display_name.trim().length > 0
			? profile.display_name
			: `@${profile.handle}`
	);

	// Friendly "sworn since" date from the stored join timestamp.
	const swornDate = $derived(
		new Date(profile.joined_at).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		})
	);

	// Whether this member currently reigns (drives the champion badge + the
	// "currently reigning" note under the days-anointed plaque).
	const reigns = $derived(profile.is_current_top_dog === true);

	// Locale-formatted ledger numbers (the mockup shows thousands separators).
	const fmt = (n: number): string => n.toLocaleString(undefined);

	// Render-time friendly timestamp for a wall message.
	function formatMessageDate(iso: string): string {
		return new Date(iso).toLocaleString(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		});
	}

	// ----- Wall composer (form-validation CANON) -------------------------------
	// Bound to the post box; cleared after a successful post.
	let wallBody = $state('');
	let posting = $state(false);
	const validation = createFormValidation();

	const submitWallPost = validation.enhance(() => {
		posting = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			wallBody = '';
			posting = false;
			await invalidateAll();
		};
	});

	const submitWallDelete = () => {
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			await invalidateAll();
		};
	};

	// ----- Anoint (mustard) splat surface --------------------------------------
	// The mustard overlay container; click positions are computed relative to its
	// bounding rect so stored x/y are layout-robust fractions in [0,1].
	let sprayArea = $state<HTMLElement | null>(null);
	// Pending click position, written into the hidden form inputs before submit.
	let pendingX = $state(0);
	let pendingY = $state(0);
	let isSpraying = $state(false);
	// The form element, submitted programmatically after a click sets x/y.
	let sprayForm = $state<HTMLFormElement | null>(null);

	// Capture the click position as relative fractions of the spray area, then
	// submit the spray form. Only wired when canSpray is true.
	function onSprayAreaClick(event: MouseEvent) {
		if (!canSpray || !sprayArea || !sprayForm) return;
		const rect = sprayArea.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return;
		// Clamp into [0,1] against rounding at the edges.
		pendingX = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
		pendingY = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
		sprayForm.requestSubmit();
	}

	const submitSpray = () => {
		isSpraying = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			isSpraying = false;
			// Refresh so the new spray (and any decay) renders immediately.
			await invalidateAll();
		};
	};
</script>

<main class="shrine">
	<div class="glow-orb" aria-hidden="true"></div>

	{#if form?.message}
		<p class="shrine-error" role="alert">{form.message}</p>
	{/if}

	<!-- ===== SHRINE HERO ===== -->
	<!--
		The spray area wraps the sigil avatar so the current Top Dog (The Anointed
		Wiener) can Anoint the disciple anywhere on the shrine head. When canSpray, a
		transparent overlay <button> captures the click (computing a relative x,y and
		submitting the spray form); otherwise the area is a plain wrapper. The Anoint
		splat visual itself is TASK-094 — this lays out the overlay surface and keeps
		the canSpray gate (decision #25) intact.
	-->
	<div class="shrine-hero fade-up">
		<div class="shrine-disc" bind:this={sprayArea}>
			{#if sigilId}
				<Sigil id={sigilId} size={200} title="{displayName}'s sigil" />
			{:else if avatarUrl}
				<img class="shrine-avatar-img" src={avatarUrl} alt="{displayName}'s avatar" />
			{:else}
				<div class="shrine-avatar-placeholder" aria-hidden="true">🌭</div>
			{/if}

			<!-- Anoint overlay: one decaying splotch per spray (decision #15 — opacity
			     computed at render time from sprayed_at via mustardOpacity). The full
			     splat re-theme is TASK-094; this is the tokenized base surface. -->
			<div class="anoint-layer" aria-hidden="true">
				{#each sprays as spray (spray.id)}
					<span
						class="anoint-splat"
						style:left="{spray.x * 100}%"
						style:top="{spray.y * 100}%"
						style:opacity={mustardOpacity(spray.sprayed_at, Date.now())}
					></span>
				{/each}
			</div>

			{#if canSpray}
				<!-- Transparent click target over the whole disc. A real <button> gives
				     keyboard + screen-reader support for free; the click handler reads the
				     pointer position relative to .shrine-disc to derive x/y in [0,1]. -->
				<button
					type="button"
					class="anoint-target"
					aria-label="Anoint this disciple"
					onclick={onSprayAreaClick}
				></button>
			{/if}

			<!-- 🍔 Hamburger Court brands (TASK-073). HERETIC is persistent (any owned
			     dog confirmed a hamburger); FALSE WITNESS decays over ~7 days (opacity
			     from the brand summary). Both are render-time, ranking-inert
			     police-tape strips slapped across the shrine head. The code identifier /
			     symbols stay; only the displayed label is the finalized "FALSE WITNESS". -->
			{#if isHeretic}
				<ProfilePoliceBanner label="HERETIC" seed={`${profile.id}:HERETIC`} />
			{/if}
			{#if liarBrand.active}
				<ProfilePoliceBanner
					label="FALSE WITNESS"
					seed={`${profile.id}:LIAR`}
					opacity={liarBrand.intensity}
				/>
			{/if}
		</div>

		{#if reigns}
			<div class="shrine-champion-badge">
				<TopDogBadge label="The Anointed Wiener" />
			</div>
		{/if}
	</div>

	{#if canSpray}
		<p class="anoint-hint">
			Thou art The Anointed Wiener — touch the sigil to anoint this disciple in mustard.
		</p>
		<form method="POST" action="?/spray" bind:this={sprayForm} use:enhance={submitSpray}>
			<input type="hidden" name="x" value={pendingX} />
			<input type="hidden" name="y" value={pendingY} />
			{#if isSpraying}<span class="anoint-status" aria-live="polite">Anointing…</span>{/if}
		</form>
	{/if}

	<h1 class="shrine-name">{displayName}</h1>
	<p class="shrine-handle">@{profile.handle}</p>
	<p class="shrine-sworn">Sworn since {swornDate}</p>

	<!--
		Send an Epistle (TASK-051): the conversation-initiation affordance for direct
		messages, shown only when viewing ANOTHER member's shrine (reusing isWallOwner —
		owner of the wall === the viewer themselves). Links to the DM thread route.
	-->
	{#if !isWallOwner}
		<a
			class="shrine-epistle btn-relic"
			href={resolve('/(protected)/snacktum-snacktorum/messages/[handle]', {
				handle: profile.handle
			})}
		>
			Send an Epistle <span aria-hidden="true">→</span>
		</a>
	{/if}

	<!-- ===== STAT LEDGER ===== -->
	<!-- The marquee plaque: Days as The Anointed Wiener (profile.days_as_top_dog). -->
	<div class="ledger-feature">
		<span class="ledger-feature-num">{fmt(profile.days_as_top_dog)}</span>
		<span class="ledger-feature-label">Days as The Anointed Wiener</span>
		{#if reigns}
			<span class="ledger-feature-note">· currently reigning ·</span>
		{/if}
	</div>

	<!-- The derived ledger grid — every value a read-only aggregate (TASK-093). The
	     reporter side is NEVER surfaced (decision #27): only consequences BORNE
	     (HERETIC / FALSE WITNESS / anointings received) appear. -->
	<dl class="ledger">
		<div class="ledger-cell">
			<dt class="ledger-num">{fmt(stats.timesCrowned)}</dt>
			<dd class="ledger-label">Times Crowned</dd>
		</div>
		<div class="ledger-cell">
			<dt class="ledger-num">{fmt(stats.franksOffered)}</dt>
			<dd class="ledger-label">Franks Offered</dd>
		</div>
		<div class="ledger-cell">
			<dt class="ledger-num">{fmt(stats.totalDevotion)}</dt>
			<dd class="ledger-label">Total Devotion</dd>
		</div>
		<div class="ledger-cell">
			<dt class="ledger-num">{fmt(stats.highestBlessing)}</dt>
			<dd class="ledger-label">Highest Blessing</dd>
		</div>
		<div class="ledger-cell">
			<dt class="ledger-num">{fmt(stats.disciplesSummoned)}</dt>
			<dd class="ledger-label">Disciples Summoned</dd>
		</div>
		<div class="ledger-cell">
			<dt class="ledger-num">{fmt(stats.anointingsReceived)}</dt>
			<dd class="ledger-label">Anointings Received</dd>
		</div>
		<div class="ledger-cell ledger-cell-wide">
			<dt class="ledger-num">{fmt(stats.reactionsReceived)}</dt>
			<dd class="ledger-label">Reactions Received</dd>
		</div>

		{#if isHeretic}
			<div class="ledger-mark ledger-cell-wide" role="status">
				<span class="ledger-mark-tag">⚠ Heretic</span>
				<span class="ledger-mark-text">Marked by the Tribunal — confirmed hamburger.</span>
			</div>
		{/if}
		{#if liarBrand.active}
			<div class="ledger-mark ledger-cell-wide" role="status">
				<span class="ledger-mark-tag">✕ False Witness</span>
				<span class="ledger-mark-text">Bore false witness — the mark shall fade in time.</span>
			</div>
		{/if}
	</dl>

	<!-- ===== RELIQUARY SHELF SLOT ===== -->
	<!-- TASK-094-R owns the derived badge module (src/lib/features/badges/) + the
	     Reliquary.svelte shelf component. This lays out the SECTION/SHELF SLOT per the
	     design and leaves a clearly-marked placeholder until that lands (soft-coupled:
	     neither task hard-blocks the other). Do NOT build the badge module here. -->
	<section class="reliquary" aria-label="The Reliquary">
		<header class="reliquary-head">
			<span class="reliquary-eyebrow">Honors of the Order</span>
			<h2 class="section-heading">The Reliquary</h2>
		</header>
		<!-- TASK-094-R: replace this placeholder with <Reliquary {badges} />. -->
		<div class="reliquary-placeholder">
			<p>The Reliquary shelf is consecrated soon — its relics shall be revealed.</p>
		</div>
	</section>

	<div class="ornament-divider" aria-hidden="true">✦</div>

	<!-- ===== MESSAGE WALL ===== -->
	<!--
		Message wall (TASK-050). Any member may post a text message on this wall; the
		post box always shows, now with the form-validation CANON on the body field.
		Each message shows its author and timestamp, with a delete affordance only for
		the message's author or the wall owner (mirrors the authoritative RLS DELETE
		policy). The stored body is never mutated (decision #16); the M6 emoji library
		is applied at RENDER time via renderWallBody (filter + seeded sprinkle keyed on
		the immutable message id).
	-->
	<section class="wall" aria-label="Message wall">
		<h2 class="section-heading">Words Upon the Shrine</h2>

		<form method="POST" action="?/post" novalidate use:enhance={submitWallPost} class="wall-post">
			<label class="wall-post-label" for="wall-body">
				<span class="field-label">Word upon the Shrine</span>
				<span class="wall-post-hint">Leave word upon {displayName}'s shrine</span>
			</label>
			<textarea
				id="wall-body"
				name="body"
				rows="3"
				maxlength="1000"
				required
				bind:value={wallBody}
				placeholder="Speak thy blessing, thy challenge, or thy praise…"
				aria-invalid={validation.invalid('body')}
				aria-describedby={validation.describedBy('body')}
				oninput={validation.clearOnInput}
			></textarea>
			{#if validation.errors.body}
				<p
					class="field-error"
					role="alert"
					id={validation.errorId('body')}
					transition:errorSlideFade
				>
					{validation.errors.body}
				</p>
			{/if}
			<div class="wall-post-actions">
				<button type="submit" class="wall-post-btn" disabled={posting}>
					{posting ? 'Posting…' : 'Post Word →'}
				</button>
			</div>
		</form>

		{#if wallMessages.length === 0}
			<div class="wall-empty">
				<p>No word yet upon this shrine — be the first of the Faithful.</p>
			</div>
		{:else}
			<ul class="wall-messages">
				{#each wallMessages as message (message.id)}
					<li class="wall-message fade-up">
						<div class="wall-message-head">
							<div class="wall-message-meta">
								<a
									class="wall-message-author"
									href={resolve('/(protected)/snacktum-snacktorum/shrine/[handle]', {
										handle: message.author_handle
									})}>@{message.author_handle}</a
								>
								<span class="wall-message-date">{formatMessageDate(message.created_at)}</span>
							</div>
							{#if message.author_id === viewerId || isWallOwner}
								<form method="POST" action="?/deleteMessage" use:enhance={submitWallDelete}>
									<input type="hidden" name="messageId" value={message.id} />
									<button type="submit" class="wall-message-delete">Delete</button>
								</form>
							{/if}
						</div>
						<p class="wall-message-body">{renderWallBody(message.body, message.id)}</p>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</main>

<style>
	/* The Shrine is a centered temple column. It self-caps at --measure-content so it
	   does not sprawl to the viewport edge under the full-bleed app shell. All values
	   reference theme tokens (no magic hex/px); the gold accent themes via [data-accent]. */
	.shrine {
		position: relative;
		max-width: var(--measure-content);
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding-bottom: var(--space-3xl);
	}

	.shrine .glow-orb {
		top: -200px;
	}

	.shrine-error {
		width: 100%;
		margin: 0 0 var(--space-lg);
		text-align: center;
	}

	/* ===== Hero ===== */
	.shrine-hero {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 13.75rem;
		height: 13.75rem;
		margin-top: var(--space-2xl);
	}

	/* The sigil disc in a gold ring, per the Shrine design. The Anoint surface +
	   police-tape brands are positioned within it. */
	.shrine-disc {
		position: relative;
		width: 12.5rem;
		height: 12.5rem;
		border-radius: var(--radius-pill);
		overflow: hidden;
		border: 3px solid var(--accent);
		background: var(--color-bg-deep);
		box-shadow:
			0 0 0 8px var(--accent-fill),
			var(--shadow-plaque);
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 0;
	}

	.shrine-avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.shrine-avatar-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		font-size: 5rem;
		background: var(--accent-fill);
		line-height: 1;
	}

	/* The Anoint splat overlay — one decaying gold splotch per spray (decision #15).
	   The full splat visual is TASK-094; this is the tokenized base. */
	.anoint-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.anoint-splat {
		position: absolute;
		width: 2.75rem;
		height: 2.75rem;
		transform: translate(-50%, -50%);
		border-radius: var(--radius-pill);
		background: radial-gradient(
			circle,
			var(--mustard-splat) 0%,
			var(--accent-fill-strong) 45%,
			transparent 72%
		);
		filter: blur(1.5px);
	}

	.anoint-target {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: crosshair;
		border-radius: var(--radius-pill);
	}

	/* The champion crest perched atop the hero disc when this member reigns. */
	.shrine-champion-badge {
		position: absolute;
		top: -0.875rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 5;
	}

	.anoint-hint {
		max-width: 26rem;
		margin: var(--space-md) 0 0;
		font-style: italic;
		font-size: var(--text-lg);
		color: var(--accent-strong);
	}

	.anoint-status {
		display: block;
		margin-top: var(--space-xs);
		font-style: italic;
		color: var(--color-text-muted);
	}

	/* ===== Header (display-name-forward) ===== */
	.shrine-name {
		margin: var(--space-xl) 0 0;
	}

	.shrine-handle {
		margin: var(--space-xs) 0 0;
		font-family: var(--font-body);
		font-style: italic;
		font-size: var(--text-lg);
		color: var(--color-text-muted);
	}

	.shrine-sworn {
		margin: var(--space-sm) 0 0;
		font-family: var(--font-body);
		color: var(--accent-strong);
	}

	.shrine-epistle {
		margin-top: var(--space-lg);
	}

	/* ===== Stat ledger ===== */
	.ledger-feature {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2xs);
		margin-top: var(--space-2xl);
		padding: var(--space-lg) var(--space-2xl);
		border: 1px solid var(--accent-plaque-border);
		border-radius: var(--radius-card);
		background: var(--accent-fill);
	}

	.ledger-feature-num {
		font-family: var(--font-display);
		font-size: var(--text-h1);
		font-weight: 700;
		line-height: 1;
		color: var(--accent);
		text-shadow: var(--text-shadow-hero);
	}

	.ledger-feature-label {
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 600;
		letter-spacing: var(--tracking-eyebrow);
		text-transform: uppercase;
		color: var(--color-text-muted);
	}

	.ledger-feature-note {
		margin-top: var(--space-2xs);
		font-family: var(--font-body);
		font-style: italic;
		color: var(--accent-strong);
	}

	/* The 2-up ledger grid — gold-hairline-divided plaque cells. */
	.ledger {
		width: 100%;
		max-width: 37.5rem;
		margin: var(--space-lg) 0 0;
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1px;
		background: var(--accent-soft);
		border: 1px solid var(--accent-plaque-border);
		border-radius: var(--radius-card);
		overflow: hidden;
	}

	.ledger-cell {
		margin: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2xs);
		padding: var(--space-lg) var(--space-md);
		background: var(--color-bg-mid);
		text-align: center;
	}

	.ledger-cell-wide {
		grid-column: 1 / -1;
	}

	.ledger-num {
		font-family: var(--font-display);
		font-size: var(--text-xl);
		font-weight: 700;
		color: var(--accent);
	}

	.ledger-label {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 600;
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: var(--color-text-muted);
	}

	/* Borne-consequence marks (HERETIC / FALSE WITNESS) at the foot of the ledger. */
	.ledger-mark {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		padding: var(--space-md);
		background: var(--color-bg-deep);
		text-align: center;
	}

	.ledger-mark-tag {
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 700;
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: var(--color-error);
		border: 1px solid var(--color-error);
		border-radius: var(--radius-control);
		padding: var(--space-2xs) var(--space-sm);
	}

	.ledger-mark-text {
		font-family: var(--font-body);
		font-style: italic;
		color: var(--color-error);
	}

	/* ===== Reliquary shelf slot (TASK-094-R fills it) ===== */
	.reliquary {
		width: 100%;
		max-width: 37.5rem;
		margin-top: var(--space-2xl);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-md);
	}

	.reliquary-head {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2xs);
	}

	.reliquary-eyebrow {
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 600;
		letter-spacing: var(--tracking-eyebrow);
		text-transform: uppercase;
		color: var(--accent);
	}

	.reliquary-placeholder {
		width: 100%;
		padding: var(--space-2xl) var(--space-lg);
		border: 1px dashed var(--accent-border);
		border-radius: var(--radius-card);
		background: var(--accent-fill);
		text-align: center;
	}

	.reliquary-placeholder p {
		margin: 0;
		font-style: italic;
		color: var(--color-text-muted);
	}

	/* Shared section heading (Cinzel, gold, spaced caps) — reused by the Reliquary
	   and the wall. */
	.section-heading {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--text-h2);
		font-weight: 600;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--accent);
		text-align: center;
	}

	.ornament-divider {
		margin: var(--space-2xl) 0;
	}

	/* ===== Message wall ===== */
	.wall {
		width: 100%;
		max-width: 37.5rem;
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.wall-post {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.wall-post-label {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		text-align: left;
	}

	.wall-post-label .field-label {
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 600;
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: var(--accent-strong);
	}

	.wall-post-hint {
		font-family: var(--font-body);
		font-style: italic;
		font-size: var(--text-sm);
		color: var(--color-text-faint);
	}

	.wall-post textarea {
		width: 100%;
		min-height: 6rem;
		resize: vertical;
		background: var(--accent-fill);
		border: 1px solid var(--accent-border);
		border-bottom: 1.5px solid var(--accent);
		border-radius: var(--radius-control);
		padding: var(--space-sm) var(--space-md);
		color: var(--color-text);
		font-family: var(--font-body);
		font-size: var(--text-base);
	}

	.wall-post textarea:focus {
		background: var(--accent-fill-strong);
	}

	.wall-post-actions {
		display: flex;
		justify-content: flex-end;
	}

	.wall-post-btn {
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

	.wall-post-btn:hover:not(:disabled) {
		filter: brightness(1.08);
	}

	.wall-post-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.wall-empty {
		padding: var(--space-2xl) var(--space-lg);
		border: 1px dashed var(--accent-border);
		border-radius: var(--radius-card);
		background: var(--accent-fill);
		text-align: center;
	}

	.wall-empty p {
		margin: 0;
		font-style: italic;
		font-size: var(--text-lg);
		color: var(--color-text-muted);
	}

	.wall-messages {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		text-align: left;
	}

	.wall-message {
		padding: var(--space-md) var(--space-lg);
		border: 1px solid var(--accent-plaque-border);
		background: var(--color-bg-mid);
		border-radius: var(--radius-card);
	}

	.wall-message-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-md);
		margin-bottom: var(--space-xs);
	}

	.wall-message-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-sm);
		min-width: 0;
	}

	.wall-message-author {
		font-family: var(--font-display);
		font-size: var(--text-sm);
		font-weight: 600;
		letter-spacing: var(--tracking-tight);
		color: var(--accent);
		text-decoration: none;
		white-space: nowrap;
	}

	.wall-message-author:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.wall-message-date {
		font-family: var(--font-body);
		font-style: italic;
		font-size: var(--text-sm);
		color: var(--color-text-faint);
		white-space: nowrap;
	}

	.wall-message-body {
		margin: 0;
		color: var(--color-text-muted);
	}

	.wall-message-delete {
		flex: none;
		background: none;
		border: none;
		padding: 0;
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: var(--color-text-faint);
		cursor: pointer;
	}

	.wall-message-delete:hover {
		color: var(--color-error);
	}

	/* Responsive: shrink the hero on narrow viewports. */
	@media (max-width: 36rem) {
		.shrine-hero {
			width: 11rem;
			height: 11rem;
		}

		.shrine-disc {
			width: 10rem;
			height: 10rem;
		}
	}
</style>
