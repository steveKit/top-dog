<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';

	// Summon a Frank — the invite-mint page, rebuilt from
	// design/pages/Summon a Frank.dc.html (M8 TASK-098). A RE-SKIN of the
	// unchanged invite flow: +page.server.ts (the `create` action minting a
	// single-use invite token server-side) is PRESERVED and re-wired into the new
	// temple "summon" markup. The mockup's header / nav / Offer-a-Frank chrome
	// belongs to the persistent app shell (+layout.svelte) and is NOT re-rendered
	// here; this page owns the centered summoning column only.

	let { form } = $props();

	// The mint submit is in flight. Drives the disabled "Summoning…" state — the
	// preserved enhance pattern from the original page.
	let minting = $state(false);

	// "Mint another summons" clears the current result back to the idle state
	// WITHOUT re-running load — we just stop rendering the minted block. A fresh
	// submit replaces `form` and re-shows it.
	let dismissed = $state(false);

	// Whether the link was just copied (transient "Copied ✓" affordance).
	let copied = $state(false);

	// Build the shareable sign-up link from the minted token + the CURRENT origin
	// (not the mockup's literal snacktum.faith). Null until a token is minted.
	const inviteLink = $derived(
		!dismissed && form?.token ? `${page.url.origin}/sign-up?token=${form.token}` : null
	);

	const hasError = $derived(!dismissed && Boolean(form?.error));

	// Idle = nothing minted, no error, not in flight.
	const isIdle = $derived(!minting && !inviteLink && !hasError);

	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	const submitCreate = () => {
		minting = true;
		dismissed = false;
		copied = false;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			minting = false;
		};
	};

	function reset() {
		dismissed = true;
		copied = false;
	}

	async function copyLink() {
		if (!inviteLink) return;
		let ok = false;
		try {
			await navigator.clipboard.writeText(inviteLink);
			ok = true;
		} catch {
			// Fall back to the legacy select + execCommand path when the async
			// Clipboard API is unavailable (insecure context, older browser).
			const el = linkInput;
			if (el) {
				el.focus();
				el.select();
				el.setSelectionRange(0, inviteLink.length);
				try {
					ok = document.execCommand('copy');
				} catch {
					ok = false;
				}
			}
		}
		if (ok) {
			copied = true;
			clearTimeout(copyTimer);
			copyTimer = setTimeout(() => {
				copied = false;
			}, 1700);
		}
	}

	let linkInput: HTMLInputElement | null = $state(null);
</script>

