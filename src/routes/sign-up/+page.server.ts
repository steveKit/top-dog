import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isValidTokenFormat } from '$lib/features/invites/token';
import { isInviteRedeemable, redeemInvite } from '$lib/features/invites/invites';
import { getServiceClient } from '$lib/server/supabase';
import { validateHandle } from '$lib/features/profiles/handle';
import {
	createProfile,
	getProfileById,
	isHandleAvailable,
	HANDLE_TAKEN
} from '$lib/features/profiles/profiles';
import { isSigilId, sigilAvatarValue, DEFAULT_SIGIL } from '$lib/features/profiles/sigils';

// The Snacktum Onboarding RITE (TASK-092). A single public route at /sign-up that
// absorbs the old standalone /snacktum-snacktorum/onboarding step. Two form actions drive the
// ceremony:
//
//   register     — Summoned + Inscribe: the invite-redemption flow (UNCHANGED
//                  from the old sign-up). On success WITH a session it returns
//                  `{ registered: true }` so the client advances IN-PAGE to the
//                  sigil/oath steps (it no longer redirects to /snacktum-snacktorum). Email-
//                  confirm (no session) still returns the confirm-email state.
//   createProfile — Choose Thy Sigil: validates the @handle (Casing Name) at the
//                  boundary and creates the `profiles` row with the chosen sigil
//                  stored as `sigil:<id>` in avatar_path (no upload, no migration).
//                  Fires from the SIGIL step's Continue (NOT the oath screen), so
//                  the legitimate `safeGetSession()` check never surfaces on the
//                  pure-UI Renounce step. Returns `{ created, handle }` instead of
//                  redirecting so the client can advance Sigil → Renounce →
//                  Received in-page (a redirect would skip the oath + Received).
//
// Redemption order (register) is defensive against an orphaned-account race
// (decisions #17/#22/#23) AND against burning a single-use invite on a bad handle
// (FIX-RITE-VALIDATION):
//   1. validate token shape, email, password, AND the Casing (handle) — ALL at the
//      boundary, BEFORE any account/invite work, so a malformed handle can never
//      create an orphan account or consume the invite,
//   2. best-effort pre-check that the token is redeemable BEFORE signUp (so the
//      common "already used" case never leaves an orphan auth user),
//   3. best-effort handle-uniqueness pre-check (service-client head count) AFTER
//      the invite gate — only a valid-invite holder may probe handle existence,
//   4. signUp(),
//   5. consume the token via the SECURITY DEFINER redeem_invite RPC keyed to the
//      new user id (the conditional UPDATE is the authoritative single-use check),
//   6. if redemption loses the narrow race, delete the just-created auth user with
//      the service client (server-side only) so the email is reusable,
//   7. branch on whether signUp returned a session.
//
// Resumability (AC): an authenticated-but-profile-less member funneled here by the
// app guard already has a session — `load` surfaces `resumeAtProfile` so the rite
// skips Summoned/Inscribe and starts at Choose Thy Sigil. A member who finished
// the rite HAS a profile and is redirected straight to it.
//
// Step split (TASK-092): profile creation lives on the SIGIL step's Continue, NOT
// the oath step. The oath (Renounce) is therefore pure UI — its Continue is gated
// SOLELY on the oath having been sworn, with no server action and no session
// check. The Received step gets an explicit "Enter →" into the app because
// createProfile no longer redirects.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export const load: PageServerLoad = async ({ url, locals: { supabase, safeGetSession } }) => {
	const token = url.searchParams.get('token') ?? '';

	// If the visitor is already authenticated (the app guard funnels a profile-less
	// member here), the rite resumes at the profile-creation steps rather than
	// re-asking for invite/credentials. An already-onboarded member is sent to
	// their profile so they never re-run the rite.
	const { session, user } = await safeGetSession();
	if (session && user) {
		const existing = await getProfileById(supabase, user.id);
		if (existing.ok && existing.data) {
			throw redirect(303, `/snacktum-snacktorum/shrine/${existing.data.handle}`);
		}
		return { token, resumeAtProfile: true };
	}

	return { token, resumeAtProfile: false };
};

