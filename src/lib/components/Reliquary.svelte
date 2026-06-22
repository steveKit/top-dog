<script lang="ts">
	// The Reliquary — a shelf of a member's earned HONORS, rendered on The Shrine
	// (M8 TASK-094-R). PRESENTATIONAL ONLY: it takes the already-computed badge
	// state as a prop and renders earned (lit gold) vs locked (dim silhouette)
	// relics, with tier indicators (I / II / III) on tiered honors, and a distinct
	// "Marks of Disgrace" register for the two shame marks. No badge LOGIC lives
	// here — the derivation is the pure computeBadges module
	// (src/lib/features/badges/badges.ts); this only skins it, per the design
	// (design/pages/The Shrine.dc.html + prompt #12 "The Reliquary").
	//
	// Tokens only (var(--…)) — no literal hex/px; the accent themes via [data-accent].
	// No {@html}: every relic icon is real inline Svelte SVG, every label/description
	// a fixed string keyed by the neutral badge id (cult names are display copy only).
	// Never signals earned/locked or honor/shame by color alone — the lit glow, the
	// dim silhouette, the explicit "unearned" / "next at …" lines, and the separate
	// disgrace heading each carry the state in shape + text (AA, decision/DW-028).

	import type { BadgeId, BadgeState } from '$lib/features/badges/badges';
	import { countEarnedHonors, countTotalHonors } from '$lib/features/badges/badges';

	let { badges }: { badges: BadgeState[] } = $props();

	// Display metadata per badge id — cult name + a one-line liturgical description.
	// Tiered badges carry a per-tier description (index 0 = locked, 1..N = the rank's
	// earned line); simple badges carry [locked, earned]. Roman numerals for tiers.
	const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

	type Meta = { name: string; locked: string; earned: string };
	const META: Record<BadgeId, Meta> = {
		first_frank: {
			name: 'First Frank',
			locked: 'Offer thy first sacred link.',
			earned: 'Offered thy first sacred link.'
		},
		crowned: {
			name: 'The Anointed',
			locked: 'Reign as The Anointed Wiener.',
			earned: 'Reigned as The Anointed Wiener.'
		},
		centurion: {
			name: 'Centurion',
			locked: 'Let one frank bear a hundred blessings.',
			earned: 'A frank that bore a hundred blessings.'
		},
		summoner: {
			name: 'The Summoner',
			locked: 'Summon a disciple into the Order.',
			earned: 'Disciples summoned into the Order.'
		},
		drenched: {
			name: 'The Drenched',
			locked: 'Be anointed by the champion.',
			earned: 'Anointed by the champion.'
		},
		inquisitor: {
			name: 'The Inquisitor',
			locked: 'Judge a heresy as The Anointed Wiener.',
			earned: 'Heresies judged as The Anointed Wiener.'
		},
		elder: {
			name: 'Elder',
			locked: 'Reserved for the first of the Faithful.',
			earned: 'Among the first sworn to the Tube.'
		},
		heretic: {
			name: '⚠ Heretic',
			locked: 'Unmarked — keep thy links pure.',
			earned: 'Keepeth a frank the Tribunal confirmed a hamburger — a lasting mark.'
		},
		liar: {
			name: '✕ False Witness',
			locked: 'Unmarked — bear no false witness.',
			earned: 'Bore false witness against a clean link — a mark that fades.'
		}
	};

	const honors = $derived(badges.filter((b) => b.kind === 'honor'));
	const shame = $derived(badges.filter((b) => b.kind === 'shame'));

	const earnedCount = $derived(countEarnedHonors(badges));
	const totalCount = $derived(countTotalHonors(badges));
	const noneEarned = $derived(earnedCount === 0);

	// The one-line description for a relic given its earned/tier state.
	function description(badge: BadgeState): string {
		const meta = META[badge.id];
		if (!badge.earned) {
			// Locked tiered honors hint the first threshold; simple ones their how-to.
			if (badge.nextThreshold != null) {
				return `${meta.locked} The first rank at ${badge.nextThreshold}.`;
			}
			return meta.locked;
		}
		if (badge.nextThreshold != null) {
			return `${meta.earned} The next rank at ${badge.nextThreshold}.`;
		}
		return meta.earned;
	}

	// Accessible state suffix so the lit/dim distinction never relies on color alone.
	function stateLabel(badge: BadgeState): string {
		if (!badge.earned) return badge.kind === 'shame' ? 'unmarked' : 'unearned';
		if (badge.tier != null && badge.maxTier != null) return `earned, rank ${badge.tier}`;
		return badge.kind === 'shame' ? 'marked' : 'earned';
	}
</script>

<div class="reliquary-count">
	Thou hast earned {earnedCount} of {totalCount} relics.
</div>

