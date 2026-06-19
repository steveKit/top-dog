<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { form } = $props();

	// Preserve whatever the member typed on a failed submit so the field repopulates.
	const initialEmail = $derived(form?.email ?? '');

	// Loading affordance for use:enhance — disabled + relabelled while in flight.
	let submitting = $state(false);
</script>

<svelte:head>
	<title>Restore Thy Seal — Snacktum Snacktorum</title>
</svelte:head>

<div class="glow-orb" aria-hidden="true"></div>

<main class="recovery fade-up">
	{#if form?.success}
		<span class="eyebrow">A Rite Dispatched</span>
		<h1>Check Thy Mustard</h1>
		<p role="status">{form.message}</p>
		<p>
			Inscribe the six-mark recovery rite when it arrives.
			<a href="{resolve('/reset-password')}?email={encodeURIComponent(form.email ?? '')}"
				>Enter thy recovery code →</a
			>
		</p>
		<a class="btn-text" href={resolve('/sign-in')}>← Back to the gates</a>
	{:else}
		<span class="eyebrow">The Lost Seal</span>
		<h1>Restore Thy Seal</h1>
		<div class="ornament-divider" aria-hidden="true">✦</div>
		<p>
			Even the faithful forget. Speak thy mustard-address and the Order shall dispatch a recovery
			rite by sacred spatula.
		</p>

		<form
			method="POST"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
		>
			<label>
				<span class="field-label">Mustard Address</span>
				<input
					type="email"
					name="email"
					value={initialEmail}
					autocomplete="email"
					placeholder="you@parish.com"
					required
				/>
			</label>

			<button class="btn-relic" type="submit" disabled={submitting}>
				{submitting ? 'Dispatching…' : 'Send the Recovery Rite →'}
			</button>
		</form>

		{#if form?.error}
			<p role="alert">{form.error}</p>
		{/if}

		<a class="btn-text" href={resolve('/sign-in')}>← Thy memory returns? Back to the gates</a>
	{/if}
</main>

<style>
	.recovery {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-lg);
		text-align: center;
		max-width: var(--measure-form);
		margin: 0 auto;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		width: 100%;
		max-width: 22.5rem;
		align-items: stretch;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		text-align: left;
	}

	.field-label {
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 600;
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: var(--accent-strong);
	}

	input {
		background: var(--accent-fill);
		border: 1px solid var(--accent-border);
		border-bottom: 1.5px solid var(--accent);
		border-radius: var(--radius-control);
		padding: var(--space-sm) var(--space-md);
		color: var(--color-text);
		font-family: var(--font-body);
		font-size: var(--text-base);
	}

	input::placeholder {
		color: var(--color-text-fainter);
	}
</style>
