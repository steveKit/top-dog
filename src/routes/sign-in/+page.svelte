<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { form } = $props();

	// Preserve whatever the member typed on a failed submit so the email field
	// repopulates. The password is intentionally never echoed back.
	const initialEmail = $derived(form?.email ?? '');

	// Loading affordance for use:enhance — disabled + relabelled while in flight.
	let submitting = $state(false);
</script>

<svelte:head>
	<title>Enter the Snacktum — Snacktum Snacktorum</title>
</svelte:head>

<div class="glow-orb" aria-hidden="true"></div>

<main class="sign-in fade-up">
	<span class="eyebrow">The Faithful Return</span>
	<h1>Enter the Snacktum</h1>
	<div class="ornament-divider" aria-hidden="true">✦</div>
	<p>Speak thy mustard-address and secret word to pass once more through the gates.</p>

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

		<label>
			<span class="field-label">Secret Word</span>
			<input
				type="password"
				name="password"
				autocomplete="current-password"
				placeholder="known only to thee and the Tube"
				required
			/>
		</label>

		<button class="btn-relic" type="submit" disabled={submitting}>
			{submitting ? 'Entering…' : 'Enter the Snacktum →'}
		</button>
	</form>

	{#if form?.error}
		<p role="alert">{form.error}</p>
	{/if}

	<div class="links">
		<a class="btn-text" href={resolve('/forgot-password')}>Forgotten thy seal?</a>
		<a class="btn-text" href={resolve('/sign-up')}>Have an invite? Join the Order →</a>
	</div>
</main>

<style>
	.sign-in {
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

	.links {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		align-items: center;
	}
</style>
