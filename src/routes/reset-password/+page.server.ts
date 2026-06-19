import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// Public "reset password" step (steps 2–3 of the design's recovery flow): the
// member supplies the 6-digit recovery CODE emailed by /forgot-password plus a
// new password (with confirm). Reachable while unauthenticated — the auth guard
// only protects /app*.
//
// OTP recovery handshake (Supabase Auth, @supabase/ssr per-request client):
//   1. verifyOtp({ email, token, type: 'recovery' }) — validates the 6-digit
//      code and, on success, establishes a recovery SESSION (the @supabase/ssr
//      client persists it via the response cookies for this request).
//   2. updateUser({ password }) — runs WHILE that recovery session is active, so
//      it mutates ONLY the account the code authenticated. The recovery session
//      is the authoritative gate: a member can never reset another account
//      because they cannot produce a valid code for it.
//
// The email is carried from /forgot-password via the ?email= query param
// (pre-filled below) and travels with the form so verifyOtp has both email +
// token. SECURITY (L2): password length + confirm-match enforced at the
// boundary; raw Supabase errors are logged server-side only and replaced with a
// friendly, non-revealing message on the wrong/expired-code path; the secret key
// never touches this flow (we use the RLS-scoped event.locals.supabase).

const MIN_PASSWORD_LENGTH = 8;

// The recovery email template renders {{ .Token }} as a 6-digit numeric code.
const CODE_PATTERN = /^\d{6}$/;

export const load: PageServerLoad = async ({ url }) => {
	// Pre-fill the email handed over from /forgot-password so the member doesn't
	// retype it. It's still submitted with the form (verifyOtp needs it).
	const email = url.searchParams.get('email') ?? '';
	return { email };
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const email = String(formData.get('email') ?? '').trim();
		const code = String(formData.get('code') ?? '').trim();
		const password = String(formData.get('password') ?? '');
		const confirmPassword = String(formData.get('confirmPassword') ?? '');

		// Boundary validation, cheapest checks first. Echo email + code so the
		// form repopulates on failure (never echo the password).
		if (!CODE_PATTERN.test(code)) {
			return fail(400, { email, code, error: 'Enter the 6-digit recovery code from your email.' });
		}
		if (password.length < MIN_PASSWORD_LENGTH) {
			return fail(400, {
				email,
				code,
				error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
			});
		}
		if (password !== confirmPassword) {
			return fail(400, { email, code, error: 'The two passwords do not match.' });
		}

		// Step 1: verify the recovery code. On success this establishes a recovery
		// session for `email` on event.locals.supabase (cookies set for this
		// request). A wrong/expired code returns an error — surface a friendly,
		// non-revealing message and let the member retry.
		const { error: verifyError } = await supabase.auth.verifyOtp({
			email,
			token: code,
			type: 'recovery'
		});
		if (verifyError) {
			console.error('[auth] verifyOtp (recovery) failed', { error: verifyError.message });
			return fail(400, {
				email,
				code,
				error: 'That recovery code is invalid or has expired. Please request a new one.'
			});
		}

		// Step 2: with the recovery session active, set the new password. This
		// targets ONLY the account the code authenticated.
		const { error: updateError } = await supabase.auth.updateUser({ password });
		if (updateError) {
			console.error('[auth] updateUser (password reset) failed', { error: updateError.message });
			return fail(400, {
				email,
				code,
				error: 'We could not update your password. Please try again.'
			});
		}

		return { success: true };
	}
};
