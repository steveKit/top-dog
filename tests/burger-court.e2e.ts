import { expect, test } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getLocalStackCreds } from './helpers/local-stack';

// TASK-073 live-DB coverage for the 🍔 Hamburger Court MODERATION half (the Top-Dog
// verdict + HAMBURGER LIAR / HERETIC consequences). The verdict + LIAR rows are
// written EXCLUSIVELY through the render_burger_verdict SECURITY DEFINER RPC, gated on
// the non-client-writable is_current_top_dog crown (decision #25). These prove the
// DB-authoritative invariants the mocked unit tests cannot reach:
//   (a) a NON-Top-Dog cannot call the verdict RPC (the EXISTS crown gate rejects it,
//       42501) — the gate holds at the DB, not just the UI;
//   (b) the verdict is NOT client-forgeable: a member cannot INSERT/UPDATE
//       burger_verdicts or hamburger_liars directly (no client write policy) — the RPC
//       is the sole write path;
//   (c) a not_a_hamburger verdict brands EVERY reporter a HAMBURGER LIAR;
//   (d) a confirmed_hamburger verdict brands the OWNER a HERETIC (derived) and does NOT
//       brand the reporters (clears any stale LIAR rows);
//   (e) LIAR and HERETIC rows are RANKING-INERT (vote_count / peak_votes unchanged);
//   (f) anon cannot read burger_verdicts / hamburger_liars at all (decision #28).
//
// We go DIRECTLY to PostgREST as authenticated members (publishable key + a signed-in
// user's JWT) against the LOCAL Postgres — the same pattern as burger-alarms.e2e.ts.
// The service-role client is used ONLY for setup (users/profiles/dogs/reports, crowning
// a Top Dog by writing is_current_top_dog directly — which only the privileged role can
// do) and authoritative read-backs. The service key stays Node/server-side.
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
 * key, and returns an authenticated-role client holding their JWT.
 */
async function makeUser(handle: string): Promise<TestUser> {
	const service = serviceClient();
	const email = `court-${handle}-${Date.now().toString(36)}@topdog.test`;
	const password = 'court-test-password-123';

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
		caption: 'hamburger-court fixture dog'
	});
	if (error) {
		throw new Error(`Could not insert fixture dog: ${error.message}`);
	}
	return dogId;
}

/** Inserts a burger report by `reporter` on `dogId` (as that reporter, under RLS). */
async function report(reporter: TestUser, dogId: string): Promise<void> {
	const { error } = await reporter.client
		.from('burger_alarms')
		.insert({ reporter_id: reporter.id, hot_dog_id: dogId });
	if (error) {
		throw new Error(`Could not insert fixture report: ${error.message}`);
	}
}

/**
 * Crowns `userId` the current Top Dog by setting is_current_top_dog directly with the
 * service client (the column is non-client-writable — decision #25 — so only the
 * privileged role can do this; the gate the RPC reads is thereby trustworthy). Clears
 * any other holder first so exactly one crown exists.
 */
