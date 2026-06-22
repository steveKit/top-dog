<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { renderMessageBody } from '$lib/features/emoji/render';
	import { createFormValidation } from '$lib/features/forms/formValidation.svelte';
	import { errorSlideFade } from '$lib/motion/reducedMotion';

	// Whispers — the DM thread with one other member, rebuilt from
	// design/pages/Whispers.dc.html (M8 TASK-097). A RE-SKIN of the unchanged
	// thread data flow: +page.server.ts (the conversation-scoped privacy load, the
	// read_at-only mark-read mutation boundary, and the sender-pinned send action)
	// is preserved and re-wired into the temple thread markup. The mockup's header
	// / Anointed-Wiener chrome ribbon belong to the persistent app shell
	// (+layout.svelte) and are NOT re-rendered here; this page owns the back-link,
	// the counterparty heading, the message thread, and the compose box.
	//
	// Message bodies are filtered at RENDER (decision #16 — filter only, no wall
	// sprinkle; the stored body is never mutated). The compose box follows the
	// app-wide form-validation CANON: novalidate + createFormValidation, the body
	// field nested inside its <label>, themed inline errors via errorSlideFade.

	let { data, form } = $props();

	const counterparty = $derived(data.counterparty);
	const messages = $derived(data.messages);
	const viewerId = $derived(data.viewerId);

	// Bound to the compose box; cleared after a successful send.
	let body = $state('');

	// Render-time friendly timestamp for a message.
	function formatDate(iso: string): string {
		return new Date(iso).toLocaleString(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		});
	}

	let sending = $state(false);

	// Form-validation CANON: themed inline validation replaces the native bubble.
	// The required body <textarea> is the empty-able field. validation.enhance
	// wraps the send submit handler (validate → cancel + focus on failure).
	const validation = createFormValidation();

	const submitSend = validation.enhance(() => {
		sending = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			body = '';
			sending = false;
			await invalidateAll();
		};
	});
</script>

