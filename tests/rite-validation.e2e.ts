import { expect, test, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getLocalStackCreds } from './helpers/local-stack';
import { generateInviteToken } from '../src/lib/features/invites/token';
import { SMOKE_INVITER_EMAIL } from './helpers/bootstrap-fixtures';

// FIX-RITE-VALIDATION @security regression guard for the Snacktum Onboarding RITE
// at /sign-up. The unit tests (src/routes/sign-up/signup-action.test.ts) prove the
// `register` action's ORDERING against mocks — a bad handle is rejected before the
// invite gate / signUp / redemption. That is necessary but not sufficient: the
// ACTUAL bug was that a typo in a handle BURNED a single-use invite, and only an
// end-to-end run against the LIVE local Supabase stack proves the invite genuinely
// survives (a mock can't consume a real single-use row).
//
// Tagged @security (NOT @smoke): every scenario asserts a LIVE-DB write guard —
// the invite row stays unconsumed and no auth account is forged by a rejected
// registration. That is the same "live-DB write guards" bucket as db-guards /
// votes / grants (`pnpm test:e2e --grep @security`). The token-guard scenario is a
// client-side entry gate, but it is the front door of the same "don't advance /
// don't burn the invite" contract, so it lives with the other rite-entry guards.
//
// Local-stack only: creds resolve via `getLocalStackCreds()` (the non-localhost
// guardrail) — a run can never touch hosted. The service-role key stays Node-side
// (this file + the service client below); it is NEVER handed to the browser
// context. No pinned fixture ids (DW-014): every email/handle carries a per-run
// stamp, so the spec is rerunnable without a `supabase db reset`.

const creds = getLocalStackCreds();

function serviceClient(): SupabaseClient {
	// Service-role client: bypasses RLS, used ONLY on the Node side to mint invites,
	// seed a colliding profile, and read back the DB-authoritative facts. Never
	// exposed to page/browser code — the secret key does not cross into the app.
	return createClient(creds.apiUrl, creds.secretKey, {
		auth: { autoRefreshToken: false, persistSession: false }
	});
}

