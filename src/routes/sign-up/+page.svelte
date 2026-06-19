<script lang="ts">
	import { enhance } from '$app/forms';
	import theHolyTube from '$lib/assets/brand/the-holy-tube.svg';

	let { data, form } = $props();

	// Pre-fill the token from the invite link (?token=...) on first load, and
	// preserve whatever the server echoed back on a failed submit.
	const initialToken = $derived(form?.token ?? data.token);
	const initialEmail = $derived(form?.email ?? '');
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

		<form method="POST" use:enhance>
			<label>
				Invite token
				<input type="text" name="token" value={initialToken} required />
			</label>

			<label>
				Email
				<input type="email" name="email" value={initialEmail} autocomplete="email" required />
			</label>

			<label>
				Password
				<input type="password" name="password" autocomplete="new-password" minlength="8" required />
			</label>

			<button type="submit">Create account</button>
		</form>

		{#if form?.error}
			<p role="alert">{form.error}</p>
		{/if}
	{/if}
</main>

<style>
	/* The Holy Tube — a decorative brand mark crowning the page, sized as a
	   tasteful relic above the title. Token-sized for a consistent treatment
	   across all four gate pages. align-self centers it within the
	   (column-flex) .gate-center, which doesn't center its cross axis. */
	.gate-mark {
		width: var(--space-3xl);
		height: var(--space-3xl);
		display: block;
		align-self: center;
	}
</style>
