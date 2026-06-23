import { expect, test } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getLocalStackCreds } from './helpers/local-stack';
import { generateInviteToken } from '../src/lib/features/invites/token';
import { HOTDOGS_BUCKET } from '../src/lib/storage';

// TASK-032 — E2E hardening for the /snacktum-snacktorum/procession + /snacktum-snacktorum/litter/[id] flows (closes
// DW-011 and the PR #45 review gaps). Unlike votes.e2e.ts / reactions.e2e.ts
// (which drive PostgREST directly), this spec drives the REAL UI in a browser
// against the LOCAL stack — the same browser-driven pattern as smoke.e2e.ts —
// because the gap being closed is the feed/detail ROUTE wiring (form actions,
// signed-URL render, 404 handling), not the RPC contracts.
//
// Cast → move → remove must be exercised by a real member who does NOT own the
// dog they vote on (the self-vote CHECK forbids voting on your own dog). So we:
//   1. SEED a second member (the "owner") + two dogs via a Node-side
//      service-role client, uploading the fixture image into the private
//      `hotdogs` bucket at `{owner_id}/...` so the signed URL actually renders;
//   2. drive the VOTER through the UI: redeem a fresh invite (minted in-spec —
//      global-setup's single token belongs to the @smoke spec) → onboard →
//      land on the feed where only the owner's dogs are votable;
//   3. cast/move/remove + react/unreact through the feed, asserting the
//      AUTHORITATIVE vote_count (read back via service-role, bypassing RLS) and
//      the global Top Dog crown reflect each step;
//   4. open the dog detail page: image renders, stats show, 404 on a bad id.
//
// Fixture ids are crypto.randomUUID() (NOT pinned) so this spec never
// reintroduces the fixed-id hot_dogs_pkey collision fragility that affects
// votes.e2e.ts (tracked separately as DW-014 — not in scope here).
//
// The secret key stays Node/server-side (service-role setup + read-backs); it is
// NEVER handed to a browser/page context. Local-stack creds are resolved via the
// non-localhost-guarded helper, so the run cannot hit the hosted project.
//
// Tagged @smoke (browser-driven UI flow against the previewed app), consistent
// with smoke.e2e.ts — these are functional UI flows, not DB write-guard checks.
// They run serialized under playwright.config.ts `workers: 1`; the crown reset
// below mutates the global singleton crown, so serialization is required.

const creds = getLocalStackCreds();

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_IMAGE = join(here, 'fixtures', 'hotdog.png');

/** Service-role client: bypasses RLS + column grants for setup + authoritative reads. */
function serviceClient(): SupabaseClient {
	return createClient(creds.apiUrl, creds.secretKey, {
		auth: { autoRefreshToken: false, persistSession: false }
	});
}

// A unique handle suffix per spec keeps reruns from colliding on handle/profile
// uniqueness. Handles are limited to 2..32 chars; keep them short.
let seq = 0;
function uniqueHandle(prefix: string): string {
	seq += 1;
	return `${prefix}${Date.now().toString(36).slice(-4)}${seq}`.slice(0, 32);
}

// A unique caption per seeded dog. Captions are this spec's UI locator key (the
// feed card is located by caption text), so they MUST be unique per run — a prior
// run's leftover dog with the same caption would make the `li` locator ambiguous.
// Pairs with the fresh-UUID dog ids to keep reruns collision-free.
let captionSeq = 0;
function uniqueCaption(label: string): string {
	captionSeq += 1;
	return `${label} ${Date.now().toString(36)}-${captionSeq}`;
}

/**
 * Seeds an owner: an auth user + matching profile, using the service client
 * (bypasses RLS — we are seeding a fixture, not exercising the write path).
 * Returns the new auth id, which is also the profile id and the storage prefix.
 */
async function seedOwner(handle: string): Promise<string> {
	const service = serviceClient();
	const email = `feed-owner-${handle}-${Date.now().toString(36)}@topdog.test`;
	const { data: created, error: createError } = await service.auth.admin.createUser({
		email,
		password: 'feed-owner-password-123',
		email_confirm: true
	});
	if (createError || !created.user) {
		throw new Error(`Could not create owner ${handle}: ${createError?.message}`);
	}
	const id = created.user.id;

	const { error: profileError } = await service
		.from('profiles')
		.insert({ id, handle, display_name: handle });
	if (profileError) {
		throw new Error(`Could not create profile for ${handle}: ${profileError.message}`);
	}
	return id;
}

