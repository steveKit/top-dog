<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { renderMessageBody } from '$lib/features/emoji/render';

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

	const submitSend = () => {
		sending = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			body = '';
			sending = false;
			await invalidateAll();
		};
	};
</script>

<section aria-label="Conversation with {counterparty.display_name}">
	<p class="back">
		<a href={resolve('/(protected)/app/messages')}>← Messages</a>
	</p>

	<h1>
		{counterparty.display_name}
		<a
			class="handle"
			href={resolve('/(protected)/app/profile/[handle]', { handle: counterparty.handle })}
			>@{counterparty.handle}</a
		>
	</h1>

	{#if form?.message}
		<p role="alert">{form.message}</p>
	{/if}

	{#if messages.length === 0}
		<p class="empty">No messages yet. Say hello.</p>
	{:else}
		<ul class="messages">
			{#each messages as message (message.id)}
				<li class="message" class:sent={message.sender_id === viewerId}>
					<!-- Decision #16: stored body never mutated; M6 emoji filter applied at
					     render (DM = filter only, no wall sprinkle). -->
					<p class="message-body">{renderMessageBody(message.body)}</p>
					<p class="message-meta">
						<span class="message-direction"
							>{message.sender_id === viewerId ? 'You' : counterparty.display_name}</span
						>
						<span class="message-date">{formatDate(message.created_at)}</span>
					</p>
				</li>
			{/each}
		</ul>
	{/if}

	<form method="POST" action="?/send" use:enhance={submitSend} class="compose">
		<label for="dm-body">Message {counterparty.display_name}</label>
		<textarea
			id="dm-body"
			name="body"
			rows="3"
			maxlength="1000"
			bind:value={body}
			placeholder="Write a message…"
		></textarea>
		<button type="submit" disabled={sending || body.trim().length === 0}>
			{sending ? 'Sending…' : 'Send'}
		</button>
	</form>
</section>
