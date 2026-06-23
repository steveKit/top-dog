import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getProfileById } from '$lib/features/profiles/profiles';
import {
	listFlaggedDogs,
	renderBurgerVerdict,
	NOT_TOP_DOG,
	VERDICT_NOT_TOP_DOG,
	VERDICT_UNAUTHENTICATED,
	VERDICT_NO_SUCH_DOG,
	VERDICT_BAD_VALUE
} from '$lib/features/reports/verdictStore';
import { getServiceClient } from '$lib/server/supabase';
import { getSignedUrl } from '$lib/storage';
import type { BurgerVerdict } from '$lib/features/reports/verdict';

// 🍔 Hamburger Court — the Top-Dog-only ADJUDICATION surface (TASK-073). The current
// Top Dog reviews flagged dogs and renders a verdict (confirmed_hamburger /
// not_a_hamburger), which the render_burger_verdict SECURITY DEFINER RPC applies in
// one transaction (branding reporters LIARs on a clear, or the owner a HERETIC —
// derived — on a confirm).
//
// Two-layer gate: the UI is hidden from non-Top-Dog members (this load redirects
// them away), AND the DB RPC re-checks the crown via an EXISTS on the
// non-client-writable is_current_top_dog (decision #25) — so the gate holds even if
// the UI is bypassed. The crown is read off the viewer's OWN profile (server-maintained,
// non-client-writable), so it is trustworthy.
//
// The flagged-dog list is an ANONYMOUS aggregate read (listFlaggedDogs, service client
// AFTER the gate): burger_alarms' SELECT is owner-scoped to the reporter, so only
// per-dog report COUNTS + dog/owner metadata are surfaced — reporter ids never leave
// the server. Dog images come from the private `hotdogs` bucket via the service client
// (createSignedUrl is RLS-gated at creation; the bucket is owner-only SELECT, so a
// cross-owner view must sign server-side — the TASK-033 pattern).

/** Friendly copy for the known verdict failure sentinels. */
function verdictErrorMessage(err: string): string {
	switch (err) {
		case VERDICT_UNAUTHENTICATED:
			return 'You must be signed in to rule on a report.';
		case VERDICT_NOT_TOP_DOG:
			return NOT_TOP_DOG;
		case VERDICT_NO_SUCH_DOG:
			return 'That hot dog no longer exists.';
		case VERDICT_BAD_VALUE:
			return 'That verdict is not valid.';
		default:
			return 'Could not record that verdict right now. Please try again.';
	}
}

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		throw redirect(303, '/sign-in');
	}

	// Crown gate (UI half): only the current Top Dog sees the court. is_current_top_dog
	// is server-maintained and non-client-writable (decision #25), so reading it off
	// the viewer's own profile is trustworthy. A non-Top-Dog (or a read failure) is
	// funnelled back to the feed — the DB RPC is the authoritative second gate.
	const viewerResult = await getProfileById(supabase, user.id);
	if (!viewerResult.ok) {
		console.error('[court] failed to load viewer profile for crown gate', {
			userId: user.id,
			error: viewerResult.error
		});
		throw error(500, 'Could not load the Hamburger Court right now.');
	}
	if (viewerResult.data?.is_current_top_dog !== true) {
		// Not the Top Dog: this surface is theirs alone. Send them home.
		throw redirect(303, '/snacktum-snacktorum/procession');
	}

	// Flagged dogs (anonymous aggregate). Service client AFTER the gate above.
	const service = getServiceClient();
	const flaggedResult = await listFlaggedDogs(service);
	if (!flaggedResult.ok) {
		console.error('[court] failed to list flagged dogs', {
			userId: user.id,
			error: flaggedResult.error
		});
		throw error(500, 'Could not load flagged dogs right now.');
	}

	// Sign each flagged dog's private image server-side (a failed mint degrades to a
	// null URL rather than blanking the row).
	const flagged = await Promise.all(
		flaggedResult.data.map(async (dog) => {
			const signed = await getSignedUrl(service, dog.image_path);
			return {
				id: dog.id,
				ownerHandle: dog.owner_handle,
				caption: dog.caption,
				reportCount: dog.reportCount,
				verdict: dog.verdict,
				signedUrl: signed.ok ? signed.data.signedUrl : null
			};
		})
	);

	return { flagged };
};

export const actions: Actions = {
	// Render a verdict on a flagged dog. The adjudicating Top Dog is derived from
	// safeGetSession() / auth.uid() INSIDE the RPC (never client-supplied); the client
	// supplies only the dog id + the verdict value. The DB RPC re-checks the crown
	// (decision #25 EXISTS gate), so even a forged request from a non-Top-Dog is
	// rejected at the authoritative layer. On success the page invalidates and
	// re-renders the updated queue.
	rule: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { message: 'You must be signed in to rule on a report.' });
		}

		const formData = await request.formData();
		const dogId = String(formData.get('dogId') ?? '');
		const verdict = String(formData.get('verdict') ?? '');
		if (!dogId) {
			return fail(400, { message: 'Which hot dog?' });
		}
		if (verdict !== 'confirmed_hamburger' && verdict !== 'not_a_hamburger') {
			return fail(400, { message: 'That verdict is not valid.' });
		}

		const result = await renderBurgerVerdict(supabase, dogId, verdict as BurgerVerdict);
		if (!result.ok) {
			console.error('[court] renderBurgerVerdict failed', {
				userId: user.id,
				dogId,
				verdict,
				error: result.error
			});
			const status = result.error === VERDICT_NOT_TOP_DOG ? 403 : 400;
			return fail(status, { message: verdictErrorMessage(result.error) });
		}

		return { ruled: true };
	}
};
