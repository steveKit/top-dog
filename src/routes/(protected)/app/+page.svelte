<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<h1>Your kennel</h1>
<p>Signed in as {data.user?.email ?? 'unknown'}.</p>

<nav>
	<a href={resolve('/(protected)/app/dogs')}>Your hot dogs</a>
	<a href={resolve('/(protected)/app/feed')}>The feed</a>
</nav>