{#if noneEarned}
	<div class="reliquary-empty">
		<svg
			class="empty-mark"
			viewBox="0 0 200 200"
			width="84"
			height="84"
			fill="none"
			stroke="currentColor"
			stroke-width="3"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<ellipse cx="100" cy="58" rx="42" ry="11"></ellipse>
			<rect x="52" y="98" width="96" height="26" rx="13" fill="none"></rect>
			<path d="M66 110 q8 -7 16 0 q8 7 16 0 q8 -7 16 0 q8 7 16 0" stroke-width="2.6"></path>
		</svg>
		<p>No relics yet — earn thy first honor in the service of the Tube.</p>
	</div>
{/if}

<!-- Honors shelf -->
<ul class="relic-shelf" aria-label="Honors of the Order">
	{#each honors as badge (badge.id)}
		<li class="relic" class:is-earned={badge.earned} class:is-locked={!badge.earned}>
			<div class="relic-medallion">
				<span class="relic-icon" aria-hidden="true">
					{#if badge.id === 'first_frank'}
						<svg width="30" height="30" viewBox="0 0 24 24"
							><rect x="4" y="9" width="16" height="6" rx="3" fill="currentColor"></rect></svg
						>
					{:else if badge.id === 'crowned'}
						<svg width="30" height="30" viewBox="0 0 24 24"
							><path d="M3 18 L3 7 L8 11 L12 4 L16 11 L21 7 L21 18 Z" fill="currentColor"
							></path></svg
						>
					{:else if badge.id === 'centurion'}
						<svg width="30" height="30" viewBox="0 0 24 24"
							><path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" fill="currentColor"
							></path></svg
						>
					{:else if badge.id === 'summoner'}
						<svg width="30" height="30" viewBox="0 0 24 24"
							><path
								d="M5 21 V12 a7 7 0 0 1 14 0 V21"
								fill="none"
								stroke="currentColor"
								stroke-width="2.2"
							></path><line
								x1="3.5"
								y1="21"
								x2="20.5"
								y2="21"
								stroke="currentColor"
								stroke-width="2.2"
								stroke-linecap="round"
							></line></svg
						>
					{:else if badge.id === 'drenched'}
						<svg width="30" height="30" viewBox="0 0 24 24"
							><path
								d="M12 3 C12 3 5 12 5 16 a7 7 0 0 0 14 0 C19 12 12 3 12 3 Z"
								fill="currentColor"
							></path></svg
						>
					{:else if badge.id === 'inquisitor'}
						<svg width="30" height="30" viewBox="0 0 24 24"
							><path d="M7 4 H17 L12 12 L17 20 H7 L12 12 Z" fill="currentColor"></path><line
								x1="6"
								y1="4"
								x2="18"
								y2="4"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
							></line><line
								x1="6"
								y1="20"
								x2="18"
								y2="20"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
							></line></svg
						>
					{:else if badge.id === 'elder'}
						<svg width="30" height="30" viewBox="0 0 24 24"
							><path
								d="M5 21 V12 a7 7 0 0 1 14 0 V21"
								fill="none"
								stroke="currentColor"
								stroke-width="2.2"
							></path><circle cx="12" cy="6" r="3" fill="currentColor"></circle></svg
						>
					{/if}
				</span>
				{#if badge.earned && badge.tier != null && badge.tier > 0}
					<span class="relic-tier" aria-hidden="true">{ROMAN[badge.tier] ?? badge.tier}</span>
				{/if}
			</div>
			<span class="relic-name">
				{META[badge.id].name}
				<span class="relic-state"> · {stateLabel(badge)}</span>
			</span>
			<span class="relic-desc">{description(badge)}</span>
		</li>
	{/each}
</ul>

<!-- Marks of Disgrace (shame register) — visually distinct from gilded honors. -->
<div class="disgrace-divider" aria-hidden="true">
	<span class="disgrace-rule"></span>
	<span class="disgrace-label">Marks of Disgrace</span>
	<span class="disgrace-rule"></span>
</div>

<ul class="relic-shelf shame-shelf" aria-label="Marks of Disgrace">
	{#each shame as badge (badge.id)}
		<li class="relic shame" class:is-marked={badge.earned} class:is-locked={!badge.earned}>
			<div class="relic-medallion shame-medallion">
				<span class="relic-icon" aria-hidden="true">
					{#if badge.id === 'heretic'}
						<svg width="30" height="30" viewBox="0 0 24 24"
							><rect x="4" y="6" width="16" height="4.5" rx="2.25" fill="currentColor"></rect><rect
								x="5.5"
								y="11.3"
								width="13"
								height="2"
								rx="1"
								fill="currentColor"
								opacity="0.6"
							></rect><rect x="4" y="14.5" width="16" height="4.5" rx="2.25" fill="currentColor"
							></rect></svg
						>
					{:else if badge.id === 'liar'}
						<svg width="30" height="30" viewBox="0 0 24 24"
							><ellipse
								cx="12"
								cy="12"
								rx="9"
								ry="6"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							></ellipse><circle cx="12" cy="12" r="2.5" fill="currentColor"></circle><line
								x1="4"
								y1="20"
								x2="20"
								y2="4"
								stroke="currentColor"
								stroke-width="2.2"
								stroke-linecap="round"
							></line></svg
						>
					{/if}
				</span>
			</div>
			<span class="relic-name">
				{META[badge.id].name}
				<span class="relic-state"> · {stateLabel(badge)}</span>
			</span>
			<span class="relic-desc">{description(badge)}</span>
		</li>
	{/each}
</ul>

<style>
	.reliquary-count {
		font-family: var(--font-body);
		font-style: italic;
		font-size: var(--text-lg);
		color: var(--color-text-muted);
		text-align: center;
	}

	.reliquary-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-2xl) var(--space-lg);
		color: var(--accent);
	}

	.reliquary-empty .empty-mark {
		opacity: 0.6;
	}

	.reliquary-empty p {
		margin: 0;
		font-family: var(--font-body);
		font-style: italic;
		font-size: var(--text-lg);
		color: var(--color-text-muted);
		text-align: center;
	}

	/* The relic-shelf grid — wrapping row of medallions, centered. */
	.relic-shelf {
		list-style: none;
		margin: 0;
		padding: var(--space-md) 0 var(--space-2xs);
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-xl) var(--space-md);
	}

	.relic {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-xs);
		width: 7rem;
		text-align: center;
	}

	/* The medallion disc — a gold-ringed sigil. Earned = lit with a glow; locked =
	   a dim parchment silhouette (no glow), so the shelf reads as a set with gaps. */
	.relic-medallion {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 4.5rem;
		height: 4.5rem;
		border-radius: var(--radius-pill);
	}

	.relic.is-earned .relic-medallion {
		border: 2px solid var(--accent);
		background: radial-gradient(
			circle at 50% 35%,
			var(--accent-fill-strong),
			var(--color-bg-deep) 70%
		);
		box-shadow: var(--shadow-button-glow);
		color: var(--accent);
	}

	.relic.is-locked .relic-medallion {
		border: 2px solid var(--accent-border);
		background: var(--color-bg-deep);
		color: var(--color-text-fainter);
	}

	.relic-icon {
		display: inline-flex;
		line-height: 0;
	}

	/* Tier pill (I / II / III) on a tiered, earned honor. */
	.relic-tier {
		position: absolute;
		bottom: -0.25rem;
		right: -0.25rem;
		min-width: 1.375rem;
		height: 1.375rem;
		padding: 0 var(--space-2xs);
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-pill);
		border: 2px solid var(--color-bg-mid);
		background: var(--accent);
		color: var(--color-on-accent);
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 700;
		line-height: 1;
	}

	.relic-name {
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 600;
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: var(--color-heading);
	}

	.relic.is-locked .relic-name {
		color: var(--color-text-muted);
	}

	/* The accessible state suffix carries earned/locked in TEXT (never color alone). */
	.relic-state {
		font-weight: 400;
		letter-spacing: var(--tracking-tight);
		text-transform: none;
		font-style: italic;
		color: var(--color-text-faint);
	}

	.relic-desc {
		font-family: var(--font-body);
		font-size: var(--text-sm);
		color: var(--color-text-faint);
		line-height: 1.3;
	}

	.relic.is-locked .relic-desc {
		font-style: italic;
		color: var(--color-text-muted);
	}

	/* Marks of Disgrace — a rust-toned divider + a distinct shame register. */
	.disgrace-divider {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		width: 100%;
		margin-top: var(--space-md);
		color: var(--color-error);
	}

	.disgrace-rule {
		flex: 1;
		height: 1px;
		background: var(--color-error);
		opacity: 0.4;
	}

	.disgrace-label {
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 600;
		letter-spacing: var(--tracking-eyebrow);
		text-transform: uppercase;
	}

	.shame-shelf {
		padding-top: var(--space-sm);
	}

	/* Shame medallions are a darker / rust register — disgrace, not gilded honor. */
	.relic.shame.is-marked .shame-medallion {
		border: 2px solid var(--color-error);
		background: var(--color-bg-deep);
		box-shadow: 0 0 0.875rem var(--color-error);
		color: var(--color-error);
	}

	.relic.shame.is-locked .shame-medallion {
		border: 2px solid var(--accent-border);
		background: var(--color-bg-deep);
		color: var(--color-text-fainter);
	}

	.relic.shame.is-marked .relic-name {
		color: var(--color-error);
	}

	.relic.shame.is-marked .relic-desc {
		color: var(--color-error);
		font-style: italic;
	}

	@media (max-width: 36rem) {
		.relic {
			width: 6rem;
		}
	}
</style>
