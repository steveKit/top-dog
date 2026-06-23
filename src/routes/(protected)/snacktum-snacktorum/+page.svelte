<script lang="ts">
	// The bare `/snacktum-snacktorum` hub is retired (TASK-080): its
	// `+page.server.ts` always redirects to The Procession
	// (`/snacktum-snacktorum/procession`), and the persistent app shell (`+layout.svelte`)
	// now owns navigation on every page. This body therefore never renders in
	// practice; it remains only as a minimal SSR fallback in case the redirect is
	// somehow bypassed. The old inline nav now lives in the shell, and the Top Dog
	// Privileges notice was retired in M8 — Top Dog powers are documented in the
	// Catechism (`/snacktum-snacktorum/catechism`), and the crown-gated Tribunal nav link
	// covers adjudication in the Court.
</script>

<p>Redirecting to The Procession…</p>
