<script lang="ts">
	// The Catechism — the everyone-facing, fully STATIC "how it works" doctrine
	// page, rebuilt from design/pages/The Catechism.dc.html (M8 TASK-100, leaf
	// help → catechism). It lives under (protected)/snacktum-snacktorum, so the
	// layout guard (+layout.server.ts) already enforces auth — no +page.server.ts
	// / load is needed and there is NO dynamic, per-user data here by design. The
	// mockup's header / nav / avatar chrome belongs to the persistent app shell
	// (+layout.svelte) and is NOT re-rendered here; this page owns the centered
	// scripture column only.
	//
	// ‼️ ACCURACY-CRITICAL: this re-skin changes only the VOICE, never the described
	// BEHAVIOR. Every mechanic was re-verified against source (TASK-075 baseline):
	//   - the vote / crown rules against src/lib/features/voting/ranking.ts;
	//   - reactions are ranking-inert (decision #12);
	//   - the Anoint lifespan reads ~6 HOURS, sourced from MUSTARD_LIFESPAN_MS =
	//     6 * 60 * 60 * 1000 in src/lib/features/mustard/decay.ts (M8 TASK-094 /
	//     decision #29 — NOT the mockup's stale "about a day");
	//   - FALSE WITNESS fades over 7 days (LIAR_BRAND_WINDOW_MS = 7d) and the
	//     HAMBURGER HERETIC brand is permanent, against
	//     src/lib/features/reports/verdict.ts.
	//
	// XSS-safe: every word of copy is a fixed literal string; there is NO dynamic
	// or user-supplied content and NO {@html}.

	// `glow` matches the mockup's `glow` prop — gate the decorative halo orb. On by
	// default (the mockup default); the only DSL <sc-if> ported to {#if}.
	const glow = true;
</script>

