<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import TopDogBadge from '$lib/components/TopDogBadge.svelte';
	import { mustardOpacity } from '$lib/features/mustard/decay';

	let { data, form } = $props();

	const profile = $derived(data.profile);
	const avatarUrl = $derived(data.avatarUrl);
	const sprays = $derived(data.sprays);
	const canSpray = $derived(data.canSpray);

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
		{#if avatarUrl}
			<img src={avatarUrl} alt="{profile.display_name}'s avatar" width="96" height="96" />
		{:else}
			<div class="avatar-placeholder" aria-hidden="true">🌭</div>
		{/if}

		{#if profile.is_current_top_dog}
			<TopDogBadge />
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
</article>

<style>
	.spray-area {
		position: relative;
		display: inline-block;
	}

	.mustard-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.mustard-splotch {
		position: absolute;
		transform: translate(-50%, -50%);
		font-size: 1.5rem;
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
</style>