<main class="whispers" aria-label="Conversation with {counterparty.display_name}">
	<div class="glow-orb" aria-hidden="true"></div>

	<p class="whispers-back">
		<a href={resolve('/(protected)/snacktum-snacktorum/epistles')}>← Epistles</a>
	</p>

	<header class="whispers-head">
		<span class="whispers-disc" aria-hidden="true">🌭</span>
		<div class="whispers-id">
			<span class="whispers-name">{counterparty.display_name}</span>
			<a
				class="whispers-handle"
				href={resolve('/(protected)/snacktum-snacktorum/shrine/[handle]', {
					handle: counterparty.handle
				})}>@{counterparty.handle}</a
			>
		</div>
	</header>

	{#if form?.message}
		<p class="form-error" role="alert">{form.message}</p>
	{/if}

	{#if messages.length === 0}
		<div class="empty">
			<svg
				class="empty-mark"
				viewBox="0 0 200 200"
				width="96"
				height="96"
				fill="none"
				stroke="currentColor"
				stroke-width="3"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<ellipse cx="100" cy="58" rx="42" ry="11" />
				<rect x="52" y="98" width="96" height="26" rx="13" fill="var(--accent-fill-strong)" />
				<path d="M66 110 q8 -7 16 0 q8 7 16 0 q8 -7 16 0 q8 7 16 0" stroke-width="2.6" />
				<path
					d="M44 122 q0 -4 6 -4 h100 q6 0 6 4 v6 q0 18 -22 18 h-68 q-22 0 -22 -18 z"
					fill="var(--accent-fill)"
				/>
			</svg>
			<p class="empty-line">No whispers yet. Greet this disciple.</p>
		</div>
	{:else}
		<ul class="thread">
			{#each messages as message (message.id)}
				{@const isMe = message.sender_id === viewerId}
				<li class="whisper" class:sent={isMe} class:received={!isMe}>
					<span class="whisper-meta">
						<span class="whisper-sender">{isMe ? 'Thee' : counterparty.display_name}</span>
						<span class="whisper-time">{formatDate(message.created_at)}</span>
					</span>
					<!-- Decision #16: stored body never mutated; M6 emoji filter applied at
					     render (DM = filter only, no wall sprinkle). -->
					<p class="whisper-bubble">{renderMessageBody(message.body)}</p>
				</li>
			{/each}
		</ul>
	{/if}

	<form method="POST" action="?/send" class="compose" novalidate use:enhance={submitSend}>
		<label class="compose-label">
			<span class="field-label">Whisper unto {counterparty.display_name}…</span>
			<textarea
				name="body"
				rows="3"
				maxlength="1000"
				required
				bind:value={body}
				placeholder="Speak softly, faithful one…"
				aria-invalid={validation.invalid('body')}
				aria-describedby={validation.describedBy('body')}
				oninput={validation.clearOnInput}
			></textarea>
		</label>
		{#if validation.errors.body}
			<p class="field-error" role="alert" id={validation.errorId('body')} transition:errorSlideFade>
				{validation.errors.body}
			</p>
		{/if}

		<div class="compose-actions">
			<button type="submit" class="btn-relic" disabled={sending}>
				{sending ? 'Sending…' : 'Send →'}
			</button>
		</div>
	</form>
</main>

<style>
	/* Whispers is a centered temple column: back-link, the counterparty heading, the
	   message thread, then the compose box. All values reference theme tokens (no
	   magic hex/px); the gold accent themes via [data-accent]. */
	.whispers {
		position: relative;
		max-width: var(--measure-content);
		margin: 0 auto;
		display: flex;
		flex-direction: column;
	}

	.whispers .glow-orb {
		top: -200px;
	}

	.whispers-back {
		position: relative;
		z-index: 1;
		align-self: flex-start;
		margin: 0;
	}

	.whispers-back a {
		font-family: var(--font-body);
		font-size: var(--text-base);
		color: var(--color-text-faint);
		text-decoration: none;
	}

	.whispers-back a:hover {
		color: var(--accent);
	}

	/* The counterparty heading: sigil disc + name + @handle, on a divider rule. */
	.whispers-head {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		gap: var(--space-md);
		margin-top: var(--space-md);
		padding-bottom: var(--space-lg);
		border-bottom: 1px solid var(--accent-divider);
	}

	.whispers-disc {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3.375rem;
		height: 3.375rem;
		border-radius: var(--radius-pill);
		border: 1.5px solid var(--accent);
		background: var(--color-bg-lift);
		font-size: var(--text-xl);
		line-height: 1;
	}

	.whispers-id {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		min-width: 0;
	}

	.whispers-name {
		font-family: var(--font-display);
		font-size: var(--text-xl);
		font-weight: 600;
		letter-spacing: var(--tracking-tight);
		color: var(--color-heading);
	}

	.whispers-handle {
		font-family: var(--font-body);
		font-style: italic;
		font-size: var(--text-sm);
		text-decoration: none;
	}

	.whispers-handle:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	/* A page-level send error (the action's friendly message). */
	.form-error {
		position: relative;
		z-index: 1;
		margin: var(--space-md) 0 0;
		color: var(--color-error);
		font-size: var(--text-base);
	}

	/* The thread — alternating left (received) / right (sent) bubbles. */
	.thread {
		position: relative;
		z-index: 1;
		margin: 0;
		padding: var(--space-xl) 0 var(--space-xs);
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.whisper {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		max-width: 78%;
	}

	.whisper.received {
		align-self: flex-start;
		align-items: flex-start;
	}

	.whisper.sent {
		align-self: flex-end;
		align-items: flex-end;
	}

	.whisper-meta {
		display: flex;
		align-items: baseline;
		gap: var(--space-xs);
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 600;
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
	}

	.whisper.received .whisper-sender {
		color: var(--color-text-faint);
	}

	.whisper.sent .whisper-sender {
		color: var(--accent-strong);
	}

	.whisper-time {
		font-family: var(--font-body);
		font-size: var(--text-sm);
		font-style: italic;
		text-transform: none;
		letter-spacing: normal;
		font-weight: 400;
		color: var(--color-text-faint);
	}

	.whisper-bubble {
		margin: 0;
		padding: var(--space-sm) var(--space-md);
		font-family: var(--font-body);
		font-size: var(--text-base);
		line-height: 1.45;
		text-wrap: pretty;
	}

	.whisper.received .whisper-bubble {
		background: var(--accent-fill-strong);
		border: 1px solid var(--accent-divider);
		border-radius: 3px 14px 14px 14px;
		color: var(--color-text);
	}

	.whisper.sent .whisper-bubble {
		background: var(--accent-fill-strong);
		border: 1px solid var(--accent-soft);
		border-radius: 14px 3px 14px 14px;
		color: var(--color-heading);
	}

	/* Empty state — a dashed plaque with the cold-grill mark. */
	.empty {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-lg);
		margin: var(--space-xl) 0 var(--space-xs);
		padding: var(--space-3xl) var(--space-lg);
		border: 1px dashed var(--accent-border);
		border-radius: var(--radius-card);
		background: var(--accent-fill);
	}

	.empty-mark {
		display: block;
		color: var(--accent);
		opacity: 0.8;
	}

	.empty-line {
		margin: 0;
		font-size: var(--text-lg);
		font-style: italic;
		color: var(--color-text-muted);
		text-align: center;
		text-wrap: pretty;
	}

	/* The compose box — a divider-topped block: themed label, textarea, send. */
	.compose {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		margin-top: var(--space-xl);
		padding-top: var(--space-xl);
		border-top: 1px solid var(--accent-divider);
	}

	.compose-label {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.compose-label .field-label {
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 600;
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: var(--accent-strong);
	}

	.compose textarea {
		width: 100%;
		min-height: 5.25rem;
		resize: vertical;
		padding: var(--space-md) var(--space-md);
		background: var(--accent-fill);
		border: 1px solid var(--accent-border);
		border-bottom: 1.5px solid var(--accent);
		border-radius: var(--radius-control);
		color: var(--color-text);
		font-family: var(--font-body);
		font-size: var(--text-base);
		line-height: 1.45;
	}

	.compose textarea::placeholder {
		color: var(--color-text-fainter);
	}

	.compose textarea:focus-visible {
		outline: var(--ring-focus);
		outline-offset: 2px;
		background: var(--accent-fill-strong);
	}

	.compose-actions {
		display: flex;
		justify-content: flex-end;
	}
</style>
