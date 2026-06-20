<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';

	let { form } = $props();

	// Build the shareable sign-up link from the minted token + current origin.
	// Derived from the form result so it updates whenever a new invite is minted.
	const inviteLink = $derived(
		form?.token ? `${page.url.origin}/sign-up?token=${form.token}` : null
	);

	let minting = $state(false);

	const submitCreate = () => {
		minting = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			minting = false;
		};
	};
</script>

<h1>Invite a friend</h1>
<p>Top Dog is invite-only. Mint a single-use link and share it with someone you trust.</p>

<form method="POST" action="?/create" use:enhance={submitCreate}>
	<button type="submit" disabled={minting}>
		{minting ? 'Generating…' : 'Generate invite link'}
	</button>
</form>

{#if form?.error}
	<p role="alert">{form.error}</p>
{/if}

{#if inviteLink}
	<p>Share this single-use link:</p>
	<input type="text" readonly value={inviteLink} aria-label="Invite link" />
{/if}
