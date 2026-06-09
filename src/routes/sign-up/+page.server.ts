import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isValidTokenFormat } from '$lib/features/invites/token';
import { redeemInvite } from '$lib/features/invites/invites';

// Public sign-up flow. The auth guard in hooks.server.ts only protects /app*, so
// this route is reachable while unauthenticated (anon). The token may arrive in
// the query string (?token=...) from an invite link; we surface it to the form
// so the field pre-fills.
//
// Redemption order matters: we validate the token shape, then signUp(), then
// consume the token via the SECURITY DEFINER RPC keyed to the new user id. The
// RPC enforces single-use atomically (consumed_by IS NULL guard) — an
// invalid/used token returns ok:false and we reject with a friendly fail().

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
		// the gap between page load and submit, this rejects atomically.
		const redemption = await redeemInvite(supabase, token, signUpData.user.id);
		if (!redemption.ok) {
			console.error('[invites] redeemInvite failed after signUp', {
				userId: signUpData.user.id,
				error: redemption.error
			});
			return fail(400, { token, email, error: redemption.error });
		}

		// Account created and invite consumed. Send the user into the app (or to
		// confirm their email, depending on the Supabase Auth email settings).
		throw redirect(303, '/app');
	}
};
