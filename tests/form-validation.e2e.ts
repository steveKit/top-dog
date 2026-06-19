import { expect, test } from '@playwright/test';

// M8 themed inline form-validation UI spec. Standalone (NOT @smoke/@security):
// it drives only the PUBLIC /sign-in form and exercises the client-side themed
// validation layer (formValidation.svelte.ts + validationMessage.ts). No DB,
// auth, or seeding — we never submit valid credentials, so the live stack and
// the local-stack helpers are irrelevant here. The webServer still boots the
// previewed app (the harness default), but this spec only touches markup the
// server renders for an anonymous visitor.
//
// What it proves end-to-end (the unit tests already pin the pure message map):
//  (a) submitting empty required fields shows the themed, field-naming inline
//      messages, wires the a11y attrs, and focuses the first invalid field —
//      AND the native validation bubble never blocks (our handler ran, since
//      the themed <p role="alert"> appeared, which only happens when our
//      enhance-wrapper's validate() executed on a `novalidate` form);
//  (b) typing one keystroke into a field clears ONLY that field's error.

test.describe('themed inline form validation on /sign-in', () => {
	test('empty submit shows themed messages, wires a11y, and focuses the first invalid field', async ({
		page
	}) => {
		await page.goto('/sign-in');
		await expect(page.getByRole('heading', { name: 'Enter the Snacktum' })).toBeVisible();

		const email = page.locator('input[name="email"]');
		const seal = page.locator('input[name="password"]');

		// Submit with both required fields empty.
		await page.getByRole('button', { name: /Enter the Snacktum/ }).click();

		// Both themed, field-naming messages are visible. Their presence proves our
		// enhance-wrapper's validate() ran: on a `novalidate` form the browser
		// renders no native bubble, so these <p>s only exist because our handler
		// populated the reactive errors map. (We don't use getByRole({ name }) here:
		// `alert` is not a name-from-content role, so the visible text is not its
		// accessible name — match by text and assert the role attribute separately.)
		const emailError = page.getByText('Speak thy Mustard Address.');
		const sealError = page.getByText('A Seal is required to pass.');
		await expect(emailError).toBeVisible();
		await expect(sealError).toBeVisible();
		await expect(emailError).toHaveAttribute('role', 'alert');
		await expect(sealError).toHaveAttribute('role', 'alert');

		// a11y wiring on the invalid email field: aria-invalid="true" and
		// aria-describedby pointing at the visible error element's id.
		await expect(email).toHaveAttribute('aria-invalid', 'true');
		const describedBy = await email.getAttribute('aria-describedby');
		expect(describedBy).toBeTruthy();
		await expect(emailError).toHaveAttribute('id', describedBy!);

		// The first invalid field (email — it appears first in the form) is focused.
		await expect(email).toBeFocused();

		// The Seal is likewise marked invalid.
		await expect(seal).toHaveAttribute('aria-invalid', 'true');
	});

	test('typing in a field clears only that field’s error', async ({ page }) => {
		await page.goto('/sign-in');

		const email = page.locator('input[name="email"]');
		const emailError = page.getByText('Speak thy Mustard Address.');
		const sealError = page.getByText('A Seal is required to pass.');

		// Trigger both errors.
		await page.getByRole('button', { name: /Enter the Snacktum/ }).click();
		await expect(emailError).toBeVisible();
		await expect(sealError).toBeVisible();

		// First keystroke in the email field clears its error (NOT validity-gated —
		// a single character is enough), and the a11y attrs come off in lockstep.
		await email.press('a');
		await expect(emailError).toHaveCount(0);
		await expect(email).not.toHaveAttribute('aria-invalid', 'true');
		await expect(email).not.toHaveAttribute('aria-describedby', /.+/);

		// The Seal's error is untouched — clearing is strictly per-field.
		await expect(sealError).toBeVisible();
	});
});
