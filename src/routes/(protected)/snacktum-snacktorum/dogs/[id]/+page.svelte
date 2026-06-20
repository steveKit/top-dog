<script lang="ts">
	import { resolve } from '$app/paths';
	import TopDogBadge from '$lib/components/TopDogBadge.svelte';
	import HamburgerAlarmBanner from '$lib/components/HamburgerAlarmBanner.svelte';
	import ConfirmedHamburgerStamp from '$lib/components/ConfirmedHamburgerStamp.svelte';
	import BurgerReportControl from '$lib/components/BurgerReportControl.svelte';

	let { data } = $props();

	const dog = $derived(data.dog);
	const owner = $derived(data.dog.owner);
</script>

<p><a href={resolve('/(protected)/snacktum-snacktorum/procession')}>← Back to the feed</a></p>

{#if owner.is_current_top_dog}
	<TopDogBadge label="Top Dog" />
{/if}

{#if data.signedUrl}
	<div class="dog-image">
		<img src={data.signedUrl} alt={dog.caption ?? 'A hot dog'} width="480" />
		<!-- 🍔 Hamburger Court display (TASK-073). A verdict overrides the decaying
		     alarm: 'confirmed' -> persistent CONFIRMED HAMBURGER stamp; 'cleared' ->
		     nothing (adjudicated). Only when there is NO verdict ('alarm') does the
		     decaying report alarm show. -->
		{#if data.alarmState === 'confirmed'}
			<ConfirmedHamburgerStamp dogId={dog.id} />
		{:else if data.alarmState === 'alarm' && data.alarm.active}
			<HamburgerAlarmBanner
				dogId={dog.id}
				intensity={data.alarm.intensity}
				reporterCount={data.alarm.reporterCount}
			/>
		{/if}
	</div>
{:else}
	<p>Image unavailable</p>
{/if}

<!-- DW-022: hide the report toggle on a dog the viewer doesn't own ONLY while it's
     still unadjudicated ('alarm'). Once the Hamburger Court rules ('cleared' /
     'confirmed'), the verdict drives the display, so a live report toggle would be
     stale — show a small adjudicated note instead. -->
{#if !data.isOwnDog}
	{#if data.alarmState === 'alarm'}
		<BurgerReportControl dogId={dog.id} iReported={data.iReported} />
	{:else}
		<p class="adjudicated-note">🍔 The Hamburger Court has ruled.</p>
	{/if}
{/if}

{#if dog.caption}
	<p>{dog.caption}</p>
{/if}

<p>
	by <a
		href={resolve('/(protected)/snacktum-snacktorum/profile/[handle]', { handle: owner.handle })}
		>@{owner.handle || owner.display_name}</a
	>
</p>

<section aria-label="Stats">
	<h2>Stats</h2>
	<p>Peak votes: {dog.peak_votes}</p>
	<p>Current votes: {dog.vote_count}</p>
</section>

{#if data.reactions.length > 0}
	<section aria-label="Reactions">
		<h2>Reactions</h2>
		<ul>
			{#each data.reactions as summary (summary.emoji)}
				<li>{summary.emoji} {summary.count}</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	/* Positioned wrapper so the absolutely-positioned alarm overlay covers the
	   dog image exactly (the banner component is inset:0 within this box). */
	.dog-image {
		position: relative;
		display: inline-block;
		line-height: 0;
	}
</style>
