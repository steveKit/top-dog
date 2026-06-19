<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { REACTION_EMOJIS } from '$lib/features/reactions/emojiSet';
	import type { ReactionSummary } from '$lib/features/reactions/summarize';

	// Cosmetic reaction bar for a single hot dog (decision #12 — flair only, never
	// touches votes/ranking). Renders existing reaction chips (emoji + count,
	// highlighted when the viewer reacted) and a picker of the allowed emojis to
	// add a new one. Clicking a chip you already own un-reacts; clicking a new
	// emoji reacts. The viewer id is NEVER sent from the client — the server form
	// actions derive it from safeGetSession(); we only post the dog id + emoji.

	let {
		dogId,
		summaries
	}: {
		dogId: string;
		summaries: ReactionSummary[];
	} = $props();

	// Which emoji on THIS dog has a toggle in flight (disables it + shows pending).
	let pending = $state<string | null>(null);

	// Emojis the viewer can still add (not already reacted-by-me): the picker hides
	// an emoji once it's an owned chip, since the chip itself is the un-react
	// affordance. Derived from the summaries so it refreshes after invalidateAll().
	const myEmojis = $derived(new Set(summaries.filter((s) => s.reactedByMe).map((s) => s.emoji)));
	const pickerEmojis = $derived(REACTION_EMOJIS.filter((e) => !myEmojis.has(e)));

	const submitToggle = (emoji: string) => {
		pending = emoji;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			pending = null;
			await invalidateAll();
		};
	};
</script>

<div class="reaction-bar">
	{#if summaries.length > 0}
		<ul class="chips">
			{#each summaries as summary (summary.emoji)}
				<li>
					<form
						method="POST"
						action={summary.reactedByMe ? '?/unreact' : '?/react'}
						use:enhance={() => submitToggle(summary.emoji)}
					>
						<input type="hidden" name="id" value={dogId} />
						<input type="hidden" name="emoji" value={summary.emoji} />
						<button
							type="submit"
							disabled={pending !== null}
							aria-pressed={summary.reactedByMe}
							title={summary.reactedByMe ? 'Remove your reaction' : 'React'}
						>
							{summary.emoji}
							{summary.count}{summary.reactedByMe ? ' ✓' : ''}
						</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}

	{#if pickerEmojis.length > 0}
		<ul class="picker">
			{#each pickerEmojis as emoji (emoji)}
				<li>
					<form method="POST" action="?/react" use:enhance={() => submitToggle(emoji)}>
						<input type="hidden" name="id" value={dogId} />
						<input type="hidden" name="emoji" value={emoji} />
						<button type="submit" disabled={pending !== null} title="React with {emoji}">
							{emoji}
						</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	/* Cosmetic reaction flair, themed against the temple tokens. Chips read as
	   faint gold plaques; the viewer's own reaction (aria-pressed) lights gold. */
	.reaction-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-sm);
		margin: var(--space-sm) 0;
	}

	.chips,
	.picker {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-xs);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.reaction-bar button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
		padding: var(--space-2xs) var(--space-xs);
		background: var(--accent-fill);
		border: 1px solid var(--accent-border);
		border-radius: var(--radius-control);
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		letter-spacing: var(--tracking-tight);
		color: var(--color-text-muted);
		cursor: pointer;
		line-height: 1.4;
	}

	.reaction-bar button:hover:not(:disabled) {
		border-color: var(--accent);
		color: var(--color-text);
	}

	/* The viewer's own reaction reads gold — not by color alone: the chip also
	   carries a trailing "✓" from the markup. */
	.chips button[aria-pressed='true'] {
		background: var(--accent-fill-strong);
		border-color: var(--accent);
		color: var(--accent);
	}

	.reaction-bar button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
