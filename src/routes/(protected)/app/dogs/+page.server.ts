import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createHotDog,
	listHotDogsByOwner,
	countByOwner,
	getHotDogById,
	deleteHotDog,
	appStorageBytes,
	isAtCap,
	PER_USER_CAP,
	MAX_UPLOAD_BYTES
} from '$lib/features/hotdogs/hotdogs';
import {
	upload,
	remove,
	getSignedUrl,
	hotdogPath,
	evaluateUpload,
	HOTDOGS_BUCKET
} from '$lib/storage';
import { getProfileById } from '$lib/features/profiles/profiles';
import { selectTopDog, type RankableDog } from '$lib/features/voting/ranking';
import { getServiceClient } from '$lib/server/supabase';
import { getBurgerAlarmCounts } from '$lib/features/reports/reports';
import { summarizeBurgerAlarm } from '$lib/features/reports/alarm';
import { getVerdictsForDogs } from '$lib/features/reports/verdictStore';
import { dogAlarmState, type BurgerVerdict } from '$lib/features/reports/verdict';

// Hot dog upload + display (TASK-013) — the M1 vertical slice. This page shows
// the signed-in user's hot dogs in a grid (each rendered via a short-lived
// signed URL from the private `hotdogs` bucket), with an upload form and a
// per-dog delete control.
//
// Upload flow (orphan-safe ordering):
//   1. safeGetSession() -> trusted user.id (never a client value),
//   2. per-user cap (decision #10): reject at >= 100 with "delete one to add
//      another",
//   3. global storage guard (decision #11): evaluateUpload(usedBytes) — reject
//      the friendly blocked message when the kennel is full,
//   4. compression runs CLIENT-SIDE (canvas is browser-only) in the enhance
//      handler; the action receives an already-WebP blob,
//   5. generate the dog id server-side, build the owner-prefixed path via
//      hotdogPath() (its uuid validation backs the storage RLS write policy),
//      upload, then insert the row. If the insert fails, REMOVE the just-
//      uploaded object (compensating delete) so no orphan remains.
//
// Delete flow (orphan-free, decision #10): delete the DB row first (the
// authoritative record), then remove the storage object; a failed object
// removal is logged (a reclaimable storage leak), not surfaced as a broken row.

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		throw redirect(303, '/sign-in');
	}

	const dogsResult = await listHotDogsByOwner(supabase, user.id);
	if (!dogsResult.ok) {
		console.error('[hotdogs] failed to list dogs', {
			userId: user.id,
			error: dogsResult.error
		});
		return { dogs: [], cap: PER_USER_CAP, isCurrentTopDog: false, topDogId: null };
	}

	// Burger-alarm aggregate for the owner's OWN dogs (decision #12/#15 — cosmetic,
	// render-time, ranking-inert). The banner shows if YOUR dog has been flagged a
	// hamburger; there is NO report control here (you can't report your own dog).
	// Reporter is ANONYMOUS: read with the SERVICE client (the owner-scoped SELECT
	// policy on burger_alarms is about the REPORTER, not the dog owner, so even on
	// your own dog the RLS client can't see who reported), returning only
	// timestamps. A read error here shouldn't blank the grid; degrade to no alarm.
	const ownDogIds = dogsResult.data.map((dog) => dog.id);
	const now = new Date();
	const alarmCountsResult = await getBurgerAlarmCounts(getServiceClient(), ownDogIds);
	let alarmTimestampsByDog = new Map<string, string[]>();
	if (!alarmCountsResult.ok) {
		console.error('[hotdogs] failed to load burger alarms', {
			userId: user.id,
			error: alarmCountsResult.error
		});
	} else {
		alarmTimestampsByDog = alarmCountsResult.data;
	}

	// 🍔 Hamburger Court verdicts on the owner's OWN dogs (TASK-073). A verdict resolves
	// the render-time alarm: 'cleared' (not_a_hamburger -> suppress) or 'confirmed'
	// (-> persistent CONFIRMED HAMBURGER stamp on your own dog). No verdict -> the
	// decaying alarm stands. Public read on the RLS-scoped client; a failure degrades
	// to "no verdict".
	const verdictsResult = await getVerdictsForDogs(supabase, ownDogIds);
	let verdictsByDog = new Map<string, BurgerVerdict>();
	if (!verdictsResult.ok) {
		console.error('[hotdogs] failed to load verdicts', {
			userId: user.id,
			error: verdictsResult.error
		});
	} else {
		verdictsByDog = verdictsResult.data;
	}

	// Mint a signed URL per dog (private bucket). A single failed URL shouldn't
	// blank the whole grid, so we surface null for that one and log it.
	const dogs = await Promise.all(
		dogsResult.data.map(async (dog) => {
			const alarm = summarizeBurgerAlarm(alarmTimestampsByDog.get(dog.id) ?? [], now);
			const alarmState = dogAlarmState(verdictsByDog.get(dog.id) ?? null);
			const signed = await getSignedUrl(supabase, dog.image_path);
			if (!signed.ok) {
				console.error('[hotdogs] failed to sign url', {
					dogId: dog.id,
					path: dog.image_path,
					error: signed.error.message
				});
				return { ...dog, signedUrl: null, alarm, alarmState };
			}
			return { ...dog, signedUrl: signed.data.signedUrl, alarm, alarmState };
		})
	);

	// Top Dog badge (TASK-023): read LIVE crown state from the user's own profile
	// so the badge reflects a crown handoff on the next load. When this user holds
	// the crown, find which of their dogs is the winning ("crown") dog via the
	// shared `selectTopDog` comparator — never a parallel ordering, so the badge
	// stays in lockstep with the vote-RPC crown recompute (PROJECT decision #13).
	let isCurrentTopDog = false;
	let topDogId: string | null = null;

	const profileResult = await getProfileById(supabase, user.id);
	if (!profileResult.ok) {
		console.error('[hotdogs] failed to load own profile for crown badge', {
			userId: user.id,
			error: profileResult.error
		});
	} else if (profileResult.data?.is_current_top_dog) {
		isCurrentTopDog = true;
		// Map this user's dogs to the comparator's shape. They all share the owner's
		// single `top_dog_since`, so the stickiness tie-break degenerates to the
		// vote-count + id ordering across their own dogs — which correctly picks the
		// owner's highest-voted dog. `selectTopDog` returns null on an empty/no-
		// eligible set (no dog with >= 1 vote), so we render no dog badge then.
		const rankable: RankableDog[] = dogsResult.data.map((dog) => ({
			id: dog.id,
			ownerId: dog.owner_id,
			voteCount: dog.vote_count,
			topDogSince: profileResult.data!.top_dog_since
		}));
		topDogId = rankable.length > 0 ? (selectTopDog(rankable)?.id ?? null) : null;
	}

	return { dogs, cap: PER_USER_CAP, isCurrentTopDog, topDogId };
};

