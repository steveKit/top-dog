<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import TopDogBadge from '$lib/components/TopDogBadge.svelte';
	import ProfilePoliceBanner from '$lib/components/ProfilePoliceBanner.svelte';
	import Sigil from '$lib/components/Sigil.svelte';
	import { mustardOpacity } from '$lib/features/mustard/decay';
	import { renderWallBody } from '$lib/features/emoji/render';

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
	// 🍔 Hamburger Court brands (TASK-073): the decaying LIAR brand summary and the
	// persistent HERETIC flag, both computed server-side at render time.
	const liarBrand = $derived(data.liarBrand);
	const isHeretic = $derived(data.isHeretic);

	// Bound to the post box; cleared after a successful post.
	let wallBody = $state('');

	// Render-time friendly timestamp for a wall message.
	function formatMessageDate(iso: string): string {
		return new Date(iso).toLocaleString(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		});
	}

	let posting = $state(false);

	const submitWallPost = () => {
		posting = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			wallBody = '';
			posting = false;
			await invalidateAll();
		};
	};

	const submitWallDelete = () => {
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			await invalidateAll();
		};
	};

	// The mustard overlay container; click positions are computed relative to its
	// bounding rect so stored x/y are layout-robust fractions in [0,1].
	let sprayArea = $state<HTMLElement | null>(null);
	// Pending click position, written into the hidden form inputs before submit.
	let pendingX = $state(0);
	let pendingY = $state(0);
	let isSpraying = $state(false);
	// The form element, submitted programmatically after a click sets x/y.
	let sprayForm = $state<HTMLFormElement | null>(null);

	// Friendly join date from the stored timestamp.
	const joinedAt = $derived(
		new Date(profile.joined_at).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		})
	);

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

