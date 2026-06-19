<script lang="ts">
	// 🍔 burger-report toggle for a single hot dog (decision #12 — cosmetic flair,
	// never touches votes/ranking). Posts to the page's `report` / `unreport` form
	// actions. The reporter is ANONYMOUS and is NEVER sent from the client — the
	// server actions derive the reporter id from safeGetSession(); we only post the
	// dog id. The control is hidden on the viewer's own dogs by the caller (you
	// can't report your own dog), so this component assumes it's another's dog.

	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let {
		dogId,
		iReported = false
	}: {
		dogId: string;
		iReported?: boolean;
	} = $props();

	let pending = $state(false);

	const submitToggle = () => {
		pending = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			pending = false;
			await invalidateAll();
		};
	};
</script>

<form
	method="POST"
	action={iReported ? '?/unreport' : '?/report'}
	use:enhance={submitToggle}
	class="burger-report"
>
	<input type="hidden" name="id" value={dogId} />
	<button
		type="submit"
		disabled={pending}
		aria-pressed={iReported}
		title={iReported
			? 'Retract your hamburger report'
			: 'Report this as a hamburger, not a hot dog'}
	>
		🍔 {iReported ? 'Reported as a hamburger ✓' : "That's a hamburger"}
	</button>
</form>

<style>
	/* The 🍔 "call it heresy" report toggle, themed against the temple tokens.
	   Reads as a muted accusatory text-control; the active (reported) state lights
	   gold — not by color alone: the label itself carries a trailing "✓". */
	.burger-report {
		margin: var(--space-xs) 0;
	}

	.burger-report button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-2xs) var(--space-sm);
		background: var(--accent-fill);
		border: 1px solid var(--accent-border);
		border-radius: var(--radius-control);
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 600;
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.burger-report button:hover:not(:disabled) {
		border-color: var(--accent);
		color: var(--color-text);
	}

	.burger-report button[aria-pressed='true'] {
		background: var(--accent-fill-strong);
		border-color: var(--accent);
		color: var(--accent);
	}

	.burger-report button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
