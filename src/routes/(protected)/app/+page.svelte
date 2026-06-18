<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<h1>Your kennel</h1>
<p>Signed in as {data.user?.email ?? 'unknown'}.</p>

<nav>
	<a href={resolve('/(protected)/app/dogs')}>Your hot dogs</a>
	<a href={resolve('/(protected)/app/feed')}>The feed</a>
	<a href={resolve('/(protected)/app/messages')}>Messages</a>
	<!-- The 🍔 Hamburger Court adjudication surface is the current Top Dog's alone
	     (TASK-073). Gated on the live, non-client-writable crown flag (decision #25);
	     the court route's own load + the DB RPC re-check it authoritatively. -->
	{#if data.profile?.is_current_top_dog}
		<a href={resolve('/(protected)/app/court')}>🍔 Hamburger Court</a>
	{/if}
</nav>
