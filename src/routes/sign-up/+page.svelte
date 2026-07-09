<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ordoSeal from '$lib/assets/brand/ordo-sancti-tubi-seal.svg';
	import snacktumHeader from '$lib/assets/brand/snacktum-snacktorum-header.svg';
	import Sigil from '$lib/components/Sigil.svelte';
	import { createFormValidation } from '$lib/features/forms/formValidation.svelte';
	import { errorSlideFade } from '$lib/motion/reducedMotion';
	import {
		SIGIL_IDS,
		SIGIL_NAMES,
		SIGIL_LABELS,
		DEFAULT_SIGIL,
		type SigilId
	} from '$lib/features/profiles/sigils';

	let { data, form } = $props();

	// The two action results carry disjoint shapes; read an optional echoed string
	// field defensively (a register failure echoes token/email; a createProfile
	// failure echoes handle). Returns '' when the field is absent.
	function formField(name: string): string {
		if (form && name in form) {
			const value = (form as Record<string, unknown>)[name];
			if (typeof value === 'string') return value;
		}
		return '';
	}

	// ---- Rite step machine ------------------------------------------------
	// 0 Summoned · 1 Inscribe · 2 Sigil · 3 Renounce · 4 Received. An already-
	// authenticated, profile-less member (funneled here by the app guard) resumes
	// at the Inscribe step in a HANDLE-ONLY mode — they already have an account, so
	// they never re-do invite/credentials, but they DO name themselves (the Casing)
	// here, exactly like a fresh registrant. This keeps the naming on Inscribe for
	// everyone, so Renounce can stay a pure oath. Otherwise the rite begins at
	// Summoned.
	//
	// Step split (TASK-092): the profile is forged at the SIGIL step's Continue (the
	// createProfile form lives there). On success the rite advances Sigil →
	// Renounce. Renounce is then PURE UI — its Continue is a plain button gated
	// SOLELY on `sworn`, with NO form, NO action, NO session check, persisting
	// NOTHING — it just advances to Received. Received holds an explicit "Enter →"
	// into the app (createProfile no longer redirects).
	const STEP = {
		summoned: 0,
		inscribe: 1,
		sigil: 2,
		renounce: 3,
		received: 4
	} as const;

	const beadLabels = ['Summoned', 'Inscribe', 'Sigil', 'Renounce', 'Received'];

	// Whether THIS visitor entered the rite as an authenticated, profile-less
	// resumer (funneled here by the app guard). Snapshot it ONCE at init: after a
	// successful `register`, the enhance `update()` runs `invalidateAll()`, which
	// re-runs `load` — and because a session now exists with no profile yet, `load`
	// returns `resumeAtProfile: true` for a FRESH registrant too. Reading the live
	// prop would then wrongly classify a fresh registrant as a resumer (dropping
	// the handle they just typed by routing them through the handle-only Inscribe).
	// The snapshot keeps the resumer identity fixed to how the visitor actually
	// arrived.
	const isResumer = untrack(() => data.resumeAtProfile);

	// Initial step depends on whether the visitor is an authenticated resumer. A
	// resumer skipped the credential steps but still names themselves, so they
	// begin at Inscribe (in handle-only mode — see the markup). A fresh visitor
	// begins at Summoned. We want the INITIAL value of the prop only (untrack),
	// then drive `step` locally.
	let step = $state<number>(isResumer ? STEP.inscribe : STEP.summoned);

	// Persisted-across-steps rite inputs, seeded ONCE from the page props (the
	// invite-link ?token= or whatever the server echoed back on a failed submit),
	// then owned locally as the member edits. untrack keeps these one-time seeds.
	let token = $state(untrack(() => formField('token') || data.token || ''));
	let handle = $state(untrack(() => formField('handle')));
	let email = $state(untrack(() => formField('email')));
	let password = $state('');
	let sigil = $state<SigilId>(DEFAULT_SIGIL);
	let sworn = $state(false);

	// The canonical (server-validated) handle the createProfile action echoes back
	// on success. Received's "Enter →" links into the app at this handle — the prior
	// createProfile redirect target — so the in-app entry survives the now-in-page
	// advance. Seeded from the typed handle; overwritten by the action's echoed
	// handle once createProfile succeeds at the Sigil step.
	let createdHandle = $state(untrack(() => formField('handle')));

	// Themed inline client-side validation for the Inscribe credentials step. The
	// server still validates authoritatively; this is purely the UX layer.
	const inscribeValidation = createFormValidation();

	// Themed inline validation for a RESUMER's handle-only Inscribe step. A resumer
	// names themselves with a client-side advance (no `register` round-trip), so
	// their Casing field validates through its own instance, independent of the
	// fresh-registrant Inscribe credentials validation.
	const resumeNameValidation = createFormValidation();

	// In-flight affordances for the two server actions.
	let registering = $state(false);
	let creatingProfile = $state(false);

	// When the register action reports success, advance the rite IN-PAGE to the
	// sigil step (single route at /sign-up — no separate onboarding URL).
	$effect(() => {
		if (form && 'registered' in form && form.registered && step === STEP.inscribe) {
			step = STEP.sigil;
		}
	});

	// True when the register action returned the email-confirmation success state
	// (signUp succeeded but there is no session yet).
	function isConfirmEmail(): boolean {
		return Boolean(form && 'confirmEmail' in form && form.confirmEmail);
	}

	const chosenSigilName = $derived(SIGIL_NAMES[sigil]);
	const confirmEmail = $derived(isConfirmEmail());
	const formError = $derived(formField('error'));

	// Received's "Enter →" target — the new Shrine page (the prior createProfile
	// redirect target). Falls back to the typed handle if the echo is somehow empty.
	const enterHref = $derived(
		resolve('/(protected)/snacktum-snacktorum/shrine/[handle]', {
			handle: createdHandle || handle
		})
	);

	function pickSigil(id: SigilId) {
		sigil = id;
	}

	function beginRite() {
		step = STEP.inscribe;
	}

	function swearOath() {
		sworn = true;
	}
