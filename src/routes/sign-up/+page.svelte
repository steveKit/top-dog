<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	// Pre-fill the token from the invite link (?token=...) on first load, and
	// preserve whatever the server echoed back on a failed submit.
	const initialToken = $derived(form?.token ?? data.token);
	const initialEmail = $derived(form?.email ?? '');
</script>

<h1>Sign up</h1>
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
