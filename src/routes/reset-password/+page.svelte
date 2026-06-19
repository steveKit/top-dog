<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { data, form } = $props();

	// A 6-digit numeric pattern for the code input. Built as a JS string so the
	// `{6}` quantifier isn't parsed as a Svelte mustache in the markup.
	const codePattern = '[0-9]{6}';

	// Email arrives from /forgot-password via ?email= (data.email) and is preserved
	// across failed submits (form.email). It travels hidden with the form so
	// verifyOtp has both email + code.
	const initialEmail = $derived(form?.email ?? data.email ?? '');
	const initialCode = $derived(form?.code ?? '');

	let submitting = $state(false);

	// Client-side confirm-match hint (the server re-checks authoritatively).
	let password = $state('');
	let confirmPassword = $state('');
	const mismatch = $derived(confirmPassword.length > 0 && password !== confirmPassword);
</script>

<svelte:head>
	<title>Forge a New Seal — Snacktum Snacktorum</title>
</svelte:head>

<div class="glow-orb" aria-hidden="true"></div>

<main class="recovery fade-up">
	{#if form?.success}
		<span class="eyebrow">Thy Seal Is Restored</span>
		<h1>The Tube Holds</h1>
		<p role="status">
			Thy new seal is forged and blessed. Return to the gates and resume thy righteous judgment of
			the sacred links.
		</p>
		<a class="btn-relic" href={resolve('/sign-in')}>Return to the Gates →</a>
	{:else}
		<span class="eyebrow">Forge Anew</span>
		<h1>Forge a New Seal</h1>
		<div class="ornament-divider" aria-hidden="true">✦</div>
		<p>
			Inscribe the recovery code sent to your mustard-address, then choose a new secret word — known
			only to thee and the Tube.
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
			<!-- Email carried from /forgot-password; verifyOtp needs it alongside the code. -->
			<input type="hidden" name="email" value={initialEmail} />

			<label>
				<span class="field-label">Recovery Code</span>
				<input
					class="code-input"
					type="text"
					name="code"
					value={initialCode}
					inputmode="numeric"
					autocomplete="one-time-code"
					maxlength="6"
					pattern={codePattern}
					placeholder="••••••"
					required
				/>
			</label>

			<label>
				<span class="field-label">New Secret Word</span>
				<input
					type="password"
					name="password"
					bind:value={password}
					autocomplete="new-password"
					minlength="8"
					placeholder="at least eight marks"
					required
				/>
			</label>

			<label>
				<span class="field-label">Confirm the Word</span>
				<input
					type="password"
					name="confirmPassword"
					bind:value={confirmPassword}
					autocomplete="new-password"
					minlength="8"
					placeholder="speak it once more"
					required
				/>
			</label>

			{#if mismatch}
				<p role="alert">The two words do not agree. Speak them alike.</p>
			{/if}

			<button class="btn-relic" type="submit" disabled={submitting || mismatch}>
				{submitting ? 'Sealing…' : 'Seal It →'}
			</button>
		</form>

		{#if form?.error}
			<p role="alert">{form.error}</p>
		{/if}

		<a class="btn-text" href={resolve('/forgot-password')}
			>← Need a new code? Dispatch another raven</a
		>
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
		max-width: 25rem;
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

	/* The recovery code reads as spaced display digits, mirroring the mockup. */
	.code-input {
		font-family: var(--font-display);
		font-size: var(--text-xl);
		letter-spacing: 0.75rem;
		text-align: center;
	}
</style>
