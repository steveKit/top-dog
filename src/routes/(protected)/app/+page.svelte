<script lang="ts">
	let { data } = $props();
</script>

<h1>Your kennel</h1>
<p>Signed in as {data.user?.email ?? 'unknown'}.</p>