async function crown(userId: string): Promise<void> {
	const service = serviceClient();
	await service
		.from('profiles')
		.update({ is_current_top_dog: false, top_dog_since: null })
		.eq('is_current_top_dog', true);
	const { error } = await service
		.from('profiles')
		.update({ is_current_top_dog: true, top_dog_since: new Date().toISOString() })
		.eq('id', userId);
	if (error) {
		throw new Error(`Could not crown ${userId}: ${error.message}`);
	}
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

/** Service-role read of LIAR rows for a (reporter, dog). */
async function liarRows(reporterId: string, dogId: string): Promise<number> {
	const service = serviceClient();
	const { data } = await service
		.from('hamburger_liars')
		.select('id')
		.eq('reporter_id', reporterId)
		.eq('hot_dog_id', dogId);
	return (data ?? []).length;
}

/** Service-role read of the verdict for a dog. */
async function verdictFor(dogId: string): Promise<string | null> {
	const service = serviceClient();
	const { data } = await service
		.from('burger_verdicts')
		.select('verdict')
		.eq('hot_dog_id', dogId)
		.maybeSingle();
	return (data as { verdict: string } | null)?.verdict ?? null;
}

test.describe('@security hamburger court: Top-Dog-gated verdict RPC + LIAR/HERETIC (direct PostgREST)', () => {
	test('a NON-Top-Dog cannot call the verdict RPC (EXISTS crown gate rejects, 42501)', async () => {
		const member = await makeUser(uniqueHandle('mem'));
		const owner = await makeUser(uniqueHandle('own'));
		const dog = await makeDog(owner.id);
		// member is NOT crowned.

		const { error } = await member.client.rpc('render_burger_verdict', {
			target_dog: dog,
			the_verdict: 'confirmed_hamburger'
		});

		expect(error, 'a non-Top-Dog calling the verdict RPC must be rejected').not.toBeNull();
		expect(error?.code, 'the crown gate raises insufficient_privilege (42501)').toBe('42501');
		expect(await verdictFor(dog), 'no verdict was recorded').toBeNull();
	});

	test('a member cannot forge a verdict by writing burger_verdicts directly (no client write policy)', async () => {
		const member = await makeUser(uniqueHandle('mem'));
		const owner = await makeUser(uniqueHandle('own'));
		const dog = await makeDog(owner.id);

		// Direct INSERT into burger_verdicts: there is NO client INSERT policy, so
		// default-deny + no base grant rejects it (the RPC is the sole writer).
		const { error } = await member.client.from('burger_verdicts').insert({
			hot_dog_id: dog,
			verdict: 'confirmed_hamburger',
			decided_by: member.id
		});

		expect(
			error,
			'a direct verdict insert must be rejected (RPC is the sole writer)'
		).not.toBeNull();
		expect(await verdictFor(dog), 'no forged verdict exists').toBeNull();
	});

	test('a member cannot UPDATE an existing verdict directly (RPC is the sole writer)', async () => {
		// Forge guard for the UPDATE path: the no-client-write lockdown must block a
		// member flipping a real verdict (e.g. confirmed -> not, or re-pointing
		// decided_by to themselves) by a direct PostgREST UPDATE. Seed a genuine verdict
		// via the RPC as the Top Dog first, then try to mutate it as an ordinary member.
		const topDog = await makeUser(uniqueHandle('td'));
		const member = await makeUser(uniqueHandle('mem'));
		const owner = await makeUser(uniqueHandle('own'));
		const dog = await makeDog(owner.id);
		await crown(topDog.id);
		await topDog.client.rpc('render_burger_verdict', {
			target_dog: dog,
			the_verdict: 'confirmed_hamburger'
		});
		expect(await verdictFor(dog), 'a real verdict exists to attack').toBe('confirmed_hamburger');

		// A member tries to overturn it via a direct UPDATE. Default-deny (no UPDATE
		// policy) makes this a zero-row no-op at best — never an actual mutation.
		await member.client
			.from('burger_verdicts')
			.update({ verdict: 'not_a_hamburger', decided_by: member.id })
			.eq('hot_dog_id', dog);

		expect(await verdictFor(dog), 'a direct UPDATE must not overturn the verdict').toBe(
			'confirmed_hamburger'
		);
	});

	test('a member cannot DELETE an existing verdict or LIAR row directly (RPC is the sole writer)', async () => {
		// Forge guard for the DELETE path: a branded LIAR must not be able to scrub their
		// own brand (or a guilty owner delete the verdict) via a direct PostgREST DELETE.
		const topDog = await makeUser(uniqueHandle('td'));
		const reporter = await makeUser(uniqueHandle('rep'));
		const owner = await makeUser(uniqueHandle('own'));
		const dog = await makeDog(owner.id);
		await report(reporter, dog);
		await crown(topDog.id);
		// not_a_hamburger -> the reporter is branded a LIAR and a verdict exists.
		await topDog.client.rpc('render_burger_verdict', {
			target_dog: dog,
			the_verdict: 'not_a_hamburger'
		});
		expect(await liarRows(reporter.id, dog), 'the reporter is branded before the attack').toBe(1);

		// The branded reporter tries to scrub their own LIAR row.
		await reporter.client.from('hamburger_liars').delete().eq('reporter_id', reporter.id);
		expect(await liarRows(reporter.id, dog), 'a direct DELETE must not scrub the LIAR brand').toBe(
			1
		);

		// The guilty owner tries to delete the verdict on their own dog.
		await owner.client.from('burger_verdicts').delete().eq('hot_dog_id', dog);
		expect(await verdictFor(dog), 'a direct DELETE must not remove the verdict').toBe(
			'not_a_hamburger'
		);
	});

	test('a member cannot forge a HAMBURGER LIAR row by writing hamburger_liars directly', async () => {
		const attacker = await makeUser(uniqueHandle('atk'));
		const victim = await makeUser(uniqueHandle('vic'));
		const owner = await makeUser(uniqueHandle('own'));
		const dog = await makeDog(owner.id);

		const { error } = await attacker.client.from('hamburger_liars').insert({
			reporter_id: victim.id,
			hot_dog_id: dog
		});

		expect(error, 'a direct LIAR insert must be rejected (RPC is the sole writer)').not.toBeNull();
		expect(await liarRows(victim.id, dog), 'no forged LIAR row exists').toBe(0);
	});

	test('not_a_hamburger verdict brands EVERY reporter a HAMBURGER LIAR', async () => {
		const topDog = await makeUser(uniqueHandle('td'));
		const reporterA = await makeUser(uniqueHandle('ra'));
		const reporterB = await makeUser(uniqueHandle('rb'));
		const owner = await makeUser(uniqueHandle('own'));
		const dog = await makeDog(owner.id);

		await report(reporterA, dog);
		await report(reporterB, dog);
		await crown(topDog.id);

		const { error } = await topDog.client.rpc('render_burger_verdict', {
			target_dog: dog,
			the_verdict: 'not_a_hamburger'
		});
		expect(error, 'the Top Dog can render a not_a_hamburger verdict').toBeNull();

		expect(await verdictFor(dog), 'the verdict is recorded').toBe('not_a_hamburger');
		expect(await liarRows(reporterA.id, dog), 'reporter A is branded a LIAR').toBe(1);
		expect(await liarRows(reporterB.id, dog), 'reporter B is branded a LIAR').toBe(1);
		// The OWNER is not a reporter and gets no LIAR brand.
		expect(await liarRows(owner.id, dog), 'the owner is not branded a LIAR').toBe(0);
	});

	test('confirmed_hamburger verdict brands the OWNER a HERETIC (derived) and brands NO reporters', async () => {
		const topDog = await makeUser(uniqueHandle('td'));
		const reporter = await makeUser(uniqueHandle('rep'));
		const owner = await makeUser(uniqueHandle('own'));
		const dog = await makeDog(owner.id);

		await report(reporter, dog);
		await crown(topDog.id);

		const { error } = await topDog.client.rpc('render_burger_verdict', {
			target_dog: dog,
			the_verdict: 'confirmed_hamburger'
		});
		expect(error, 'the Top Dog can render a confirmed_hamburger verdict').toBeNull();

		expect(await verdictFor(dog), 'the verdict is recorded').toBe('confirmed_hamburger');
		// HERETIC is DERIVED: the owner has a dog with a confirmed_hamburger verdict.
		const service = serviceClient();
		const { data: heresy } = await service
			.from('burger_verdicts')
			.select('verdict, hot_dogs!inner(owner_id)')
			.eq('hot_dogs.owner_id', owner.id)
			.eq('verdict', 'confirmed_hamburger');
		expect((heresy ?? []).length, 'the owner is derivably a HERETIC').toBeGreaterThan(0);
		// The reporter, who was RIGHT, is NOT branded a LIAR.
		expect(
			await liarRows(reporter.id, dog),
			'the reporter is not branded a LIAR on a confirm'
		).toBe(0);
	});

	test('re-ruling not_a_hamburger -> confirmed_hamburger clears the stale LIAR brands', async () => {
		const topDog = await makeUser(uniqueHandle('td'));
		const reporter = await makeUser(uniqueHandle('rep'));
		const owner = await makeUser(uniqueHandle('own'));
		const dog = await makeDog(owner.id);

		await report(reporter, dog);
		await crown(topDog.id);

		// First: clear -> reporter branded.
		await topDog.client.rpc('render_burger_verdict', {
			target_dog: dog,
			the_verdict: 'not_a_hamburger'
		});
		expect(await liarRows(reporter.id, dog), 'reporter branded after the clear').toBe(1);

		// Re-rule: confirmed -> the reporter was right after all; clear the brand.
		await topDog.client.rpc('render_burger_verdict', {
			target_dog: dog,
			the_verdict: 'confirmed_hamburger'
		});
		expect(await verdictFor(dog), 'the verdict is updated in place (UNIQUE hot_dog_id)').toBe(
			'confirmed_hamburger'
		);
		expect(await liarRows(reporter.id, dog), 'the stale LIAR brand is cleared on re-rule').toBe(0);
	});

	test('a verdict + LIAR/HERETIC brands are RANKING-INERT (vote_count / peak_votes unchanged)', async () => {
		const topDog = await makeUser(uniqueHandle('td'));
		const reporter = await makeUser(uniqueHandle('rep'));
		const owner = await makeUser(uniqueHandle('own'));
		const dog = await makeDog(owner.id);

		await report(reporter, dog);
		await crown(topDog.id);

		const before = await rankingState(dog);

		await topDog.client.rpc('render_burger_verdict', {
			target_dog: dog,
			the_verdict: 'not_a_hamburger'
		});
		const afterClear = await rankingState(dog);
		expect(afterClear.voteCount, 'a verdict must not change vote_count').toBe(before.voteCount);
		expect(afterClear.peakVotes, 'a verdict must not change peak_votes').toBe(before.peakVotes);

		await topDog.client.rpc('render_burger_verdict', {
			target_dog: dog,
			the_verdict: 'confirmed_hamburger'
		});
		const afterConfirm = await rankingState(dog);
		expect(afterConfirm.voteCount, 'a confirm must not change vote_count').toBe(before.voteCount);
		expect(afterConfirm.peakVotes, 'a confirm must not change peak_votes').toBe(before.peakVotes);
	});

	test('the verdict RPC rejects an invalid verdict value (22023)', async () => {
		const topDog = await makeUser(uniqueHandle('td'));
		const owner = await makeUser(uniqueHandle('own'));
		const dog = await makeDog(owner.id);
		await crown(topDog.id);

		const { error } = await topDog.client.rpc('render_burger_verdict', {
			target_dog: dog,
			the_verdict: 'maybe_a_hamburger'
		});
		expect(error, 'an invalid verdict value is rejected').not.toBeNull();
		expect(error?.code, 'invalid verdict raises invalid_parameter_value (22023)').toBe('22023');
	});

	test('the verdict RPC rejects an unknown dog (P0002)', async () => {
		const topDog = await makeUser(uniqueHandle('td'));
		await crown(topDog.id);

		const { error } = await topDog.client.rpc('render_burger_verdict', {
			target_dog: crypto.randomUUID(),
			the_verdict: 'confirmed_hamburger'
		});
		expect(error, 'an unknown dog is rejected').not.toBeNull();
		expect(error?.code, 'unknown dog raises no_data_found (P0002)').toBe('P0002');
	});

	test('anon (unauthenticated) cannot read burger_verdicts or hamburger_liars (decision #28)', async () => {
		const topDog = await makeUser(uniqueHandle('td'));
		const reporter = await makeUser(uniqueHandle('rep'));
		const owner = await makeUser(uniqueHandle('own'));
		const dog = await makeDog(owner.id);
		await report(reporter, dog);
		await crown(topDog.id);
		await topDog.client.rpc('render_burger_verdict', {
			target_dog: dog,
			the_verdict: 'not_a_hamburger'
		});

		const anon = anonClient();
		const { data: verdicts, error: vErr } = await anon
			.from('burger_verdicts')
			.select('id')
			.eq('hot_dog_id', dog);
		const verdictLeaked = !vErr && (verdicts ?? []).length > 0;
		expect(verdictLeaked, 'anon must not read any burger_verdicts row').toBe(false);

		const { data: liars, error: lErr } = await anon
			.from('hamburger_liars')
			.select('id')
			.eq('hot_dog_id', dog);
		const liarLeaked = !lErr && (liars ?? []).length > 0;
		expect(liarLeaked, 'anon must not read any hamburger_liars row').toBe(false);
	});

	test('anon cannot call the verdict RPC (execute revoked from anon)', async () => {
		const owner = await makeUser(uniqueHandle('own'));
		const dog = await makeDog(owner.id);

		const { error } = await anonClient().rpc('render_burger_verdict', {
			target_dog: dog,
			the_verdict: 'confirmed_hamburger'
		});
		expect(error, 'anon must not be able to call the verdict RPC').not.toBeNull();
	});
});
