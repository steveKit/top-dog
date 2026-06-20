<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ordoSeal from '$lib/assets/brand/ordo-sancti-tubi-seal.svg';
	import snacktumHeader from '$lib/assets/brand/snacktum-snacktorum-header.svg';
	import { createFormValidation } from '$lib/features/forms/formValidation.svelte';
	import { errorSlideFade } from '$lib/motion/reducedMotion';

	let { form } = $props();

	// Preserve whatever the member typed on a failed submit so the email field
	// repopulates. The password is intentionally never echoed back.
	const initialEmail = $derived(form?.email ?? '');

	// Loading affordance for use:enhance — disabled + relabelled while in flight.
	let submitting = $state(false);

	// Themed inline client-side validation (replaces the native bubble). The
	// server still validates authoritatively; this is purely the UX layer.
	const validation = createFormValidation();
</script>

<svelte:head>
	<title>Enter the Snacktum — Snacktum Snacktorum</title>
</svelte:head>

<div class="glow-orb" aria-hidden="true"></div>

<main class="sign-in fade-up gate-center">
	<header class="gate-header">
		<img class="gate-header-mark" src={snacktumHeader} alt="Snacktum Snacktorum" />
	</header>
	<img class="gate-mark" src={ordoSeal} alt="" aria-hidden="true" />
	<span class="eyebrow">The Faithful Return</span>
	<h1>Enter the Snacktum</h1>
	<div class="ornament-divider" aria-hidden="true">✦</div>
	<p>Speak thy mustard-address and seal to pass once more over the grill.</p>

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
		<label>
			<span class="field-label">Mustard Address</span>
			<input
				type="email"
				name="email"
				value={initialEmail}
				autocomplete="email"
				placeholder="you@mustard.condiment"
				required
				aria-invalid={validation.invalid('email')}
				aria-describedby={validation.describedBy('email')}
				oninput={validation.clearOnInput}
			/>
			{#if validation.errors.email}
				<p
					class="field-error"
					role="alert"
					id={validation.errorId('email')}
					transition:errorSlideFade
				>
					{validation.errors.email}
				</p>
			{/if}
		</label>

		<label>
			<span class="field-label">Seal</span>
			<input
				type="password"
				name="password"
				autocomplete="current-password"
				placeholder="known only to thee and the Tube"
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
		/* --space-md (down from --space-lg): a one-step gap reduction keeps the
		   vertical rhythm tight and in step with the recovery gate pages. With the
		   15rem seal mark this page may exceed a short viewport and scroll (body
		   scroll), which is acceptable; the tighter gap just minimizes that. */
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
		gap: var(--space-md);
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