/**
 * Seeds a hot dog for `ownerId` and UPLOADS the fixture image into the private
 * `hotdogs` bucket at the `{owner_id}/...` prefix (load-bearing for storage RLS,
 * and required for the feed/detail signed URL to resolve to a real, decodable
 * image). Uses the service client for both the row insert and the storage upload
 * — seeding a fixture, not testing the column grants or the RLS write prefix.
 * The id is a fresh UUID (never pinned) to avoid hot_dogs_pkey collisions.
 */
async function seedDog(ownerId: string, caption: string): Promise<string> {
	const service = serviceClient();
	const dogId = crypto.randomUUID();
	const imagePath = `${ownerId}/${dogId}.png`;

	const bytes = readFileSync(FIXTURE_IMAGE);
	const { error: uploadError } = await service.storage
		.from(HOTDOGS_BUCKET)
		.upload(imagePath, bytes, { contentType: 'image/png', upsert: true });
	if (uploadError) {
		throw new Error(`Could not upload fixture image for dog: ${uploadError.message}`);
	}

	const { error } = await service.from('hot_dogs').insert({
		id: dogId,
		owner_id: ownerId,
		image_path: imagePath,
		byte_size: bytes.byteLength,
		caption
	});
	if (error) {
		throw new Error(`Could not insert fixture dog: ${error.message}`);
	}
	return dogId;
}

/** Authoritative vote_count for a dog, read with the service client (bypasses RLS). */
async function voteCount(dogId: string): Promise<number> {
	const service = serviceClient();
	const { data, error } = await service
		.from('hot_dogs')
		.select('vote_count')
		.eq('id', dogId)
		.single();
	if (error || !data) {
		throw new Error(`Could not read vote_count for ${dogId}: ${error?.message}`);
	}
	return data.vote_count as number;
}

/** A profile's live crown state, read with the service client. */
async function crownState(
	profileId: string
): Promise<{ isTopDog: boolean; topDogSince: string | null }> {
	const service = serviceClient();
	const { data, error } = await service
		.from('profiles')
		.select('is_current_top_dog, top_dog_since')
		.eq('id', profileId)
		.single();
	if (error || !data) {
		throw new Error(`Could not read crown state for ${profileId}: ${error?.message}`);
	}
	return { isTopDog: data.is_current_top_dog as boolean, topDogSince: data.top_dog_since };
}

/** Count of reaction rows on a dog (authoritative, service-role read). */
async function reactionCount(dogId: string, emoji: string): Promise<number> {
	const service = serviceClient();
	const { count, error } = await service
		.from('hotdog_reactions')
		.select('id', { count: 'exact', head: true })
		.eq('hot_dog_id', dogId)
		.eq('emoji', emoji);
	if (error) {
		throw new Error(`Could not count reactions for ${dogId}/${emoji}: ${error.message}`);
	}
	return count ?? 0;
}

/**
 * Clears the GLOBAL vote/crown field so the voter's single vote makes the seeded
 * owner the unambiguous Top Dog (mirrors votes.e2e.ts resetCrownField). The crown
 * is a global singleton ranked across EVERY eligible dog, so sibling specs / prior
 * runs can leave a sticky incumbent and stray counts behind; we zero them. Safe
 * under `workers: 1` (serialized) — this spec owns the global crown for its run.
 * Deleting votes does not auto-recompute counters, so we also zero
 * vote_count/peak_votes and clear is_current_top_dog/top_dog_since directly.
 */