<main class="summon" aria-label="Summon a Frank">
	<div class="glow-orb" aria-hidden="true"></div>

	<svg
		class="summon-mark"
		viewBox="0 0 200 200"
		width="150"
		height="150"
		fill="none"
		stroke="currentColor"
		stroke-width="3"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<g stroke-width="2.5" opacity="0.92">
			<line x1="100" y1="30" x2="100" y2="12" />
			<line x1="74" y1="36" x2="64" y2="20" />
			<line x1="126" y1="36" x2="136" y2="20" />
			<line x1="52" y1="50" x2="38" y2="38" />
			<line x1="148" y1="50" x2="162" y2="38" />
			<line x1="40" y1="70" x2="24" y2="66" />
			<line x1="160" y1="70" x2="176" y2="66" />
		</g>
		<ellipse cx="100" cy="58" rx="42" ry="11" />
		<rect x="52" y="98" width="96" height="26" rx="13" fill="var(--accent-fill-strong)" />
		<path d="M66 110 q8 -7 16 0 q8 7 16 0 q8 -7 16 0 q8 7 16 0" stroke-width="2.6" />
		<path
			d="M44 122 q0 -4 6 -4 h100 q6 0 6 4 v6 q0 18 -22 18 h-68 q-22 0 -22 -18 z"
			fill="var(--accent-fill)"
		/>
	</svg>

	<span class="eyebrow">Extend the Summons</span>
	<h1>Summon a Frank</h1>
	<div class="ornament-divider" aria-hidden="true">✦</div>
	<p class="lede">
		The Order admits none uninvited. Mint a single-use summoning token and bestow it upon one you
		trust.
	</p>

	<!-- The mint posts to the PRESERVED `create` action; the in-flight `minting`
	     $state drives the disabled "Summoning…" label. -->
	<form method="POST" action="?/create" use:enhance={submitCreate}>
		{#if isIdle}
			<button class="btn-relic" type="submit">Mint a Summoning Token →</button>
		{:else if minting}
			<button class="btn-relic" type="submit" disabled>Summoning…</button>
		{/if}
	</form>

	{#if hasError}
		<div class="summon-error fade-up">
			<p class="error-line" role="alert">{form?.error}</p>
			<form method="POST" action="?/create" use:enhance={submitCreate}>
				<button class="btn-relic btn-relic--small" type="submit">Try Again →</button>
			</form>
		</div>
	{/if}

	{#if inviteLink}
		<div class="minted fade-up">
			<span class="minted-label">Bestow this single-use summons:</span>

			<div class="minted-row">
				<input
					bind:this={linkInput}
					class="minted-input"
					type="text"
					readonly
					value={inviteLink}
					aria-label="Single-use summoning link"
				/>
				<button class="copy-btn" type="button" onclick={copyLink}>
					{#if copied}<span class="copied-mark">Copied ✓</span>{:else}Copy{/if}
				</button>
			</div>

			<span class="minted-note"
				>Once redeemed, this summons is spent — mint anew for each disciple.</span
			>

			<button class="btn-text" type="button" onclick={reset}>Mint another summons</button>
		</div>
	{/if}
</main>

<style>
	/* Summon a Frank is a centered, narrow temple column (the mockup caps <main>
	   at ~520px). The shell wraps the page in .shell-content already; this column
	   self-caps and centers. All values reference theme tokens — no magic hex/px;
	   the gold accent themes via [data-accent]. */
	.summon {
		position: relative;
		max-width: 32.5rem; /* ~520px, matching the mockup's <main> cap */
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: var(--space-lg);
		padding: var(--space-3xl) var(--space-lg);
	}

	.summon .glow-orb {
		top: -180px;
	}

	/* The haloed summons sigil (a decorative grill mark). */
	.summon-mark {
		position: relative;
		z-index: 1;
		display: block;
		color: var(--accent);
	}

	.summon :global(.eyebrow),
	.summon h1,
	.summon .ornament-divider,
	.summon .lede,
	.summon form,
	.summon .summon-error,
	.summon .minted {
		position: relative;
		z-index: 1;
	}

	.summon h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--text-h1);
		font-weight: 600;
		letter-spacing: var(--tracking-tight);
		color: var(--color-heading);
		text-shadow: var(--text-shadow-hero);
	}

	.lede {
		max-width: 27.5rem;
		margin: 0;
		font-family: var(--font-body);
		font-size: var(--text-lg);
		line-height: 1.55;
		color: var(--color-text-muted);
		text-wrap: pretty;
	}

	.summon form {
		margin: 0;
	}

	/* The error state: the rust-warm message + a retry. */
	.summon-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-md);
	}

	.error-line {
		margin: 0;
		font-family: var(--font-body);
		font-style: italic;
		font-size: var(--text-base);
		color: var(--color-error);
	}

	.btn-relic--small {
		padding: 0.8125rem 2.25rem;
		font-size: var(--text-label);
	}

	/* The minted single-use link + copy affordance. */
	.minted {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-sm);
		width: 100%;
		max-width: 28.75rem;
	}

	.minted-label {
		font-family: var(--font-body);
		font-style: italic;
		font-size: var(--text-base);
		color: var(--accent-strong);
	}

	.minted-row {
		display: flex;
		align-items: stretch;
		gap: var(--space-sm);
		width: 100%;
	}

	.minted-input {
		flex: 1;
		min-width: 0;
		background: var(--accent-fill);
		border: 1px solid var(--accent-border);
		border-bottom: 1.5px solid var(--accent);
		border-radius: var(--radius-control);
		padding: 0.8125rem 0.9375rem;
		color: var(--color-text);
		font-family: var(--font-body);
		font-size: var(--text-base);
	}

	.copy-btn {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2xs);
		padding: 0 var(--space-lg);
		background: var(--accent);
		color: var(--color-on-accent);
		border: none;
		border-radius: var(--radius-control);
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 600;
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		cursor: pointer;
	}

	.copy-btn:hover {
		filter: brightness(1.08);
	}

	.copied-mark {
		color: var(--color-on-accent);
	}

	.minted-note {
		font-family: var(--font-body);
		font-style: italic;
		font-size: var(--text-sm);
		color: var(--color-text-faint);
	}

	.minted .btn-text {
		margin-top: var(--space-2xs);
		font-family: var(--font-body);
		font-size: var(--text-base);
	}
</style>
