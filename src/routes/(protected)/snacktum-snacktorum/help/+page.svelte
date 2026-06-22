<script lang="ts">
	// "How Top Dog works" — an everyone-facing, fully STATIC how-it-works page
	// (TASK-075). It lives under (protected)/snacktum-snacktorum, so the layout guard
	// (+layout.server.ts) already enforces auth — no +page.server.ts / load is
	// needed and there is NO dynamic, per-user data here by design.
	//
	// XSS-safe: every word of copy is a fixed literal string; the only dynamic
	// bits are nav `resolve(...)` route ids. No {@html}, no user-supplied content.

	import { resolve } from '$app/paths';
</script>

<h1>How Top Dog works</h1>
<p>
	Top Dog is where members show off their homemade hot dogs and compete for the crown. Here's
	everything you can do.
</p>

<!-- Voting gets top billing — it's the heart of the app. -->
<section aria-labelledby="voting-heading">
	<h2 id="voting-heading">🗳️ Voting &amp; the crown</h2>
	<p>The vote system decides who wears the 👑 crown. The rules are simple:</p>
	<ul>
		<li><strong>One vote per member.</strong> You get a single vote across the whole pack.</li>
		<li>
			<strong>Your vote is movable.</strong> Change your mind anytime — move your vote to a different
			dog and your old vote is released.
		</li>
		<li>
			<strong>No voting for your own dog.</strong> You can't crown yourself; vote for someone else's creation.
		</li>
		<li>
			<strong>Most votes wins.</strong> The dog with the most votes earns its owner the Top Dog crown.
		</li>
		<li>
			<strong>Ties are sticky.</strong> If two dogs are tied on votes, the crown stays with whoever has
			held it longest — the incumbent keeps it until someone pulls strictly ahead.
		</li>
		<li>
			<strong>Days as Top Dog.</strong> Every day you hold the crown is tallied, so your reign is counted
			over time, not just in the moment.
		</li>
	</ul>
</section>

<section aria-labelledby="powers-heading">
	<h2 id="powers-heading">👑 Top Dog powers</h2>
	<p>While you hold the crown, you get a couple of exclusive privileges:</p>
	<ul>
		<li>
			<strong>Spray mustard 🟡</strong> on another member's profile. (Mustard fades on its own — see below.)
		</li>
		<li>
			<strong>Adjudicate 🍔 hamburger reports</strong> in the Hamburger Court — you alone decide what's
			a hot dog and what's a hamburger.
		</li>
	</ul>
	<p>Lose the crown and these powers pass to the new Top Dog.</p>
</section>

<section aria-labelledby="reactions-heading">
	<h2 id="reactions-heading">😀 Reactions</h2>
	<p>
		React to any dog with an emoji. Reactions are purely cosmetic — they're a fun way to show love,
		and they have <strong>no effect on votes, ranking, or the crown</strong>.
	</p>
</section>

<section aria-labelledby="mustard-heading">
	<h2 id="mustard-heading">🟡 Mustard</h2>
	<p>
		The current Top Dog can spray mustard on a member's profile. It's a badge of (questionable)
		honor that <strong>fades on its own over about 24 hours</strong> — the longer ago it was sprayed,
		the fainter it gets, until it disappears.
	</p>
</section>

<section aria-labelledby="walls-heading">
	<h2 id="walls-heading">💬 Walls &amp; messages</h2>
	<p>
		Every member has a wall where others can leave public messages. For something more private, send
		a direct message. Check yours under <a
			href={resolve('/(protected)/snacktum-snacktorum/epistles')}>Messages</a
		>.
	</p>
</section>

<section aria-labelledby="court-heading">
	<h2 id="court-heading">🍔 The Hamburger Court</h2>
	<p>
		Think a "hot dog" is actually a hamburger in disguise? Report it. Here's how a case plays out:
	</p>
	<ol>
		<li>
			<strong>Report.</strong> Any member can report a dog as a suspected hamburger.
		</li>
		<li>
			<strong>HAMBURGER ALARM.</strong> A report raises a HAMBURGER ALARM on the dog for all to see.
		</li>
		<li>
			<strong>Verdict.</strong> The current Top Dog adjudicates and delivers the ruling:
			<ul>
				<li>
					<strong>Not a hamburger</strong> → the reporters are branded
					<strong>HAMBURGER LIAR</strong> — a mark that fades over about 7 days.
				</li>
				<li>
					<strong>Confirmed hamburger</strong> → the dog's owner is branded
					<strong>HAMBURGER HERETIC</strong> — a permanent mark of shame.
				</li>
			</ul>
		</li>
	</ol>
	<p>Choose your accusations wisely. A bad report can brand <em>you</em>.</p>
</section>

<p>
	<a href={resolve('/(protected)/snacktum-snacktorum')}>← Back to your kennel</a>
</p>