async function resetCrownField(): Promise<void> {
	const service = serviceClient();
	const sentinel = '00000000-0000-0000-0000-000000000000';
	const { error: delErr } = await service.from('votes').delete().neq('id', sentinel);
	if (delErr) {
		throw new Error(`resetCrownField: could not clear votes: ${delErr.message}`);
	}
	const { error: dogErr } = await service
		.from('hot_dogs')
		.update({ vote_count: 0, peak_votes: 0 })
		.neq('id', sentinel);
	if (dogErr) {
		throw new Error(`resetCrownField: could not zero counters: ${dogErr.message}`);
	}
	const { error: crownErr } = await service
		.from('profiles')
		.update({ is_current_top_dog: false, top_dog_since: null })
		.neq('id', sentinel);
	if (crownErr) {
		throw new Error(`resetCrownField: could not clear crowns: ${crownErr.message}`);
	}
}

/**
 * Mints a fresh, unconsumed invite (and the inviter that owns it) via the service
 * client, returning the token. global-setup mints ONE token for the @smoke spec;
 * this spec's browser voter needs its OWN unconsumed invite, so we mint here.
 */
async function mintInvite(): Promise<string> {
	const service = serviceClient();
	const email = `feed-inviter-${Date.now().toString(36)}-${seq}@topdog.test`;
	const { data: created, error: createError } = await service.auth.admin.createUser({
		email,
		password: 'feed-inviter-password-123',
		email_confirm: true
	});
	if (createError || !created.user) {
		throw new Error(`Could not create inviter: ${createError?.message}`);
	}
	const token = generateInviteToken();
	const { error: insertError } = await service
		.from('invites')
		.insert({ inviter_id: created.user.id, token });
	if (insertError) {
		throw new Error(`Could not mint invite: ${insertError.message}`);
	}
	return token;
}

/**
 * Signs a fresh VOTER up through the real UI — the Snacktum Onboarding rite at
 * /sign-up (TASK-092): present token → inscribe name/email/secret → choose a sigil
 * (the Sigil Continue FORGES the profile) → renounce the patty (pure oath) →
 * Received → "Enter →" into the app on their new profile (no dog of their own).
 * Returns the handle (for later assertions if needed).
 */
async function signUpVoter(page: import('@playwright/test').Page): Promise<string> {
	const token = await mintInvite();
	const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
	const email = `feed-voter-${stamp}@topdog.test`;
	const password = 'feed-voter-password-123';
	const handle = `fv_${stamp}`.slice(0, 32);

	await page.goto(`/sign-up?token=${encodeURIComponent(token)}`);
	await expect(page.getByRole('heading', { name: 'You Have Been Summoned' })).toBeVisible();
	await page.getByRole('button', { name: 'Take a Bite →' }).click();

	await expect(page.getByRole('heading', { name: 'Inscribe Thy Name' })).toBeVisible();
	await page.locator('input[name="handle"]').fill(handle);
	await page.locator('input[name="email"]').fill(email);
	await page.locator('input[name="password"]').fill(password);
	await page.getByRole('button', { name: 'Continue →' }).click();

	// Sigil Continue FORGES the profile (createProfile fires here, not on the oath
	// screen). The Casing typed once at Inscribe rides hidden from client state.
	await expect(page.getByRole('heading', { name: 'Choose Thy Sigil' })).toBeVisible();
	await page.getByRole('button', { name: 'Continue →' }).click();

	// Renounce is PURE UI — no form/action/session check. The Continue is gated only
	// on the oath. Swear it, advance to Received, then click "Enter →" into the app.
	await expect(page.getByRole('heading', { name: 'Renounce the Patty' })).toBeVisible();
	await page.getByRole('button', { name: 'Press to Swear the Oath' }).click();
	await page.getByRole('button', { name: 'Continue →' }).click();

	await expect(page.getByRole('heading', { name: `Welcome, ${handle}` })).toBeVisible();
	await page.getByRole('link', { name: 'Enter →' }).click();
	await page.waitForURL(`**/snacktum-snacktorum/shrine/${handle}`);

	return handle;
}

