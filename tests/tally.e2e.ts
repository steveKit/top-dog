import { expect, test } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getLocalStackCreds } from './helpers/local-stack';

// TASK-022 live-DB coverage for the daily Top Dog tally: the top_dog_days table
// + the idempotent tally_top_dog_day() RPC. The authoritative logic is SQL, so
// these tests go DIRECTLY to PostgREST against the LOCAL Postgres — the same
// live-DB pattern as votes.e2e.ts / db-guards.e2e.ts.
//
// What is being proven (decision #14 + TASK-021 column grants):
//   1. Same-day idempotency: two calls the same day record ONE row, count = 1.
//   2. Cross-day increment: count reflects DISTINCT calendar days, not a +1.
//   3. No current Top Dog -> clean no-op (returns NULL, no error, no row).
//   4. top_dog_days is NOT client-writable (RLS default-deny, no write grant).
//   5. anon CAN call the RPC (decision A1 — the keep-alive's caller).
//   6. days_as_top_dog stays non-client-writable (TASK-021 column-grant guard);
//      the tally RPC is its only writer.
//
// The crown (profiles.is_current_top_dog) is a GLOBAL singleton, so each test
// resets crown state + clears top_dog_days before it runs (the resetCrownField
// pattern from votes.e2e.ts) and seeds its OWN current Top Dog via the
// service-role client (which bypasses the column grants — we are seeding a
// fixture, not exercising the write path). The service key stays Node/server
// side; it is never handed to a browser context.
//
// Tagged @security (NOT @smoke) so `--grep @smoke` does not select these. Runs
// against the LOCAL stack via the non-localhost-guarded helper; no app server.

const creds = getLocalStackCreds();

/** Service-role client: bypasses RLS + column grants for setup + reads. */
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

/** A test user: their auth id + an authenticated-role client (their own JWT). */
interface TestUser {
	id: string;
	client: SupabaseClient;
}

// A unique handle suffix per spec keeps reruns from colliding on handle/profile
// uniqueness. Handles are limited to 2..32 chars; keep them short.
let seq = 0;
function uniqueHandle(prefix: string): string {
	seq += 1;
	return `${prefix}${Date.now().toString(36).slice(-4)}${seq}`.slice(0, 32);
}

/**
 * Creates an auth user + matching profile row, signs them in with the
 * publishable key, and returns an authenticated-role client holding their JWT —
 * exactly what a browser carries.
 */
