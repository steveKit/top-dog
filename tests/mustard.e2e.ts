import { expect, test } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getLocalStackCreds } from './helpers/local-stack';

// TASK-041 live-DB coverage for cosmetic mustard sprays (decision #15: flair only,
// gated to the current Top Dog). We go DIRECTLY to PostgREST as authenticated
// members (publishable key + a signed-in user's JWT) against the LOCAL Postgres —
// the same live-DB pattern as reactions.e2e.ts / votes.e2e.ts.
//
// These tests prove the DB-authoritative RLS guarantees the mocked unit tests
// cannot reach:
//   1. INSERT is gated to the CURRENT Top Dog: a non-Top-Dog member's direct
//      PostgREST insert is rejected (42501). The current Top Dog CAN insert.
//   2. sprayer_id is pinned to auth.uid(): a forged sprayer_id (!= caller) is
//      rejected even when the caller IS the Top Dog.
//   3. The x/y CHECK ([0,1]) is the DB backstop: an out-of-range insert is
//      rejected (23514).
//   4. Sprays PERSIST across crown changes (AC) — a spray landed while Top Dog
//      remains, unchanged, after the crown moves to another member.
//
// The Top Dog crown is a GLOBAL singleton (exactly one profile across the whole
// DB). The crown is server-maintained / non-client-writable (decision #25), so we
// set it AUTHORITATIVELY with the SERVICE client (bypasses RLS + column grants) —
// the same discipline votes.e2e.ts uses in resetCrownField. To avoid cross-file /
// cross-test races on that singleton, this suite is describe.serial and clears the
// global crown before each test, consistent with the workers:1 config and the
// other @security crown-mutating specs.
//
// The service client is used ONLY for setup (users + profiles), authoritative
// crown writes/reads, and authoritative spray read-backs — never for the INSERT
// under test, which runs as the authenticated member. The service key stays
// Node/server-side; never handed to a browser context.
//
// Tagged @security (NOT @smoke). Pure PostgREST, LOCAL stack, no app server.

const creds = getLocalStackCreds();

/** Service-role client: bypasses RLS for setup, crown writes, authoritative reads. */
function serviceClient(): SupabaseClient {
	return createClient(creds.apiUrl, creds.secretKey, {
		auth: { autoRefreshToken: false, persistSession: false }
	});
}

interface TestUser {
	id: string;
	client: SupabaseClient;
}

let seq = 0;
function uniqueHandle(prefix: string): string {
	seq += 1;
	return `${prefix}${Date.now().toString(36).slice(-4)}${seq}`.slice(0, 32);
}

/**
 * Creates an auth user + matching profile row, signs them in with the publishable
 * key, and returns an authenticated-role client holding their JWT (exactly what a
 * browser carries).
 */
async function makeUser(handle: string): Promise<TestUser> {
	const service = serviceClient();
	const email = `mustard-${handle}-${Date.now().toString(36)}@topdog.test`;
	const password = 'mustard-test-password-123';

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

	const anon = createClient(creds.apiUrl, creds.publishableKey, {
		auth: { autoRefreshToken: false, persistSession: false }
	});
	const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
		email,
		password
	});
	if (signInError || !signIn.session) {
		throw new Error(`Could not sign in test user ${handle}: ${signInError?.message}`);
	}

	const client = createClient(creds.apiUrl, creds.publishableKey, {
		auth: { autoRefreshToken: false, persistSession: false },
		global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } }
	});

	return { id, client };
}

/**
 * Clears the GLOBAL crown then grants it to exactly `profileId` — authoritatively,
 * with the service client (is_current_top_dog is non-client-writable). This mirrors
 * what recompute_top_dog() does, but set directly so a test can establish a known
 * Top Dog without driving the full vote machinery. Clearing first preserves the
 * singleton invariant (at most one crown holder).
 */
