import { expect, test } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getLocalStackCreds } from './helpers/local-stack';

// TASK-071 live-DB coverage for burger alarms (🍔 "that's a hamburger, not a hot
// dog" report). Decision #12/#15: cosmetic flair, NO denormalized counter, the
// alarm is computed at render time — never touches vote_count/peak_votes/the crown.
// The one twist vs. hotdog_reactions is ANONYMITY: the SELECT policy is owner-scoped
// to the REPORTER, so no member can read who else reported a dog.
//
// We go DIRECTLY to PostgREST as authenticated members (publishable key + a signed-
// in user's JWT) against the LOCAL Postgres — the same live-DB pattern as
// reactions.e2e.ts / db-guards.e2e.ts. These prove the DB-authoritative invariants
// the mocked unit tests cannot reach:
//   (a) a member CANNOT forge a report as another member (WITH CHECK pins
//       reporter_id = auth.uid());
//   (b) a member CANNOT report their OWN dog (WITH CHECK's NOT EXISTS on owner_id);
//   (c) ANONYMITY: a report by user A is NOT readable by user B (owner-scoped SELECT
//       returns only the caller's own rows);
//   (d) report + unreport leaves the dog's vote_count / peak_votes unchanged;
//   (e) no UPDATE policy (a report is immutable); anon cannot read at all.
//
// Service-role client is used ONLY for setup (users + profiles + dogs) and
// authoritative read-backs (vote_count, anonymity cross-check) — it bypasses RLS,
// which is the point. The report INSERT/DELETE/SELECT under test run as the
// authenticated members. The service key stays Node/server-side; never to a browser.
//
// Tagged @security (NOT @smoke). Pure PostgREST, LOCAL stack, no app server.

const creds = getLocalStackCreds();

/** Service-role client: bypasses RLS for setup + authoritative reads. */
function serviceClient(): SupabaseClient {
	return createClient(creds.apiUrl, creds.secretKey, {
		auth: { autoRefreshToken: false, persistSession: false }
	});
}

