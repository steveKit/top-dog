import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readBootstrap } from './helpers/bootstrap-fixtures';

// M1 vertical-slice @smoke (TASK-014). Drives the full happy path through the
// REAL UI in a browser, against the LOCAL Supabase stack:
//
//   redeem invite -> set @handle -> upload one dog -> see it rendered
//
// Local-stack creds are injected into the previewed app by playwright.config.ts
// (webServer.env) and the invite token is minted by globalSetup. Everything here
// runs as a normal anonymous browser; the secret key never reaches page code.
//
// This is the milestone-closing test — all later milestones must keep it green.

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_IMAGE = join(here, 'fixtures', 'hotdog.png');

test('@smoke redeem invite, set handle, upload a dog, and see it rendered', async ({ page }) => {
	const { token } = readBootstrap();

	// Unique per-run identity so reruns never collide on the email / handle.
	const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
	const email = `smoke-${stamp}@topdog.test`;
	const password = 'smoke-user-password-123';
	const handle = `smoke_${stamp}`.slice(0, 32);

	// (1) Redeem the invite via the public sign-up form.
	await page.goto(`/sign-up?token=${encodeURIComponent(token)}`);
	await expect(page.getByRole('heading', { name: 'Sign up' })).toBeVisible();

	// Token should be pre-filled from the query string.
	await expect(page.locator('input[name="token"]')).toHaveValue(token);

	await page.locator('input[name="email"]').fill(email);
	await page.locator('input[name="password"]').fill(password);
	await page.getByRole('button', { name: 'Create account' }).click();

	// Local stack has email confirmation disabled, so signUp returns a session and
	// the action redirects into /app. The app-layout guard then funnels a
	// profile-less user to onboarding.
	await page.waitForURL('**/app/onboarding');
	await expect(page.getByRole('heading', { name: 'Set up your profile' })).toBeVisible();

	// (2) Set a unique handle (skip the optional avatar).
	await page.locator('input[name="handle"]').fill(handle);
	await page.getByRole('button', { name: 'Create profile' }).click();

	// Onboarding redirects to the new profile page.
	await page.waitForURL(`**/app/profile/${handle}`);
	await expect(page.getByRole('heading', { name: handle, exact: false })).toBeVisible();
	await expect(page.getByText(`@${handle}`)).toBeVisible();

	// (3) Upload one hot dog. compressToWebp runs in the real browser (canvas),
	// then the server uploads to the private `hotdogs` bucket and inserts the row.
	await page.goto('/app/dogs');
	await expect(page.getByRole('heading', { name: 'Your hot dogs' })).toBeVisible();
	await expect(page.getByText('No hot dogs yet. Upload your first one!')).toBeVisible();

	await page.locator('input[name="photo"]').setInputFiles(FIXTURE_IMAGE);
	await page.locator('input[name="caption"]').fill('A fine frank');
	await page.getByRole('button', { name: 'Add hot dog' }).click();

	// (4) See it rendered: the grid shows an <img> backed by a signed URL from the
	// private bucket, and the caption we set.
	const dogImage = page.locator('ul li img').first();
	await expect(dogImage).toBeVisible({ timeout: 15000 });
	await expect(page.getByText('A fine frank')).toBeVisible();

	// The src must be a real signed URL into the hotdogs bucket (not a data URI or
	// blank), and the image must actually decode/load in the browser.
	const src = await dogImage.getAttribute('src');
	expect(src, 'rendered dog should have a src').toBeTruthy();
	expect(src).toContain('/storage/v1/');
	expect(src).toContain('token=');

	const naturalWidth = await dogImage.evaluate((img) => (img as HTMLImageElement).naturalWidth);
	expect(naturalWidth, 'signed-URL image should actually load').toBeGreaterThan(0);
});