/** Per-run unique suffix so reruns never collide on email/handle (DW-014). */
function stamp(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function uniqueEmail(prefix: string): string {
	return `${prefix}-${stamp()}@topdog.test`;
}

/**
 * Scans the auth users for an email (paginated). GoTrue's admin API has no
 * email filter, so we page through — after the `supabase db reset` the director
 * runs before the suite, the table is small, so one page suffices; we loop
 * defensively regardless.
 */
async function findAuthUserByEmail(
	service: SupabaseClient,
	email: string
): Promise<{ id: string; email?: string } | null> {
	const target = email.toLowerCase();
	for (let page = 1; page <= 20; page++) {
		const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
		if (error) throw new Error(`listUsers failed: ${error.message}`);
		const found = data.users.find((u) => u.email?.toLowerCase() === target);
		if (found) return { id: found.id, email: found.email };
		if (data.users.length < 1000) break;
	}
	return null;
}

/**
 * Mints a fresh, unconsumed invite owned by the seeded smoke inviter. Reuses the
 * global-setup bootstrap pattern (service-client insert of `{ inviter_id, token }`
 * with `generateInviteToken`) and the already-seeded inviter identity — globalSetup
 * guarantees `SMOKE_INVITER_EMAIL` exists before any spec runs. Each call mints a
 * NEW token, so tests never collide on the single-use guard.
 */
async function mintInvite(service: SupabaseClient): Promise<string> {
	const inviter = await findAuthUserByEmail(service, SMOKE_INVITER_EMAIL);
	if (!inviter) {
		throw new Error(
			`Rite-validation setup: smoke inviter ${SMOKE_INVITER_EMAIL} not found — did globalSetup run?`
		);
	}
	const token = generateInviteToken();
	const { error } = await service.from('invites').insert({ inviter_id: inviter.id, token });
	if (error) throw new Error(`mintInvite failed: ${error.message}`);
	return token;
}

/** Reads the single-use markers on an invite row (the load-bearing invariant). */
async function getInviteRow(
	service: SupabaseClient,
	token: string
): Promise<{ consumed_at: string | null; consumed_by: string | null }> {
	const { data, error } = await service
		.from('invites')
		.select('consumed_at, consumed_by')
		.eq('token', token)
		.single();
	if (error) throw new Error(`getInviteRow failed: ${error.message}`);
	return data as { consumed_at: string | null; consumed_by: string | null };
}

/**
 * Seeds a real profile with a known handle (its own fresh auth user), so a later
 * registration can collide on it case-insensitively (citext). Service client
 * bypasses RLS + the decision #24/#25 column grants — the point here is to plant a
 * row, not to test the write path.
 */
async function seedProfile(service: SupabaseClient, handle: string): Promise<void> {
	const email = uniqueEmail('rite-seed');
	const { data: created, error } = await service.auth.admin.createUser({
		email,
		password: 'rite-seed-password-123',
		email_confirm: true
	});
	if (error || !created.user) {
		throw new Error(`seedProfile createUser failed: ${error?.message}`);
	}
	const { error: insertError } = await service.from('profiles').insert({
		id: created.user.id,
		handle,
		display_name: handle,
		avatar_path: 'sigil:tube'
	});
	if (insertError) throw new Error(`seedProfile insert failed: ${insertError.message}`);
}

/**
 * Raw same-origin POST to the `register` form action, BYPASSING the page's Svelte
 * `use:enhance` client validation entirely — exactly what a scripted client (or a
 * JS-disabled resubmit) sends. The browser adds the `Origin` header automatically,
 * satisfying SvelteKit's CSRF check. Requires the page to already be on the app
 * origin (call after a goto).
 *
 * Why the raw POST is necessary at all: the Inscribe form's client-side `pattern`
 * + `use:enhance` themed validation `cancel()`s a charset-invalid handle submit in
 * the browser, so it never reaches the server. A pure UI walk therefore cannot
 * exercise the `register` action's boundary `validateHandle` guard — it would pass
 * even if that guard were reverted, because the browser stops the bad handle first.
 * This helper is the only path that puts the server guard under test.
 *
 * ‼️ Non-obvious SvelteKit behavior (the reason this spec first failed): a `fetch`
 * POST to a form action does NOT return a page render and does NOT reflect the
 * action's `fail(400, …)` in the HTTP status. It returns an action-result ENVELOPE
 * as `content-type: application/json` with HTTP **200**, and the `fail()` status is
 * carried INSIDE the envelope: `{ "type": "failure", "status": 400, "data": "…" }`.
 * `data` is a devalue-encoded string that embeds the `fail()` payload's fields —
 * including the rejection `error` reason. So the HTTP status is 200 for BOTH a
 * rejection and a success; the real discriminator lives in the parsed body. We
 * return both so the caller asserts on `body.type` / `body.status` / `body.data`,
 * never on the (always-200) HTTP status.
 */
async function postRegisterDirect(
	page: Page,
	fields: Record<string, string>
): Promise<{ status: number; body: { type?: string; status?: number; data?: string } }> {
	return page.evaluate(async (f) => {
		const res = await fetch('/sign-up?/register', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(f).toString(),
			redirect: 'manual'
		});
		const body = (await res.json()) as { type?: string; status?: number; data?: string };
		return { status: res.status, body };
	}, fields);
}

/** Walks the full happy-path rite with a valid handle, ending on the Shrine. */
async function completeRite(
	page: Page,
	token: string,
	handle: string,
	email: string,
	password: string
): Promise<void> {
	await page.goto(`/sign-up?token=${encodeURIComponent(token)}`);
	await page.getByRole('button', { name: 'Take a Bite →' }).click();
	await expect(page.getByRole('heading', { name: 'Inscribe Thy Name' })).toBeVisible();

	await page.locator('input[name="handle"]').fill(handle);
	await page.locator('input[name="email"]').fill(email);
	await page.locator('input[name="password"]').fill(password);
	await page.getByRole('button', { name: 'Continue →' }).click();

	await expect(page.getByRole('heading', { name: 'Choose Thy Sigil' })).toBeVisible();
	await page.getByRole('radio', { name: 'The Tube Sigil' }).click();
	await page.getByRole('button', { name: 'Continue →' }).click();

	await expect(page.getByRole('heading', { name: 'Renounce the Patty' })).toBeVisible();
	await page.getByRole('button', { name: 'Press to Swear the Oath' }).click();
	await page.getByRole('button', { name: 'Continue →' }).click();

	await expect(page.getByRole('heading', { name: `Welcome, ${handle}` })).toBeVisible();
	await page.getByRole('link', { name: 'Enter →' }).click();
	await page.waitForURL(`**/snacktum-snacktorum/shrine/${handle}`);
}

