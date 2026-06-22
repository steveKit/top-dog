<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { compressToWebp } from '$lib/image/compress';
	import { createFormValidation } from '$lib/features/forms/formValidation.svelte';
	import { errorSlideFade } from '$lib/motion/reducedMotion';
	import HamburgerAlarmBanner from '$lib/components/HamburgerAlarmBanner.svelte';
	import ConfirmedHamburgerStamp from '$lib/components/ConfirmedHamburgerStamp.svelte';

	// Your Litter — the member's own-dogs gallery + offering rite, rebuilt from
	// design/pages/Your Litter.dc.html (M8 TASK-095). This is a RE-SKIN of the
	// unchanged upload/list/delete data flow: +page.server.ts (load + the upload
	// and delete actions) is preserved and re-wired into the temple-gallery markup.
	// The mockup's header / Anointed-Wiener chrome ribbon belong to the persistent
	// app shell (+layout.svelte) and are NOT re-rendered here; this page owns the
	// temple column (eyebrow → h1 → ✦ divider → lead), the Offering Rite card, and
	// the gallery of own-frank tiles.
	//
	// The own-dogs gallery correctly stays fully on the RLS-scoped client (own-bucket
	// SELECT works without the service client) — decision #27's cross-member signing
	// is the Relic/Procession concern, not this own gallery.

	let { data, form } = $props();

	// Preserve the caption the server echoed back on a failed upload.
	const initialCaption = $derived(form && 'caption' in form ? form.caption : '');

	let photoError = $state<string | null>(null);
	let uploading = $state(false);

	// The chosen file's name, for the dashed file-drop label (the mockup's
	// fileLabel). Resets after a submit settles.
	let fileLabel = $state('Choose a relic image — click to browse');

	function onFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		fileLabel = file ? file.name : 'Choose a relic image — click to browse';
	}

	// Form-validation CANON: themed inline validation replaces the native bubble.
	// The required photo file input is the empty-able field; the caption is
	// optional. validation.enhance wraps the compression submit handler.
	const validation = createFormValidation();

	// Compression is browser-only (canvas), so the chosen photo is compressed to
	// WebP here in the enhance submit handler and the FormData's `photo` entry is
	// swapped for the smaller WebP blob before it goes to the server (which only
	// uploads + inserts the row).
	const submitUpload = validation.enhance(() => {
		photoError = null;
		uploading = true;
		return async ({ formData, update }: { formData: FormData; update: () => Promise<void> }) => {
			const file = formData.get('photo');
			if (file instanceof File && file.size > 0) {
				try {
					const webp = await compressToWebp(file);
					formData.set('photo', webp, 'hotdog.webp');
				} catch {
					photoError = "That relic couldn't be processed. Offer a different image.";
					uploading = false;
					formData.delete('photo');
					return;
				}
			}
			await update();
			uploading = false;
			fileLabel = 'Choose a relic image — click to browse';
			await invalidateAll();
		};
	});

	let deleting = $state<string | null>(null);

	const submitDelete = (id: string) => {
		deleting = id;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			deleting = null;
			await invalidateAll();
		};
	};

	const isChampionDog = (dog: { id: string }): boolean => {
		return data.isCurrentTopDog && data.topDogId != null && data.topDogId === dog.id;
	};
</script>

