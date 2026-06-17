import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDogDetail, DOG_NOT_FOUND } from '$lib/features/hotdogs/detail';
import { listReactionsForDogs } from '$lib/features/reactions/reactions';
import { summarizeReactions } from '$lib/features/reactions/summarize';
import {
	reportBurger,
	unreportBurger,
	getMyReportedDogIds,
	getBurgerAlarmCounts
} from '$lib/features/reports/reports';
import { summarizeBurgerAlarm } from '$lib/features/reports/alarm';
import { getSignedUrl, isUuid } from '$lib/storage';
import { getServiceClient } from '$lib/server/supabase';

// Per-dog detail view (TASK-031). Surfaces per-dog stats — peak_votes (the
// all-time high, maintained by the M2 vote RPC) alongside the current
// vote_count — plus the dog's image, caption, and owner. safeGetSession()-gated
// like the dogs/feed loads; a missing dog 404s. The image lives in the private
// `hotdogs` bucket, so we mint a short-lived signed URL via $lib/storage (a
// failed mint degrades to a null URL rather than blanking the page).
//
// The reaction summary here is READ-ONLY flair (decision #12 — never touches
// vote_count/ranking): the detail view shows the counts, but interactive
// react/unreact stays on the feed.

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		throw redirect(303, '/sign-in');
	}

	// Guard the route param BEFORE the DB read: a non-uuid id would otherwise reach
	// Postgres as a uuid comparison and raise `22P02 invalid input syntax for type
	// uuid`, which getDogDetail maps to a read error → 500. A malformed id is not a
	// server fault — it's just "no such dog", so treat it as a 404 with the same
	// friendly copy as DOG_NOT_FOUND. Genuine DB read errors below still 500.
	if (!isUuid(params.id)) {
		throw error(404, 'No such hot dog.');
	}

	const detailResult = await getDogDetail(supabase, params.id, user.id);
	if (!detailResult.ok) {
		if (detailResult.error === DOG_NOT_FOUND) {
			throw error(404, 'No such hot dog.');
		}
		console.error('[dog-detail] failed to load dog', {
			userId: user.id,
			dogId: params.id,
			error: detailResult.error
		});
		throw error(500, 'Could not load this hot dog right now.');
	}

	const dog = detailResult.data;

	// Mint a signed URL for the private image. The detail view can show ANOTHER
	// member's dog, and the `hotdogs` bucket's only storage SELECT policy is
	// owner-only (hotdogs_select_own) — so the viewer's RLS-scoped client can't
	// mint a URL for a dog it doesn't own. createSignedUrl is RLS-gated AT
	// CREATION, so we sign with the privileged service client AFTER the
	// safeGetSession() gate. This keeps the bucket private (decision #6): the URL
	// stays a short-lived signed URL, and the service client lives only in this
	// server-only load — it never reaches the browser. The getDogDetail read above
	// stays correctly RLS-scoped on `supabase`.
	//
	// A failed mint shouldn't blank the page — degrade to null and log it
	// (consistent with the feed pattern).
	let signedUrl: string | null = null;
	const signed = await getSignedUrl(getServiceClient(), dog.image_path);
	if (!signed.ok) {
		console.error('[dog-detail] failed to sign url', {
			dogId: dog.id,
			path: dog.image_path,
			error: signed.error.message
		});
	} else {
		signedUrl = signed.data.signedUrl;
	}

	// Read-only reaction summary (decision #12 — cosmetic flair). A read error
	// here shouldn't blank the page; degrade to "no reactions" and log it.
	const reactionsResult = await listReactionsForDogs(supabase, [dog.id]);
	let reactions = summarizeReactions([], user.id);
	if (!reactionsResult.ok) {
		console.error('[dog-detail] failed to load reactions', {
			userId: user.id,
			dogId: dog.id,
			error: reactionsResult.error
		});
	} else {
		reactions = summarizeReactions(
			reactionsResult.data.map((row) => ({ emoji: row.emoji, user_id: row.user_id })),
			user.id
		);
	}

	// Burger-alarm aggregate (decision #12/#15 — cosmetic, render-time, ranking-
	// inert). Reporter is ANONYMOUS: the per-dog count is read with the SERVICE
	// client (the owner-scoped SELECT policy hides others' reports from the RLS
	// client) and only timestamps come back — never reporter ids. The viewer's own
	// report toggle state is read on the RLS-scoped client. A read error here
	// shouldn't blank the page; degrade to "no alarm" and log it.
	const alarmCountsResult = await getBurgerAlarmCounts(getServiceClient(), [dog.id]);
	let alarm = summarizeBurgerAlarm([], new Date());
	if (!alarmCountsResult.ok) {
		console.error('[dog-detail] failed to load burger alarm', {
			userId: user.id,
			dogId: dog.id,
			error: alarmCountsResult.error
		});
	} else {
		alarm = summarizeBurgerAlarm(alarmCountsResult.data.get(dog.id) ?? [], new Date());
	}

	// Whether the viewer is the dog's owner: you can't report your own dog, so the
	// report control is hidden for the owner.
	const isOwnDog = dog.owner_id === user.id;

	const myReportsResult = await getMyReportedDogIds(supabase, [dog.id]);
	let iReported = false;
	if (!myReportsResult.ok) {
		console.error('[dog-detail] failed to load my burger report', {
			userId: user.id,
			dogId: dog.id,
			error: myReportsResult.error
		});
	} else {
		iReported = myReportsResult.data.has(dog.id);
	}

	return { dog, signedUrl, reactions, alarm, iReported, isOwnDog };
};

export const actions: Actions = {
	// Report this dog as a hamburger (decision #12 — cosmetic flair, never touches
	// the vote count or crown). The reporter is ANONYMOUS and derived from
	// safeGetSession(); the client supplies only the dog id (the route param).
	// RLS blocks reporting your own dog. Idempotent: a repeat report is a no-op.
	report: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { error: 'You must be signed in to report a hot dog.' });
		}

		const formData = await request.formData();
		const dogId = String(formData.get('id') ?? '');
		if (!dogId) {
			return fail(400, { error: 'Which hot dog?' });
		}

		const result = await reportBurger(supabase, user.id, dogId);
		if (!result.ok) {
			console.error('[dog-detail] reportBurger failed', { userId: user.id, dogId });
			return fail(400, { error: result.error });
		}

		return { reported: true };
	},

	// Retract a burger report (the un-report half of the toggle). Same trust model
	// as `report`. Idempotent: retracting a missing report is a no-op.
	unreport: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { error: 'You must be signed in to report a hot dog.' });
		}

		const formData = await request.formData();
		const dogId = String(formData.get('id') ?? '');
		if (!dogId) {
			return fail(400, { error: 'Which hot dog?' });
		}

		const result = await unreportBurger(supabase, user.id, dogId);
		if (!result.ok) {
			console.error('[dog-detail] unreportBurger failed', { userId: user.id, dogId });
			return fail(400, { error: result.error });
		}

		return { unreported: true };
	}
};
