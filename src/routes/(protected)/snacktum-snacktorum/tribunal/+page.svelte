<script lang="ts">
	// The Tribunal of the Holy Tube — the Top-Dog-only adjudication docket (TASK-073,
	// rebuilt from design/pages/The Tribunal.dc.html as M8 TASK-099). This is a
	// RE-SKIN: +page.server.ts (the double-gated load + the verdict action) is
	// preserved byte-identical; every value is re-wired into the tribunal markup. The
	// mockup's header / champion sub-bar belong to the persistent app shell
	// (+layout.svelte) and are NOT re-rendered here — this page owns only the docket.
	//
	// Reporter anonymity (decision #27) is preserved structurally: the docket is driven
	// solely by data.flagged — an ANONYMOUS aggregate (per-dog report COUNT only, no
	// reporter ids). The verdict write stays the ?/rule form → render_burger_verdict
	// RPC, which re-checks the crown authoritatively (decision #25). No query is
	// widened, no service-client call lives in this component.
	//
	// XSS-safe: captions/handles bind as text (no {@html}); the verdict values are
	// fixed strings on hidden inputs.

	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ConfirmedHamburgerStamp from '$lib/components/ConfirmedHamburgerStamp.svelte';

	let { data, form } = $props();

	const flagged = $derived(data.flagged);

	// Which ruling is in flight, keyed `${dogId}:${verdict}` so only the clicked
	// button shows a pending label and every ruling button disables while it settles.
	let pendingRule = $state<string | null>(null);

	const submitRule = (key: string) => {
		pendingRule = key;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			pendingRule = null;
			await invalidateAll();
		};
	};

	function reportText(count: number): string {
		return `${count} ${count === 1 ? 'report' : 'reports'}`;
	}
</script>

