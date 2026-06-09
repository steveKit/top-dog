import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isValidTokenFormat } from '$lib/features/invites/token';
import { isInviteRedeemable, redeemInvite } from '$lib/features/invites/invites';
import { getServiceClient } from '$lib/server/supabase';

// Public sign-up flow. The auth guard in hooks.server.ts only protects /app*, so
// this route is reachable while unauthenticated (anon). The token may arrive in
// the query string (?token=...) from an invite link; we surface it to the form
// so the field pre-fills.
//
// Redemption order matters and is defensive against an orphaned-account race:
//   1. validate the token shape,
//   2. best-effort pre-check that the token is redeemable BEFORE creating any
//      account (rejects the common "already used at submit time" case so no
//      orphan auth user is created),
//   3. signUp(),
//   4. consume the token via the SECURITY DEFINER RPC keyed to the new user id.
//      The conditional UPDATE (consumed_at IS NULL guard) is the authoritative
//      single-use check; the pre-check is only best-effort.
//   5. if redemption loses the narrow race after signUp succeeded, delete the
//      just-created auth user with the service client so the email is reusable.
//   6. branch the success path on whether signUp returned a session: with email
//      confirmation enabled there is no session yet, so we cannot send the user
//      into /app (the guard would bounce them) — we return a "check your email"
//      success state instead.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token') ?? '';
	return { token };
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const token = String(formData.get('token') ?? '');
		const email = String(formData.get('email') ?? '').trim();
		const password = String(formData.get('password') ?? '');

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
				error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
			});
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
			// is not permanently stuck. No profile row exists yet (TASK-011), so this
			// is a clean delete. The secret key stays server-only — never near the
			// client.
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
		// signUp returns no session — we cannot send the user into /app (the guard
		// would bounce them to /sign-in), so show a confirmation-required success
		// state. The invite was validly consumed, so this is NOT a failure.
		if (!signUpData.session) {
			return { success: true, confirmEmail: true, email };
		}

		// We have a live session: send the user into the app.
		throw redirect(303, '/app');
	}
};
