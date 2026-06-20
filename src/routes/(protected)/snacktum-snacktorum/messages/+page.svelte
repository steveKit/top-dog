<script lang="ts">
	import { resolve } from '$app/paths';
	import { renderMessageBody } from '$lib/features/emoji/render';

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

<section aria-label="Direct messages">
	<h1>Messages</h1>

	{#if conversations.length === 0}
		<p class="empty">No conversations yet. Visit a chef's profile to start one.</p>
	{:else}
		<ul class="conversations">
			{#each conversations as conversation (conversation.counterpartyId)}
				<li class="conversation">
					<a
						href={resolve('/(protected)/snacktum-snacktorum/messages/[handle]', {
							handle: conversation.counterpartyHandle
						})}
					>
						<span class="counterparty">
							{conversation.counterpartyDisplayName}
							<span class="handle">@{conversation.counterpartyHandle}</span>
						</span>
						{#if conversation.unreadCount > 0}
							<span class="unread-badge" aria-label="{conversation.unreadCount} unread"
								>{conversation.unreadCount}</span
							>
						{/if}
						<!-- Decision #16: filter at render only (no sprinkle), matching the thread. -->
						<span class="preview">{renderMessageBody(conversation.lastBody)}</span>
						<span class="date">{formatDate(conversation.lastAt)}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>
