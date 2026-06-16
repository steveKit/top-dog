import { expect, test } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getLocalStackCreds } from './helpers/local-stack';

// TASK-042 live-DB coverage for the daily mustard prune: the SECURITY DEFINER
// prune_mustard_sprays() RPC that DELETEs mustard_sprays rows older than 24h and
// returns the pruned count. There is NO TS wrapper (the keep-alive workflow is
// the sole consumer — same shape as tally_top_dog_day), so the authoritative
// logic is SQL and these tests go DIRECTLY to PostgREST against the LOCAL
// Postgres — the same live-DB pattern as tally.e2e.ts / votes.e2e.ts.
//
// What is being proven (decision #15 prune + decision #26 anon-callable):
//   1. Deletes >24h sprays, keeps <24h sprays — the count includes the expired
//      one, the expired row is GONE, the fresh row REMAINS unchanged.
//   2. Anon CAN call the RPC (the keep-alive workflow's caller) — succeeds.
//   3. Idempotent — a second immediate call returns 0 and leaves the fresh row.
//   4. No-input / not forgeable — the RPC takes no arguments, so it only ever
//      removes the provably-expired rows, never the fresh one.
//
// Seeding sets an EXPLICIT old sprayed_at via the service-role client, which
// bypasses RLS and column defaults — this is fixture seeding, not the write
// path under test (the spray INSERT path is covered by the mustard feature
// tests). The service key stays Node/server side; it is never handed to a
// browser context.
//
// Tagged @security (NOT @smoke) so `--grep @smoke` does not select these. Runs
// serially (describe.serial + per-test cleanup), consistent with the
// `workers: 1` config and the other @security specs, against the LOCAL stack
// via the non-localhost-guarded helper; no app server.

const creds = getLocalStackCreds();

/** Service-role client: bypasses RLS + column defaults for setup + reads. */
function serviceClient(): SupabaseClient {
	return createClient(creds.apiUrl, creds.secretKey, {
		auth: { autoRefreshToken: false, persistSession: false }
	});
}

