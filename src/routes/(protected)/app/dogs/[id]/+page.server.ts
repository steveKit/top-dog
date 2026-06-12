import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDogDetail, DOG_NOT_FOUND } from '$lib/features/hotdogs/detail';
import { listReactionsForDogs } from '$lib/features/reactions/reactions';
import { summarizeReactions } from '$lib/features/reactions/summarize';
import { getSignedUrl } from '$lib/storage';

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

	// Mint a signed URL for the private image. A failed mint shouldn't blank the
	// page — degrade to null and log it (consistent with the feed/dogs pattern).
	let signedUrl: string | null = null;
	const signed = await getSignedUrl(supabase, dog.image_path);
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