async function makeUser(handle: string): Promise<TestUser> {
	const service = serviceClient();
	const email = `tally-${handle}-${Date.now().toString(36)}@topdog.test`;
	const password = 'tally-test-password-123';

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

	const anon = anonClient();
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
 * Clears the GLOBAL crown singleton and ALL top_dog_days rows with the service
 * client, so each tally test reasons about an absolute "no crown, no history"
 * starting state. Touches rows created by sibling specs, which is acceptable:
 * each tally test owns the global crown for its duration and asserts only its
 * own profiles. (top_dog_days FK-cascades from profiles; we delete the rows
 * directly rather than relying on user teardown.)
 */
async function resetCrownAndTally(): Promise<void> {
	const service = serviceClient();
	const { error: daysErr } = await service
		.from('top_dog_days')
		.delete()
		.neq('id', '00000000-0000-0000-0000-000000000000');
	if (daysErr) {
		throw new Error(`resetCrownAndTally: could not clear top_dog_days: ${daysErr.message}`);
	}
	const { error: crownErr } = await service
		.from('profiles')
		.update({ is_current_top_dog: false, top_dog_since: null, days_as_top_dog: 0 })
		.neq('id', '00000000-0000-0000-0000-000000000000');
	if (crownErr) {
		throw new Error(`resetCrownAndTally: could not clear crowns: ${crownErr.message}`);
	}
}

/**
 * Crowns `profileId` as the (singleton) current Top Dog via the service client.
 * Bypasses the TASK-021 column grants — this is fixture seeding, not the write
 * path under test. Caller has already cleared any prior crown.
 */
async function seedCurrentTopDog(profileId: string): Promise<void> {
	const service = serviceClient();
	const { error } = await service
		.from('profiles')
		.update({ is_current_top_dog: true, top_dog_since: new Date().toISOString() })
		.eq('id', profileId);
	if (error) {
		throw new Error(`Could not seed current Top Dog ${profileId}: ${error.message}`);
	}
}

/** All top_dog_days rows for a profile, read with the service client (bypasses RLS). */
async function tallyRows(profileId: string): Promise<{ id: string; day: string }[]> {
	const service = serviceClient();
	const { data, error } = await service
		.from('top_dog_days')
		.select('id, day')
		.eq('profile_id', profileId);
	if (error) {
		throw new Error(`Could not read top_dog_days for ${profileId}: ${error.message}`);
	}
	return (data ?? []) as { id: string; day: string }[];
}

/** A profile's days_as_top_dog counter, read with the service client. */
async function daysAsTopDog(profileId: string): Promise<number> {
	const service = serviceClient();
	const { data, error } = await service
		.from('profiles')
		.select('days_as_top_dog')
		.eq('id', profileId)
		.single();
	if (error || !data) {
		throw new Error(`Could not read days_as_top_dog for ${profileId}: ${error?.message}`);
	}
	return data.days_as_top_dog as number;
}

test.describe('@security tally_top_dog_day RPC + top_dog_days guards (direct PostgREST)', () => {
	// Each test reasons about the ABSOLUTE global crown + tally history, so start
	// from a known-empty field.
	test.beforeEach(async () => {
		await resetCrownAndTally();
	});

	test('idempotent same-day tally — two calls today record ONE row, days_as_top_dog === 1', async () => {
		// Decision #14: multiple reigns the same calendar day count as ONE day. With
		// a current Top Dog set, calling the RPC twice today must collapse to a single
		// top_dog_days row (UNIQUE + ON CONFLICT DO NOTHING).
		const holder = await makeUser(uniqueHandle('idem'));
		await seedCurrentTopDog(holder.id);

		const first = await holder.client.rpc('tally_top_dog_day');
		expect(first.error, 'first tally should succeed').toBeNull();
		expect(first.data, 'the RPC returns the tallied profile_id').toBe(holder.id);

		const second = await holder.client.rpc('tally_top_dog_day');
		expect(second.error, 'a same-day re-run should succeed (no-op insert)').toBeNull();
		expect(second.data, 'the RPC still returns the current Top Dog').toBe(holder.id);

		const rows = await tallyRows(holder.id);
		expect(rows, 'two same-day calls record exactly ONE top_dog_days row').toHaveLength(1);
		expect(await daysAsTopDog(holder.id), 'days_as_top_dog reflects the single held day').toBe(1);
	});

	test('cross-day increment — a prior-day row + today yields two days, days_as_top_dog === 2', async () => {
		// Pre-seed a top_dog_days row on a PRIOR day (current_date - 1), then tally
		// today. The count must reflect DISTINCT days (2), proving the recompute is a
		// COUNT(top_dog_days), not a blind +1.
		const holder = await makeUser(uniqueHandle('xday'));
		await seedCurrentTopDog(holder.id);

		// Seed yesterday directly (service role bypasses the no-write-path on the table).
		const service = serviceClient();
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const yyyyMmDd = yesterday.toISOString().slice(0, 10);
		const { error: seedErr } = await service
			.from('top_dog_days')
			.insert({ profile_id: holder.id, day: yyyyMmDd });
		expect(seedErr, 'seeding a prior-day tally row should succeed').toBeNull();

		const { data, error } = await holder.client.rpc('tally_top_dog_day');
		expect(error, "today's tally should succeed").toBeNull();
		expect(data, 'the RPC returns the tallied profile_id').toBe(holder.id);

		const rows = await tallyRows(holder.id);
		expect(rows, 'a prior day + today are two DISTINCT day-rows').toHaveLength(2);
		const distinctDays = new Set(rows.map((r) => r.day));
		expect(distinctDays.size, 'the two rows are on different calendar days').toBe(2);
		expect(
			await daysAsTopDog(holder.id),
			'days_as_top_dog counts distinct days (2), not a blind +1'
		).toBe(2);
	});

	test('no current Top Dog — the RPC is a clean no-op (returns NULL, inserts nothing)', async () => {
		// With NO profile holding is_current_top_dog (cold state), the RPC must return
		// NULL without erroring and record no top_dog_days row. The keep-alive ping
		// still keeps the DB warm.
		const observer = await makeUser(uniqueHandle('noop'));

		const { data, error } = await observer.client.rpc('tally_top_dog_day');
		expect(error, 'a no-crown call must NOT error').toBeNull();
		expect(data, 'with no current Top Dog the RPC returns NULL').toBeNull();

		// Authoritative read: no top_dog_days row landed for anyone today.
		const service = serviceClient();
		const today = new Date().toISOString().slice(0, 10);
		const { data: rows, error: readErr } = await service
			.from('top_dog_days')
			.select('id')
			.eq('day', today);
		expect(readErr, 'the authoritative read should succeed').toBeNull();
		expect(rows ?? [], 'a no-op tally inserts no row').toHaveLength(0);
	});

	test('top_dog_days is NOT client-writable — authenticated + anon INSERT rejected, no row lands', async () => {
		// The table has RLS default-deny with only a SELECT policy and NO write
		// grant/policy — all writes go through the SECURITY DEFINER RPC. A direct
		// authenticated insert must be refused (RLS violation / insufficient
		// privilege) and leave no row.
		const member = await makeUser(uniqueHandle('wguard'));

		const authedAttempt = await member.client
			.from('top_dog_days')
			.insert({ profile_id: member.id, day: new Date().toISOString().slice(0, 10) });
		expect(authedAttempt.error, 'an authenticated direct INSERT must be rejected').not.toBeNull();

		const anonAttempt = await anonClient()
			.from('top_dog_days')
			.insert({ profile_id: member.id, day: new Date().toISOString().slice(0, 10) });
		expect(anonAttempt.error, 'an anon direct INSERT must be rejected').not.toBeNull();

		// Authoritative read-back: neither attempt landed a row.
		const rows = await tallyRows(member.id);
		expect(rows, 'a rejected client INSERT creates no top_dog_days row').toHaveLength(0);
	});

	test('anon CAN call tally_top_dog_day (decision A1) — callable, and a clean no-op when no crown', async () => {
		// EXECUTE is granted to anon (the keep-alive workflow calls it with the
		// publishable/anon key). An anon call must NOT raise a permission error. With
		// no current Top Dog it is callable AND self-limiting: a clean no-op returning
		// NULL. This distinguishes "callable" from "does something for an arbitrary
		// caller" — anon cannot forge a day, it only ever records the actual crown.
		const { data, error } = await anonClient().rpc('tally_top_dog_day');

		expect(error, 'anon must be able to call the RPC (no 42501)').toBeNull();
		expect(data, 'callable but self-limiting: no crown -> NULL no-op').toBeNull();
	});

	test('anon-callable RPC still records the ACTUAL current Top Dog (not forgeable)', async () => {
		// Companion to the no-op above: when a crown IS held, an anon call records
		// THAT holder's today — the RPC takes no caller input, so anon cannot target
		// an arbitrary profile. Confirms the grant is useful (keep-alive can drive it)
		// while remaining self-limiting.
		const holder = await makeUser(uniqueHandle('areal'));
		await seedCurrentTopDog(holder.id);

		const { data, error } = await anonClient().rpc('tally_top_dog_day');
		expect(error, 'anon call against a held crown should succeed').toBeNull();
		expect(data, 'anon records the ACTUAL current Top Dog, not a caller-supplied one').toBe(
			holder.id
		);

		expect(await tallyRows(holder.id), 'the held day was recorded').toHaveLength(1);
		expect(await daysAsTopDog(holder.id), 'and the counter was recomputed').toBe(1);
	});

	test('days_as_top_dog stays non-client-writable — direct UPDATE rejected; the RPC is the only writer', async () => {
		// TASK-021 column-grant guard: days_as_top_dog is NOT in the profiles UPDATE
		// grant, so an authenticated member cannot bump their own counter. The SECURITY
		// DEFINER tally RPC is the only writer.
		const member = await makeUser(uniqueHandle('cguard'));

		const { error } = await member.client
			.from('profiles')
			.update({ days_as_top_dog: 9999 })
			.eq('id', member.id);

		expect(error, 'forging days_as_top_dog via UPDATE must be rejected').not.toBeNull();
		expect(error?.code, 'the column-grant guard raises insufficient_privilege 42501').toBe('42501');

		// Authoritative read-back: the counter is untouched.
		expect(await daysAsTopDog(member.id), 'days_as_top_dog must remain at its default 0').toBe(0);

		// And the RPC IS the writer: crowning + tallying moves it to 1.
		await seedCurrentTopDog(member.id);
		const { error: rpcErr } = await member.client.rpc('tally_top_dog_day');
		expect(rpcErr, 'the tally RPC is the legitimate writer').toBeNull();
		expect(await daysAsTopDog(member.id), 'the RPC sets the counter the client could not').toBe(1);
	});
});