</script>

<svelte:head>
	<title>The First Bite — Snacktum Snacktorum</title>
</svelte:head>

<div class="glow-orb" aria-hidden="true"></div>

<main class="rite gate-center">
	<header class="rite-header">
		<img class="rite-header-mark" src={snacktumHeader} alt="Snacktum Snacktorum" />
	</header>

	<div class="rite-center">
		{#if confirmEmail}
			<!-- Email confirmation enabled: signUp returned no session, so the rite can't
			     advance into the profile steps. The invite WAS consumed — this is success. -->
			<section class="rite-step fade-up" aria-live="polite">
				<span class="eyebrow">A Letter Is Sealed</span>
				<h1>Confirm Thy Address</h1>
				<div class="ornament-divider" aria-hidden="true">✦</div>
				<p>
					The Order has dispatched a sealed letter to that mustard-address. Open it and follow the
					link within to complete thy passage through the bite.
				</p>
			</section>
		{:else}
			<div class="rite-body">
				{#if step === STEP.summoned}
					<section class="rite-step fade-up">
						<img class="rite-relic" src={ordoSeal} alt="" aria-hidden="true" />
						<span class="eyebrow">The First Bite</span>
						<h1>You Have Been Summoned</h1>
						<p>
							Hotdog aficionado — the Order has watched you linger at the grill and deems you worthy
							to judge the sacred links. Present your token and take the first bite.
						</p>

						<!-- Summoned only PRESENTS the token (pre-filled from the invite link);
						     the credentials + authoritative redemption happen at Inscribe. This
						     step advances IN-PAGE with no server round-trip. -->
						<div class="rite-form">
							<label>
								<span class="field-label">Your Summoning Token</span>
								<input class="token-input" type="text" name="token" bind:value={token} required />
							</label>

							<button class="btn-relic" type="button" onclick={beginRite}>Take a Bite →</button>
						</div>
					</section>
				{:else if step === STEP.inscribe && isResumer}
					<!-- RESUMER Inscribe (handle-only). An authenticated, profile-less member
					     already has an account, so they get NO mustard-address/seal fields and
					     NO `register` round-trip — they only name themselves (the Casing). The
					     form validates inline with the themed canon, then advances IN-PAGE to
					     Sigil (the enhance inner cancels the POST). The handle they type lives
					     in client $state and carries hidden to createProfile, exactly like a
					     fresh registrant — so Renounce stays a pure oath and createProfile never
					     sees an empty handle. -->
					<section class="rite-step fade-up">
						<img class="rite-relic" src={ordoSeal} alt="" aria-hidden="true" />
						<span class="eyebrow">The Second Bite</span>
						<h1>Inscribe Thy Name</h1>
						<p>Every disciple of the Tube is known by a name. Speak it now.</p>

						<form
							method="POST"
							novalidate
							class="rite-form"
							use:enhance={resumeNameValidation.enhance((submitEvent) => {
								// Validation passed; this is a client-only advance — there is no
								// server action to call (the account already exists). Cancel the
								// POST and move to the Sigil step with the handle held in $state.
								submitEvent.cancel();
								step = STEP.sigil;
							})}
						>
							<label>
								<span class="field-label">Casing</span>
								<input
									type="text"
									name="handle"
									bind:value={handle}
									minlength="2"
									maxlength="32"
									placeholder="e.g. FrankfurterTheFaithful"
									autocomplete="username"
									required
									aria-invalid={resumeNameValidation.invalid('handle')}
									aria-describedby={resumeNameValidation.describedBy('handle')}
									oninput={resumeNameValidation.clearOnInput}
								/>
								{#if resumeNameValidation.errors.handle}
									<p
										class="field-error"
										role="alert"
										id={resumeNameValidation.errorId('handle')}
										transition:errorSlideFade
									>
										{resumeNameValidation.errors.handle}
									</p>
								{/if}
							</label>

							<div class="rite-actions">
								<button class="btn-relic" type="submit">Continue →</button>
							</div>
						</form>
					</section>
				{:else if step === STEP.inscribe}
					<section class="rite-step fade-up">
						<img class="rite-relic" src={ordoSeal} alt="" aria-hidden="true" />
						<span class="eyebrow">The Second Bite</span>
						<h1>Inscribe Thy Name</h1>
						<p>
							Every disciple of the Tube is known by a name, a mustard-address, and a seal. Speak
							them now.
						</p>

						<form
							method="POST"
							action="?/register"
							novalidate
							class="rite-form"
							use:enhance={inscribeValidation.enhance(() => {
								registering = true;
								return async ({ update }) => {
									// Keep the entered values on failure so the rite repopulates;
									// the $effect advances the step when register succeeds.
									await update({ reset: false });
									registering = false;
								};
							})}
						>
							<!-- The token is carried from the Summoned step and submitted with the
							     credentials so the redemption RPC has it. -->
							<input type="hidden" name="token" value={token} />

							<label>
								<span class="field-label">Casing</span>
								<input
									type="text"
									name="handle"
									bind:value={handle}
									minlength="2"
									maxlength="32"
									placeholder="e.g. FrankfurterTheFaithful"
									autocomplete="username"
									required
									aria-invalid={inscribeValidation.invalid('handle')}
									aria-describedby={inscribeValidation.describedBy('handle')}
									oninput={inscribeValidation.clearOnInput}
								/>
								{#if inscribeValidation.errors.handle}
									<p
										class="field-error"
										role="alert"
										id={inscribeValidation.errorId('handle')}
										transition:errorSlideFade
									>
										{inscribeValidation.errors.handle}
									</p>
								{/if}
							</label>

							<label>
								<span class="field-label">Mustard Address</span>
								<input
									type="email"
									name="email"
									bind:value={email}
									autocomplete="email"
									placeholder="you@parish.com"
									required
									aria-invalid={inscribeValidation.invalid('email')}
									aria-describedby={inscribeValidation.describedBy('email')}
									oninput={inscribeValidation.clearOnInput}
								/>
								{#if inscribeValidation.errors.email}
									<p
										class="field-error"
										role="alert"
										id={inscribeValidation.errorId('email')}
										transition:errorSlideFade
									>
										{inscribeValidation.errors.email}
									</p>
								{/if}
							</label>

							<label>
								<span class="field-label">Seal</span>
								<input
									type="password"
									name="password"
									bind:value={password}
									autocomplete="new-password"
									minlength="8"
									placeholder="known only to you and the Tube"
									required
									aria-invalid={inscribeValidation.invalid('password')}
									aria-describedby={inscribeValidation.describedBy('password')}
									oninput={inscribeValidation.clearOnInput}
								/>
								{#if inscribeValidation.errors.password}
									<p
										class="field-error"
										role="alert"
										id={inscribeValidation.errorId('password')}
										transition:errorSlideFade
									>
										{inscribeValidation.errors.password}
									</p>
								{/if}
							</label>

							{#if formError}
								<p role="alert">{formError}</p>
							{/if}

							<div class="rite-actions">
								<button class="btn-relic" type="submit" disabled={registering}>
									{registering ? 'Passing the gate…' : 'Continue →'}
								</button>
							</div>
						</form>
					</section>
				{:else if step === STEP.sigil}
					<section class="rite-step fade-up">
						<img class="rite-relic" src={ordoSeal} alt="" aria-hidden="true" />
						<span class="eyebrow">The Third Bite · Thy Sigil</span>
						<h1>Choose Thy Sigil</h1>
						<p>
							Until thou reveal thine own likeness, the Order grants thee a sacred face. Choose the
							one thou shalt wear among the faithful.
						</p>

						<div class="sigil-grid" role="radiogroup" aria-label="Choose thy sigil">
							{#each SIGIL_IDS as id (id)}
								<button
									type="button"
									class="sigil-swatch"
									class:selected={sigil === id}
									role="radio"
									aria-checked={sigil === id}
									aria-label={SIGIL_NAMES[id]}
									onclick={() => pickSigil(id)}
								>
									<span class="sigil-ring">
										<span class="sigil-avatar">
											<Sigil {id} size={84} title="" />
										</span>
										{#if sigil === id}
											<span class="sigil-check" aria-hidden="true">✓</span>
										{/if}
									</span>
									<span class="sigil-label">{SIGIL_LABELS[id]}</span>
								</button>
							{/each}
						</div>

						<p class="sigil-chosen">Thy sigil — {chosenSigilName}</p>

						<!-- The profile is FORGED here, at the Sigil step's Continue — NOT on the
						     oath screen. createProfile legitimately calls safeGetSession() (it
						     needs the validated uid), so it lives here where a session check is
						     appropriate, leaving Renounce a pure oath. The Casing was captured at
						     Inscribe (by both a fresh registrant and a resumer) and rides hidden
						     from client $state, so the action ALWAYS receives the non-empty
						     handle. On success the rite advances Sigil → Renounce; on failure
						     (e.g. HANDLE_TAKEN in the rare collision window) the themed error
						     shows IN PLACE here and Continue re-submits — forward-only, no dead-end. -->
						<form
							method="POST"
							action="?/createProfile"
							novalidate
							class="rite-form"
							use:enhance={() => {
								creatingProfile = true;
								return async ({ result, update }) => {
									creatingProfile = false;
									// SUCCESS: advance the rite IN-PAGE to Renounce and return
									// EARLY — do NOT call update()/applyAction(). Once the profile
									// exists, any re-run of `load` (which update()'s invalidateAll
									// triggers) finds the freshly-created profile and redirects to
									// /snacktum-snacktorum/shrine/<handle>, skipping the oath + Received. The action
									// returns NO redirect, so the only thing that could yank us off
									// the rite is our own invalidate — so we must not invalidate
									// here. The action echoes the canonical (server-validated)
									// handle for Received's entry link.
									if (
										result.type === 'success' &&
										result.data &&
										'created' in result.data &&
										result.data.created
									) {
										const echoed = result.data.handle;
										if (typeof echoed === 'string' && echoed) createdHandle = echoed;
										step = STEP.renounce;
										return;
									}
									// FAILURE: no profile was created, so `load` won't redirect — it
									// is safe to apply the action result, which populates `form` so
									// the themed `formError` renders in place and we stay on the
									// Sigil step (forward-only retry). reset: false keeps inputs.
									await update({ reset: false });
								};
							}}
						>
							<input type="hidden" name="sigil" value={sigil} />
							<!-- The handle carried in $state from Inscribe, submitted hidden so the
							     Sigil step shows no field yet createProfile still gets the Casing. -->
							<input type="hidden" name="handle" value={handle} />

							{#if formError}
								<p role="alert">{formError}</p>
							{/if}

							<div class="rite-actions">
								<button class="btn-relic" type="submit" disabled={creatingProfile}>
									{creatingProfile ? 'Sealing thy name…' : 'Continue →'}
								</button>
							</div>
						</form>
					</section>
				{:else if step === STEP.renounce}
					<section class="rite-step fade-up">
						<img class="rite-relic" src={ordoSeal} alt="" aria-hidden="true" />
						<span class="eyebrow">The Fourth Bite · The Renunciation</span>
						<h1>Renounce the Patty</h1>
						<p class="oath-quote">
							“Dost thou forswear the ground patty and all its flattened kin — the hamburger steak,
							the slider, the smash burger — and pledge thy judgment to the one true Tube?”
						</p>

						<div class="oath-area">
							{#if !sworn}
								<button class="oath-button" type="button" onclick={swearOath}>
									Press to<br />Swear the<br />Oath
								</button>
							{:else}
								<div class="oath-sworn">
									<div class="oath-seal stamp-in" aria-hidden="true">
										<span class="oath-cross">☩</span>
										<span class="oath-sworn-label">SWORN</span>
									</div>
									<span class="oath-sealed" role="status">Thy oath is sealed.</span>
								</div>
							{/if}
						</div>

						<!-- Renounce is PURE UI — it shows nothing but the oath + the wax-seal
						     "SWORN" interaction and persists NOTHING. There is NO form, NO
						     ?/createProfile action, NO session check: the profile was already
						     forged at the Sigil step. The Continue is a plain button gated SOLELY
						     on the oath having been sworn (disabled={!sworn}); it just advances to
						     Received. Forward-only, no back button. -->
						<div class="rite-actions">
							<button
								class="btn-relic"
								type="button"
								disabled={!sworn}
								onclick={() => (step = STEP.received)}
							>
								Continue →
							</button>
						</div>
					</section>
				{:else if step === STEP.received}
					<section class="rite-step fade-up" aria-live="polite">
						<Sigil id={sigil} size={132} title={chosenSigilName} />
						<span class="eyebrow">You Are Received</span>
						<h1>Welcome, {createdHandle || handle || 'Pilgrim'}</h1>
						<p>
							Thou art now sworn of the Order of the Holy Tube. Go forth and judge the sacred links
							with a righteous eye.
						</p>

						<!-- createProfile no longer redirects (it returns so the oath + Received
						     are not skipped), so Received holds the explicit entry into the app —
						     the new profile page, the prior redirect target. -->
						<div class="rite-actions">
							<a class="btn-relic" href={enterHref}>Enter →</a>
						</div>
					</section>
				{/if}
			</div>
		{/if}

		<footer class="rite-beads" aria-hidden="true">
			{#each beadLabels as label, i (label)}
				<span class="bead" class:on={i <= step} class:current={i === step}>
					<span class="bead-dot"></span>
					<span class="bead-label">{label}</span>
				</span>
			{/each}
		</footer>

		<p class="rite-aside">
			Already sworn of the Order? <a class="btn-text" href={resolve('/sign-in')}
				>Enter the Snacktum →</a
			>
		</p>
	</div>
</main>

<style>
	/* The rite is the gate column: header image pinned at the TOP of the page,
	   the rite content flowing downward from there. .rite-step owns the per-step
	   vertical rhythm. */
	.rite {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-lg);
		text-align: center;
		max-width: var(--measure-form);
		margin-inline: auto;
	}

	/* Top-anchor the rite — the deliberate exception to the shared .gate-center
	   utility, which vertically centers the gate column (justify-content: center).
	   The rite is tall (24rem header + 15rem ordo seal + the Inscribe form), and
	   the design wants the header image pinned at the TOP of the page rather than
	   floating in the viewport middle with empty space above it. This compound
	   selector .rite.gate-center has specificity (0,2,0) — it beats the global
	   .gate-center (0,1,0) in app.css — so ONLY this page's column top-aligns; the
	   other three gate pages (/sign-in, /forgot-password, /reset-password) keep
	   the shared centering untouched. padding-top restores top breathing room so
	   the header mark isn't jammed against the viewport edge (it composes with the
	   .gate-center padding-block already present).

	   Scroll-safety: .gate-center keeps min-height: 100svh (never a fixed height),
	   and the parent .page-container:has(> .gate-center) overflow: clip trims only
	   transient transform painting beyond the container's OWN box — it does NOT
	   establish a scroll container. The container grows to the tall content height,
	   so when the top-anchored column exceeds the viewport (short windows) the BODY
	   scrolls and no field/button is trapped. Top-anchoring only changes WHERE the
	   slack sits (all below, none above), not whether overflow scrolls. */
	.rite.gate-center {
		justify-content: flex-start;
		padding-top: var(--space-xl);
	}

	/* The header image, pinned at the top of the rite column. The breathing room
	   below opens the gap between the mark and the first rite step. */
	.rite-header {
		margin-bottom: var(--space-2xl);
	}

	.rite-header-mark {
		display: block;
		/* The natural sizing knob for the wordmark image — a plain literal rem so
		   it can be dialed directly (intentionally outside the token scale). */
		width: 24rem;
		max-width: 100%;
		height: auto;
		margin-inline: auto;
	}

	/* The rite content column — the step, the beads, and the aside. */
	.rite-center {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-lg);
		width: 100%;
	}

	.rite-body {
		width: 100%;
	}

	/* The Summoned-step relic — the Ordo Sancti Tubi seal crowning the first rite.
	   Sized to 15rem so the seal reads large and central across every rite
	   stage. The 200x200 viewBox carries transparent padding below the artwork; a
	   small positive margin-bottom adds to the --space-md flex gap to clearly open
	   the relic->eyebrow spacing beneath the enlarged mark. */
	.rite-relic {
		width: 15rem;
		height: 15rem;
		max-width: 100%;
		display: block;
		margin-bottom: var(--space-sm);
	}

	.rite-step {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-md);
	}

	.rite-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		width: 100%;
		max-width: 25rem;
		margin-inline: auto;
		align-items: stretch;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		text-align: left;
	}

	.field-label {
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 600;
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: var(--accent-strong);
	}

	input {
		background: var(--accent-fill);
		border: 1px solid var(--accent-border);
		border-bottom: 1.5px solid var(--accent);
		border-radius: var(--radius-control);
		padding: var(--space-sm) var(--space-md);
		color: var(--color-text);
		font-family: var(--font-body);
		font-size: var(--text-base);
	}

	input::placeholder {
		color: var(--color-text-fainter);
	}

	.token-input {
		font-family: var(--font-display);
		font-weight: 600;
		letter-spacing: var(--tracking-eyebrow);
		text-align: center;
	}

	.rite-actions {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-lg);
		margin-top: var(--space-2xs);
	}

	/* ---- Sigil picker ---------------------------------------------------- */
	.sigil-grid {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-md);
		max-width: 20rem;
	}

	.sigil-swatch {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-xs);
		width: 5.75rem;
		padding: var(--space-2xs);
		background: none;
		border: none;
		cursor: pointer;
	}

	/* Outer wrapper: positions the check badge but does NOT clip, so the part of
	   the badge that overhangs the circle stays visible. The circular clip lives
	   on the inner .sigil-avatar. */
	.sigil-ring {
		position: relative;
		display: block;
		width: 84px;
		height: 84px;
	}

	/* The circular avatar: border-radius + overflow: hidden round the sigil, and
	   the flex centering parks the SVG dead-center within the bordered box. */
	.sigil-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		border-radius: var(--radius-pill);
		overflow: hidden;
		border: 2px solid var(--accent-border);
		background: var(--color-bg);
		box-sizing: border-box;
	}

	/* The sigil SVG fills the avatar's content box exactly (the bordered box is
	   84px, so the 2px border leaves an 80px content box). Sizing the SVG to the
	   content box — rather than letting its 84px width attribute overflow and get
	   trimmed — keeps the circular artwork centered and uncropped. */
	.sigil-avatar :global(svg.sigil) {
		width: 100%;
		height: 100%;
	}

	.sigil-swatch.selected .sigil-avatar {
		border-color: var(--accent);
		box-shadow: 0 0 0 4px var(--accent-fill-strong);
	}

	.sigil-check {
		position: absolute;
		bottom: -2px;
		right: -2px;
		width: 22px;
		height: 22px;
		border-radius: var(--radius-pill);
		background: var(--accent);
		color: var(--color-on-accent);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-display);
		font-size: 0.6875rem;
		font-weight: 700;
		border: 2px solid var(--color-bg);
	}

	.sigil-label {
		font-family: var(--font-display);
		font-size: 0.5625rem;
		font-weight: 600;
		letter-spacing: var(--tracking-tight);
		text-transform: uppercase;
		color: var(--color-text-muted);
	}

	.sigil-chosen {
		margin: 0;
		font-style: italic;
		color: var(--accent-strong);
	}

	/* ---- The oath ------------------------------------------------------- */
	.oath-quote {
		font-style: italic;
		color: var(--color-text-muted);
		max-width: 29rem;
	}

	.oath-area {
		margin: var(--space-xs) 0;
	}

	.oath-button {
		width: 8.625rem;
		height: 8.625rem;
		padding: 0 var(--space-md);
		border-radius: var(--radius-pill);
		border: 2px dashed var(--accent);
		background: var(--accent-fill-strong);
		color: var(--accent);
		font-family: var(--font-display);
		font-size: var(--text-label);
		font-weight: 600;
		line-height: 1.4;
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		cursor: pointer;
	}

	.oath-button:hover {
		filter: brightness(1.12);
	}

	.oath-sworn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-xs);
	}

	.oath-seal {
		width: 8.625rem;
		height: 8.625rem;
		border-radius: var(--radius-pill);
		background: var(--accent);
		color: var(--color-on-accent);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-2xs);
		box-shadow: 0 0 0 7px var(--accent-fill-strong);
	}

	.oath-cross {
		font-size: 2.375rem;
		line-height: 1;
	}

	.oath-sworn-label {
		font-family: var(--font-display);
		font-size: 0.8125rem;
		font-weight: 700;
		letter-spacing: var(--tracking-eyebrow);
	}

	.oath-sealed {
		font-style: italic;
		color: var(--accent-strong);
	}

	/* ---- Step beads ----------------------------------------------------- */
	.rite-beads {
		display: flex;
		align-items: flex-start;
		gap: var(--space-lg);
	}

	.bead {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-xs);
		width: 4.625rem;
	}

	.bead-dot {
		width: 11px;
		height: 11px;
		border-radius: var(--radius-pill);
		border: 1.5px solid var(--accent-soft);
		background: transparent;
		transition: all var(--motion-base) var(--ease-standard);
	}

	.bead.on .bead-dot {
		border-color: var(--accent);
		background: var(--accent);
	}

	.bead.current .bead-dot {
		box-shadow: 0 0 0 4px var(--accent-fill-strong);
	}

	.bead-label {
		font-family: var(--font-display);
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: var(--tracking-tight);
		text-transform: uppercase;
		color: var(--color-text-faint);
	}

	.bead.on .bead-label {
		color: var(--color-text-muted);
	}

	.rite-aside {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--color-text-faint);
	}

	@media (prefers-reduced-motion: reduce) {
		.bead-dot {
			transition: none;
		}
	}
</style>