export const actions: Actions = {
	// Summoned + Inscribe: invite redemption. UNCHANGED mechanics; only the
	// success-with-session branch differs — it returns a `registered` flag so the
	// single-route rite advances in-page instead of redirecting to /snacktum-snacktorum.
	register: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const token = String(formData.get('token') ?? '');
		const email = String(formData.get('email') ?? '').trim();
		const password = String(formData.get('password') ?? '');
		const rawHandle = String(formData.get('handle') ?? '');

		// Validate at the boundary before doing any work.
		if (!isValidTokenFormat(token)) {
			return fail(400, { token, email, error: 'A valid invite link is required to sign up.' });
		}
		if (!EMAIL_PATTERN.test(email)) {
			return fail(400, { token, email, error: 'Please enter a valid email address.' });
		}
		if (password.length < MIN_PASSWORD_LENGTH) {
			return fail(400, {
				token,
				email,
				error: `Seal must be at least ${MIN_PASSWORD_LENGTH} characters.`
			});
		}
		// Validate the Casing (handle) HERE, at the Inscribe boundary — BEFORE the
		// invite gate and signUp — the same care already taken with the token. The
		// Inscribe form posts name="handle"; validating it only at the later Sigil
		// step meant a malformed handle (e.g. one with a space) sailed through here,
		// created the auth account, and BURNED the single-use invite before being
		// rejected. createProfile still re-validates as the authoritative backstop.
		const handleCheck = validateHandle(rawHandle);
		if (!handleCheck.ok) {
			return fail(400, { token, email, handle: rawHandle, error: handleCheck.reason });
		}

		// Best-effort pre-check: reject an invalid/already-used token BEFORE creating
		// an account, so the common case never leaves an orphaned auth user. The
		// atomic RPC below is still authoritative for the narrow race window.
		const redeemable = await isInviteRedeemable(supabase, token);
		if (!redeemable.ok || !redeemable.data) {
			return fail(400, {
				token,
				email,
				error: 'This invite link is invalid or has already been used.'
			});
		}

		// Best-effort handle-uniqueness pre-check (the DB citext UNIQUE constraint on
		// profiles.handle stays authoritative for the narrow race). Placed AFTER the
		// invite gate on purpose: only the holder of a valid, unconsumed invite may
		// probe whether a Casing is already taken.
		//
		// This MUST use the SERVICE client: the register caller is unauthenticated
		// (no session exists yet), and profiles' only SELECT policy/grant is for the
		// `authenticated` role — an RLS-scoped probe here would silently return zero
		// rows and report EVERY handle as free. A head count ships no rows, only the
		// integer (the established service-client-after-gate head-count pattern).
		// handle is extensions.citext, so .eq() is already case-insensitive — do not
		// lowercase.
		const { count: handleCount, error: handleCountError } = await getServiceClient()
			.from('profiles')
			.select('id', { count: 'exact', head: true })
			.eq('handle', handleCheck.value);
		if (!handleCountError && (handleCount ?? 0) > 0) {
			return fail(400, {
				token,
				email,
				handle: rawHandle,
				error: 'That Casing is already worn by another of the faithful. Choose another.'
			});
		}

		const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
			email,
			password
		});

		if (signUpError || !signUpData.user) {
			console.error('[invites] signUp failed during invite redemption', {
				email,
				error: signUpError?.message
			});
			return fail(400, {
				token,
				email,
				error: signUpError?.message ?? 'Could not create your account. Please try again.'
			});
		}

		// Consume the invite for the newly created user. If the token was used in
		// the gap between the pre-check and here, this rejects atomically.
		const redemption = await redeemInvite(supabase, token, signUpData.user.id);
		if (!redemption.ok) {
			console.error('[invites] redeemInvite failed after signUp; cleaning up orphan', {
				userId: signUpData.user.id,
				error: redemption.error
			});

			// Lost the narrow race: an account now exists but no invite was consumed.
			// Delete it with the service client so the email is reusable and the user
			// is not permanently stuck. No profile row exists yet, so this is a clean
			// delete. The secret key stays server-only — never near the client.
			const { error: deleteError } = await getServiceClient().auth.admin.deleteUser(
				signUpData.user.id
			);
			if (deleteError) {
				console.error('[invites] failed to delete orphaned auth user after lost redeem race', {
					userId: signUpData.user.id,
					error: deleteError.message
				});
			}

			return fail(400, {
				token,
				email,
				error:
					'This invite link was just used by someone else. Please sign up again with a valid invite.'
			});
		}

		// Account created and invite consumed. If email confirmation is enabled,
		// signUp returns no session — the rite cannot advance into the profile steps
		// (the profile insert needs an authenticated session), so show a
		// confirmation-required success state. The invite was validly consumed, so
		// this is NOT a failure.
		if (!signUpData.session) {
			return { success: true, confirmEmail: true, email };
		}

		// We have a live session: advance the rite IN-PAGE to Choose Thy Sigil. The
		// session cookie is now set, so the createProfile action below can run.
		return { registered: true };
	},

	// Choose Thy Sigil: create the profile row. Fires from the SIGIL step's
	// Continue (the Renounce/oath step that follows is pure UI). Carries the old
	// onboarding's handle-validation/profile-creation logic. The sigil choice is
	// stored as a prefixed id in avatar_path (no upload). The trusted profile id is
	// the validated session uid, never a client value. On success it RETURNS
	// `{ created, handle }` (instead of redirecting) so the client can advance the
	// rite Sigil → Renounce → Received in-page; a failure surfaces the themed error
	// IN PLACE on the Sigil step (retry-able), never on the oath screen.
	createProfile: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { error: 'You must be signed in to complete the rite.' });
		}

		const formData = await request.formData();
		const rawHandle = String(formData.get('handle') ?? '');
		const rawSigil = String(formData.get('sigil') ?? '');

		// Validate the handle (charset + length) at the boundary. Themed copy must
		// not weaken this — the same pure validator the old onboarding used.
		const handleCheck = validateHandle(rawHandle);
		if (!handleCheck.ok) {
			return fail(400, { handle: rawHandle, sigil: rawSigil, error: handleCheck.reason });
		}
		const handle = handleCheck.value;

		// display_name is NOT NULL; the rite has no separate display-name field, so
		// it defaults to the chosen handle (the Casing Name IS the display identity).
		const displayName = handle;

		// Resolve the chosen sigil. An unknown/absent value falls back to the default
		// sigil rather than failing — every member gets a face. Stored as `sigil:<id>`.
		const sigil = isSigilId(rawSigil) ? rawSigil : DEFAULT_SIGIL;
		const avatarStoredPath = sigilAvatarValue(sigil);

		// Best-effort pre-check (the DB UNIQUE constraint is still authoritative).
		const available = await isHandleAvailable(supabase, handle);
		if (available.ok && !available.data) {
			return fail(400, {
				handle: rawHandle,
				sigil: rawSigil,
				error: 'That handle is taken. Try another.'
			});
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
					sigil: rawSigil,
					error: 'That handle is taken. Try another.'
				});
			}
			console.error('[profiles] createProfile failed during onboarding rite', {
				userId: user.id,
				error: created.error
			});
			return fail(500, {
				handle: rawHandle,
				sigil: rawSigil,
				error: 'Could not complete the rite right now. Please try again.'
			});
		}

		// Do NOT redirect: the client advances Sigil → Renounce → Received in-page so
		// the oath and Received steps are not skipped. The handle echoes back so the
		// client carries the canonical (validated) handle into Received's "Enter →".
		return { created: true, handle: created.data.handle };
	}
};