async function setSoleTopDog(profileId: string): Promise<void> {
	const service = serviceClient();
	const { error: clearErr } = await service
		.from('profiles')
		.update({ is_current_top_dog: false, top_dog_since: null })
		.neq('id', '00000000-0000-0000-0000-000000000000');
	if (clearErr) {
		throw new Error(`setSoleTopDog: could not clear crowns: ${clearErr.message}`);
	}
	const { error: setErr } = await service
		.from('profiles')
		.update({ is_current_top_dog: true, top_dog_since: new Date().toISOString() })
		.eq('id', profileId);
	if (setErr) {
		throw new Error(`setSoleTopDog: could not crown ${profileId}: ${setErr.message}`);
	}
}

/** Clears the GLOBAL crown entirely (no Top Dog). */
async function clearCrown(): Promise<void> {
	const service = serviceClient();
	const { error } = await service
		.from('profiles')
		.update({ is_current_top_dog: false, top_dog_since: null })
		.neq('id', '00000000-0000-0000-0000-000000000000');
	if (error) {
		throw new Error(`clearCrown: could not clear crowns: ${error.message}`);
	}
}

/** Authoritative spray rows for a target profile, read with the service client. */
async function spraysFor(targetProfileId: string): Promise<
	{
		id: string;
		sprayer_id: string;
		target_profile_id: string;
		x: number;
		y: number;
		sprayed_at: string;
	}[]
> {
	const service = serviceClient();
	const { data, error } = await service
		.from('mustard_sprays')
		.select('id, sprayer_id, target_profile_id, x, y, sprayed_at')
		.eq('target_profile_id', targetProfileId);
	if (error) {
		throw new Error(`Could not read sprays for ${targetProfileId}: ${error.message}`);
	}
	return data ?? [];
}

