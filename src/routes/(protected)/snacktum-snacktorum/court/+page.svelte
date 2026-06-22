<script lang="ts">
	// 🍔 Hamburger Court — the Top-Dog-only adjudication queue (TASK-073). Lists every
	// flagged dog with its report count and any existing verdict, and offers the two
	// rulings: "Confirmed hamburger" (brands the owner a HERETIC) and "Not a hamburger"
	// (brands the reporters LIARs). Only the current Top Dog reaches this page (the load
	// redirects everyone else); the DB RPC re-checks the crown authoritatively.
	//
	// XSS-safe: captions/handles are bound as text (no {@html}); the verdict values are
	// fixed strings on hidden inputs.

	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';

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

	function verdictLabel(verdict: string | null): string {
		if (verdict === 'confirmed_hamburger') return 'Ruled: confirmed hamburger 🍔';
		if (verdict === 'not_a_hamburger') return 'Ruled: not a hamburger 🌭';
		return 'Awaiting your ruling';
	}
</script>

<h1>🍔 Hamburger Court</h1>
<p>
	You're the Top Dog — yours is the verdict. Confirm a hamburger to brand its chef a
	<strong>HAMBURGER HERETIC</strong>, or clear it to brand every reporter a
	<strong>HAMBURGER LIAR</strong>.
</p>

{#if form?.message}
	<p role="alert">{form.message}</p>
{/if}

{#if flagged.length === 0}
	<p>No flagged hot dogs right now. The kennel is honest.</p>
{:else}
	<ul class="docket">
		{#each flagged as dog (dog.id)}
			<li class="case">
				{#if dog.signedUrl}
					<img src={dog.signedUrl} alt={dog.caption ?? 'A flagged hot dog'} width="200" />
				{:else}
					<span>Image unavailable</span>
				{/if}

				<div class="case-meta">
					<p>
						by <a
							href={resolve('/(protected)/snacktum-snacktorum/shrine/[handle]', {
								handle: dog.ownerHandle
							})}>@{dog.ownerHandle}</a
						>
					</p>
					{#if dog.caption}
						<p class="caption">{dog.caption}</p>
					{/if}
					<p class="report-count">
						{dog.reportCount}
						{dog.reportCount === 1 ? 'report' : 'reports'}
					</p>
					<p class="verdict-state">{verdictLabel(dog.verdict)}</p>
				</div>

				<div class="rulings">
					<form method="POST" action="?/rule" use:enhance={() => submitRule(`${dog.id}:confirmed`)}>
						<input type="hidden" name="dogId" value={dog.id} />
						<input type="hidden" name="verdict" value="confirmed_hamburger" />
						<button type="submit" disabled={pendingRule !== null}>
							{pendingRule === `${dog.id}:confirmed` ? 'Ruling…' : 'Confirmed hamburger'}
						</button>
					</form>
					<form method="POST" action="?/rule" use:enhance={() => submitRule(`${dog.id}:cleared`)}>
						<input type="hidden" name="dogId" value={dog.id} />
						<input type="hidden" name="verdict" value="not_a_hamburger" />
						<button type="submit" disabled={pendingRule !== null}>
							{pendingRule === `${dog.id}:cleared` ? 'Ruling…' : 'Not a hamburger'}
						</button>
					</form>
				</div>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.docket {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.case {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		align-items: flex-start;
		border: 1px solid #ccc;
		border-radius: 8px;
		padding: 1rem;
	}

	.rulings {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.verdict-state {
		font-weight: 700;
	}
</style>
