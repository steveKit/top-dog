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

	// (1) Begin the Snacktum Onboarding rite at the public /sign-up route. The rite
	// is a single-route, multi-step ceremony (Summoned → Inscribe → Sigil →
	// Renounce → Received); the old standalone /snacktum-snacktorum/onboarding URL is
	// gone — the naming/sigil step now happens IN-PAGE at /sign-up.
	//
	// This walks the EXACT user path — type the Casing (@handle) ONCE at Inscribe,
	// never re-typing it later — so the slice catches the TASK-092 flow bug where
	// the handle typed at Inscribe failed to carry forward to the createProfile
	// submission, surfacing "Please choose a handle." at the final Continue. If the
	// handle does not survive Inscribe → register → Sigil → Renounce, the rite
	// never reaches /snacktum-snacktorum/shrine/<handle> and this test fails.
	await page.goto(`/sign-up?token=${encodeURIComponent(token)}`);
	await expect(page.getByRole('heading', { name: 'You Have Been Summoned' })).toBeVisible();

	// The summoning token is pre-filled from the query string.
	await expect(page.locator('input[name="token"]')).toHaveValue(token);

	// Pass from Summoned into the Inscribe step.
	await page.getByRole('button', { name: 'Take a Bite →' }).click();
	await expect(page.getByRole('heading', { name: 'Inscribe Thy Name' })).toBeVisible();

	// Inscribe: the Casing Name (@handle), mustard-address (email), and secret word
	// (password). This is the ONLY place the smoke test types the handle — it must
	// carry forward unaided to the createProfile submission. Submitting redeems the
	// invite and signs the member up, then the rite advances IN-PAGE to Choose Thy
	// Sigil (no separate onboarding URL).
	await page.locator('input[name="handle"]').fill(handle);
	await page.locator('input[name="email"]').fill(email);
	await page.locator('input[name="password"]').fill(password);
	await page.getByRole('button', { name: 'Continue →' }).click();

	// (2) Choose Thy Sigil — the built-in SVG sigil avatar (no upload), stored as a
	// `sigil:<id>` in avatar_path. Pick the Tube sigil, then Continue. The Sigil
	// step's Continue is where the profile is FORGED (TASK-092): createProfile fires
	// here — NOT on the oath screen — so the action's legitimate session check never
	// surfaces on the pure-UI Renounce step. The Casing typed once at Inscribe rides
	// hidden from client state straight to createProfile; the test does NOT re-type
	// the handle anywhere, so a regression that drops the carried handle would submit
	// an empty handle, fail with "Please choose a handle." IN PLACE here, and never
	// advance to the oath. On success the rite advances to Renounce.
	await expect(page.getByRole('heading', { name: 'Choose Thy Sigil' })).toBeVisible();
	await page.getByRole('radio', { name: 'The Tube Sigil' }).click();
	await page.getByRole('button', { name: 'Continue →' }).click();

	// Renounce the Patty — now PURE UI. No form, no action, no session check: the
	// profile was already forged at Sigil. The Continue here is a plain button gated
	// SOLELY on the oath having been sworn (it is disabled until the seal is pressed).
	// Swear the oath, then Continue advances to Received. This exercises the
	// session/oath SPLIT end-to-end: the session-dependent createProfile ran at
	// Sigil; this screen only checks the oath.
	await expect(page.getByRole('heading', { name: 'Renounce the Patty' })).toBeVisible();
	await page.getByRole('button', { name: 'Press to Swear the Oath' }).click();
	await page.getByRole('button', { name: 'Continue →' }).click();

	// Received — the rite no longer redirects (createProfile returns so the oath +
	// Received are not skipped). Click the explicit "Enter →" into the app to reach
	// the new profile page with the typed handle — proof the Casing carried
	// end-to-end through register + the in-page Sigil-forge advance.
	await expect(page.getByRole('heading', { name: `Welcome, ${handle}` })).toBeVisible();
	await page.getByRole('link', { name: 'Enter →' }).click();
	await page.waitForURL(`**/snacktum-snacktorum/shrine/${handle}`);
	await expect(page.getByRole('heading', { name: handle, exact: false })).toBeVisible();
	await expect(page.getByText(`@${handle}`)).toBeVisible();

	// (3) Upload one hot dog. compressToWebp runs in the real browser (canvas),
	// then the server uploads to the private `hotdogs` bucket and inserts the row.
	await page.goto('/snacktum-snacktorum/litter');
	await expect(page.getByRole('heading', { name: 'Your Litter' })).toBeVisible();
	await expect(
		page.getByText('The grill is cold. Offer thy first frank to the Order.')
	).toBeVisible();

	await page.locator('input[name="photo"]').setInputFiles(FIXTURE_IMAGE);
	await page.locator('input[name="caption"]').fill('A fine frank');
	await page.getByRole('button', { name: 'Offer This Frank →' }).click();

	// (4) See it rendered: the gallery shows an <img> backed by a signed URL from the
	// private bucket, and the caption we set.
	const dogImage = page.locator('.frank-image img').first();
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
