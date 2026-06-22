import { expect, test } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getLocalStackCreds } from './helpers/local-stack';

// M8 TASK-094 — mustard_sprays RETENTION (decision #29). The daily prune job
// (TASK-042, prune_mustard_sprays()) is RETIRED: the "Anoint → wall notice" now
// PERSISTS and is render-derived from the mustard_sprays rows, so those rows must
// survive — there is no longer ANY delete path. The overlay splat still decays to
// invisible at render time (mustardOpacity, now over 6h), but the rows themselves
// are append-only / immutable.
//
// This spec replaces the old "prune deletes >24h sprays" coverage with the
// retention guarantee:
//   1. The prune_mustard_sprays() RPC NO LONGER EXISTS — a call (anon OR service)
//      errors (the function was dropped), so nothing can reap sprays via PostgREST.
//   2. Old, fully-faded (>6h, even >24h) sprays are NOT deleted — they persist in
//      the table (the source rows the persisting wall notice is derived from).
//
// We go DIRECTLY to PostgREST against the LOCAL Postgres — the same live-DB pattern
// as tally.e2e.ts / votes.e2e.ts. Seeding uses the service-role client (bypasses
// RLS + column defaults) to place a spray at an explicit age — fixture seeding, not
// the write path under test. The service key stays Node/server side; it is never
// handed to a browser context.
//
// Tagged @security (NOT @smoke). Runs serially against the LOCAL stack via the
// non-localhost-guarded helper; no app server.

const creds = getLocalStackCreds();

/** Service-role client: bypasses RLS + column defaults for setup + reads. */
function serviceClient(): SupabaseClient {
	return createClient(creds.apiUrl, creds.secretKey, {
		auth: { autoRefreshToken: false, persistSession: false }
	});
}

/** Anon (unauthenticated) client: publishable key, no JWT — the keep-alive's old caller. */
function anonClient(): SupabaseClient {
	return createClient(creds.apiUrl, creds.publishableKey, {
		auth: { autoRefreshToken: false, persistSession: false }
	});
}

let seq = 0;
function uniqueHandle(prefix: string): string {
	seq += 1;
	return `${prefix}${Date.now().toString(36).slice(-4)}${seq}`.slice(0, 32);
}

/**
 * Creates a throwaway auth user + matching profile row via the service client and
 * returns its id — only to satisfy the mustard_sprays sprayer/target FKs. These
 * tests never exercise the spray INSERT path, so no JWT/sign-in is required.
 */
async function makeProfile(handle: string): Promise<string> {
	const service = serviceClient();
	const email = `retain-${handle}-${Date.now().toString(36)}@topdog.test`;
	const password = 'retain-test-password-123';

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
 * Inserts a mustard_sprays row with an EXPLICIT sprayed_at via the service client
 * (bypasses RLS + the now() default) and returns its id. `ageMs` is subtracted from
 * now to place the spray at a chosen age.
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

const HOUR_MS = 60 * 60 * 1000;

test.describe
	.serial('@security mustard_sprays retention — prune job retired (decision #29)', () => {
	let sprayer: string;
	let target: string;

	test.beforeAll(async () => {
		sprayer = await makeProfile(uniqueHandle('rtsp'));
		target = await makeProfile(uniqueHandle('rttg'));
	});

	// Deleting the profiles cascades to any remaining sprays — full teardown.
	test.afterAll(async () => {
		if (target) await deleteProfile(target);
		if (sprayer) await deleteProfile(sprayer);
	});

	test('the prune_mustard_sprays() RPC no longer exists (dropped) — anon cannot call it', async () => {
		// The function was dropped in 20260622120000_retire_mustard_prune.sql, so
		// PostgREST cannot resolve it: an anon (keep-alive caller) call must error
		// rather than reaping rows. (PGRST202 / 404 — the RPC is gone.)
		const { error } = await anonClient().rpc('prune_mustard_sprays');
		expect(error, 'a dropped RPC must not resolve — the call errors').not.toBeNull();
	});

	test('the prune_mustard_sprays() RPC no longer exists — even the service role cannot call it', async () => {
		// Not a permission issue: the function is GONE, so even the privileged
		// service role cannot invoke it. This proves there is no delete path at all.
		const { error } = await serviceClient().rpc('prune_mustard_sprays');
		expect(error, 'the dropped RPC is unresolvable for any role').not.toBeNull();
	});

	test('old, fully-faded sprays are NOT deleted — they persist as the notice source', async () => {
		// Seed a very old spray (48h — well past the 6h overlay lifespan, and past the
		// old 24h prune threshold). With the prune job retired there is no delete path,
		// so the row must still be present (the persisting wall notice derives from it).
		const old = await seedSpray(sprayer, target, 48 * HOUR_MS);

		// The former caller can no longer reap it: the RPC is gone.
		const { error } = await anonClient().rpc('prune_mustard_sprays');
		expect(error, 'no prune RPC remains to delete the row').not.toBeNull();

		expect(await sprayExists(old), 'the >48h spray persists — sprays are append-only now').toBe(
			true
		);

		// Cleanup this fixture row (test hygiene, not a product delete path).
		await serviceClient().from('mustard_sprays').delete().eq('id', old);
	});
});
