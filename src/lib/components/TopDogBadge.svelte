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
