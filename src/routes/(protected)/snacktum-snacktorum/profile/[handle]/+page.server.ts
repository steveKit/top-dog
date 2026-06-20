import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getProfileByHandle, getProfileById } from '$lib/features/profiles/profiles';
import { addSpray, listSpraysForProfile, NOT_TOP_DOG } from '$lib/features/mustard/sprays';
import {
	postWallMessage,
	listWallMessages,
	deleteWallMessage,
	type WallMessageRow
} from '$lib/features/walls/walls';
import { getPublicUrl } from '$lib/storage';
import { parseSigilId } from '$lib/features/profiles/sigils';
import { getLiarBrandTimestamps, getDogVerdictsForOwner } from '$lib/features/reports/verdictStore';
import { summarizeLiarBrand, isHamburgerHeretic } from '$lib/features/reports/verdict';

// Profile view (TASK-011) + mustard spray/render (TASK-041) + message wall
// (TASK-050). Fetches a profile by its (case-insensitive) handle and renders
// handle, join date, stats, mustard, and the message wall. Avatars live in the
// public-read `avatars` bucket, so we resolve a public URL for the stored path —
// no signed URL needed. A missing handle 404s.
//
// Mustard (decision #15): the current Top Dog may spray cosmetic mustard on any
// profile at a clicked (x,y). We load the target's live sprays for render-time
// decay and compute `canSpray` from the VIEWER's own (server-maintained,
// non-client-writable) crown flag. The spray action derives the target from the
// trusted route param — never a client-supplied id.
//
// Walls (decision: cosmetic/many-allowed, like reactions/sprays): any member may
// post a text message on any member's wall; the message stores the ORIGINAL body
// (M6 applies a render-time emoji filter, never persisted). Plain RLS write — no
// RPC. The author is pinned to safeGetSession() (never client-supplied); the wall
// owner is resolved from the TRUSTED route param. Delete is allowed for the
// message author or the wall owner (enforced by the RLS DELETE policy).

// How many wall messages the load returns (latest-first).
const WALL_MESSAGE_LIMIT = 50;

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

	// Avatar resolution (TASK-092): a member's avatar_path is either a built-in
	// sigil id (`sigil:<id>`, chosen in the onboarding rite — rendered inline as an
	// <Sigil>, no storage fetch) or a real uploaded object in the public `avatars`
	// bucket (resolved to a public URL). A sigil id never yields a storage URL.
	const sigilId = parseSigilId(profile.avatar_path);
	const avatarUrl =
		!sigilId && profile.avatar_path ? getPublicUrl(supabase, profile.avatar_path) : null;

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

	// Latest wall messages for this profile (newest first). A read failure degrades
	// to an empty wall rather than failing the whole page.
	const wallResult = await listWallMessages(supabase, profile.id, WALL_MESSAGE_LIMIT);
	let wallMessages: WallMessageRow[] = [];
	if (!wallResult.ok) {
		console.error('[profiles] failed to load wall messages', {
			profileId: profile.id,
			error: wallResult.error
		});
	} else {
		wallMessages = wallResult.data;
	}

	// The viewer's own id and whether they own this wall, so the page can show a
	// delete affordance only to a message's author or the wall owner (mirrors the
	// RLS DELETE policy).
	const viewerId = user.id;
	const isWallOwner = viewerId === profile.id;

	// 🍔 Hamburger Court brands (TASK-073, decision #12/#15 — cosmetic, ranking-inert,
	// computed at RENDER time). Two profile banners:
	//   - HAMBURGER LIAR: this member reported a dog the Top Dog ruled NOT a hamburger.
	//     Decaying over ~7 days from the brand timestamp (summarizeLiarBrand). A read
	//     failure degrades to "no banner" rather than failing the page.
	//   - HAMBURGER HERETIC: this member owns a dog confirmed to BE a hamburger.
	//     Persistent, derived from the verdicts on their dogs (isHamburgerHeretic).
	const liarResult = await getLiarBrandTimestamps(supabase, profile.id);
	let liarBrand = summarizeLiarBrand([], new Date());
	if (!liarResult.ok) {
		console.error('[profiles] failed to load liar brand', {
			profileId: profile.id,
			error: liarResult.error
		});
	} else {
		liarBrand = summarizeLiarBrand(liarResult.data, new Date());
	}

	const heresyResult = await getDogVerdictsForOwner(supabase, profile.id);
	let isHeretic = false;
	if (!heresyResult.ok) {
		console.error('[profiles] failed to load heretic state', {
			profileId: profile.id,
			error: heresyResult.error
		});
	} else {
		isHeretic = isHamburgerHeretic(heresyResult.data);
	}

	return {
		profile,
		avatarUrl,
		sigilId,
		sprays,
		canSpray,
		wallMessages,
		viewerId,
		isWallOwner,
		liarBrand,
		isHeretic
	};
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
	},

	// Post a message on this profile's wall. The author is derived from
	// safeGetSession() (never client-supplied); the wall owner is resolved from
	// the TRUSTED route param `params.handle` (never a client-supplied id). The
	// body is validated at the app boundary (postWallMessage), stored verbatim,
	// and the INSERT is RLS-gated so author_id = auth.uid().
	post: async ({ request, params, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { message: 'You must be signed in to post a message.' });
		}

		const targetResult = await getProfileByHandle(supabase, params.handle);
		if (!targetResult.ok) {
			console.error('[profiles] post: failed to resolve target', {
				handle: params.handle,
				error: targetResult.error
			});
			return fail(500, { message: 'Could not post your message right now.' });
		}
		if (!targetResult.data) {
			return fail(404, { message: 'No such chef.' });
		}

		const formData = await request.formData();
		const body = String(formData.get('body') ?? '');

		const result = await postWallMessage(supabase, user.id, targetResult.data.id, body);
		if (!result.ok) {
			console.error('[profiles] post wall message failed', {
				userId: user.id,
				targetId: targetResult.data.id,
				error: result.error
			});
			return fail(400, { message: result.error });
		}

		return { posted: true };
	},

	// Delete a message from this profile's wall. The caller is derived from
	// safeGetSession(); authorization (the deleter is the message author OR the
	// wall owner) is enforced AUTHORITATIVELY by the RLS DELETE policy — a delete
	// the caller isn't allowed to make affects zero rows and still succeeds, so we
	// don't re-check it here.
	deleteMessage: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { message: 'You must be signed in to delete a message.' });
		}

		const formData = await request.formData();
		const messageId = String(formData.get('messageId') ?? '');
		if (messageId.trim().length === 0) {
			return fail(400, { message: 'Missing message id.' });
		}

		const result = await deleteWallMessage(supabase, messageId);
		if (!result.ok) {
			console.error('[profiles] delete wall message failed', {
				userId: user.id,
				messageId,
				error: result.error
			});
			return fail(400, { message: result.error });
		}

		return { deleted: true };
	}
};