export const actions: Actions = {
	upload: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { error: 'You must be signed in to upload a hot dog.' });
		}

		const formData = await request.formData();
		const photo = formData.get('photo');
		const rawCaption = String(formData.get('caption') ?? '').trim();
		const caption = rawCaption.length > 0 ? rawCaption : null;

		// Validate the upload at the boundary: a real, non-empty image file.
		if (!(photo instanceof File) || photo.size === 0) {
			return fail(400, { caption: rawCaption, error: 'Pick a hot dog photo to upload.' });
		}

		// Per-file size cap (TASK-070; friendly UX layer). The authoritative
		// enforcement is server-side — the Storage API bucket file_size_limit on
		// the real object bytes plus the hot_dogs_byte_size_max DB CHECK on the
		// declared byte_size — so a direct API insert can't bypass it. Reject
		// early here so an oversized photo never reaches storage.
		if (photo.size > MAX_UPLOAD_BYTES) {
			return fail(400, {
				caption: rawCaption,
				error: "That photo's too big — keep it under 2 MB."
			});
		}

		// Caption length bound (friendly UX layer; the hot_dogs_caption_length DB
		// CHECK is the authoritative backstop). Reject before any upload/insert so
		// an oversized caption never reaches storage. Empty captions are stored as
		// null (see `caption` above); the limit applies only to actual text.
		if (caption !== null && caption.length > 280) {
			return fail(400, {
				caption: rawCaption,
				error: 'Keep your caption to 280 characters or less.'
			});
		}

		// Per-user cap (decision #10): count first, reject at the cap.
		const countResult = await countByOwner(supabase, user.id);
		if (!countResult.ok) {
			console.error('[hotdogs] cap count failed', { userId: user.id, error: countResult.error });
			return fail(500, {
				caption: rawCaption,
				error: 'Could not upload right now. Please try again.'
			});
		}
		if (isAtCap(countResult.data)) {
			return fail(400, {
				caption: rawCaption,
				error: `You've hit ${PER_USER_CAP} dogs — delete one to add another.`
			});
		}

		// Global storage guard (decision #11): block new uploads near the cap.
		const usageResult = await appStorageBytes(supabase);
		if (!usageResult.ok) {
			console.error('[hotdogs] storage usage check failed', {
				userId: user.id,
				error: usageResult.error
			});
			return fail(500, {
				caption: rawCaption,
				error: 'Could not upload right now. Please try again.'
			});
		}
		const guard = evaluateUpload(usageResult.data);
		if (!guard.allowed) {
			return fail(503, { caption: rawCaption, error: guard.message });
		}

		// Generate the dog id server-side so the storage key and row id agree.
		const dogId = crypto.randomUUID();
		const path = hotdogPath(user.id, dogId);

		// Upload first, then insert. (The WebP blob was compressed client-side.)
		const uploaded = await upload(supabase, HOTDOGS_BUCKET, path, photo, { upsert: false });
		if (!uploaded.ok) {
			console.error('[hotdogs] upload failed', {
				userId: user.id,
				path,
				error: uploaded.error.message
			});
			return fail(500, {
				caption: rawCaption,
				error: 'Could not upload your hot dog. Please try again.'
			});
		}

		const created = await createHotDog(supabase, {
			id: dogId,
			ownerId: user.id,
			imagePath: path,
			byteSize: photo.size,
			caption
		});

		if (!created.ok) {
			// Compensating delete: the row didn't land, so remove the orphaned object.
			const cleanup = await remove(supabase, HOTDOGS_BUCKET, path);
			if (!cleanup.ok) {
				console.error('[hotdogs] orphan cleanup failed after insert error', {
					userId: user.id,
					path,
					error: cleanup.error.message
				});
			}
			console.error('[hotdogs] createHotDog failed', {
				userId: user.id,
				dogId,
				error: created.error
			});
			return fail(500, {
				caption: rawCaption,
				error: 'Could not save your hot dog. Please try again.'
			});
		}

		return { uploaded: true };
	},

	delete: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { error: 'You must be signed in to delete a hot dog.' });
		}

		const formData = await request.formData();
		const dogId = String(formData.get('id') ?? '');
		if (!dogId) {
			return fail(400, { error: 'Which hot dog?' });
		}

		// Resolve the image_path before deleting the row, so we know which object
		// to remove afterwards. The subsequent delete is owner-pinned by RLS.
		const existing = await getHotDogById(supabase, dogId);
		if (!existing.ok) {
			console.error('[hotdogs] failed to load dog before delete', {
				userId: user.id,
				dogId,
				error: existing.error
			});
			return fail(500, { error: 'Could not delete that hot dog right now. Please try again.' });
		}
		if (!existing.data) {
			return fail(404, { error: 'That hot dog no longer exists.' });
		}

		// Delete the authoritative DB row first (RLS pins it to the owner).
		const deleted = await deleteHotDog(supabase, dogId);
		if (!deleted.ok) {
			console.error('[hotdogs] row delete failed', {
				userId: user.id,
				dogId,
				error: deleted.error
			});
			return fail(500, { error: 'Could not delete that hot dog right now. Please try again.' });
		}
		if (deleted.data.deleted === 0) {
			// RLS matched no row — not the owner, or already gone.
			return fail(404, { error: 'That hot dog no longer exists.' });
		}

		// Then remove the storage object. A failure here is a reclaimable storage
		// leak (a stray object), not a broken row — log it, don't fail the action.
		const removed = await remove(supabase, HOTDOGS_BUCKET, existing.data.image_path);
		if (!removed.ok) {
			console.error('[hotdogs] storage object removal failed after row delete', {
				userId: user.id,
				dogId,
				path: existing.data.image_path,
				error: removed.error.message
			});
		}

		return { deleted: true };
	}
};
