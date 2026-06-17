<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { compressToWebp } from '$lib/image/compress';
	import TopDogBadge from '$lib/components/TopDogBadge.svelte';
	import HamburgerAlarmBanner from '$lib/components/HamburgerAlarmBanner.svelte';

	let { data, form } = $props();

	// Preserve the caption the server echoed back on a failed upload.
	const initialCaption = $derived(form && 'caption' in form ? form.caption : '');

	let photoError = $state<string | null>(null);
	let uploading = $state(false);

	// Compression is browser-only (canvas), so the chosen photo is compressed to
	// WebP here in the enhance submit handler and the FormData's `photo` entry is
	// swapped for the smaller WebP blob before it goes to the server (which only
	// uploads + inserts the row).
	const submitUpload = () => {
		photoError = null;
		uploading = true;
		return async ({ formData, update }: { formData: FormData; update: () => Promise<void> }) => {
			const file = formData.get('photo');
			if (file instanceof File && file.size > 0) {
				try {
					const webp = await compressToWebp(file);
					formData.set('photo', webp, 'hotdog.webp');
				} catch {
					photoError = "That image couldn't be processed. Try a different photo.";
					uploading = false;
					formData.delete('photo');
					return;
				}
			}
			await update();
			uploading = false;
			await invalidateAll();
		};
	};

	let deleting = $state<string | null>(null);

	const submitDelete = (id: string) => {
		deleting = id;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			deleting = null;
			await invalidateAll();
		};
	};
</script>

<h1>Your hot dogs</h1>
<p>{data.dogs.length} / {data.cap} — delete one to add another once you hit the cap.</p>

<form method="POST" action="?/upload" enctype="multipart/form-data" use:enhance={submitUpload}>
	<label>
		Photo
		<input type="file" name="photo" accept="image/*" required />
	</label>

	<label>
		Caption (optional)
		<input
			type="text"
			name="caption"
			value={initialCaption}
			maxlength="280"
			placeholder="A fine frank"
		/>
	</label>

	<button type="submit" disabled={uploading}>
		{uploading ? 'Uploading…' : 'Add hot dog'}
	</button>
</form>

{#if photoError}
	<p role="alert">{photoError}</p>
{/if}

{#if form?.error}
	<p role="alert">{form.error}</p>
{/if}

{#if data.dogs.length === 0}
	<p>No hot dogs yet. Upload your first one!</p>
{:else}
	<ul>
		{#each data.dogs as dog (dog.id)}
			<li>
				{#if data.isCurrentTopDog && dog.id === data.topDogId}
					<TopDogBadge label="Top Dog" />
				{/if}
				{#if dog.signedUrl}
					<div class="dog-image">
						<img src={dog.signedUrl} alt={dog.caption ?? 'A hot dog'} width="240" />
						{#if dog.alarm.active}
							<HamburgerAlarmBanner
								dogId={dog.id}
								intensity={dog.alarm.intensity}
								reporterCount={dog.alarm.reporterCount}
							/>
						{/if}
					</div>
				{:else}
					<span>Image unavailable</span>
				{/if}
				{#if dog.caption}
					<p>{dog.caption}</p>
				{/if}
				<p>Peak: {dog.peak_votes}</p>
				<p><a href={resolve('/(protected)/app/dogs/[id]', { id: dog.id })}>View details</a></p>
				<form method="POST" action="?/delete" use:enhance={() => submitDelete(dog.id)}>
					<input type="hidden" name="id" value={dog.id} />
					<button type="submit" disabled={deleting === dog.id}>
						{deleting === dog.id ? 'Deleting…' : 'Delete'}
					</button>
				</form>
			</li>
		{/each}
	</ul>
{/if}

<style>
	/* Positioned wrapper so the absolutely-positioned alarm overlay covers the
	   dog image exactly (the banner component is inset:0 within this box). */
	.dog-image {
		position: relative;
		display: inline-block;
		line-height: 0;
	}
</style>
