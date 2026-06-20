<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ordoSeal from '$lib/assets/brand/ordo-sancti-tubi-seal.svg';
	import snacktumHeader from '$lib/assets/brand/snacktum-snacktorum-header.svg';
	import { createFormValidation } from '$lib/features/forms/formValidation.svelte';
	import { errorSlideFade } from '$lib/motion/reducedMotion';

	let { data, form } = $props();

	// Themed inline client-side validation (replaces the native bubble). The
	// server still validates authoritatively; this is purely the UX layer.
	const validation = createFormValidation();

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

<main class="recovery fade-up gate-center">
	<header class="gate-header">
		<img class="gate-header-mark" src={snacktumHeader} alt="Snacktum Snacktorum" />
	</header>
	<img class="gate-mark" src={ordoSeal} alt="" aria-hidden="true" />
	{#if form?.success}
		<span class="eyebrow">Thy Seal Is Restored</span>
		<h1>The Tube Holds</h1>
		<p role="status">
			Thy new seal is forged and blessed. Return to the grill and resume thy righteous judgment of
			the sacred links.
		</p>
		<a class="btn-relic" href={resolve('/sign-in')}>Return to the Grill →</a>
	{:else}
		<span class="eyebrow">Forge Anew</span>
		<h1>Forge a New Seal</h1>
		<div class="ornament-divider" aria-hidden="true">✦</div>
		<p>
			Inscribe the recovery code sent to your mustard-address, then forge a new seal — known only to
			thee and the Tube.
		</p>

		<form
			method="POST"
			novalidate
			use:enhance={validation.enhance(() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			})}
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
					aria-invalid={validation.invalid('code')}
					aria-describedby={validation.describedBy('code')}
					oninput={validation.clearOnInput}
				/>
				{#if validation.errors.code}
					<p
						class="field-error"
						role="alert"
						id={validation.errorId('code')}
						transition:errorSlideFade
					>
						{validation.errors.code}
					</p>
				{/if}
			</label>

			<label>
				<span class="field-label">New Seal</span>
				<input
					type="password"
					name="password"
					bind:value={password}
					autocomplete="new-password"
					minlength="8"
					placeholder="at least eight marks"
					required
					aria-invalid={validation.invalid('password')}
					aria-describedby={validation.describedBy('password')}
					oninput={validation.clearOnInput}
				/>
				{#if validation.errors.password}
					<p
						class="field-error"
						role="alert"
						id={validation.errorId('password')}
						transition:errorSlideFade
					>
						{validation.errors.password}
					</p>
				{/if}
			</label>

			<label>
				<span class="field-label">Confirm the Seal</span>
				<input
					type="password"
					name="confirmPassword"
					bind:value={confirmPassword}
					autocomplete="new-password"
					minlength="8"
					placeholder="speak it once more"
					required
					aria-invalid={validation.invalid('confirmPassword')}
					aria-describedby={validation.describedBy('confirmPassword')}
					oninput={validation.clearOnInput}
				/>
				{#if validation.errors.confirmPassword}
					<p
						class="field-error"
						role="alert"
						id={validation.errorId('confirmPassword')}
						transition:errorSlideFade
					>
						{validation.errors.confirmPassword}
					</p>
				{/if}
			</label>

			{#if mismatch}
				<p role="alert">The two seals do not agree. Speak them alike.</p>
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
		/* --space-md (down from --space-lg): this is the tallest gate page (code
		   input + new-seal + confirm + the 15rem seal mark), so a one-step gap
		   reduction across its many rows keeps the vertical rhythm tight. With the
		   15rem seal the page exceeds a short viewport and scrolls (body scroll),
		   which is acceptable; the gap reduction just minimizes how soon that
		   happens — without touching the mark. */
		gap: var(--space-md);
		text-align: center;
		max-width: var(--measure-form);
		/* margin-inline (not `margin: 0 auto`) so this scoped wrapper only centers
		   horizontally and can never clobber .gate-center's vertical layout. */
		margin-inline: auto;
	}

	form {
		display: flex;
		flex-direction: column;
		/* --space-md (down from --space-lg) — three fields here, so the tighter
		   field rhythm reclaims the most space on this page. */
		gap: var(--space-md);
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
