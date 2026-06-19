import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

// Public sign-in flow. The auth guard in hooks.server.ts only protects /app*, so
// this route is reachable while unauthenticated and is the destination every
// bounced /app request lands on.
//
// signInWithPassword runs on the RLS-scoped per-request client
// (event.locals.supabase), which the @supabase/ssr integration wires to set the
// auth cookies on success. We then redirect to /app and let the (protected)/app
// layout guard route onward (profile-less -> /app/onboarding; otherwise the app
// shell). We never bypass that guard.
//
// SECURITY (L2 — account enumeration): on ANY auth failure we surface ONE
// generic, non-enumerating message and do NOT reveal whether the email exists or
// the password was wrong. The raw Supabase error is logged server-side only,
// never sent to the client. We echo the email back to repopulate the form, but
// NEVER the password.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Shown verbatim for every auth failure so the response can't be used to probe
// which emails are registered or whether a password was correct.
const GENERIC_AUTH_ERROR = "Those credentials didn't work.";

export const actions: Actions = {
	default: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const email = String(formData.get('email') ?? '').trim();
		const password = String(formData.get('password') ?? '');

		// Validate at the boundary before doing any work. Note: login enforces only
		// a non-empty password — a length policy is a sign-up/reset concern, and
		// enforcing it here would weakly hint at the stored password's shape.
		if (!EMAIL_PATTERN.test(email)) {
			return fail(400, { email, error: 'Please enter a valid email address.' });
		}
		if (password.length === 0) {
			return fail(400, { email, error: 'Please enter your seal.' });
		}

		const { data, error } = await supabase.auth.signInWithPassword({ email, password });

		if (error || !data.session) {
			// Log the raw cause for operators; the member sees only the generic
			// message. Never log the password.
			console.error('[auth] signInWithPassword failed', {
				error: error?.message ?? 'no session returned'
			});
			return fail(400, { email, error: GENERIC_AUTH_ERROR });
		}

		// Live session established (cookies set by the SSR client). Hand off to the
		// app guard, which funnels profile-less users to onboarding.
		throw redirect(303, '/app');
	}
};