test.describe('@security rite-entry validation guards (live local stack)', () => {
	test('a charset-invalid handle at Inscribe is rejected without burning the single-use invite', async ({
		page
	}) => {
		const service = serviceClient();
		const token = await mintInvite(service);
		const rejectedEmail = uniqueEmail('rite-bad-handle');
		// A space is length-legal (18 chars, within 2..32) but charset-illegal — the
		// exact typo class that used to burn the invite.
		const badHandle = 'Frank The Faithful';
		const password = 'rite-valid-password-123';

		// (1) CLIENT defense-in-depth: the Inscribe form's `pattern` + themed
		// validation cancels the submit before it ever leaves the browser. The rite
		// must NOT advance to Sigil, and the themed inline error must show.
		await page.goto(`/sign-up?token=${encodeURIComponent(token)}`);
		await page.getByRole('button', { name: 'Take a Bite →' }).click();
		await expect(page.getByRole('heading', { name: 'Inscribe Thy Name' })).toBeVisible();

		const handleInput = page.locator('input[name="handle"]');
		await handleInput.fill(badHandle);
		await page.locator('input[name="email"]').fill(rejectedEmail);
		await page.locator('input[name="password"]').fill(password);
		await page.getByRole('button', { name: 'Continue →' }).click();

		await expect(page.getByRole('heading', { name: 'Choose Thy Sigil' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Inscribe Thy Name' })).toBeVisible();
		await expect(handleInput).toHaveAttribute('aria-invalid', 'true');
		const clientError = page.locator('#handle-error');
		await expect(clientError).toBeVisible();
		await expect(clientError).toHaveAttribute('role', 'alert');
		await expect(clientError).toHaveClass(/field-error/);

		// (2) SERVER guard — THE invite-burn regression assertion. Bypass the client
		// enhance with a raw same-origin POST straight to the register action. If the
		// boundary handle-validation added by FIX-RITE-VALIDATION were reverted, this
		// POST would sail past token/email/password checks, PASS the invite gate,
		// signUp (creating an auth user), and redeem_invite (BURNING the token)
		// before createProfile later rejected the handle — so `register` would return
		// `{ registered: true }` (envelope type "success"), not a `fail(400)`.
		//
		// A `fetch` POST to a form action always returns HTTP 200 with a JSON envelope
		// (see postRegisterDirect) — the `fail()` status lives INSIDE it, so we assert
		// on the parsed body, not the HTTP status. We check `type`/`status` for the
		// rejection AND that the devalue-encoded `data` carries the handle-charset
		// reason — the latter is the true discriminator: a reverted guard yields a
		// success envelope with no such reason (and would fail these), whereas a bare
		// HTTP-status assertion could not tell a working fix from a broken one (both 200).
		const { body } = await postRegisterDirect(page, {
			token,
			handle: badHandle,
			email: rejectedEmail,
			password
		});
		expect(body.type, 'register must REJECT the bad handle (failure envelope)').toBe('failure');
		expect(body.status, 'the rejection must carry fail(400)').toBe(400);
		expect(
			body.data,
			'the rejection reason must be the handle-charset guard, not some incidental failure'
		).toContain('letters, numbers, and underscores');

		// (3) LOAD-BEARING live-DB assertions — what no mock can prove. The single-use
		// invite is still pristine, and NO auth account was forged for the rejected
		// email. Reverting the fix fails BOTH: consumed_at/consumed_by become non-null
		// and an orphan user appears.
		const inviteRow = await getInviteRow(service, token);
		expect(inviteRow.consumed_at, 'invite must NOT be consumed by a bad-handle attempt').toBeNull();
		expect(inviteRow.consumed_by, 'invite consumer must remain null').toBeNull();
		expect(
			await findAuthUserByEmail(service, rejectedEmail),
			'a rejected registration must not create an auth account'
		).toBeNull();

		// (4) The invite genuinely SURVIVED: the SAME token still redeems with a valid
		// handle, and only then does the row flip to consumed.
		const goodHandle = `frank_${stamp()}`.slice(0, 32);
		const goodEmail = uniqueEmail('rite-good-handle');
		await completeRite(page, token, goodHandle, goodEmail, password);

		const consumedRow = await getInviteRow(service, token);
		expect(
			consumedRow.consumed_at,
			'the surviving invite must redeem for a valid handle'
		).not.toBeNull();
		expect(consumedRow.consumed_by, 'the redeemed invite records its consumer').not.toBeNull();
	});

	test('the Summoned token guard blocks a missing / malformed token with a themed inline error', async ({
		page
	}) => {
		// Missing token: land on /sign-up with no ?token=, then try to advance.
		await page.goto('/sign-up');
		await expect(page.getByRole('heading', { name: 'You Have Been Summoned' })).toBeVisible();
		await page.getByRole('button', { name: 'Take a Bite →' }).click();

		// Stays on Summoned; never advances to Inscribe.
		await expect(page.getByRole('heading', { name: 'Inscribe Thy Name' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'You Have Been Summoned' })).toBeVisible();

		// The themed inline error is shown (NOT the native validation bubble). Its very
		// presence proves our JS guard ran: the token field is not wrapped in a <form>
		// and its advance control is a plain type="button", so no native
		// constraint-validation bubble path exists to fall back on.
		const tokenError = page.locator('#token-error');
		await expect(tokenError).toBeVisible();
		await expect(tokenError).toHaveAttribute('role', 'alert');
		await expect(tokenError).toHaveClass(/field-error/);
		await expect(page.locator('input[name="token"]')).toHaveAttribute('aria-invalid', 'true');
		await expect(page.getByRole('button', { name: 'Take a Bite →' })).toHaveAttribute(
			'type',
			'button'
		);

		// Malformed token (contains a space -> patternMismatch, not merely empty).
		await page.goto(`/sign-up?token=${encodeURIComponent('bad token')}`);
		await page.getByRole('button', { name: 'Take a Bite →' }).click();
		await expect(page.getByRole('heading', { name: 'Inscribe Thy Name' })).toHaveCount(0);
		const malformedError = page.locator('#token-error');
		await expect(malformedError).toBeVisible();
		await expect(malformedError).toHaveAttribute('role', 'alert');
	});

	test('an already-taken handle (case-insensitive) is caught at Inscribe before any account or invite consumption', async ({
		page
	}) => {
		const service = serviceClient();
		const suffix = stamp();
		// citext is case-insensitive: `Chef…` and `chef…` collide. Seed the canonical
		// casing; attempt the case-variant.
		const seededHandle = `Chef${suffix}`.slice(0, 32);
		const collidingHandle = `chef${suffix}`.slice(0, 32);
		await seedProfile(service, seededHandle);

		const token = await mintInvite(service);
		const email = uniqueEmail('rite-taken-handle');
		const password = 'rite-valid-password-123';

		await page.goto(`/sign-up?token=${encodeURIComponent(token)}`);
		await page.getByRole('button', { name: 'Take a Bite →' }).click();
		await expect(page.getByRole('heading', { name: 'Inscribe Thy Name' })).toBeVisible();

		// A charset-VALID handle: the client `pattern` passes it, so the submit
		// genuinely reaches the register action and its service-client uniqueness
		// probe — the case a client-only guard cannot catch.
		await page.locator('input[name="handle"]').fill(collidingHandle);
		await page.locator('input[name="email"]').fill(email);
		await page.locator('input[name="password"]').fill(password);
		await page.getByRole('button', { name: 'Continue →' }).click();

		// Rejected at Inscribe (server), never advancing to Sigil.
		await expect(page.getByText(/already worn/i)).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Choose Thy Sigil' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Inscribe Thy Name' })).toBeVisible();

		// LOAD-BEARING: the uniqueness gate sits BEFORE signUp, so no account exists
		// for this email and the invite is untouched.
		const inviteRow = await getInviteRow(service, token);
		expect(
			inviteRow.consumed_at,
			'a taken-handle rejection must not consume the invite'
		).toBeNull();
		expect(inviteRow.consumed_by).toBeNull();
		expect(
			await findAuthUserByEmail(service, email),
			'no account may be created before the uniqueness gate passes'
		).toBeNull();
	});
});
