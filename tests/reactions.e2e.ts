import { expect, test } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getLocalStackCreds } from './helpers/local-stack';

// TASK-030 live-DB coverage for cosmetic hot-dog reactions (decision #12: flair
// only — VOTE drives ranking, REACTION never does). We go DIRECTLY to PostgREST
// as authenticated members (publishable key + a signed-in user's JWT) against the
// LOCAL Postgres — the same live-DB pattern as db-guards.e2e.ts / votes.e2e.ts.
//
// These tests prove the two DB-authoritative invariants the mocked unit tests
// cannot reach:
//   1. Owner-scoped INSERT RLS: a member CANNOT forge a reaction as another
//      user — `with check ((select auth.uid()) = user_id)` rejects a row whose
//      user_id is not the caller. Inserting your OWN reaction succeeds.
//   2. Reactions never touch ranking: inserting AND deleting a reaction on a dog
//      leaves that dog's vote_count (and peak_votes) unchanged — there is no
//      denormalized reaction counter and no trigger onto the vote columns.
//
// Service-role client is used ONLY for setup (users + profiles + dogs) and
// authoritative read-backs (vote_count) — it bypasses RLS, which is the point of
// the read-back. The reaction INSERT/DELETE under test run as authenticated users.
// The service key stays Node/server-side; never handed to a browser context.
//
// Tagged @security (NOT @smoke). Pure PostgREST, LOCAL stack, no app server.

const creds = getLocalStackCreds();

/** Service-role client: bypasses RLS for setup + authoritative reads. */
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
	const email = `react-${handle}-${Date.now().toString(36)}@topdog.test`;
	const password = 'react-test-password-123';

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

/** Inserts a hot dog for `ownerId` with the service client; returns the dog id. */
async function makeDog(ownerId: string): Promise<string> {
	const service = serviceClient();
	const dogId = crypto.randomUUID();
	const { error } = await service.from('hot_dogs').insert({
		id: dogId,
		owner_id: ownerId,
		image_path: `${ownerId}/${dogId}.webp`,
		byte_size: 10,
		caption: 'reaction fixture dog'
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

test.describe('@security hotdog_reactions: owner-scoped RLS + no ranking effect (direct PostgREST)', () => {
	test('a member cannot forge a reaction as another user (owner-scoped INSERT RLS)', async () => {
		const attacker = await makeUser(uniqueHandle('atk'));
		const victim = await makeUser(uniqueHandle('vic'));
		const owner = await makeUser(uniqueHandle('own'));
		const dog = await makeDog(owner.id);

		// The attacker tries to insert a reaction stamped with the VICTIM's user_id.
		// `with check ((select auth.uid()) = user_id)` must reject it — auth.uid()
		// is the attacker, not the victim.
		const { error } = await attacker.client.from('hotdog_reactions').insert({
			user_id: victim.id,
			hot_dog_id: dog,
			emoji: '🌭'
		});

		expect(error, 'forging a reaction as another user must be rejected by RLS').not.toBeNull();

		// And no forged row exists.
		const service = serviceClient();
		const { data: rows } = await service
			.from('hotdog_reactions')
			.select('id')
			.eq('user_id', victim.id)
			.eq('hot_dog_id', dog);
		expect(rows ?? [], 'the rejected insert created no reaction row').toHaveLength(0);
	});

	test('a member CAN insert their OWN reaction (user_id = auth.uid())', async () => {
		const reactor = await makeUser(uniqueHandle('rct'));
		const owner = await makeUser(uniqueHandle('own'));
		const dog = await makeDog(owner.id);

		const { error } = await reactor.client.from('hotdog_reactions').insert({
			user_id: reactor.id,
			hot_dog_id: dog,
			emoji: '🔥'
		});

		expect(error, 'a self-owned reaction insert must succeed under RLS').toBeNull();
	});

	test('inserting AND deleting a reaction does NOT change the dog vote_count / peak_votes', async () => {
		const reactor = await makeUser(uniqueHandle('rct'));
		const owner = await makeUser(uniqueHandle('own'));
		const dog = await makeDog(owner.id);

		const before = await rankingState(dog);

		// Insert a reaction.
		const ins = await reactor.client.from('hotdog_reactions').insert({
			user_id: reactor.id,
			hot_dog_id: dog,
			emoji: '😂'
		});
		expect(ins.error, 'self-owned reaction insert should succeed').toBeNull();

		const afterInsert = await rankingState(dog);
		expect(afterInsert.voteCount, 'a reaction must not change vote_count').toBe(before.voteCount);
		expect(afterInsert.peakVotes, 'a reaction must not change peak_votes').toBe(before.peakVotes);

		// Delete the reaction (the un-react half of the toggle).
		const del = await reactor.client
			.from('hotdog_reactions')
			.delete()
			.eq('user_id', reactor.id)
			.eq('hot_dog_id', dog)
			.eq('emoji', '😂');
		expect(del.error, 'self-owned reaction delete should succeed').toBeNull();

		const afterDelete = await rankingState(dog);
		expect(afterDelete.voteCount, 'un-reacting must not change vote_count').toBe(before.voteCount);
		expect(afterDelete.peakVotes, 'un-reacting must not change peak_votes').toBe(before.peakVotes);
	});

	test('UNIQUE(user_id, hot_dog_id, emoji) gives per-emoji toggle while allowing MANY emojis', async () => {
		const reactor = await makeUser(uniqueHandle('rct'));
		const owner = await makeUser(uniqueHandle('own'));
		const dog = await makeDog(owner.id);

		// Same emoji twice → the second is a unique violation (23505): toggle per emoji.
		const first = await reactor.client
			.from('hotdog_reactions')
			.insert({ user_id: reactor.id, hot_dog_id: dog, emoji: '🌭' });
		expect(first.error, 'first reaction with an emoji should succeed').toBeNull();

		const dup = await reactor.client
			.from('hotdog_reactions')
			.insert({ user_id: reactor.id, hot_dog_id: dog, emoji: '🌭' });
		expect(dup.error?.code, 'a duplicate (user, dog, emoji) raises unique_violation 23505').toBe(
			'23505'
		);

		// A DIFFERENT emoji from the same user on the same dog is allowed (decision
		// #12 "many DIFFERENT emojis").
		const other = await reactor.client
			.from('hotdog_reactions')
			.insert({ user_id: reactor.id, hot_dog_id: dog, emoji: '❤️' });
		expect(other.error, 'a different emoji on the same dog must be allowed').toBeNull();
	});
});