<main class="tribunal">
	<div class="glow-orb" aria-hidden="true"></div>

	<span class="eyebrow tribunal-eyebrow">The Anointed Wiener Adjudicates</span>
	<h1 class="tribunal-title">The Tribunal of the Holy Tube</h1>
	<div class="ornament-divider tribunal-divider" aria-hidden="true">☩</div>
	<p class="tribunal-lede">
		Thou alone holdest the crown, and thine is the verdict. Confirm a heresy to brand its maker a
		<span class="brand-heretic">Hamburger Heretic</span>; absolve it to brand every false accuser a
		<span class="brand-witness">False Witness</span>.
	</p>

	{#if form?.message}
		<p class="tribunal-error" role="alert">{form.message}</p>
	{/if}

	{#if flagged.length === 0}
		<div class="tribunal-empty">
			<svg
				class="tribunal-empty-mark"
				viewBox="0 0 200 200"
				fill="none"
				stroke="var(--accent)"
				stroke-width="3"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<g stroke-width="2.5" opacity="0.9">
					<line x1="100" y1="30" x2="100" y2="14" />
					<line x1="74" y1="36" x2="64" y2="22" />
					<line x1="126" y1="36" x2="136" y2="22" />
					<line x1="52" y1="50" x2="40" y2="40" />
					<line x1="148" y1="50" x2="160" y2="40" />
				</g>
				<ellipse cx="100" cy="58" rx="42" ry="11" />
				<rect x="52" y="98" width="96" height="26" rx="13" fill="var(--accent-fill)" />
				<path d="M66 110 q8 -7 16 0 q8 7 16 0 q8 -7 16 0 q8 7 16 0" stroke-width="2.6" />
				<path
					d="M44 122 q0 -4 6 -4 h100 q6 0 6 4 v6 q0 18 -22 18 h-68 q-22 0 -22 -18 z"
					fill="var(--accent-fill)"
				/>
			</svg>
			<p class="tribunal-empty-line">No links stand accused. The Order is honest.</p>
		</div>
	{:else}
		<ul class="docket">
			{#each flagged as dog (dog.id)}
				{@const isAwaiting = dog.verdict === null}
				{@const isConfirmed = dog.verdict === 'confirmed_hamburger'}
				{@const isNotBurger = dog.verdict === 'not_a_hamburger'}
				<li>
					<article class="case fade-up">
						<div class="case-image">
							{#if dog.signedUrl}
								<img src={dog.signedUrl} alt={dog.caption ?? 'A flagged hot dog'} />
							{:else}
								<span class="case-image-missing">The sacred link is veiled.</span>
							{/if}

							{#if isAwaiting}
								<div class="accused-tape" aria-hidden="true">
									<span class="accused-tape-text">⚠ ACCUSED</span>
								</div>
							{:else if isConfirmed}
								<ConfirmedHamburgerStamp dogId={dog.id} />
							{/if}
						</div>

						<div class="case-body">
							{#if isAwaiting}
								<span class="case-state case-state-awaiting">⚖ Awaiting Thy Ruling</span>
							{:else if isConfirmed}
								<span class="case-state case-state-confirmed">Ruled · Confirmed Hamburger 🍔</span>
							{:else if isNotBurger}
								<span class="case-state case-state-notburger">Ruled · Not a Hamburger 🌭</span>
							{/if}

							<p class="case-attribution">
								<span class="case-attribution-pre">made by</span>
								<a
									class="case-handle"
									href={resolve('/(protected)/snacktum-snacktorum/shrine/[handle]', {
										handle: dog.ownerHandle
									})}>@{dog.ownerHandle}</a
								>
							</p>

							{#if dog.caption}
								<p class="case-caption">&ldquo;{dog.caption}&rdquo;</p>
							{/if}

							<span class="case-reports">{reportText(dog.reportCount)}</span>

							<div class="case-rulings">
								{#if isAwaiting}
									<form
										method="POST"
										action="?/rule"
										use:enhance={() => submitRule(`${dog.id}:confirmed`)}
									>
										<input type="hidden" name="dogId" value={dog.id} />
										<input type="hidden" name="verdict" value="confirmed_hamburger" />
										<button
											class="rule-btn rule-confirm"
											type="submit"
											disabled={pendingRule !== null}
										>
											{#if pendingRule === `${dog.id}:confirmed`}
												Ruling…
											{:else}
												Confirmed Hamburger →
											{/if}
										</button>
									</form>
									<form
										method="POST"
										action="?/rule"
										use:enhance={() => submitRule(`${dog.id}:cleared`)}
									>
										<input type="hidden" name="dogId" value={dog.id} />
										<input type="hidden" name="verdict" value="not_a_hamburger" />
										<button
											class="rule-btn rule-absolve"
											type="submit"
											disabled={pendingRule !== null}
										>
											{#if pendingRule === `${dog.id}:cleared`}
												Ruling…
											{:else}
												Not a Hamburger →
											{/if}
										</button>
									</form>
								{:else if isConfirmed}
									<p class="case-outcome case-outcome-confirmed">
										@{dog.ownerHandle} is branded a Hamburger Heretic — permanently.
									</p>
								{:else if isNotBurger}
									<p class="case-outcome case-outcome-notburger">
										The {dog.reportCount}
										{dog.reportCount === 1 ? 'accuser stands' : 'accusers stand'} as False {dog.reportCount ===
										1
											? 'Witness'
											: 'Witnesses'} — the mark shall fade.
									</p>
								{/if}
							</div>
						</div>
					</article>
				</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	/* The Tribunal is a centered docket column. All values reference theme tokens (no
	   magic hex/px); the gold accent themes via [data-accent]. Self-caps to the
	   ~760px docket measure per the App Chrome full-bleed invariant (wrapped in
	   .shell-content). */
	.tribunal {
		position: relative;
		max-width: 47.5rem;
		margin: 0 auto;
		padding-bottom: var(--space-3xl);
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.tribunal .glow-orb {
		top: -200px;
	}

	.tribunal-eyebrow {
		position: relative;
		z-index: 1;
		letter-spacing: var(--tracking-wide);
		text-align: center;
	}

	.tribunal-title {
		position: relative;
		z-index: 1;
		margin: var(--space-sm) 0 0;
		font-family: var(--font-display);
		font-size: var(--text-h1);
		font-weight: 600;
		line-height: 1.04;
		letter-spacing: var(--tracking-tight);
		color: var(--color-heading);
		text-align: center;
		text-shadow: var(--text-shadow-hero);
	}

	.tribunal-divider {
		margin-top: var(--space-lg);
	}

	.tribunal-lede {
		position: relative;
		z-index: 1;
		max-width: 35rem;
		margin: var(--space-md) 0 0;
		font-family: var(--font-body);
		font-size: var(--text-xl);
		font-style: italic;
		line-height: 1.55;
		color: var(--color-text-muted);
		text-align: center;
		text-wrap: pretty;
	}

	.brand-heretic {
		font-style: normal;
		font-weight: 600;
		color: var(--color-error);
	}

	.brand-witness {
		font-style: normal;
		font-weight: 600;
		color: var(--accent);
	}

	.tribunal-error {
		position: relative;
		z-index: 1;
		margin: var(--space-lg) 0 0;
		padding: var(--space-sm) var(--space-lg);
		max-width: 35rem;
		font-family: var(--font-body);
		font-size: var(--text-base);
		color: var(--color-error);
		border: 1px solid var(--color-error);
		border-radius: var(--radius-control);
		text-align: center;
	}

	/* ===== EMPTY STATE ===== */
	.tribunal-empty {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 33.75rem;
		margin-top: var(--space-2xl);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-lg);
		padding: var(--space-3xl) var(--space-lg);
		border: 1px dashed var(--accent-border);
		border-radius: var(--radius-card);
		background: var(--accent-fill);
	}

	.tribunal-empty-mark {
		width: 6.875rem;
		height: 6.875rem;
		opacity: 0.82;
	}

	.tribunal-empty-line {
		margin: 0;
		font-family: var(--font-body);
		font-size: var(--text-xl);
		font-style: italic;
		color: var(--color-text-faint);
		text-align: center;
		text-wrap: pretty;
	}

	/* ===== DOCKET ===== */
	.docket {
		position: relative;
		z-index: 1;
		width: 100%;
		margin: var(--space-2xl) 0 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.case {
		position: relative;
		display: flex;
		gap: var(--space-lg);
		padding: var(--space-lg);
		background: var(--color-bg-mid);
		border: 1px solid var(--accent-border);
		border-radius: var(--radius-card);
		box-shadow: var(--shadow-card);
	}

	/* The accused frank's image, framed in gold, with the police-tape / stamp
	   overlay inset on top. */
	.case-image {
		position: relative;
		flex: none;
		width: 8.25rem;
		height: 8.25rem;
		border: 2px solid var(--accent-soft);
		border-radius: var(--radius-control);
		overflow: hidden;
		background: var(--color-bg-deep);
		line-height: 0;
	}

	.case-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.case-image-missing {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		padding: var(--space-sm);
		font-family: var(--font-body);
		font-size: var(--text-sm);
		font-style: italic;
		color: var(--color-text-faint);
		text-align: center;
		line-height: 1.4;
	}

	/* The ⚠ ACCUSED police-tape stripe across the awaiting frank's image. */
	.accused-tape {
		position: absolute;
		top: 50%;
		left: -14%;
		width: 128%;
		transform: translateY(-50%) rotate(-12deg);
		padding: var(--space-2xs) 0;
		text-align: center;
		pointer-events: none;
		background: repeating-linear-gradient(
			45deg,
			var(--accent) 0,
			var(--accent) 11px,
			var(--color-bg-lift) 11px,
			var(--color-bg-lift) 22px
		);
		box-shadow: var(--shadow-button);
	}

	.accused-tape-text {
		display: inline-block;
		padding: 0.125rem var(--space-xs);
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 700;
		letter-spacing: var(--tracking-tight);
		color: var(--color-on-accent);
		background: var(--accent);
	}

	/* ===== CASE BODY ===== */
	.case-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.case-state {
		font-family: var(--font-display);
		font-size: var(--text-label);
		font-weight: 700;
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
	}

	.case-state-awaiting {
		color: var(--color-text-muted);
	}

	.case-state-confirmed {
		color: var(--color-error);
	}

	.case-state-notburger {
		color: var(--accent);
	}

	.case-attribution {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: var(--space-xs);
		margin: 0;
	}

	.case-attribution-pre {
		font-family: var(--font-body);
		font-size: var(--text-base);
		color: var(--color-text-faint);
	}

	.case-handle {
		font-family: var(--font-display);
		font-size: var(--text-sm);
		font-weight: 600;
		letter-spacing: var(--tracking-tight);
		color: var(--accent);
		text-decoration: none;
	}

	.case-handle:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.case-caption {
		margin: 0;
		font-family: var(--font-body);
		font-size: var(--text-lg);
		font-style: italic;
		color: var(--color-text);
		text-wrap: pretty;
	}

	.case-reports {
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 600;
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: var(--accent-strong);
	}

	/* ===== RULING CONTROLS ===== */
	.case-rulings {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
		margin-top: var(--space-2xs);
	}

	.case-rulings form {
		margin: 0;
	}

	.rule-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-sm) var(--space-lg);
		border-radius: var(--radius-control);
		background: transparent;
		font-family: var(--font-display);
		font-size: var(--text-label);
		font-weight: 600;
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		cursor: pointer;
	}

	.rule-confirm {
		color: var(--color-error);
		border: 1.5px solid var(--color-error);
	}

	.rule-confirm:hover:not(:disabled) {
		background: var(--accent-fill);
	}

	.rule-absolve {
		color: var(--accent);
		border: 1.5px solid var(--accent);
	}

	.rule-absolve:hover:not(:disabled) {
		background: var(--accent-fill);
	}

	.rule-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.case-outcome {
		margin: 0;
		font-family: var(--font-body);
		font-size: var(--text-sm);
		font-style: italic;
	}

	.case-outcome-confirmed {
		color: var(--color-error);
	}

	.case-outcome-notburger {
		color: var(--accent-strong);
	}

	/* Responsive: stack the image above the body on narrow viewports. */
	@media (max-width: 36rem) {
		.case {
			flex-direction: column;
			align-items: center;
		}

		.case-body {
			width: 100%;
		}
	}
</style>
