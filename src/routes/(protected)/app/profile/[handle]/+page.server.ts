import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getProfileByHandle } from '$lib/features/profiles/profiles';
import { getPublicUrl } from '$lib/storage';

// Profile view (TASK-011). Fetches a profile by its (case-insensitive) handle
// and renders handle, join date, and stats (zeros initially). Avatars live in
// the public-read `avatars` bucket, so we resolve a public URL for the stored
// path — no signed URL needed. A missing handle 404s.

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
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

	return { profile, avatarUrl };
};
