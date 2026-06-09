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
	PER_USER_CAP
} from '$lib/features/hotdogs/hotdogs';
import {
	upload,
	remove,
	getSignedUrl,
	hotdogPath,
	evaluateUpload,
	HOTDOGS_BUCKET
} from '$lib/storage';

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
		return { dogs: [], cap: PER_USER_CAP };
	}

	// Mint a signed URL per dog (private bucket). A single failed URL shouldn't
	// blank the whole grid, so we surface null for that one and log it.
	const dogs = await Promise.all(
		dogsResult.data.map(async (dog) => {
			const signed = await getSignedUrl(supabase, dog.image_path);
			if (!signed.ok) {
				console.error('[hotdogs] failed to sign url', {
					dogId: dog.id,
					path: dog.image_path,
					error: signed.error.message
				});
				return { ...dog, signedUrl: null };
			}
			return { ...dog, signedUrl: signed.data.signedUrl };
		})
	);

	return { dogs, cap: PER_USER_CAP };
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
