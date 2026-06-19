import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

// Public "forgot password" request step (step 0 of the design's recovery flow).
// Reachable while unauthenticated — the auth guard in hooks.server.ts only
// protects /app*. The member supplies their email; Supabase Auth sends a
// recovery email rendering a 6-digit OTP code ({{ .Token }} in the template).
// Locally that email lands in Mailpit (http://localhost:54324).
//
// SECURITY (L2 — account enumeration): the action ALWAYS returns the same
// neutral success message regardless of whether the email is registered, and
// regardless of whether resetPasswordForEmail reports an error. Surfacing a
// distinct "no such account" response would let an attacker enumerate members.
// Raw Supabase errors are logged server-side only, never sent to the client.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Shown verbatim on every non-validation outcome so the response can't be used
// to probe which emails are registered.
const NEUTRAL_MESSAGE = 'If that email is registered, a recovery code is on its way.';

export const actions: Actions = {
	default: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const email = String(formData.get('email') ?? '').trim();

		// Boundary-validate the email shape. A malformed address is the one case
		// we reject loudly — it's a client mistake, not an enumeration signal.
		if (!EMAIL_PATTERN.test(email)) {
			return fail(400, { email, error: 'Please enter a valid email address.' });
		}

		// Fire the recovery email. We deliberately ignore the result for the
		// response: whether the email exists or Supabase errors, the member sees
		// the same neutral confirmation. Errors are logged for operators only.
		const { error } = await supabase.auth.resetPasswordForEmail(email);
		if (error) {
			console.error('[auth] resetPasswordForEmail failed', {
				// Never log the raw email at info level; message is enough to debug.
				error: error.message
			});
		}

		// Always neutral. Echo the email so /reset-password can pre-fill it.
		return { success: true, email, message: NEUTRAL_MESSAGE };
	}
};