test.describe
	.serial('@security mustard_sprays: Top-Dog-gated INSERT RLS (direct PostgREST)', () => {
	// Each test reasons about the ABSOLUTE global crown singleton — start with no
	// crown so a leftover incumbent from a sibling spec can't satisfy the EXISTS
	// gate for the wrong user.
	test.beforeEach(async () => {
		await clearCrown();
	});

	test('a NON-Top-Dog member CANNOT insert a spray (RLS WITH-CHECK rejects, 42501)', async () => {
		const sprayer = await makeUser(uniqueHandle('np')); // not the Top Dog
		const target = await makeUser(uniqueHandle('tg'));
		// No crown is set — sprayer is not the Top Dog.

		const { error } = await sprayer.client.from('mustard_sprays').insert({
			sprayer_id: sprayer.id,
			target_profile_id: target.id,
			x: 0.5,
			y: 0.5
		});

		expect(error, 'a non-Top-Dog spray must be rejected by RLS').not.toBeNull();
		expect(error?.code, 'the INSERT WITH-CHECK denial surfaces as 42501').toBe('42501');

		// And no row was written.
		expect(await spraysFor(target.id), 'the rejected insert created no spray row').toHaveLength(0);
	});

	test('the CURRENT Top Dog CAN insert a spray on a target profile', async () => {
		const topDog = await makeUser(uniqueHandle('td'));
		const target = await makeUser(uniqueHandle('tg'));
		await setSoleTopDog(topDog.id);

		const { error } = await topDog.client.from('mustard_sprays').insert({
			sprayer_id: topDog.id,
			target_profile_id: target.id,
			x: 0.25,
			y: 0.75
		});

		expect(error, 'the current Top Dog spray must succeed under RLS').toBeNull();

		const rows = await spraysFor(target.id);
		expect(rows, 'exactly one spray landed').toHaveLength(1);
		expect(rows[0].sprayer_id).toBe(topDog.id);
		expect(rows[0].x).toBeCloseTo(0.25, 5);
		expect(rows[0].y).toBeCloseTo(0.75, 5);
	});

	test('a forged sprayer_id (!= auth.uid()) is rejected even when the caller IS the Top Dog (42501)', async () => {
		const topDog = await makeUser(uniqueHandle('td'));
		const victim = await makeUser(uniqueHandle('vc'));
		const target = await makeUser(uniqueHandle('tg'));
		await setSoleTopDog(topDog.id);

		// The Top Dog tries to stamp the spray as if the VICTIM sprayed it. The
		// `sprayer_id = (select auth.uid())` conjunct rejects it — auth.uid() is the
		// Top Dog, not the victim — so the row is refused regardless of crown state.
		const { error } = await topDog.client.from('mustard_sprays').insert({
			sprayer_id: victim.id,
			target_profile_id: target.id,
			x: 0.5,
			y: 0.5
		});

		expect(error, 'forging another sprayer_id must be rejected by RLS').not.toBeNull();
		expect(error?.code, 'the pinned-sprayer denial surfaces as 42501').toBe('42501');

		expect(await spraysFor(target.id), 'no forged spray row exists').toHaveLength(0);
	});

	test('an x/y outside [0,1] is rejected by the CHECK backstop (23514)', async () => {
		const topDog = await makeUser(uniqueHandle('td'));
		const target = await makeUser(uniqueHandle('tg'));
		await setSoleTopDog(topDog.id);

		// Even as the Top Dog, an out-of-range position hits the DB CHECK. (The app
		// boundary validates first, but a direct PostgREST insert reaches the CHECK.)
		const { error } = await topDog.client.from('mustard_sprays').insert({
			sprayer_id: topDog.id,
			target_profile_id: target.id,
			x: 1.5,
			y: 0.5
		});

		expect(error, 'an out-of-range x must be rejected').not.toBeNull();
		expect(error?.code, 'the x/y range CHECK surfaces as 23514').toBe('23514');

		expect(await spraysFor(target.id), 'the rejected insert created no spray row').toHaveLength(0);
	});

	test('sprays PERSIST after the crown moves to another member (AC: persist across crown changes)', async () => {
		const firstTopDog = await makeUser(uniqueHandle('t1'));
		const nextTopDog = await makeUser(uniqueHandle('t2'));
		const target = await makeUser(uniqueHandle('tg'));

		// firstTopDog holds the crown and lands a spray.
		await setSoleTopDog(firstTopDog.id);
		const { error: sprayErr } = await firstTopDog.client.from('mustard_sprays').insert({
			sprayer_id: firstTopDog.id,
			target_profile_id: target.id,
			x: 0.4,
			y: 0.6
		});
		expect(sprayErr, 'the incumbent Top Dog spray should succeed').toBeNull();

		const before = await spraysFor(target.id);
		expect(before, 'the spray landed').toHaveLength(1);
		const original = before[0];

		// The crown moves to a different member (handoff). is_current_top_dog flips —
		// firstTopDog is no longer the Top Dog.
		await setSoleTopDog(nextTopDog.id);

		// The spray row still exists and is UNCHANGED: there is no UPDATE/DELETE
		// policy, and the crown flag is not a column on mustard_sprays — sprays are
		// immutable + persistent (decision #15). The original sprayer keeping the
		// authorship is the point of "persist across crown changes".
		const after = await spraysFor(target.id);
		expect(after, 'the spray persists after the crown moves').toHaveLength(1);
		expect(after[0]).toEqual(original);
		expect(after[0].sprayer_id, 'the original sprayer remains the author').toBe(firstTopDog.id);

		// Sanity: the former Top Dog cannot spray AGAIN now that the crown moved.
		const { error: nowDeniedErr } = await firstTopDog.client.from('mustard_sprays').insert({
			sprayer_id: firstTopDog.id,
			target_profile_id: target.id,
			x: 0.1,
			y: 0.1
		});
		expect(nowDeniedErr?.code, 'a dethroned member can no longer spray (42501)').toBe('42501');
		expect(await spraysFor(target.id), 'no new spray landed after dethroning').toHaveLength(1);
	});
});
