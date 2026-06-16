import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getProfileByHandle, getProfileById } from '$lib/features/profiles/profiles';
import { addSpray, listSpraysForProfile, NOT_TOP_DOG } from '$lib/features/mustard/sprays';
import { getPublicUrl } from '$lib/storage';

// Profile view (TASK-011) + mustard spray/render (TASK-041). Fetches a profile by
// its (case-insensitive) handle and renders handle, join date, and stats.
// Avatars live in the public-read `avatars` bucket, so we resolve a public URL
// for the stored path — no signed URL needed. A missing handle 404s.
//
// Mustard (decision #15): the current Top Dog may spray cosmetic mustard on any
// profile at a clicked (x,y). We load the target's live sprays for render-time
// decay and compute `canSpray` from the VIEWER's own (server-maintained,
// non-client-writable) crown flag. The spray action derives the target from the
// trusted route param — never a client-supplied id.

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		throw redirect(303, '/sign-in');
	}

	const result = await getProfileByHandle(supabase, params.handle);

	if (!result.ok) {
		console.error('[profiles] failed to load profile by handle', {
			handle: params.handle,
			error: result.error
		});
		throw error(500, 'Could not load this profile right now.');
	}

	if (!result.data) {
		throw error(404, 'No such chef.');
	}

	const profile = result.data;
	const avatarUrl = profile.avatar_path ? getPublicUrl(supabase, profile.avatar_path) : null;

	// Can the VIEWER spray? Only the current Top Dog may. is_current_top_dog is
	// server-maintained and non-client-writable (decision #25), so reading it off
	// the viewer's own profile is trustworthy. A read failure degrades to "no
	// spray affordance" rather than blocking the page.
	const viewerResult = await getProfileById(supabase, user.id);
	let canSpray = false;
	if (!viewerResult.ok) {
		console.error('[profiles] failed to load viewer profile for canSpray', {
			userId: user.id,
			error: viewerResult.error
		});
	} else {
		canSpray = viewerResult.data?.is_current_top_dog === true;
	}

	// Live sprays on this profile for render-time decay. A read failure degrades to
	// an empty mustard layer rather than failing the whole page.
	const spraysResult = await listSpraysForProfile(supabase, profile.id);
	let sprays: { id: string; x: number; y: number; sprayed_at: string }[] = [];
	if (!spraysResult.ok) {
		console.error('[profiles] failed to load sprays', {
			profileId: profile.id,
			error: spraysResult.error
		});
	} else {
		sprays = spraysResult.data;
	}

	return { profile, avatarUrl, sprays, canSpray };
};

export const actions: Actions = {
	// Spray mustard on this profile. The sprayer is derived from
	// safeGetSession() (never client-supplied); the target is resolved from the
	// TRUSTED route param `params.handle` (never a client-supplied id). x/y are
	// parsed and validated; the RLS INSERT policy is the authoritative gate that
	// only the current Top Dog may spray (addSpray maps that denial to a friendly
	// message). On success the page invalidates and re-renders with the new spray.
	spray: async ({ request, params, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { message: 'You must be signed in to spray mustard.' });
		}

		const targetResult = await getProfileByHandle(supabase, params.handle);
		if (!targetResult.ok) {
			console.error('[profiles] spray: failed to resolve target', {
				handle: params.handle,
				error: targetResult.error
			});
			return fail(500, { message: 'Could not spray mustard right now.' });
		}
		if (!targetResult.data) {
			return fail(404, { message: 'No such chef.' });
		}

		const formData = await request.formData();
		const x = Number(formData.get('x'));
		const y = Number(formData.get('y'));
		if (!Number.isFinite(x) || !Number.isFinite(y)) {
			return fail(400, { message: 'That spray position is invalid.' });
		}

		const result = await addSpray(supabase, user.id, targetResult.data.id, x, y);
		if (!result.ok) {
			console.error('[profiles] spray failed', {
				userId: user.id,
				targetId: targetResult.data.id,
				error: result.error
			});
			// Privilege denial (not the Top Dog) reads as 403; range errors as 400.
			const status = result.error === NOT_TOP_DOG ? 403 : 400;
			return fail(status, { message: result.error });
		}

		return { sprayed: true };
	}
};
