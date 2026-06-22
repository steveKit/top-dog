<script lang="ts">
	import { resolve } from '$app/paths';
	import { renderMessageBody } from '$lib/features/emoji/render';

	// Epistles — the DM inbox, rebuilt from design/pages/Epistles.dc.html (M8
	// TASK-097). A RE-SKIN of the unchanged inbox data flow: +page.server.ts (the
	// bounded listConversations load, DW-018) is preserved and re-wired into the
	// temple correspondence-list markup. The mockup's header / Anointed-Wiener
	// chrome ribbon belong to the persistent app shell (+layout.svelte) and are
	// NOT re-rendered here; this page owns the temple column (eyebrow → h1 → ✦
	// divider) and the list of conversations.
	//
	// The inbox load returns each counterparty's handle / display name + the
	// latest message preview + unread count; it does NOT surface a counterparty
	// avatar, so each row shows a neutral 🌭 disc rather than the mockup's per-row
	// sigil. Body preview is filtered at RENDER (decision #16 — never persisted).

	let { data } = $props();

	const conversations = $derived(data.conversations);

	// Render-time friendly timestamp for the latest message in a conversation.
	function formatDate(iso: string): string {
		return new Date(iso).toLocaleString(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		});
	}
</script>

<main class="epistles" aria-label="Direct messages">
	<div class="glow-orb" aria-hidden="true"></div>

	<header class="epistles-head">
		<span class="eyebrow">Whispers in the Sanctum</span>
		<h1>Epistles</h1>
		<div class="ornament-divider" aria-hidden="true">✦</div>
	</header>

	{#if conversations.length === 0}
		<div class="empty">
			<svg
				class="empty-mark"
				viewBox="0 0 200 200"
				width="110"
				height="110"
				fill="none"
				stroke="currentColor"
				stroke-width="3"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<g stroke-width="2.5" opacity="0.9">
					<line x1="100" y1="30" x2="100" y2="14" />
					<line x1="74" y1="36" x2="64" y2="22" />
					<line x1="126" y1="36" x2="136" y2="22" />
					<line x1="52" y1="50" x2="40" y2="40" />
					<line x1="148" y1="50" x2="160" y2="40" />
				</g>
				<ellipse cx="100" cy="58" rx="42" ry="11" />
				<rect x="52" y="98" width="96" height="26" rx="13" fill="var(--accent-fill-strong)" />
				<path d="M66 110 q8 -7 16 0 q8 7 16 0 q8 -7 16 0 q8 7 16 0" stroke-width="2.6" />
				<path
					d="M44 122 q0 -4 6 -4 h100 q6 0 6 4 v6 q0 18 -22 18 h-68 q-22 0 -22 -18 z"
					fill="var(--accent-fill)"
				/>
			</svg>
			<p class="empty-line">No epistles yet. Seek a disciple's shrine to begin a correspondence.</p>
		</div>
	{:else}
		<ul class="conversations">
			{#each conversations as conversation (conversation.counterpartyId)}
				<li class="conversation fade-up">
					<a
						href={resolve('/(protected)/snacktum-snacktorum/epistles/[handle]', {
							handle: conversation.counterpartyHandle
						})}
					>
						<span class="convo-disc" aria-hidden="true">🌭</span>

						<span class="convo-body">
							<span class="convo-display">{conversation.counterpartyDisplayName}</span>
							<span class="convo-handle">@{conversation.counterpartyHandle}</span>
							<!-- Decision #16: filter at render only (no sprinkle), matching the thread. -->
							<span class="convo-preview">{renderMessageBody(conversation.lastBody)}</span>
						</span>

						<span class="convo-meta">
							<span class="convo-time">{formatDate(conversation.lastAt)}</span>
							{#if conversation.unreadCount > 0}
								<span class="convo-unread" aria-label="{conversation.unreadCount} unread"
									>{conversation.unreadCount}</span
								>
							{/if}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	/* Epistles is a centered temple column: heading block, then the list of
	   correspondences (or the empty plaque). All values reference theme tokens
	   (no magic hex/px); the gold accent themes via [data-accent]. */
	.epistles {
		position: relative;
		max-width: var(--measure-content);
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.epistles .glow-orb {
		top: -200px;
	}

	.epistles-head {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		margin-bottom: var(--space-xl);
	}

	.epistles-head h1 {
		margin: var(--space-sm) 0 0;
	}

	.epistles-head .ornament-divider {
		margin: var(--space-lg) 0 0;
	}

	/* The list of correspondences. */
	.conversations {
		position: relative;
		z-index: 1;
		width: 100%;
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	/* Each conversation is a single gold-edged row that is one big link. */
	.conversation a {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-md) var(--space-lg);
		background: var(--color-bg-mid);
		border: 1px solid var(--accent-divider);
		border-radius: var(--radius-card);
		text-decoration: none;
		box-shadow: var(--shadow-plaque);
	}

	.conversation a:hover {
		border-color: var(--accent-soft);
		background: var(--color-bg-lift);
	}

	/* A neutral hot-dog disc stands in for the counterparty avatar (the inbox load
	   surfaces no avatar). */
	.convo-disc {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3rem;
		height: 3rem;
		border-radius: var(--radius-pill);
		border: 1.5px solid var(--accent);
		background: var(--color-bg-lift);
		font-size: var(--text-xl);
		line-height: 1;
	}

	.convo-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.convo-display {
		font-family: var(--font-display);
		font-size: var(--text-base);
		font-weight: 600;
		letter-spacing: var(--tracking-tight);
		color: var(--color-heading);
	}

	.convo-handle {
		font-family: var(--font-body);
		font-style: italic;
		font-size: var(--text-sm);
		color: var(--color-text-faint);
	}

	.convo-preview {
		font-family: var(--font-body);
		font-size: var(--text-base);
		color: var(--color-text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}

	.convo-meta {
		flex: none;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: var(--space-sm);
		align-self: stretch;
	}

	.convo-time {
		font-family: var(--font-body);
		font-size: var(--text-sm);
		color: var(--color-text-faint);
		white-space: nowrap;
	}

	/* The gold unread pill. */
	.convo-unread {
		min-width: 1.375rem;
		height: 1.375rem;
		padding: 0 var(--space-xs);
		border-radius: var(--radius-pill);
		background: var(--accent);
		color: var(--color-on-accent);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-display);
		font-size: var(--text-label);
		font-weight: 700;
		line-height: 1;
	}

	/* Empty state — a dashed plaque with the cold-grill mark. */
	.empty {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 34rem;
		margin-top: var(--space-md);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-lg);
		padding: var(--space-3xl) var(--space-lg);
		border: 1px dashed var(--accent-border);
		border-radius: var(--radius-card);
		background: var(--accent-fill);
	}

	.empty-mark {
		display: block;
		color: var(--accent);
		opacity: 0.82;
	}

	.empty-line {
		margin: 0;
		font-size: var(--text-lg);
		font-style: italic;
		color: var(--color-text-muted);
		text-align: center;
		text-wrap: pretty;
	}

	/* Responsive: on narrow viewports, drop the per-row timestamp's column so the
	   preview keeps room; the unread pill stays. */
	@media (max-width: 30rem) {
		.convo-time {
			display: none;
		}
	}
</style>
