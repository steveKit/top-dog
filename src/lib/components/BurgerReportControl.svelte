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