// The feed/detail flows mutate the global singleton crown, so run them serially
// (also enforced project-wide by `workers: 1`). Reset the crown field before each
// so a freshly-cast single vote crowns the seeded owner deterministically.
test.describe.serial('@smoke feed + dog detail UI flows', () => {
	test.beforeEach(async () => {
		await resetCrownField();
	});

	test('@smoke feed: cast → move → remove a vote through the UI, with crown + count', async ({
		page
	}) => {
		// Seed one owner with TWO dogs to vote across. Fresh UUIDs — no pinned ids —
		// and unique captions so the per-card UI locators are unambiguous across reruns.
		const ownerId = await seedOwner(uniqueHandle('fo'));
		const captionA = uniqueCaption('Owner dog A');
		const captionB = uniqueCaption('Owner dog B');
		const dogA = await seedDog(ownerId, captionA);
		const dogB = await seedDog(ownerId, captionB);

		// The voter signs up fresh and lands authenticated; they own no dog.
		await signUpVoter(page);

		// (1) Feed lists the owner's dogs (the only votable ones). Locate dog A's
		// card by its caption and cast a vote there.
		await page.goto('/snacktum-snacktorum/procession');
		await expect(page.getByRole('heading', { name: 'The Procession' })).toBeVisible();

		const cardA = page.locator('article', { hasText: captionA });
		const cardB = page.locator('article', { hasText: captionB });
		await expect(cardA).toBeVisible();
		await expect(cardB).toBeVisible();

		// Both dogs start at 0 votes (post-reset). Cast on dog A.
		expect(await voteCount(dogA)).toBe(0);
		expect(await voteCount(dogB)).toBe(0);

		await cardA.getByRole('button', { name: 'Vote' }).click();

		// After the vote settles, dog A shows the Voted marker and the authoritative
		// count is 1; the owner is now the unambiguous global Top Dog.
		await expect(cardA.getByText('Voted ✓')).toBeVisible();
		expect(await voteCount(dogA)).toBe(1);
		expect(await voteCount(dogB)).toBe(0);

		const afterCast = await crownState(ownerId);
		expect(afterCast.isTopDog, 'the only-voted dog’s owner holds the crown').toBe(true);
		expect(afterCast.topDogSince, 'crowned owner gets a top_dog_since').toBeTruthy();

		// (2) MOVE the vote to dog B. With a vote already cast, dog B’s control reads
		// "Move vote here" (UNIQUE(voter_id): the same vote row is re-pointed).
		await cardB.getByRole('button', { name: 'Move vote here' }).click();
		await expect(cardB.getByText('Voted ✓')).toBeVisible();

		expect(await voteCount(dogA), 'old dog drops to 0 on move').toBe(0);
		expect(await voteCount(dogB), 'new dog rises to 1 on move').toBe(1);

		// Same owner still holds the crown (both dogs are theirs).
		expect((await crownState(ownerId)).isTopDog).toBe(true);

		// (3) REMOVE the vote via dog B's Remove control. Both counts return to 0.
		await cardB.getByRole('button', { name: 'Remove vote' }).click();
		await expect(cardB.getByRole('button', { name: 'Vote' })).toBeVisible();

		expect(await voteCount(dogA)).toBe(0);
		expect(await voteCount(dogB), 'removing the vote returns the dog to 0').toBe(0);
	});

	test('@smoke feed: react increments and un-react decrements the reaction count', async ({
		page
	}) => {
		const ownerId = await seedOwner(uniqueHandle('fr'));
		const caption = uniqueCaption('Reactable dog');
		const dog = await seedDog(ownerId, caption);

		await signUpVoter(page);

		await page.goto('/snacktum-snacktorum/procession');
		const card = page.locator('article', { hasText: caption });
		await expect(card).toBeVisible();

		// No 🌭 reactions yet.
		expect(await reactionCount(dog, '🌭')).toBe(0);

		// React with 🌭 from the picker (a fresh emoji shows only the glyph as label).
		await card.getByRole('button', { name: '🌭', exact: true }).click();

		// Wait for the UI to settle into the reacted state — the owned chip shows the
		// emoji + count 1 + ✓ — BEFORE reading the DB. The enhance handler's
		// update()/invalidateAll() completes asynchronously after the click, so the
		// rendered chip is the reliable "the react POST has settled" signal.
		const reactedChip = card.getByRole('button', { name: /🌭\s*1\s*✓/ });
		await expect(reactedChip).toBeVisible();
		// The authoritative DB row is written by the same async POST; even after the
		// chip renders, the service-role read can momentarily lag the commit (DW-024
		// flake). Poll the count so the assertion auto-retries until it settles to 1
		// instead of sampling once mid-flight.
		await expect.poll(() => reactionCount(dog, '🌭')).toBe(1);

		// Un-react: clicking the owned chip toggles it off. Wait for the chip to go
		// away (the picker 🌭 returns — a plain glyph button with no count) before
		// reading the DB, so we don't sample mid-flight.
		await reactedChip.click();
		await expect(card.getByRole('button', { name: '🌭', exact: true })).toBeVisible();
		await expect(reactedChip).toHaveCount(0);
		// Same lag on the delete path — poll until the row is gone (count back to 0).
		await expect.poll(() => reactionCount(dog, '🌭')).toBe(0);
	});

	test('@smoke dog detail: another member’s dog renders image + stats; bad id is 404', async ({
		page
	}) => {
		// Seed a dog with a known vote so peak/current stats are non-zero and
		// meaningful on the detail page.
		const ownerId = await seedOwner(uniqueHandle('fd'));
		const caption = uniqueCaption('Detail dog');
		const dog = await seedDog(ownerId, caption);

		await signUpVoter(page);

		// Give the dog one vote (via the feed) so the Stats block shows non-zero
		// current + peak votes when we open the detail page.
		await page.goto('/snacktum-snacktorum/procession');
		const card = page.locator('article', { hasText: caption });
		await expect(card).toBeVisible();
		await card.getByRole('button', { name: 'Vote' }).click();
		await expect(card.getByText('Voted ✓')).toBeVisible();
		expect(await voteCount(dog)).toBe(1);

		// (1) View ANOTHER member's dog detail (RLS SELECT for authenticated members).
		await page.goto(`/snacktum-snacktorum/litter/${dog}`);
		await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible();
		await expect(page.getByText(caption)).toBeVisible();

		// (2) The signed-URL image actually renders and decodes in the browser.
		// Scope to the detail page's own image container (.dog-image, the
		// litter/[id]/+page.svelte wrapper around the signed-URL <img>) — NOT a bare
		// page.locator('img'). The rebuilt persistent shell (App Chrome) renders
		// <img> elements that precede the page content in the DOM — always the brand
		// wordmark (img.shell-brand-mark in the shell +layout.svelte), and possibly
		// the champion sub-bar avatar — so img.first() would now resolve to the shell
		// brand mark (no signed token=), not the dog image. .dog-image lives inside
		// .shell-content, so this targets only the actual dog detail image.
		const detailImage = page.locator('.dog-image img');
		await expect(detailImage).toBeVisible({ timeout: 15000 });
		const src = await detailImage.getAttribute('src');
		expect(src, 'detail image should have a src').toBeTruthy();
		expect(src).toContain('/storage/v1/');
		expect(src).toContain('token=');
		const naturalWidth = await detailImage.evaluate(
			(img) => (img as HTMLImageElement).naturalWidth
		);
		expect(naturalWidth, 'signed-URL detail image should actually load').toBeGreaterThan(0);

		// (3) The Stats block shows the current + peak votes (both 1 after one vote).
		await expect(page.getByText('Current votes: 1')).toBeVisible();
		await expect(page.getByText('Peak votes: 1')).toBeVisible();

		// (4) A non-existent dog id returns 404 (not 500) and renders the designed
		// "Lost Pilgrim" 404 page. The root +error.svelte deliberately suppresses
		// page.error.message (L2 no-internal-detail-leak), so the raw server message
		// ('No such hot dog.') must NOT appear — only the friendly themed copy does.
		const missing = await page.goto(`/snacktum-snacktorum/litter/${crypto.randomUUID()}`);
		expect(missing?.status(), 'a non-existent dog id 404s').toBe(404);
		await expect(page.getByText('Thou Hast Strayed')).toBeVisible();
		await expect(page.getByText('No such hot dog.')).toHaveCount(0);

		// (5) A MALFORMED (non-uuid) dog id also returns 404 — no 500 / SDK leak.
		const malformed = await page.goto('/snacktum-snacktorum/litter/not-a-real-uuid');
		expect(malformed?.status(), 'a malformed dog id 404s').toBe(404);
	});
});
