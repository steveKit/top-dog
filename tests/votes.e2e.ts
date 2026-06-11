import { expect, test } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getLocalStackCreds } from './helpers/local-stack';

// TASK-021 live-DB coverage for the consuming-write vote RPCs (cast_vote /
// remove_vote), the reviewer-requested counterpart to the mocked unit tests in
// src/lib/features/voting/votes.test.ts. We go DIRECTLY to PostgREST as
// authenticated members (publishable key + a signed-in user's JWT) and exercise
// the RPCs against the LOCAL Postgres — the same live-DB pattern as
// db-guards.e2e.ts.
//
// Why a service client too: the test SETUP (creating users + their profiles +
// hot dogs) and the AUTHORITATIVE counter reads (COUNT(votes), vote_count,
// is_current_top_dog/top_dog_since) run with the service role so they bypass RLS
// and the column grants — we are asserting the DB's invariants, not exercising
// the write grants. Only the vote RPC CALLS run as authenticated users. The
// service key stays Node/server-side; it is never handed to a browser context.
//
// Tagged @security (NOT @smoke) so `--grep @smoke` does not select these. Runs
// against the LOCAL stack via the non-localhost-guarded helper; no app server.

const creds = getLocalStackCreds();

/** Service-role client: bypasses RLS for setup + authoritative reads. */
function serviceClient(): SupabaseClient {
	return createClient(creds.apiUrl, creds.secretKey, {
		auth: { autoRefreshToken: false, persistSession: false }
	});
}

/** A test user: their auth id + an authenticated-role client (their own JWT). */
interface TestUser {
	id: string;
	client: SupabaseClient;
}

/**
 * Creates an auth user, a matching profile row (hot_dogs.owner_id references
 * profiles), signs them in with the publishable key, and returns an
 * authenticated-role client holding their JWT — exactly what a browser carries.
 */
