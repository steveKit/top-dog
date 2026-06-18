import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { validateHandle } from '$lib/features/profiles/handle';
import {
	createProfile,
	getProfileById,
	isHandleAvailable,
	HANDLE_TAKEN
} from '$lib/features/profiles/profiles';
import { upload, avatarPath, AVATARS_BUCKET } from '$lib/storage';
import { MAX_UPLOAD_BYTES } from '$lib/features/hotdogs/hotdogs';

// First-sign-in onboarding (TASK-011). A freshly-redeemed user has an auth
// account but no `profiles` row; the app layout guard funnels them here. This
// route creates that row (@handle + display name + optional avatar).
//
// Order:
//   1. validate the handle at the boundary with the pure validator (charset +
//      length the DB CHECK alone does not enforce),
//   2. default display_name to the handle when blank (the column is NOT NULL),
//   3. if an avatar blob was supplied, upload it via $lib/storage to
//      {uid}/avatar.webp (the owner-prefix the avatars RLS write policy
//      requires). NOTE: `compressToWebp` ($lib/image/compress) is browser-only
//      (canvas/createImageBitmap), so compression runs CLIENT-SIDE in the
//      enhance submit handler (+page.svelte) BEFORE submit — the action
//      receives an already-WebP blob and only uploads it,
//   4. createProfile() — the handle UNIQUE constraint is authoritative; a
//      duplicate maps to a friendly "handle taken" fail() preserving inputs,
//   5. redirect to the new profile page.
// The trusted profile id is the validated session uid, never a client value.

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		throw redirect(303, '/sign-in');
	}

	// Already onboarded? Don't let them re-run onboarding.
	const existing = await getProfileById(supabase, user.id);
	if (existing.ok && existing.data) {
		throw redirect(303, `/app/profile/${existing.data.handle}`);
	}

	return {};
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { error: 'You must be signed in to set up your profile.' });
		}

		const formData = await request.formData();
		const rawHandle = String(formData.get('handle') ?? '');
		const rawDisplayName = String(formData.get('display_name') ?? '').trim();
		const avatarFile = formData.get('avatar');

		// Validate the handle (charset + length) at the boundary.
		const handleCheck = validateHandle(rawHandle);
		if (!handleCheck.ok) {
			return fail(400, {
				handle: rawHandle,
				displayName: rawDisplayName,
				error: handleCheck.reason
			});
		}
		const handle = handleCheck.value;

		// display_name is NOT NULL; default a blank one to the handle.
		const displayName = rawDisplayName.length > 0 ? rawDisplayName : handle;

		// Best-effort pre-check (the DB UNIQUE constraint is still authoritative).
		const available = await isHandleAvailable(supabase, handle);
		if (available.ok && !available.data) {
			return fail(400, {
				handle: rawHandle,
				displayName: rawDisplayName,
				error: 'That handle is taken. Try another.'
			});
		}

		// Optional avatar: upload the (client-compressed WebP) blob to the
		// owner-prefixed key. Compression happens client-side before submit.
		let avatarStoredPath: string | null = null;
		if (avatarFile instanceof File && avatarFile.size > 0) {
			// Per-file size cap (DW-021; friendly UX layer, mirrors the hot-dog upload
			// action). The authoritative enforcement is the Storage API bucket
			// file_size_limit (TASK-070) on the real object bytes — this early check
			// just turns an oversized avatar into a friendly size message instead of a
			// generic upload failure.
			if (avatarFile.size > MAX_UPLOAD_BYTES) {
				return fail(400, {
					handle: rawHandle,
					displayName: rawDisplayName,
					error: "That avatar's too big — keep it under 2 MB."
				});
			}

			const uploadResult = await upload(supabase, AVATARS_BUCKET, avatarPath(user.id), avatarFile);
			if (!uploadResult.ok) {
				console.error('[profiles] avatar upload failed during onboarding', {
					userId: user.id,
					error: uploadResult.error.message
				});
				return fail(500, {
					handle: rawHandle,
					displayName: rawDisplayName,
					error: "We couldn't upload your avatar. Try again or skip it for now."
				});
			}
			avatarStoredPath = uploadResult.data.path;
		}

		// Create the profile. The handle UNIQUE constraint is the authoritative
		// duplicate guard (covers the race the pre-check can lose).
		const created = await createProfile(supabase, {
			id: user.id,
			handle,
			displayName,
			avatarPath: avatarStoredPath
		});

		if (!created.ok) {
			if (created.error === HANDLE_TAKEN) {
				return fail(400, {
					handle: rawHandle,
					displayName: rawDisplayName,
					error: 'That handle is taken. Try another.'
				});
			}
			console.error('[profiles] createProfile failed during onboarding', {
				userId: user.id,
				error: created.error
			});
			return fail(500, {
				handle: rawHandle,
				displayName: rawDisplayName,
				error: 'Could not set up your profile right now. Please try again.'
			});
		}

		throw redirect(303, `/app/profile/${created.data.handle}`);
	}
};
