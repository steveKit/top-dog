import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDogDetail, DOG_NOT_FOUND } from '$lib/features/hotdogs/detail';
import { listReactionsForDogs } from '$lib/features/reactions/reactions';
import { summarizeReactions } from '$lib/features/reactions/summarize';
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

	return { dog, signedUrl, reactions };
};