<article>
	{#if form?.message}
		<p role="alert">{form.message}</p>
	{/if}

	<!--
		The spray area wraps the avatar/badge so the current Top Dog can drop
		mustard anywhere on the profile head. When canSpray, a transparent overlay
		<button> captures the click (computing a relative x,y and submitting the
		spray form); otherwise the area is a plain wrapper.
	-->
	<div class="spray-area" bind:this={sprayArea}>
		{#if sigilId}
			<Sigil id={sigilId} size={96} title="{profile.display_name}'s sigil" />
		{:else if avatarUrl}
			<img src={avatarUrl} alt="{profile.display_name}'s avatar" width="96" height="96" />
		{:else}
			<div class="avatar-placeholder" aria-hidden="true">🌭</div>
		{/if}

		{#if profile.is_current_top_dog}
			<TopDogBadge />
		{/if}

		<!-- 🍔 Hamburger Court brands (TASK-073). HERETIC is persistent (any owned dog
		     confirmed a hamburger); LIAR decays over ~7 days (opacity from the brand
		     summary). Both are render-time, ranking-inert police-tape strips slapped
		     across the profile head. -->
		{#if isHeretic}
			<ProfilePoliceBanner label="HAMBURGER HERETIC" seed={`${profile.id}:HERETIC`} />
		{/if}
		{#if liarBrand.active}
			<ProfilePoliceBanner
				label="HAMBURGER LIAR"
				seed={`${profile.id}:LIAR`}
				opacity={liarBrand.intensity}
			/>
		{/if}

		<!-- Mustard overlay: one decaying splotch per spray (decision #15 — opacity
		     computed at render time from sprayed_at via mustardOpacity). -->
		<div class="mustard-layer" aria-hidden="true">
			{#each sprays as spray (spray.id)}
				<span
					class="mustard-splotch"
					style:left="{spray.x * 100}%"
					style:top="{spray.y * 100}%"
					style:opacity={mustardOpacity(spray.sprayed_at, Date.now())}>🟡</span
				>
			{/each}
		</div>

		{#if canSpray}
			<!-- Transparent click target over the whole area. A real <button> gives
			     keyboard + screen-reader support for free; the click handler reads the
			     pointer position relative to .spray-area to derive x/y in [0,1]. -->
			<button
				type="button"
				class="spray-target"
				aria-label="Spray mustard on this profile"
				onclick={onSprayAreaClick}
			></button>
		{/if}
	</div>

	<h1>{profile.display_name}</h1>
	<p class="handle">@{profile.handle}</p>

	<p class="joined">Joined {joinedAt}</p>

	<!--
		Message button (TASK-051): the conversation-initiation affordance for direct
		messages, shown only when viewing ANOTHER member's profile (reusing the
		existing isWallOwner flag — owner of the wall === the viewer themselves). It
		links to the DM thread route for this handle.
	-->
	{#if !isWallOwner}
		<p class="message-link">
			<a
				href={resolve('/(protected)/snacktum-snacktorum/messages/[handle]', {
					handle: profile.handle
				})}>Message @{profile.handle}</a
			>
		</p>
	{/if}

	<dl class="stats">
		<div>
			<dt>Days as Top Dog</dt>
			<dd>{profile.days_as_top_dog}</dd>
		</div>
	</dl>

	{#if canSpray}
		<p class="spray-hint">You're the Top Dog — click the avatar to spray mustard.</p>
		<form method="POST" action="?/spray" bind:this={sprayForm} use:enhance={submitSpray}>
			<input type="hidden" name="x" value={pendingX} />
			<input type="hidden" name="y" value={pendingY} />
			{#if isSpraying}<span aria-live="polite">Spraying…</span>{/if}
		</form>
	{/if}

	<!--
		Message wall (TASK-050). Any member may post a text message on this wall;
		the post box always shows. Each message shows its author and timestamp, with
		a delete affordance only for the message's author or the wall owner (which
		also mirrors the authoritative RLS DELETE policy). The stored body is never
		mutated (decision #16); the M6 emoji library is applied at RENDER time via
		renderWallBody (filter + seeded sprinkle keyed on the immutable message id).
	-->
	<section class="wall" aria-label="Message wall">
		<h2>Wall</h2>

		<form method="POST" action="?/post" use:enhance={submitWallPost} class="wall-post">
			<label for="wall-body">Leave a message on {profile.display_name}'s wall</label>
			<textarea
				id="wall-body"
				name="body"
				rows="3"
				maxlength="1000"
				bind:value={wallBody}
				placeholder="Say something nice…"
			></textarea>
			<button type="submit" disabled={posting || wallBody.trim().length === 0}>
				{posting ? 'Posting…' : 'Post'}
			</button>
		</form>

		{#if wallMessages.length === 0}
			<p class="wall-empty">No messages yet. Be the first to post.</p>
		{:else}
			<ul class="wall-messages">
				{#each wallMessages as message (message.id)}
					<li class="wall-message">
						<p class="wall-message-body">{renderWallBody(message.body, message.id)}</p>
						<p class="wall-message-meta">
							<a
								href={resolve('/(protected)/snacktum-snacktorum/profile/[handle]', {
									handle: message.author_handle
								})}>@{message.author_handle}</a
							>
							<span class="wall-message-date">{formatMessageDate(message.created_at)}</span>
						</p>
						{#if message.author_id === viewerId || isWallOwner}
							<form method="POST" action="?/deleteMessage" use:enhance={submitWallDelete}>
								<input type="hidden" name="messageId" value={message.id} />
								<button type="submit" class="wall-message-delete">Delete</button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</article>

<style>
	/* The sigil (avatar) in a thin gold ring, per the Shrine design. */
	.spray-area {
		position: relative;
		display: inline-block;
		border-radius: var(--radius-pill);
		overflow: hidden;
		border: 2px solid var(--accent);
		box-shadow: 0 0 0 4px var(--accent-fill-strong);
		line-height: 0;
	}

	.avatar-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 96px;
		height: 96px;
		font-size: 2.5rem;
		background: var(--accent-fill);
		line-height: 1;
	}

	.mustard-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	/* Themed BASE for the anointing splotches (the full splat re-theme is
	   TASK-086). Tokenized size/position only; opacity stays render-time decay. */
	.mustard-splotch {
		position: absolute;
		transform: translate(-50%, -50%);
		font-size: var(--text-xl);
		line-height: 1;
	}

	.spray-target {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: crosshair;
	}

	.handle {
		font-family: var(--font-body);
		font-size: var(--text-lg);
		color: var(--color-text-muted);
	}

	.joined {
		color: var(--color-text-faint);
		font-style: italic;
	}

	/* Stat ledger plaque — Cinzel labels over big gold numbers. */
	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-lg);
		margin: var(--space-lg) 0;
		padding: var(--space-lg);
		border: 1px solid var(--accent-plaque-border);
		background: var(--accent-fill);
		border-radius: var(--radius-card);
	}

	.stats dt {
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 600;
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: var(--accent-strong);
	}

	.stats dd {
		margin: var(--space-2xs) 0 0;
		font-family: var(--font-display);
		font-size: var(--text-xl);
		font-weight: 700;
		color: var(--accent);
	}

	.spray-hint {
		font-style: italic;
		color: var(--color-text-muted);
	}

	/* Message wall. */
	.wall {
		margin-top: var(--space-2xl);
		padding-top: var(--space-lg);
		border-top: 1px solid var(--accent-divider);
	}

	.wall-post {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		margin-bottom: var(--space-lg);
	}

	.wall-post label {
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 600;
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: var(--accent-strong);
	}

	.wall-post textarea {
		background: rgba(243, 233, 210, 0.04);
		border: 1px solid var(--accent-border);
		border-bottom: 1.5px solid var(--accent);
		border-radius: var(--radius-control);
		padding: var(--space-sm) var(--space-md);
		color: var(--color-text);
		font-family: var(--font-body);
		font-size: var(--text-base);
		resize: vertical;
	}

	.wall-post textarea:focus {
		background: rgba(243, 233, 210, 0.07);
	}

	.wall-post button {
		align-self: flex-start;
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

	.wall-post button:hover:not(:disabled) {
		filter: brightness(1.08);
	}

	.wall-post button:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.wall-empty {
		color: var(--color-text-faint);
		font-style: italic;
	}

	.wall-messages {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.wall-message {
		padding: var(--space-md);
		border: 1px solid var(--accent-plaque-border);
		background: var(--accent-fill);
		border-radius: var(--radius-card);
	}

	.wall-message-body {
		margin: 0 0 var(--space-xs);
	}

	.wall-message-meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-xs);
		align-items: baseline;
		margin: 0;
		font-size: var(--text-sm);
	}

	.wall-message-date {
		color: var(--color-text-faint);
		font-style: italic;
	}

	.wall-message-delete {
		margin-top: var(--space-xs);
		background: none;
		border: none;
		padding: 0;
		font-family: var(--font-body);
		font-size: var(--text-sm);
		color: var(--color-text-faint);
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}

	.wall-message-delete:hover {
		color: var(--color-error);
	}

	.message-link a {
		font-family: var(--font-display);
		font-size: var(--text-label);
		font-weight: 600;
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
	}
</style>