<main class="litter">
	<div class="glow-orb" aria-hidden="true"></div>

	<header class="litter-head">
		<span class="eyebrow">The Faithful's Offerings</span>
		<h1>Your Litter</h1>
		<div class="ornament-divider" aria-hidden="true">✦</div>
		<p class="litter-lead">
			Thou keepest {data.dogs.length} of {data.cap} links — release one to consecrate another.
		</p>
	</header>

	<!-- ===== THE OFFERING RITE (upload) ===== -->
	<form
		class="offering"
		method="POST"
		action="?/upload"
		enctype="multipart/form-data"
		novalidate
		use:enhance={submitUpload}
	>
		<span class="offering-title">The Offering Rite</span>

		<label class="offering-file">
			<span class="field-label visually-hidden">Relic Image</span>
			<svg
				class="offering-file-icon"
				viewBox="0 0 24 24"
				width="26"
				height="26"
				fill="none"
				stroke="currentColor"
				stroke-width="1.6"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<rect x="3" y="14" width="18" height="6" rx="3" fill="var(--accent-fill-strong)" />
				<path d="M12 11 L12 3 M12 3 L9 6 M12 3 L15 6" />
			</svg>
			<span class="offering-file-text">{fileLabel}</span>
			<input
				class="offering-file-input"
				type="file"
				name="photo"
				accept="image/*"
				required
				aria-invalid={validation.invalid('photo')}
				aria-describedby={validation.describedBy('photo')}
				oninput={validation.clearOnInput}
				onchange={onFileChange}
			/>
		</label>
		{#if validation.errors.photo}
			<p
				class="field-error"
				role="alert"
				id={validation.errorId('photo')}
				transition:errorSlideFade
			>
				{validation.errors.photo}
			</p>
		{/if}

		<label class="offering-caption">
			<span class="field-label visually-hidden">Name thy frank</span>
			<input
				type="text"
				name="caption"
				value={initialCaption}
				maxlength="280"
				placeholder="Name thy frank (optional)"
			/>
		</label>

		{#if photoError}
			<p class="field-error" role="alert">{photoError}</p>
		{/if}

		{#if form?.error}
			<p class="field-error" role="alert">{form.error}</p>
		{/if}

		<div class="offering-actions">
			<button type="submit" class="btn-relic" disabled={uploading}>
				{uploading ? 'Offering…' : 'Offer This Frank →'}
			</button>
		</div>

		<p class="offering-note">
			Thou mayest keep up to {data.cap} links, and each relic image must be kept small — no greater than
			2 MiB.
		</p>
	</form>

	<!-- ===== GALLERY ===== -->
	{#if data.dogs.length === 0}
		<div class="empty">
			<svg
				class="empty-mark"
				viewBox="0 0 200 200"
				width="110"
				height="110"
				fill="none"
				stroke="currentColor"
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
				<rect x="52" y="98" width="96" height="26" rx="13" fill="var(--accent-fill-strong)" />
				<path d="M66 110 q8 -7 16 0 q8 7 16 0 q8 -7 16 0 q8 7 16 0" stroke-width="2.6" />
				<path
					d="M44 122 q0 -4 6 -4 h100 q6 0 6 4 v6 q0 18 -22 18 h-68 q-22 0 -22 -18 z"
					fill="var(--accent-fill)"
				/>
			</svg>
			<p class="empty-line">The grill is cold. Offer thy first frank to the Order.</p>
		</div>
	{:else}
		<ul class="gallery">
			{#each data.dogs as dog (dog.id)}
				{@const isChampion = isChampionDog(dog)}
				<li>
					<article class="frank fade-up">
						<div class="frank-image">
							{#if dog.signedUrl}
								<img src={dog.signedUrl} alt={dog.caption ?? 'A hot dog'} />
							{:else}
								<span class="frank-image-missing">Image unavailable</span>
							{/if}

							{#if isChampion}
								<span class="frank-champion" role="status">
									<svg
										class="frank-champion-mark"
										viewBox="0 0 24 16"
										width="13"
										height="9"
										aria-hidden="true"
									>
										<path
											d="M2 14 L2 5 L7 9 L12 2 L17 9 L22 5 L22 14 Z"
											fill="currentColor"
											stroke="currentColor"
											stroke-width="1"
											stroke-linejoin="round"
										/>
									</svg>
									Anointed Wiener
								</span>
							{/if}

							<!-- 🍔 Hamburger Court display (TASK-073): a verdict overrides the
							     decaying alarm ('confirmed' -> persistent stamp; 'cleared' ->
							     nothing). -->
							{#if dog.alarmState === 'confirmed'}
								<ConfirmedHamburgerStamp dogId={dog.id} />
							{:else if dog.alarmState === 'alarm' && dog.alarm.active}
								<HamburgerAlarmBanner
									dogId={dog.id}
									intensity={dog.alarm.intensity}
									reporterCount={dog.alarm.reporterCount}
								/>
							{/if}
						</div>

						<div class="frank-body">
							{#if dog.caption}
								<p class="frank-caption">{dog.caption}</p>
							{:else}
								<p class="frank-caption frank-caption-empty">An unnamed offering</p>
							{/if}

							<div class="frank-peak">
								<span class="frank-peak-num">{dog.peak_votes > 0 ? dog.peak_votes : '—'}</span>
								<span class="frank-peak-label">Peak Votes</span>
							</div>

							<div class="frank-foot">
								<a
									class="frank-relic-link"
									href={resolve('/(protected)/snacktum-snacktorum/litter/[id]', { id: dog.id })}
									>View the relic <span aria-hidden="true">→</span></a
								>
								<form method="POST" action="?/delete" use:enhance={() => submitDelete(dog.id)}>
									<input type="hidden" name="id" value={dog.id} />
									<button type="submit" class="frank-release" disabled={deleting === dog.id}>
										{deleting === dog.id ? 'Releasing…' : 'Release'}
									</button>
								</form>
							</div>
						</div>
					</article>
				</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	/* Your Litter is a centered temple column: heading block, the Offering Rite
	   card, then the gallery grid. All values reference theme tokens (no magic
	   hex/px); the gold accent themes via [data-accent]. */
	.litter {
		position: relative;
		max-width: var(--measure-content);
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.litter .glow-orb {
		top: -200px;
	}

	.litter-head {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		margin-bottom: var(--space-2xl);
	}

	.litter-head h1 {
		margin: var(--space-sm) 0 0;
	}

	.litter-head .ornament-divider {
		margin: var(--space-lg) 0 0;
	}

	.litter-lead {
		max-width: 32rem;
		margin: var(--space-md) 0 0;
		font-size: var(--text-lg);
		font-style: italic;
		color: var(--color-text-muted);
	}

	/* The Offering Rite card — the upload affordance, a gold-edged plaque. */
	.offering {
		width: 100%;
		max-width: 34rem;
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		padding: var(--space-xl);
		background: var(--color-bg-mid);
		border: 1px solid var(--accent-plaque-border);
		border-radius: var(--radius-card);
		box-shadow: var(--shadow-plaque);
	}

	.offering-title {
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 600;
		letter-spacing: var(--tracking-eyebrow);
		text-transform: uppercase;
		color: var(--accent);
		text-align: center;
	}

	/* The dashed file-drop label wraps the visually-hidden file input. The whole
	   label is the click target. */
	.offering-file {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-md) var(--space-lg);
		border: 1.5px dashed var(--accent-soft);
		border-radius: var(--radius-control);
		background: var(--accent-fill);
		color: var(--accent);
		cursor: pointer;
	}

	.offering-file:hover {
		border-color: var(--accent);
		background: var(--accent-fill-strong);
	}

	/* Visible focus ring on the wrapping label when the hidden input is focused. */
	.offering-file:focus-within {
		outline: var(--ring-focus);
		outline-offset: 3px;
	}

	.offering-file-icon {
		flex: none;
		display: block;
	}

	.offering-file-text {
		flex: 1;
		min-width: 0;
		font-size: var(--text-base);
		color: var(--color-text-muted);
		word-break: break-word;
	}

	/* The actual file input is visually hidden but still focusable + in the
	   accessibility tree (the label names it; the validation layer reads it). */
	.offering-file-input {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}

	/* Visually-hidden field labels (the visible cue is the placeholder / file
	   text); kept in the a11y tree so fieldLabel() resolves the themed name. */
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}

	.offering-caption {
		display: block;
	}

	.offering-caption input {
		width: 100%;
		padding: var(--space-sm) var(--space-md);
		background: var(--accent-fill);
		border: 1px solid var(--accent-border);
		border-bottom: 1.5px solid var(--accent);
		border-radius: var(--radius-control);
		color: var(--color-text);
		font-family: var(--font-body);
		font-size: var(--text-base);
	}

	.offering-caption input::placeholder {
		color: var(--color-text-fainter);
	}

	.offering-caption input:focus-visible {
		outline: var(--ring-focus);
		outline-offset: 2px;
		background: var(--accent-fill-strong);
	}

	.offering-actions {
		display: flex;
		justify-content: center;
		margin-top: var(--space-2xs);
	}

	.offering-note {
		margin: 0;
		font-size: var(--text-sm);
		font-style: italic;
		color: var(--color-text-faint);
		text-align: center;
	}

	/* The gallery — a responsive grid of frank tiles. */
	.gallery {
		width: 100%;
		margin: var(--space-2xl) 0 0;
		padding: 0;
		list-style: none;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(13.75rem, 1fr));
		gap: var(--space-lg);
	}

	.frank {
		position: relative;
		display: flex;
		flex-direction: column;
		background: var(--color-bg-mid);
		border: 1px solid var(--accent-plaque-border);
		border-radius: var(--radius-card);
		overflow: hidden;
		box-shadow: var(--shadow-plaque);
	}

	/* Square framed relic image; the alarm/stamp overlays + champion ribbon are
	   absolutely positioned within this box. */
	.frank-image {
		position: relative;
		aspect-ratio: 1;
		border-bottom: 1px solid var(--accent-divider);
		background: var(--color-bg-deep);
		overflow: hidden;
		line-height: 0;
	}

	.frank-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.frank-image-missing {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		padding: var(--space-sm);
		font-size: var(--text-sm);
		font-style: italic;
		color: var(--color-text-faint);
		text-align: center;
		line-height: 1.3;
	}

	/* The Anointed-Wiener ribbon on the member's crown-winning frank. */
	.frank-champion {
		position: absolute;
		top: var(--space-xs);
		left: var(--space-xs);
		z-index: 3;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
		padding: var(--space-2xs) var(--space-sm);
		background: var(--accent);
		color: var(--color-on-accent);
		border-radius: var(--radius-control);
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 700;
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		box-shadow: var(--shadow-plaque);
	}

	.frank-champion-mark {
		display: block;
	}

	.frank-body {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-lg);
	}

	.frank-caption {
		margin: 0;
		color: var(--color-text);
		text-wrap: pretty;
	}

	.frank-caption-empty {
		font-style: italic;
		color: var(--color-text-muted);
	}

	.frank-peak {
		display: flex;
		align-items: baseline;
		gap: var(--space-xs);
	}

	.frank-peak-num {
		font-family: var(--font-display);
		font-size: var(--text-xl);
		font-weight: 700;
		color: var(--accent);
		line-height: 1;
	}

	.frank-peak-label {
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 600;
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: var(--color-text-faint);
	}

	.frank-foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-md);
		padding-top: var(--space-sm);
		border-top: 1px solid var(--accent-divider);
	}

	.frank-foot form {
		margin: 0;
	}

	.frank-relic-link {
		font-family: var(--font-body);
		font-size: var(--text-sm);
		font-style: italic;
		text-decoration: none;
	}

	.frank-relic-link:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	/* "Release" reads as a quiet text button that warms to the error rust on hover
	   (it is a destructive action). */
	.frank-release {
		background: none;
		border: none;
		padding: 0;
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 600;
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: var(--color-text-faint);
		cursor: pointer;
	}

	.frank-release:hover:not(:disabled) {
		color: var(--color-error);
	}

	.frank-release:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		color: var(--color-error);
	}

	/* Empty state — a dashed plaque with the cold-grill mark. */
	.empty {
		width: 100%;
		max-width: 34rem;
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

	.empty-mark {
		display: block;
		color: var(--accent);
		opacity: 0.8;
	}

	.empty-line {
		margin: 0;
		font-size: var(--text-lg);
		font-style: italic;
		color: var(--color-text-muted);
		text-align: center;
		text-wrap: pretty;
	}

	/* Responsive: drop to a single column on narrow viewports. */
	@media (max-width: 36rem) {
		.gallery {
			grid-template-columns: 1fr;
		}
	}
</style>
