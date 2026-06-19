<script lang="ts">
	// The bare `/app` hub is retired (TASK-080): its `+page.server.ts` always
	// redirects to The Procession (`/app/feed`), and the persistent app shell
	// (`+layout.svelte`) now owns navigation on every page. This body therefore
	// never renders in practice; it remains only as a minimal SSR fallback in case
	// the redirect is somehow bypassed, and is intentionally empty of the old
	// inline nav and Top Dog notice (both now live in the shell / their own pages).
</script>

<p>Redirecting to The Procession…</p>
