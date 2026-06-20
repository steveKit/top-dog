import { expect, test } from '@playwright/test';
import { SMOKE_INVITER_EMAIL, SMOKE_INVITER_PASSWORD } from './helpers/bootstrap-fixtures';

// M8 sign-in @smoke (TASK-082). Drives the REAL /sign-in form in a browser
// against the LOCAL Supabase stack and confirms a known seeded user passes the
// gates and reaches the protected app.
//
// We reuse the SEEDED INVITER created by globalSetup (tests/global-setup.ts):
// it upserts `smoke-inviter@topdog.test` with a known password via the local
// service-role client. That user is a real auth account with NO profiles row,
// so a successful sign-in redirects to /snacktum-snacktorum and the (protected)/snacktum-snacktorum layout guard
// funnels the profile-less user to the /sign-up onboarding rite (TASK-092) —
// which, detecting the existing session, RESUMES at the handle-only naming
// (Inscribe) step rather than re-asking for invite/credentials — proving both
// that the credentials
// authenticated AND that the auth cascade routed onward (we do NOT bypass the
// guard). The credentials come from the shared bootstrap-fixtures
// constants, the same source globalSetup uses to create the user, so they always
// match. The secret key never touches page code — sign-in is a plain anonymous
// browser form post.

test('@smoke a seeded user signs in through the real form and reaches the app', async ({
	page
}) => {
	// (1) Land on the real sign-in form.
	await page.goto('/sign-in');
	await expect(page.getByRole('heading', { name: 'Enter the Snacktum' })).toBeVisible();

	// (2) Sign in with the seeded inviter's known credentials.
	await page.locator('input[name="email"]').fill(SMOKE_INVITER_EMAIL);
	await page.locator('input[name="password"]').fill(SMOKE_INVITER_PASSWORD);
	await page.getByRole('button', { name: /Enter the Snacktum/ }).click();

	// (3) The action redirects to /snacktum-snacktorum; the guard funnels this profile-less user to
	// the /sign-up rite, which resumes at the handle-only naming (Inscribe) step.
	// Reaching it confirms the session was established and the guard cascade ran
	// (we never bypass it).
	await page.waitForURL('**/sign-up');
	await expect(page.getByRole('heading', { name: 'Inscribe Thy Name' })).toBeVisible();
});
