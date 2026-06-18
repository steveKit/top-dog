<script lang="ts">
	// 👑 Top Dog privileges notice — shown to the crown-holder only. The CALLER
	// gates rendering on the live, server-derived `is_current_top_dog` crown flag
	// (decision #25, re-derived each load, never cached), so this component
	// appears on gaining the crown and disappears on losing it. It is purely
	// presentational plus a client-only dismiss toggle — no server round-trip.
	//
	// Dismissal is persisted per-browser in `localStorage` with NO schema (no
	// migration, no `profiles` column). `localStorage` is browser-only, so we
	// only touch it behind the `browser` guard and inside the mount `$effect`.
	// XSS-safe: all copy is fixed strings, links use `resolve` — no {@html}, no
	// user-supplied content.

	import { resolve } from '$app/paths';
	import { browser } from '$app/environment';
	import { isNoticeDismissed, persistNoticeDismissed } from './topDogPrivilegesNotice';

	let isDismissed = $state(false);

	// Hydrate the dismissed flag from storage once on mount (browser only). On the
	// server `browser` is false, so the notice renders by default; the client then
	// hides it if this browser already dismissed it.
	$effect(() => {
		if (browser) {
			isDismissed = isNoticeDismissed(localStorage);
		}
	});

	function dismiss() {
		isDismissed = true;
		if (browser) {
			persistNoticeDismissed(localStorage);
		}
	}
</script>

{#if !isDismissed}
	<aside class="notice" role="note" aria-label="Top Dog privileges">
		<button class="dismiss" type="button" onclick={dismiss} aria-label="Dismiss notice">×</button>
		<h2>👑 Top Dog privileges</h2>
		<p>You hold the crown. While you're the Top Dog you can:</p>
		<ul>
			<li>
				<a href={resolve('/(protected)/app/court')}>🍔 Adjudicate hamburger reports</a> in the Hamburger
				Court — you alone decide what's a hot dog and what's a hamburger.
			</li>
			<li>
				🟡 <strong>Spray mustard</strong> on another member's profile. Visit a member's profile
				(find them via <a href={resolve('/(protected)/app/feed')}>the feed</a>) to spray.
			</li>
		</ul>
	</aside>
{/if}

<style>
	.notice {
		position: relative;
		border: 2px solid #f5c518;
		background: #fffbe6;
		border-radius: 0.5rem;
		padding: 1rem 1.25rem;
		margin: 1rem 0;
	}

	.notice h2 {
		margin: 0 0 0.5rem;
		font-size: 1.1rem;
	}

	.notice p {
		margin: 0 0 0.5rem;
	}

	.notice ul {
		margin: 0;
		padding-left: 1.25rem;
	}

	.notice li + li {
		margin-top: 0.4rem;
	}

	.dismiss {
		position: absolute;
		top: 0.4rem;
		right: 0.5rem;
		border: none;
		background: transparent;
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
		color: #555;
	}

	.dismiss:hover {
		color: #000;
	}
</style>
