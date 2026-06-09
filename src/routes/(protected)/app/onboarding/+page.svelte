<script lang="ts">
	import { enhance } from '$app/forms';
	import { compressToWebp } from '$lib/image/compress';

	let { form } = $props();

	// Preserve whatever the server echoed back on a failed submit. The 401 (no
	// session) fail shape omits the echoed field values, so narrow with `in`.
	const initialHandle = $derived(form && 'handle' in form ? form.handle : '');
	const initialDisplayName = $derived(form && 'displayName' in form ? form.displayName : '');

	// Client-side avatar state. `compressToWebp` is browser-only (canvas), so the
	// chosen file is compressed to WebP in the enhance submit handler below and the
	// FormData's `avatar` entry is swapped for the smaller WebP blob before it goes
	// to the server (which only uploads it).
	let avatarError = $state<string | null>(null);
	let submitting = $state(false);

	const submit = () => {
		submitting = true;
		return async ({ formData, update }: { formData: FormData; update: () => Promise<void> }) => {
			const file = formData.get('avatar');
			if (file instanceof File && file.size > 0) {
				try {
					const webp = await compressToWebp(file);
					formData.set('avatar', webp, 'avatar.webp');
				} catch {
					avatarError = "That image couldn't be processed. Try a different photo.";
					submitting = false;
					// Drop the unusable file so the rest of the form still submits.
					formData.delete('avatar');
				}
			}
			await update();
			submitting = false;
		};
	};
</script>

<h1>Set up your profile</h1>
<p>Pick a handle so other chefs can find you. You can add an avatar now or later.</p>

<form method="POST" enctype="multipart/form-data" use:enhance={submit}>
	<label>
		Handle
		<input
			type="text"
			name="handle"
			value={initialHandle}
			minlength="2"
			maxlength="32"
			placeholder="hot_dog_chef"
			autocomplete="username"
			required
		/>
	</label>

	<label>
		Display name
		<input
			type="text"
			name="display_name"
			value={initialDisplayName}
			placeholder="Defaults to your handle"
			autocomplete="name"
		/>
	</label>

	<label>
		Avatar (optional)
		<input type="file" name="avatar" accept="image/*" />
	</label>

	<button type="submit" disabled={submitting}>
		{submitting ? 'Setting up…' : 'Create profile'}
	</button>
</form>

{#if avatarError}
	<p role="alert">{avatarError}</p>
{/if}

{#if form?.error}
	<p role="alert">{form.error}</p>
{/if}
