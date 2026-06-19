<script lang="ts">
	import { enhance } from '$app/forms';
	import theHolyTube from '$lib/assets/brand/the-holy-tube.svg';
	import { createFormValidation } from '$lib/features/forms/formValidation.svelte';
	import { errorSlideFade } from '$lib/motion/reducedMotion';

	let { data, form } = $props();

	// Pre-fill the token from the invite link (?token=...) on first load, and
	// preserve whatever the server echoed back on a failed submit.
	const initialToken = $derived(form?.token ?? data.token);
	const initialEmail = $derived(form?.email ?? '');

	// Themed inline client-side validation (replaces the native bubble). The
	// server still validates authoritatively; this is purely the UX layer.
	const validation = createFormValidation();
</script>

<main class="gate-center">
	<img class="gate-mark" src={theHolyTube} alt="" aria-hidden="true" />
	<h1>Sign up</h1>

	{#if form?.success && form?.confirmEmail}
		<p role="status">
			Almost there — check <strong>{form.email}</strong> for a confirmation link to finish setting up
			your account.
		</p>
	{:else}
		<p>Top Dog is invite-only. Use the invite link a member shared with you.</p>

		<form method="POST" novalidate use:enhance={validation.enhance()}>
			<label>
				Invite token
				<input
					type="text"
					name="token"
					value={initialToken}
					required
					aria-invalid={validation.invalid('token')}
					aria-describedby={validation.describedBy('token')}
					oninput={validation.clearOnInput}
				/>
				{#if validation.errors.token}
					<p
						class="field-error"
						role="alert"
						id={validation.errorId('token')}
						transition:errorSlideFade
					>
						{validation.errors.token}
					</p>
				{/if}
			</label>

			<label>
				Email
				<input
					type="email"
					name="email"
					value={initialEmail}
					autocomplete="email"
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
				New Seal
				<input
					type="password"
					name="password"
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

			<button type="submit">Create account</button>
		</form>

		{#if form?.error}
			<p role="alert">{form.error}</p>
		{/if}
	{/if}
</main>
