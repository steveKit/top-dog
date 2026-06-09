<script lang="ts">
	let { data } = $props();

	const profile = $derived(data.profile);
	const avatarUrl = $derived(data.avatarUrl);

	// Friendly join date from the stored timestamp.
	const joinedAt = $derived(
		new Date(profile.joined_at).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		})
	);
</script>

<article>
	{#if avatarUrl}
		<img src={avatarUrl} alt="{profile.display_name}'s avatar" width="96" height="96" />
	{:else}
		<div class="avatar-placeholder" aria-hidden="true">🌭</div>
	{/if}

	<h1>{profile.display_name}</h1>
	<p class="handle">@{profile.handle}</p>

	{#if profile.is_current_top_dog}
		<p class="badge" role="status">👑 Current Top Dog</p>
	{/if}

	<p class="joined">Joined {joinedAt}</p>

	<dl class="stats">
		<div>
			<dt>Days as Top Dog</dt>
			<dd>{profile.days_as_top_dog}</dd>
		</div>
	</dl>
</article>