/** Anonymous client: publishable key, no JWT — the unauthenticated `anon` role. */
function anonClient(): SupabaseClient {
	return createClient(creds.apiUrl, creds.publishableKey, {
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
	const email = `burger-${handle}-${Date.now().toString(36)}@topdog.test`;
	const password = 'burger-test-password-123';

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

/** Inserts a hot dog for `ownerId` with the service client; returns the dog id. */
async function makeDog(ownerId: string): Promise<string> {
	const service = serviceClient();
	const dogId = crypto.randomUUID();
	const { error } = await service.from('hot_dogs').insert({
		id: dogId,
		owner_id: ownerId,
		image_path: `${ownerId}/${dogId}.webp`,
		byte_size: 10,
		caption: 'burger-alarm fixture dog'
	});
	if (error) {
		throw new Error(`Could not insert fixture dog: ${error.message}`);
	}
	return dogId;
}

/** Authoritative vote_count + peak_votes for a dog, read with the service client. */
async function rankingState(dogId: string): Promise<{ voteCount: number; peakVotes: number }> {
	const service = serviceClient();
	const { data, error } = await service
		.from('hot_dogs')
		.select('vote_count, peak_votes')
		.eq('id', dogId)
		.single();
	if (error || !data) {
		throw new Error(`Could not read ranking state for ${dogId}: ${error?.message}`);
	}
	return { voteCount: data.vote_count as number, peakVotes: data.peak_votes as number };
}

test.describe('@security burger_alarms: anonymity + owner-scoped RLS + no ranking effect (direct PostgREST)', () => {
	test('a member CANNOT forge a report as another member (WITH CHECK pins reporter_id)', async () => {
		const attacker = await makeUser(uniqueHandle('atk'));
		const victim = await makeUser(uniqueHandle('vic'));
		const owner = await makeUser(uniqueHandle('own'));
		const dog = await makeDog(owner.id);

		// The attacker tries to insert a report stamped with the VICTIM's reporter_id.
		// `with check (reporter_id = (select auth.uid()))` must reject it.
		const { error } = await attacker.client.from('burger_alarms').insert({
			reporter_id: victim.id,
			hot_dog_id: dog
		});

		expect(error, 'forging a report as another member must be rejected by RLS').not.toBeNull();

		// And no forged row exists.
		const service = serviceClient();
		const { data: rows } = await service
			.from('burger_alarms')
			.select('id')
			.eq('reporter_id', victim.id)
			.eq('hot_dog_id', dog);
		expect(rows ?? [], 'the rejected insert created no report row').toHaveLength(0);
	});

	test('a member CANNOT report their OWN dog (WITH CHECK NOT EXISTS on owner_id)', async () => {
		const owner = await makeUser(uniqueHandle('own'));
		const dog = await makeDog(owner.id);

		// The owner tries to report their own dog as a hamburger. The reporter_id is
		// pinned to themselves (allowed), but the NOT EXISTS owner check rejects it.
		const { error } = await owner.client.from('burger_alarms').insert({
			reporter_id: owner.id,
			hot_dog_id: dog
		});

		expect(error, 'reporting your own dog must be rejected by RLS').not.toBeNull();

		const service = serviceClient();
		const { data: rows } = await service.from('burger_alarms').select('id').eq('hot_dog_id', dog);
		expect(rows ?? [], 'no self-report row was created').toHaveLength(0);
	});

	test("a member CAN report ANOTHER member's dog (reporter_id = auth.uid(), not the owner)", async () => {
		const reporter = await makeUser(uniqueHandle('rep'));
		const owner = await makeUser(uniqueHandle('own'));
		const dog = await makeDog(owner.id);

		const { error } = await reporter.client.from('burger_alarms').insert({
			reporter_id: reporter.id,
			hot_dog_id: dog
		});

		expect(error, "reporting another member's dog must succeed under RLS").toBeNull();
	});

	test('ANONYMITY: a report by user A is NOT readable by user B (owner-scoped SELECT)', async () => {
		const reporterA = await makeUser(uniqueHandle('a'));
		const memberB = await makeUser(uniqueHandle('b'));
		const owner = await makeUser(uniqueHandle('own'));
		const dog = await makeDog(owner.id);

		// A reports the dog.
		const insA = await reporterA.client.from('burger_alarms').insert({
			reporter_id: reporterA.id,
			hot_dog_id: dog
		});
		expect(insA.error, "A's own report should insert").toBeNull();

		// B reads burger_alarms for the same dog. The owner-scoped SELECT means B sees
		// ONLY their own rows (none here) — A's report is invisible. This is what keeps
		// the reporter anonymous: no member can enumerate who reported a dog.
		const { data: bSees, error: bError } = await memberB.client
			.from('burger_alarms')
			.select('id, reporter_id')
			.eq('hot_dog_id', dog);
		expect(bError, "B's read should not error").toBeNull();
		const bRows = bSees ?? [];
		expect(bRows, "B must NOT be able to read A's report (reporter anonymity)").toHaveLength(0);

		// A, by contrast, CAN read their own report row (drives the toggle state).
		const { data: aSees } = await reporterA.client
			.from('burger_alarms')
			.select('id')
			.eq('hot_dog_id', dog);
		const aRows = aSees ?? [];
		expect(aRows, 'A can read their OWN report (own-scoped SELECT)').toHaveLength(1);

		// The service-role read confirms the row really exists — B's empty read is RLS
		// hiding it, not a missing row.
		const service = serviceClient();
		const { data: truth } = await service.from('burger_alarms').select('id').eq('hot_dog_id', dog);
		const truthRows = truth ?? [];
		// B's empty read above is RLS hiding the row, not the row being absent.
		expect(truthRows.length, "the row genuinely exists despite B's empty read").toBe(1);
	});

	test('report + unreport does NOT change the dog vote_count / peak_votes (ranking-inert)', async () => {
		const reporter = await makeUser(uniqueHandle('rep'));
		const owner = await makeUser(uniqueHandle('own'));
		const dog = await makeDog(owner.id);

		const before = await rankingState(dog);

		const ins = await reporter.client.from('burger_alarms').insert({
			reporter_id: reporter.id,
			hot_dog_id: dog
		});
		expect(ins.error, "reporting another member's dog should succeed").toBeNull();

		const afterReport = await rankingState(dog);
		expect(afterReport.voteCount, 'a report must not change vote_count').toBe(before.voteCount);
		expect(afterReport.peakVotes, 'a report must not change peak_votes').toBe(before.peakVotes);

		// Retract the report (the un-report half of the toggle).
		const del = await reporter.client
			.from('burger_alarms')
			.delete()
			.eq('reporter_id', reporter.id)
			.eq('hot_dog_id', dog);
		expect(del.error, 'retracting your own report should succeed').toBeNull();

		const afterUnreport = await rankingState(dog);
		expect(afterUnreport.voteCount, 'un-reporting must not change vote_count').toBe(
			before.voteCount
		);
		expect(afterUnreport.peakVotes, 'un-reporting must not change peak_votes').toBe(
			before.peakVotes
		);
	});

	test('UNIQUE(reporter_id, hot_dog_id) gives a single-report-per-member toggle (23505 on dup)', async () => {
		const reporter = await makeUser(uniqueHandle('rep'));
		const owner = await makeUser(uniqueHandle('own'));
		const dog = await makeDog(owner.id);

		const first = await reporter.client
			.from('burger_alarms')
			.insert({ reporter_id: reporter.id, hot_dog_id: dog });
		expect(first.error, 'first report should succeed').toBeNull();

		const dup = await reporter.client
			.from('burger_alarms')
			.insert({ reporter_id: reporter.id, hot_dog_id: dog });
		expect(dup.error?.code, 'a duplicate (reporter, dog) raises unique_violation 23505').toBe(
			'23505'
		);
	});

	test('a report is immutable: a member CANNOT UPDATE their report row (no UPDATE policy)', async () => {
		const reporter = await makeUser(uniqueHandle('rep'));
		const owner = await makeUser(uniqueHandle('own'));
		const otherOwner = await makeUser(uniqueHandle('oth'));
		const dog = await makeDog(owner.id);
		const otherDog = await makeDog(otherOwner.id);

		const ins = await reporter.client
			.from('burger_alarms')
			.insert({ reporter_id: reporter.id, hot_dog_id: dog })
			.select('id')
			.single();
		expect(ins.error, 'the report should insert').toBeNull();
		const reportId = (ins.data as { id: string }).id;

		// Try to repoint the report at a different dog. There is NO UPDATE policy, so
		// default-deny means the update matches zero rows (no row is changed). Read
		// back authoritatively to prove the row is unchanged.
		await reporter.client.from('burger_alarms').update({ hot_dog_id: otherDog }).eq('id', reportId);

		const service = serviceClient();
		const { data: row } = await service
			.from('burger_alarms')
			.select('hot_dog_id')
			.eq('id', reportId)
			.single();
		const stored = (row as { hot_dog_id: string }).hot_dog_id;
		expect(stored, 'the report row must be immutable (no UPDATE policy)').toBe(dog);
	});

	test('anon (unauthenticated) cannot read burger_alarms at all', async () => {
		const reporter = await makeUser(uniqueHandle('rep'));
		const owner = await makeUser(uniqueHandle('own'));
		const dog = await makeDog(owner.id);
		await reporter.client
			.from('burger_alarms')
			.insert({ reporter_id: reporter.id, hot_dog_id: dog });

		// The anon role has NO grants on burger_alarms (decision #28: anon nothing).
		// A read returns either an error or zero rows — never any report data.
		const { data, error } = await anonClient()
			.from('burger_alarms')
			.select('id')
			.eq('hot_dog_id', dog);

		const leaked = !error && (data ?? []).length > 0;
		expect(leaked, 'anon must not be able to read any burger_alarms row').toBe(false);
	});
});
