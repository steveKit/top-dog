<script lang="ts">
	// Shared "Top Dog" crown badge. Render-only — the caller decides WHEN to show
	// it (gated on live server crown state: a profile's `is_current_top_dog`, or
	// the winning dog tile on the kennel). Keeping the visual in one component
	// means the profile badge and the dog-tile badge stay in lockstep.
	//
	// `label` lets a compact surface (e.g. a dog tile) vary the wording while
	// reusing the same markup, styling, and `role="status"` semantics.
	let { label = 'Current Top Dog' }: { label?: string } = $props();
</script>

<p class="badge" role="status">👑 {label}</p>

<style>
	/* Gilded champion crest — the Cinzel/gold "Anointed" pill from the chrome
	   mockup. Tokenized; the caller still decides WHEN to show it. */
	.badge {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		margin: 0;
		padding: var(--space-2xs) var(--space-sm);
		background: var(--accent-fill-strong);
		border: 1px solid var(--accent);
		border-radius: var(--radius-control);
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 600;
		letter-spacing: var(--tracking-eyebrow);
		text-transform: uppercase;
		color: var(--accent);
		box-shadow: var(--shadow-button-glow);
	}
</style>