async function makeUser(handle: string): Promise<TestUser> {
	const service = serviceClient();
	const email = `vote-${handle}-${Date.now().toString(36)}@topdog.test`;
	const password = 'vote-test-password-123';

	const { data: created, error: createError } = await service.auth.admin.createUser({
		email,
		password,
		email_confirm: true
	});
	if (createError || !created.user) {
		throw new Error(`Could not create test user ${handle}: ${createError?.message}`);
	}
	const id = created.user.id;

	// hot_dogs.owner_id -> profiles(id), so every dog owner needs a profile.
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
 * Inserts a hot dog for `owner` using the service client (bypasses the column
 * grants — we are seeding fixtures, not testing the insert path). Returns the
 * new dog id. `id` may be pinned so id tie-break ordering is deterministic.
 */
async function makeDog(ownerId: string, id?: string): Promise<string> {
	const service = serviceClient();
	const dogId = id ?? crypto.randomUUID();
	const { error } = await service.from('hot_dogs').insert({
		id: dogId,
		owner_id: ownerId,
		image_path: `${ownerId}/${dogId}.webp`,
		byte_size: 10,
		caption: 'fixture dog'
	});
	if (error) {
		throw new Error(`Could not insert fixture dog: ${error.message}`);
	}
	return dogId;
}

/** Authoritative vote_count for a dog, read with the service client. */
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

/** The live COUNT(votes) for a dog — the ground truth vote_count must equal. */
async function liveVoteRows(dogId: string): Promise<number> {
	const service = serviceClient();
	const { count, error } = await service
		.from('votes')
		.select('id', { count: 'exact', head: true })
		.eq('hot_dog_id', dogId);
	if (error) {
		throw new Error(`Could not count votes for ${dogId}: ${error.message}`);
	}
	return count ?? 0;
}

/** A profile's crown state, read with the service client. */
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

/** Asserts vote_count equals the live COUNT(votes) — no drift. */
async function expectNoDrift(dogId: string): Promise<void> {
	const [count, rows] = await Promise.all([voteCount(dogId), liveVoteRows(dogId)]);
	expect(count, `vote_count must equal live COUNT(votes) for dog ${dogId}`).toBe(rows);
}

// A unique handle suffix per spec keeps reruns from colliding on handle/profile
// uniqueness. Handles are limited to 2..32 chars; keep them short.
let seq = 0;
function uniqueHandle(prefix: string): string {
	seq += 1;
	return `${prefix}${Date.now().toString(36).slice(-4)}${seq}`.slice(0, 32);
}

test.describe('@security vote RPC: cast / move / remove / counter (direct PostgREST)', () => {
	test('cast — a user votes for another user’s dog, vote_count becomes 1', async () => {
		const owner = await makeUser(uniqueHandle('own'));
		const voter = await makeUser(uniqueHandle('vot'));
		const dog = await makeDog(owner.id);

		const { data, error } = await voter.client.rpc('cast_vote', { target_dog: dog });

		expect(error, 'casting for another user’s dog should succeed').toBeNull();
		expect(data, 'cast_vote returns the vote id').toBeTruthy();
		expect(await voteCount(dog)).toBe(1);
		await expectNoDrift(dog);
	});

	test('move — re-casting onto a different dog moves the SAME vote row; old→0, new→1', async () => {
		const owner = await makeUser(uniqueHandle('own'));
		const voter = await makeUser(uniqueHandle('vot'));
		const dogA = await makeDog(owner.id);
		const dogB = await makeDog(owner.id);

		const first = await voter.client.rpc('cast_vote', { target_dog: dogA });
		expect(first.error).toBeNull();
		const firstVoteId = first.data as string;
		expect(await voteCount(dogA)).toBe(1);

		const second = await voter.client.rpc('cast_vote', { target_dog: dogB });
		expect(second.error).toBeNull();

		// UNIQUE(voter_id): the single vote row was re-pointed, not duplicated —
		// same vote id comes back.
		expect(second.data, 'move keeps the same vote id (row moved, not re-inserted)').toBe(
			firstVoteId
		);
		expect(await voteCount(dogA), 'old dog drops to 0').toBe(0);
		expect(await voteCount(dogB), 'new dog rises to 1').toBe(1);
		await expectNoDrift(dogA);
		await expectNoDrift(dogB);
	});

	test('remove — remove_vote deletes the vote and vote_count returns to 0', async () => {
		const owner = await makeUser(uniqueHandle('own'));
		const voter = await makeUser(uniqueHandle('vot'));
		const dog = await makeDog(owner.id);

		await voter.client.rpc('cast_vote', { target_dog: dog });
		expect(await voteCount(dog)).toBe(1);

		const { data, error } = await voter.client.rpc('remove_vote');
		expect(error, 'remove_vote should succeed').toBeNull();
		expect(data, 'remove_vote returns the hot_dog_id it removed from').toBe(dog);

		expect(await voteCount(dog)).toBe(0);
		expect(await liveVoteRows(dog), 'the vote row is gone').toBe(0);
		await expectNoDrift(dog);
	});

	test('self-vote rejected — voting for your OWN dog is refused (SQLSTATE 23514)', async () => {
		const owner = await makeUser(uniqueHandle('own'));
		const dog = await makeDog(owner.id);

		const { error } = await owner.client.rpc('cast_vote', { target_dog: dog });

		expect(error, 'self-vote must be rejected').not.toBeNull();
		expect(error?.code, 'self-vote raises check_violation 23514').toBe('23514');
		expect(await voteCount(dog), 'a rejected self-vote leaves the count at 0').toBe(0);
		await expectNoDrift(dog);
	});

	test('one-vote-per-user — vote_count tracks live COUNT(votes) across cast/move/remove', async () => {
		const owner = await makeUser(uniqueHandle('own'));
		const v1 = await makeUser(uniqueHandle('va'));
		const v2 = await makeUser(uniqueHandle('vb'));
		const dogA = await makeDog(owner.id);
		const dogB = await makeDog(owner.id);

		// Two distinct voters on dogA.
		await v1.client.rpc('cast_vote', { target_dog: dogA });
		await v2.client.rpc('cast_vote', { target_dog: dogA });
		expect(await voteCount(dogA)).toBe(2);
		await expectNoDrift(dogA);

		// v1 re-casts on dogA (idempotent no-op): still one active vote each.
		await v1.client.rpc('cast_vote', { target_dog: dogA });
		expect(await voteCount(dogA), 're-casting on the same dog is a no-op').toBe(2);
		await expectNoDrift(dogA);

		// v1 moves to dogB: dogA→1, dogB→1.
		await v1.client.rpc('cast_vote', { target_dog: dogB });
		expect(await voteCount(dogA)).toBe(1);
		expect(await voteCount(dogB)).toBe(1);
		await expectNoDrift(dogA);
		await expectNoDrift(dogB);

		// v2 removes: dogA→0.
		await v2.client.rpc('remove_vote');
		expect(await voteCount(dogA)).toBe(0);
		await expectNoDrift(dogA);
		await expectNoDrift(dogB);
	});
});

// The Top Dog crown is a GLOBAL singleton: exactly one profile holds it across
// the whole DB, and recompute_top_dog ranks EVERY eligible dog, not just this
// test's. Other @security specs (and prior runs on a non-reset DB) leave dogs at
// low vote_counts and a sticky incumbent behind. So these crown tests cannot
// assume a globally-clean field — instead each makes its OWN contender DOMINATE
// the global field with a clear vote-count lead (a small voter pool), then
// asserts the crown lands on / moves between the test's own owners. The tie-break
// tests construct an exact vote_count TIE between the test's two owners that ALSO
// out-votes the rest of the field, so the tie is the global deciding tie.

/** Creates `n` distinct authenticated voters. */
async function makeVoters(prefix: string, n: number): Promise<TestUser[]> {
	const voters: TestUser[] = [];
	for (let i = 0; i < n; i += 1) {
		voters.push(await makeUser(uniqueHandle(prefix)));
	}
	return voters;
}

/** Casts every voter's vote onto `dog` (sequentially — each is a separate user). */
async function allVoteFor(voters: TestUser[], dog: string): Promise<void> {
	for (const v of voters) {
		const { error } = await v.client.rpc('cast_vote', { target_dog: dog });
		if (error) {
			throw new Error(`cast_vote failed for a pooled voter: ${error.message}`);
		}
	}
}

// The crown field is GLOBAL, so these tests must START from a known-empty field
// to reason about an absolute crown. We clear all vote rows and crown flags with
// the service client before each crown test. Deleting votes does NOT auto-recompute
// counters (no delete trigger), so we also zero vote_count/peak_votes and clear
// is_current_top_dog/top_dog_since directly — putting the whole DB at "no votes,
// no crown" so the next cast_vote crowns from cold deterministically. This touches
// rows created by sibling specs, which is acceptable: each crown test owns the
// global crown for its duration and the specs assert only their own owners.
async function resetCrownField(): Promise<void> {
	const service = serviceClient();
	// Delete every vote (neq a never-matching uuid => match-all delete).
	const { error: delErr } = await service
		.from('votes')
		.delete()
		.neq('id', '00000000-0000-0000-0000-000000000000');
	if (delErr) {
		throw new Error(`resetCrownField: could not clear votes: ${delErr.message}`);
	}
	const { error: dogErr } = await service
		.from('hot_dogs')
		.update({ vote_count: 0, peak_votes: 0 })
		.neq('id', '00000000-0000-0000-0000-000000000000');
	if (dogErr) {
		throw new Error(`resetCrownField: could not zero counters: ${dogErr.message}`);
	}
	const { error: crownErr } = await service
		.from('profiles')
		.update({ is_current_top_dog: false, top_dog_since: null })
		.neq('id', '00000000-0000-0000-0000-000000000000');
	if (crownErr) {
		throw new Error(`resetCrownField: could not clear crowns: ${crownErr.message}`);
	}
}

// A lead that cleanly crowns from the cold (post-reset) field. With LEAD voters
// all on one dog, that dog's owner is the unambiguous global Top Dog.
const LEAD = 3;

test.describe('@security vote RPC: crown handoff + tie-breaks (direct PostgREST)', () => {
	// Each crown test reasons about the ABSOLUTE global crown, so start cold.
	test.beforeEach(async () => {
		await resetCrownField();
	});

	test('crown handoff — overtaking on vote_count moves the crown to the new owner', async () => {
		const ownerA = await makeUser(uniqueHandle('ca'));
		const ownerB = await makeUser(uniqueHandle('cb'));
		const voters = await makeVoters('cv', LEAD);
		const dogA = await makeDog(ownerA.id);
		const dogB = await makeDog(ownerB.id);

		// ownerA dominates the global field first → ownerA is Top Dog.
		await allVoteFor(voters, dogA);
		expect(await voteCount(dogA)).toBe(LEAD);
		const aState = await crownState(ownerA.id);
		expect(aState.isTopDog, 'the dominant leader holds the crown').toBe(true);
		expect(aState.topDogSince, 'crowned owner has a top_dog_since timestamp').toBeTruthy();
		expect((await crownState(ownerB.id)).isTopDog).toBe(false);

		// Every voter MOVES to dogB → dogA drops to 0, dogB takes the lead → handoff.
		await allVoteFor(voters, dogB);
		expect(await voteCount(dogB)).toBe(LEAD);
		expect(await voteCount(dogA)).toBe(0);

		const bState = await crownState(ownerB.id);
		expect(bState.isTopDog, 'the overtaker becomes Top Dog').toBe(true);
		expect(bState.topDogSince, 'new reign gets a fresh top_dog_since').toBeTruthy();

		const aAfter = await crownState(ownerA.id);
		expect(aAfter.isTopDog, 'previous holder is cleared').toBe(false);
		expect(aAfter.topDogSince, 'previous holder’s top_dog_since is cleared').toBeNull();
	});

	test('sticky tie-break (null-last) — incumbent KEEPS the crown over a never-crowned challenger on a tie', async () => {
		const incumbent = await makeUser(uniqueHandle('si'));
		const challenger = await makeUser(uniqueHandle('sc'));
		const incVoters = await makeVoters('siv', LEAD);
		const chalVoters = await makeVoters('scv', LEAD);
		const dogInc = await makeDog(incumbent.id);
		const dogChal = await makeDog(challenger.id);

		// Incumbent dominates the global field first → takes the crown (non-null
		// top_dog_since). LEAD votes clears any leftover field, so the crown is
		// unambiguously the incumbent's before the tie is constructed.
		await allVoteFor(incVoters, dogInc);
		const incState = await crownState(incumbent.id);
		expect(incState.isTopDog, 'incumbent takes the crown by dominating the field').toBe(true);
		const stickySince = incState.topDogSince;
		expect(stickySince).toBeTruthy();

		// Challenger TIES the incumbent on vote_count (same LEAD count) — and this is
		// the GLOBAL top vote_count, so the tie is the deciding one. The challenger's
		// owner has NEVER held the crown → top_dog_since NULL → sorts LAST. The
		// incumbent's earlier non-null top_dog_since wins the tie: crown stays put.
		await allVoteFor(chalVoters, dogChal);
		expect(await voteCount(dogInc)).toBe(LEAD);
		expect(await voteCount(dogChal)).toBe(LEAD);

		const incAfter = await crownState(incumbent.id);
		expect(incAfter.isTopDog, 'incumbent keeps the crown on a tie (sticky null-last)').toBe(true);
		expect(
			incAfter.topDogSince,
			'a sticky reign preserves the SAME top_dog_since (no fresh now())'
		).toBe(stickySince);
		expect(
			(await crownState(challenger.id)).isTopDog,
			'a never-crowned (null since) challenger does not displace the incumbent'
		).toBe(false);
	});

	test('id tie-break — stickiness (top_dog_since) is evaluated BEFORE hot_dogs.id', async () => {
		// The pure selectTopDog id tie-break is the FINAL determinant — it fires only
		// when vote_count ties AND top_dog_since is equal. Through the RPC a true
		// both-null tie cannot persist: the recompute that first sees an eligible dog
		// crowns its leader, stamping a non-null top_dog_since before any tie forms.
		// So the observable lockstep is the ORDERING of the tie-break keys: stickiness
		// is applied BEFORE id. We prove it by giving the INCUMBENT the
		// lexicographically-HIGHER dog id, then having the LOWER-id challenger tie on
		// vote_count. If id ranked before stickiness, the lower-id challenger would
		// steal the crown; it must not — stickiness (evaluated first) keeps the
		// incumbent.
		const ownerLow = await makeUser(uniqueHandle('il'));
		const ownerHigh = await makeUser(uniqueHandle('ih'));
		const highVoters = await makeVoters('ihv', LEAD);
		const lowVoters = await makeVoters('ilv', LEAD);

		// Pinned ids: dogLow ('0...') sorts lexicographically before dogHigh ('f...').
		const dogLow = await makeDog(ownerLow.id, '00000000-0000-4000-8000-000000000001');
		const dogHigh = await makeDog(ownerHigh.id, 'ffffffff-ffff-4fff-bfff-ffffffffffff');

		// Incumbent owns the HIGHER-id dog and dominates the field first → crowned.
		await allVoteFor(highVoters, dogHigh);
		const highState = await crownState(ownerHigh.id);
		expect(highState.isTopDog, 'higher-id incumbent takes the crown first').toBe(true);
		const incumbentSince = highState.topDogSince;
		expect(incumbentSince).toBeTruthy();

		// The LOWER-id dog ties on vote_count (same LEAD, the global top). If id were
		// applied BEFORE stickiness, dogLow (lower id) would win — it must NOT.
		await allVoteFor(lowVoters, dogLow);
		expect(await voteCount(dogLow)).toBe(LEAD);
		expect(await voteCount(dogHigh)).toBe(LEAD);

		const incAfter = await crownState(ownerHigh.id);
		expect(
			incAfter.isTopDog,
			'stickiness is evaluated BEFORE id: incumbent keeps the crown despite the challenger holding the lower hot_dogs.id'
		).toBe(true);
		expect(incAfter.topDogSince, 'sticky reign preserves its top_dog_since').toBe(incumbentSince);
		expect(
			(await crownState(ownerLow.id)).isTopDog,
			'the lower-id challenger does NOT steal the crown — id is the LAST tie-break, not the first'
		).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// TASK-021 — RPC EXECUTE-permission guards (direct PostgREST)
//
// The reviewer found that the helper-RPC EXECUTE revokes were ineffective: a
// bare `revoke ... from public` does NOT strip the explicit anon/authenticated
// grants Supabase adds to new public functions, so recompute_top_dog() /
// recompute_vote_count(uuid) were still client-callable. The migration now
// revokes EXECUTE from `public, anon, authenticated` on both helpers, and from
// `public, anon` on the vote RPCs (granting EXECUTE to `authenticated` only).
//
// These tests prove the grant surface holds at the EXECUTE-permission layer:
//   - the two private helpers reject a direct authenticated (and anon) call
//     with 42501 insufficient_privilege — they are no longer client-callable.
//   - cast_vote rejects an ANON caller with 42501 at the grant layer — distinct
//     from the authenticated paths above (self-vote 23514, success, etc.) and
//     from the function's internal null-auth 28000 (the grant fires first, so
//     anon never reaches the function body).
// Tagged @security. Pure PostgREST, LOCAL stack.
test.describe('@security RPC EXECUTE-permission guards (direct PostgREST)', () => {
	/** Anon (unauthenticated) client: publishable key, no JWT. */
	function anonClient(): SupabaseClient {
		return createClient(creds.apiUrl, creds.publishableKey, {
			auth: { autoRefreshToken: false, persistSession: false }
		});
	}

	test('recompute_top_dog() is NOT callable by an authenticated client (42501)', async () => {
		const member = await makeUser(uniqueHandle('rt'));
		const { error } = await member.client.rpc('recompute_top_dog');

		expect(error, 'a private helper must not be client-callable').not.toBeNull();
		expect(error?.code, 'EXECUTE revoke raises insufficient_privilege 42501').toBe('42501');
	});

	test('recompute_top_dog() is NOT callable by an anon client (42501)', async () => {
		const { error } = await anonClient().rpc('recompute_top_dog');

		expect(error, 'a private helper must not be anon-callable').not.toBeNull();
		expect(error?.code, 'EXECUTE revoke raises insufficient_privilege 42501').toBe('42501');
	});

	test('recompute_vote_count(uuid) is NOT callable by an authenticated client (42501)', async () => {
		const member = await makeUser(uniqueHandle('rv'));
		const { error } = await member.client.rpc('recompute_vote_count', {
			dog_id: crypto.randomUUID()
		});

		expect(error, 'a private helper must not be client-callable').not.toBeNull();
		expect(error?.code, 'EXECUTE revoke raises insufficient_privilege 42501').toBe('42501');
	});

	test('recompute_vote_count(uuid) is NOT callable by an anon client (42501)', async () => {
		const { error } = await anonClient().rpc('recompute_vote_count', {
			dog_id: crypto.randomUUID()
		});

		expect(error, 'a private helper must not be anon-callable').not.toBeNull();
		expect(error?.code, 'EXECUTE revoke raises insufficient_privilege 42501').toBe('42501');
	});

	test('cast_vote — an ANON caller is rejected at the EXECUTE-permission layer (42501)', async () => {
		// EXECUTE on cast_vote is granted to `authenticated` only; anon was revoked.
		// So an anon call is refused by the grant (42501) BEFORE the function's own
		// null-auth 28000 — the grant is the primary gate.
		const { error } = await anonClient().rpc('cast_vote', { target_dog: crypto.randomUUID() });

		expect(error, 'anon must not be able to call cast_vote').not.toBeNull();
		expect(error?.code, 'anon cast_vote is refused by the EXECUTE grant (42501)').toBe('42501');
	});

	test('remove_vote — an ANON caller is rejected at the EXECUTE-permission layer (42501)', async () => {
		const { error } = await anonClient().rpc('remove_vote');

		expect(error, 'anon must not be able to call remove_vote').not.toBeNull();
		expect(error?.code, 'anon remove_vote is refused by the EXECUTE grant (42501)').toBe('42501');
	});
});