<main class="catechism" aria-label="The Catechism">
	{#if glow}
		<div class="glow-orb" aria-hidden="true"></div>
	{/if}

	<span class="eyebrow catechism-eyebrow">The Scripture of the Order</span>
	<h1>The Catechism</h1>
	<div class="ornament-divider" aria-hidden="true">✦</div>
	<p class="lede">
		How the Tube is judged, crowned, and kept. Read, and be among the knowing of the Faithful.
	</p>

	<section class="article article--first" aria-labelledby="article-vote">
		<span class="article-kicker">Article the First · First and Highest</span>
		<h2 id="article-vote">Of the Vote and the Crown</h2>
		<p class="article-body">
			<span class="dropcap" aria-hidden="true">E</span>ach disciple is granted a
			<strong>single vote</strong>, and but one. It is not bound where first it falls — thou mayest
			<strong>move it</strong> to a worthier link, yet in moving it thou <em>releasest</em> the vote
			thou heldest before; no soul may rest two votes at once.
			<strong>None may vote upon their own frank</strong>, for self-praise is no judgment. The link
			that gathers <strong>the most votes</strong> crowns its maker
			<span class="cult-name">The Anointed Wiener</span>. And the crown is
			<strong>sticky</strong>: when votes stand equal, the reigning champion keeps it until another
			link pulls <em>strictly ahead</em>. The days of the reign are tallied, one upon the next, for
			as long as the crown is held.
		</p>
	</section>

	<div class="article-divider" aria-hidden="true">✦</div>

	<section class="article" aria-labelledby="article-powers">
		<span class="article-kicker">Article the Second</span>
		<h2 id="article-powers">Of the Powers of The Anointed Wiener</h2>
		<p class="article-body">
			To the reigning champion alone are two powers given. First, to <strong>Anoint</strong> — to
			lay the mustard blessing upon another disciple's shrine. Second, to
			<strong>adjudicate heresy</strong> — to sit in the Tribunal of the Holy Tube and rule upon the accused.
			No other hand may do these things.
		</p>
	</section>

	<div class="article-divider" aria-hidden="true">✦</div>

	<section class="article" aria-labelledby="article-reactions">
		<span class="article-kicker">Article the Third</span>
		<h2 id="article-reactions">Of Reactions</h2>
		<p class="article-body">
			Any disciple may answer a link with a reaction — 🌭, ❤, 🔥, and their kin. Yet know this well:
			reactions are <strong>adornment only</strong>. They move no vote, raise no rank, and bear no
			weight whatsoever upon the crown. React freely; it changes nothing but the heart.
		</p>
	</section>

	<div class="article-divider" aria-hidden="true">✦</div>

	<section class="article" aria-labelledby="article-anointing">
		<span class="article-kicker">Article the Fourth</span>
		<h2 id="article-anointing">Of the Anointing</h2>
		<p class="article-body">
			When the champion anoints a shrine, the mustard rests but a while. The blessing
			<strong>fades of its own accord over the span of about six hours</strong>, and then is gone —
			that the faithful may earn it anew, and the honor never grow stale.
		</p>
	</section>

	<div class="article-divider" aria-hidden="true">✦</div>

	<section class="article" aria-labelledby="article-walls">
		<span class="article-kicker">Article the Fifth</span>
		<h2 id="article-walls">Of Walls and Epistles</h2>
		<p class="article-body">
			Every disciple keeps a <strong>public wall</strong>, whereon any of the Faithful may leave
			their word for all to read. And for words meant for one alone, there are
			<strong>private epistles</strong> — whispers sent disciple to disciple, seen by no other eye.
		</p>
	</section>

	<div class="article-divider" aria-hidden="true">✦</div>

	<section class="article" aria-labelledby="article-tribunal">
		<span class="article-kicker">Article the Sixth</span>
		<h2 id="article-tribunal">Of the Tribunal of the Holy Tube</h2>
		<p class="article-body">
			Any disciple who suspects a hidden hamburger may <strong>report</strong> the link, raising a
			<span class="brand-word">HAMBURGER ALARM</span> for all the Faithful to behold. Then, and only
			then, <span class="cult-name">The Anointed Wiener</span> rules. Should the champion declare it
			<em>not a hamburger</em>, the accusers are branded
			<span class="brand-word">FALSE WITNESS</span> — a mark that fades over seven days. Should the
			champion <em>confirm the hamburger</em>, its maker is branded a
			<span class="brand-word brand-word--heretic">HAMBURGER HERETIC</span> — a mark that never fades.
		</p>
		<p class="article-warning">Choose thine accusations wisely — a false report brands thee.</p>
	</section>

	<div class="outro-divider" aria-hidden="true">☩</div>
	<p class="doxology">Glory to the holy tube.</p>
</main>

<style>
	/* The Catechism is a centered, narrow scripture column (the mockup caps <main>
	   at 720px). The shell wraps the page in .shell-content already; this column
	   self-caps and centers within it. All values reference theme tokens — no magic
	   hex/px; the gold accent themes via [data-accent]. */
	.catechism {
		position: relative;
		max-width: 45rem; /* ~720px, matching the mockup's <main> cap */
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: var(--space-3xl) var(--space-lg) var(--space-3xl);
	}

	/* All content sits above the decorative glow orb. */
	.catechism > :not(.glow-orb) {
		position: relative;
		z-index: 1;
	}

	.catechism-eyebrow {
		letter-spacing: var(--tracking-eyebrow);
	}

	.catechism h1 {
		margin: var(--space-sm) 0 0;
		font-family: var(--font-display);
		font-size: var(--text-h1);
		font-weight: 600;
		letter-spacing: var(--tracking-tight);
		color: var(--color-heading);
		text-shadow: var(--text-shadow-hero);
	}

	.catechism .ornament-divider {
		margin: var(--space-lg) 0 0;
	}

	.lede {
		max-width: 33.75rem;
		margin: var(--space-md) 0 0;
		font-family: var(--font-body);
		font-style: italic;
		font-size: var(--text-lg);
		line-height: 1.6;
		color: var(--color-text-muted);
		text-wrap: pretty;
	}

	/* Each doctrinal Article is a left-aligned passage block. The first is set in a
	   gold-bordered plaque; the rest are open passages separated by ✦ rules. */
	.article {
		width: 100%;
		max-width: 41.25rem;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		text-align: left;
	}

	.article--first {
		margin-top: var(--space-2xl);
		gap: var(--space-md);
		padding: var(--space-xl) var(--space-xl);
		background: var(--accent-fill);
		border: 1px solid var(--accent-border);
		border-radius: var(--radius-card);
	}

	.article-kicker {
		font-family: var(--font-display);
		font-size: var(--text-eyebrow);
		font-weight: 600;
		letter-spacing: var(--tracking-eyebrow);
		text-transform: uppercase;
		color: var(--accent);
	}

	.article h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--text-h2);
		font-weight: 600;
		letter-spacing: var(--tracking-tight);
		color: var(--color-heading);
	}

	.article-body {
		margin: 0;
		font-family: var(--font-body);
		font-size: var(--text-lg);
		line-height: 1.72;
		color: var(--color-text);
		text-wrap: pretty;
	}

	.article-body strong {
		font-weight: 600;
		color: var(--color-heading);
	}

	/* Illuminated drop-cap on the First Article. */
	.dropcap {
		float: left;
		font-family: var(--font-display);
		font-size: 3.875rem;
		line-height: 0.82;
		font-weight: 600;
		color: var(--accent);
		margin: 0.4rem 0.8rem 0 0;
	}

	/* Cult labels (champion title) read in the accent. */
	.cult-name {
		color: var(--accent);
		font-weight: 600;
	}

	/* The brand stamps (HAMBURGER ALARM / FALSE WITNESS / HERETIC) read as small
	   Cinzel relic words. HERETIC takes the rust-warm error hue. */
	.brand-word {
		font-family: var(--font-display);
		font-size: var(--text-sm);
		font-weight: 600;
		letter-spacing: var(--tracking-tight);
		color: var(--accent);
	}

	.brand-word--heretic {
		color: var(--color-error);
	}

	/* The cautionary aside under the Tribunal article — a gold-ruled italic pull. */
	.article-warning {
		margin: var(--space-xs) 0 0;
		padding: var(--space-sm) var(--space-md);
		border-left: 2px solid var(--accent);
		background: var(--accent-fill);
		font-family: var(--font-body);
		font-style: italic;
		font-size: var(--text-lg);
		line-height: 1.5;
		color: var(--accent-strong);
		text-wrap: pretty;
	}

	/* The ✦ rule between open articles. */
	.article-divider {
		width: 100%;
		max-width: 41.25rem;
		margin: var(--space-2xl) 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-md);
		color: var(--accent);
		font-size: var(--text-sm);
		opacity: 0.7;
	}

	.article-divider::before,
	.article-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--accent-soft);
		opacity: 0.45;
	}

	/* The closing ☩ doxology rule + line. */
	.outro-divider {
		margin: var(--space-3xl) 0 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-md);
		color: var(--accent);
		font-size: var(--text-base);
	}

	.outro-divider::before,
	.outro-divider::after {
		content: '';
		width: 2.5rem;
		height: 1px;
		background: var(--accent);
		opacity: 0.4;
	}

	.doxology {
		margin: var(--space-md) 0 0;
		font-family: var(--font-body);
		font-style: italic;
		font-size: var(--text-base);
		color: var(--color-text-faint);
		text-align: center;
	}
</style>