/** Anon (unauthenticated) client: publishable key, no JWT — the keep-alive's caller. */
function anonClient(): SupabaseClient {
	return createClient(creds.apiUrl, creds.publishableKey, {
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

/**
 * Creates a throwaway auth user + matching profile row via the service client
 * and returns its id. We only need the profile to satisfy the mustard_sprays
 * sprayer_id / target_profile_id FKs — these tests never exercise the spray
 * INSERT path, so no JWT/sign-in is required.
 */
async function makeProfile(handle: string): Promise<string> {
	const service = serviceClient();
	const email = `prune-${handle}-${Date.now().toString(36)}@topdog.test`;
	const password = 'prune-test-password-123';

	const { data: created, error: createError } = await service.auth.admin.createUser({
		email,
		password,
		email_confirm: true
	});
	if (createError || !created.user) {
		throw new Error(`Could not create test user ${handle}: ${createError?.message}`);
	}
	const id = created.user.id;

	const { error: profileError } = await service.from('profiles').insert({
		id,
		handle,
		display_name: handle
	});
	if (profileError) {
		throw new Error(`Could not create profile for ${handle}: ${profileError.message}`);
	}

	return id;
}

/** Deletes an auth user (cascades to profile + its sprays) — fixture teardown. */
async function deleteProfile(id: string): Promise<void> {
	const service = serviceClient();
	const { error } = await service.auth.admin.deleteUser(id);
	if (error) {
		throw new Error(`Could not delete test user ${id}: ${error.message}`);
	}
}

/**
 * Inserts a mustard_sprays row with an EXPLICIT sprayed_at via the service
 * client (bypasses RLS + the now() default), and returns its id. `ageMs` is
 * subtracted from now to place the spray at a chosen age. Returns the row id so
 * existence can be read back authoritatively.
 */
async function seedSpray(sprayerId: string, targetId: string, ageMs: number): Promise<string> {
	const service = serviceClient();
	const sprayedAt = new Date(Date.now() - ageMs).toISOString();
	const { data, error } = await service
		.from('mustard_sprays')
		.insert({
			sprayer_id: sprayerId,
			target_profile_id: targetId,
			x: 0.5,
			y: 0.5,
			sprayed_at: sprayedAt
		})
		.select('id')
		.single();
	if (error || !data) {
		throw new Error(`Could not seed mustard spray: ${error?.message}`);
	}
	return data.id as string;
}

/** True if a mustard_sprays row with `id` still exists (service-client read). */
async function sprayExists(id: string): Promise<boolean> {
	const service = serviceClient();
	const { data, error } = await service.from('mustard_sprays').select('id').eq('id', id);
	if (error) {
		throw new Error(`Could not read mustard_sprays ${id}: ${error.message}`);
	}
	return (data ?? []).length === 1;
}

/** Reads a spray's stored sprayed_at (service client) — to prove a fresh row is untouched. */
async function spraySprayedAt(id: string): Promise<string> {
	const service = serviceClient();
	const { data, error } = await service
		.from('mustard_sprays')
		.select('sprayed_at')
		.eq('id', id)
		.single();
	if (error || !data) {
		throw new Error(`Could not read sprayed_at for ${id}: ${error?.message}`);
	}
	return data.sprayed_at as string;
}

const HOUR_MS = 60 * 60 * 1000;

test.describe.serial('@security prune_mustard_sprays RPC (direct PostgREST)', () => {
	let sprayer: string;
	let target: string;

	// One pair of throwaway profiles for the suite; each test seeds + asserts its
	// own sprays and cleans them up so cases stay independent under serial run.
	test.beforeAll(async () => {
		sprayer = await makeProfile(uniqueHandle('prsp'));
		target = await makeProfile(uniqueHandle('prtg'));
	});

	// Deleting the profiles cascades to any remaining sprays — full teardown.
	test.afterAll(async () => {
		if (target) await deleteProfile(target);
		if (sprayer) await deleteProfile(sprayer);
	});

	test('deletes >24h sprays, keeps <24h sprays — count includes the expired one only', async () => {
		// Seed one expired spray (48h old, render-time opacity clamped to 0) and one
		// fresh spray (now). The prune must delete exactly the expired one: the count
		// reflects it, the expired row is GONE, and the fresh row REMAINS unchanged.
		const expired = await seedSpray(sprayer, target, 48 * HOUR_MS);
		const fresh = await seedSpray(sprayer, target, 0);
		const freshSprayedAt = await spraySprayedAt(fresh);

		const { data: pruned, error } = await anonClient().rpc('prune_mustard_sprays');
		expect(error, 'the prune RPC should succeed').toBeNull();
		expect(pruned, 'the pruned count includes the one expired (>24h) spray').toBeGreaterThanOrEqual(
			1
		);

		expect(await sprayExists(expired), 'the >24h spray is deleted').toBe(false);
		expect(await sprayExists(fresh), 'the <24h spray remains').toBe(true);
		expect(await spraySprayedAt(fresh), 'the fresh spray is untouched (timestamp unchanged)').toBe(
			freshSprayedAt
		);

		// Cleanup the surviving fresh row for the next test's clean slate.
		await serviceClient().from('mustard_sprays').delete().eq('id', fresh);
	});

	test('anon-callable (decision #26) — the keep-alive workflow caller succeeds', async () => {
		// EXECUTE is granted to anon: the keep-alive workflow calls this RPC with the
		// publishable (anon) key — not the service role. An anon call must NOT raise a
		// permission error (no 42501). This is what proves the workflow step will work.
		const { data, error } = await anonClient().rpc('prune_mustard_sprays');

		expect(error, 'anon must be able to call the RPC (no 42501)').toBeNull();
		expect(typeof data, 'the RPC returns the integer pruned count').toBe('number');
		expect(data, 'with nothing expired, an anon call prunes 0 (self-limiting no-op)').toBe(0);
	});

	test('idempotent — a second immediate call prunes 0 and leaves the fresh row intact', async () => {
		// Seed one expired + one fresh spray. The first call prunes the expired one; a
		// SECOND immediate call must prune 0 more (idempotent) and leave the fresh row.
		const expired = await seedSpray(sprayer, target, 25 * HOUR_MS);
		const fresh = await seedSpray(sprayer, target, 0);
		const freshSprayedAt = await spraySprayedAt(fresh);

		const first = await anonClient().rpc('prune_mustard_sprays');
		expect(first.error, 'first prune should succeed').toBeNull();
		expect(first.data, 'the first call prunes the one expired spray').toBeGreaterThanOrEqual(1);
		expect(await sprayExists(expired), 'the expired spray is gone after the first prune').toBe(
			false
		);

		const second = await anonClient().rpc('prune_mustard_sprays');
		expect(second.error, 'a second immediate prune should succeed').toBeNull();
		expect(second.data, 'the second call prunes 0 (nothing left expired)').toBe(0);

		expect(await sprayExists(fresh), 'the fresh spray survives both calls').toBe(true);
		expect(await spraySprayedAt(fresh), 'the fresh spray is untouched').toBe(freshSprayedAt);

		await serviceClient().from('mustard_sprays').delete().eq('id', fresh);
	});

	test('no-input / not forgeable — removes ONLY provably-expired rows, never the fresh one', async () => {
		// The RPC takes no arguments (pronargs = 0): a caller cannot direct it at a
		// specific or a fresh spray. Seed a fresh spray ONLY (nothing expired); the
		// prune must remove nothing and the fresh spray must survive — there is no
		// way to make it target a fresh row.
		const fresh = await seedSpray(sprayer, target, 0);
		const freshSprayedAt = await spraySprayedAt(fresh);

		// Passing an argument must NOT let a caller redirect the prune: the RPC has no
		// parameter, so PostgREST cannot resolve a 1-arg overload — it errors rather
		// than deleting a caller-named row.
		const forgeAttempt = await anonClient().rpc('prune_mustard_sprays', { id: fresh });
		expect(
			forgeAttempt.error,
			'the RPC takes no input — a caller-supplied argument cannot redirect it'
		).not.toBeNull();
		expect(await sprayExists(fresh), 'a forged-argument call deletes nothing').toBe(true);

		// And the legitimate no-arg call leaves the fresh row alone.
		const { data, error } = await anonClient().rpc('prune_mustard_sprays');
		expect(error, 'the no-arg prune should succeed').toBeNull();
		expect(data, 'with nothing expired, the prune removes 0 rows').toBe(0);
		expect(await sprayExists(fresh), 'the fresh spray is never pruned').toBe(true);
		expect(await spraySprayedAt(fresh), 'the fresh spray is untouched').toBe(freshSprayedAt);

		await serviceClient().from('mustard_sprays').delete().eq('id', fresh);
	});
});
