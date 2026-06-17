import { expect, test } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getLocalStackCreds } from './helpers/local-stack';

// TASK-050 live-DB coverage for profile message WALLS (cosmetic/many-allowed,
// decision #12/#15: flair only — no denormalized counter, never touches the
// crown/ranking). We go DIRECTLY to PostgREST as authenticated members
// (publishable key + a signed-in user's JWT) against the LOCAL Postgres — the same
// live-DB pattern as reactions.e2e.ts / mustard.e2e.ts.
//
// These tests prove the DB-authoritative RLS guarantees the mocked unit tests
// cannot reach:
//   1. INSERT author-pin: a member CAN post on ANOTHER member's wall, but author_id
//      is pinned to auth.uid() — a forged author_id (!= caller) is rejected by the
//      INSERT WITH CHECK (42501).
//   2. DELETE author-or-owner: the message AUTHOR may delete their own message; the
//      WALL OWNER may delete a message left on their wall; a THIRD PARTY (neither)
//      cannot (RLS makes their delete affect zero rows — no error, but no removal).
//   3. Body is stored VERBATIM — no server-side transformation of the original text.
//   4. UPDATE is default-denied (no UPDATE policy) — messages are immutable.
//
// The service-role client is used ONLY for setup (users + profiles) and
// authoritative read-backs — it bypasses RLS, which is the point of the read-back.
// The INSERT/DELETE/UPDATE under test run as the authenticated members. The service
// key stays Node/server-side; never handed to a browser context.
//
// Tagged @security (NOT @smoke). Pure PostgREST, LOCAL stack, no app server. Walls
// touch no global singleton (crown/votes), but the suite keeps the workers:1
// project default — the shared local Postgres is the only datastore.

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
	const email = `wall-${handle}-${Date.now().toString(36)}@topdog.test`;
	const password = 'wall-test-password-123';

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

/** Authoritative wall-message rows for a target profile, read with the service client. */
async function messagesFor(profileId: string): Promise<
	{
		id: string;
		profile_id: string;
		author_id: string;
		body: string;
		created_at: string;
	}[]
> {
	const service = serviceClient();
	const { data, error } = await service
		.from('wall_messages')
		.select('id, profile_id, author_id, body, created_at')
		.eq('profile_id', profileId);
	if (error) {
		throw new Error(`Could not read wall messages for ${profileId}: ${error.message}`);
	}
	return data ?? [];
}

/** Inserts a message authored by `author` on `wallOwner`'s wall (service client); returns id. */
async function seedMessage(authorId: string, wallOwnerId: string, body: string): Promise<string> {
	const service = serviceClient();
	const id = crypto.randomUUID();
	const { error } = await service
		.from('wall_messages')
		.insert({ id, author_id: authorId, profile_id: wallOwnerId, body });
	if (error) {
		throw new Error(`Could not seed wall message: ${error.message}`);
	}
	return id;
}

test.describe('@security wall_messages: author-pin INSERT + author-or-owner DELETE RLS (direct PostgREST)', () => {
	test('a member CAN post on ANOTHER member’s wall (author pinned to themselves)', async () => {
		const poster = await makeUser(uniqueHandle('po'));
		const wallOwner = await makeUser(uniqueHandle('wo'));

		const { error } = await poster.client.from('wall_messages').insert({
			author_id: poster.id,
			profile_id: wallOwner.id,
			body: 'Welcome to my note on your wall!'
		});

		expect(error, 'posting on another member’s wall (self-authored) must succeed').toBeNull();

		const rows = await messagesFor(wallOwner.id);
		expect(rows, 'exactly one message landed on the wall').toHaveLength(1);
		expect(rows[0].author_id).toBe(poster.id);
		expect(rows[0].profile_id).toBe(wallOwner.id);
	});

	test('a forged author_id (!= auth.uid()) is rejected by the INSERT WITH CHECK (42501)', async () => {
		const attacker = await makeUser(uniqueHandle('atk'));
		const victim = await makeUser(uniqueHandle('vic'));
		const wallOwner = await makeUser(uniqueHandle('wo'));

		// The attacker tries to stamp the message as if the VICTIM authored it. The
		// `author_id = (select auth.uid())` check rejects it — auth.uid() is the
		// attacker, not the victim.
		const { error } = await attacker.client.from('wall_messages').insert({
			author_id: victim.id,
			profile_id: wallOwner.id,
			body: 'definitely the victim wrote this'
		});

		expect(error, 'forging another author_id must be rejected by RLS').not.toBeNull();
		expect(error?.code, 'the INSERT WITH-CHECK denial surfaces as 42501').toBe('42501');

		expect(await messagesFor(wallOwner.id), 'no forged message row exists').toHaveLength(0);
	});

	test('the message AUTHOR can delete their OWN message', async () => {
		const author = await makeUser(uniqueHandle('au'));
		const wallOwner = await makeUser(uniqueHandle('wo'));
		const messageId = await seedMessage(author.id, wallOwner.id, 'I will delete this myself');

		const { error } = await author.client.from('wall_messages').delete().eq('id', messageId);

		expect(error, 'the author deleting their own message must succeed').toBeNull();
		expect(await messagesFor(wallOwner.id), 'the author’s message is gone').toHaveLength(0);
	});

	test('the WALL OWNER can delete a message left on their wall by someone else', async () => {
		const author = await makeUser(uniqueHandle('au'));
		const wallOwner = await makeUser(uniqueHandle('wo'));
		const messageId = await seedMessage(author.id, wallOwner.id, 'left on your wall');

		// The wall owner moderates their own wall: profile_id = auth.uid() satisfies
		// the DELETE policy's disjunction even though they are not the author.
		const { error } = await wallOwner.client.from('wall_messages').delete().eq('id', messageId);

		expect(error, 'the wall owner deleting a message on their wall must succeed').toBeNull();
		expect(await messagesFor(wallOwner.id), 'the moderated message is gone').toHaveLength(0);
	});

	test('a THIRD PARTY (neither author nor wall owner) CANNOT delete a message', async () => {
		const author = await makeUser(uniqueHandle('au'));
		const wallOwner = await makeUser(uniqueHandle('wo'));
		const thirdParty = await makeUser(uniqueHandle('tp'));
		const messageId = await seedMessage(author.id, wallOwner.id, 'not yours to delete');

		// RLS makes a delete the caller isn't allowed to make affect ZERO rows — it
		// is not an error in PostgREST, but the row must remain.
		const { error } = await thirdParty.client.from('wall_messages').delete().eq('id', messageId);

		expect(error, 'an unauthorized delete is a no-op (zero rows), not an error').toBeNull();

		const rows = await messagesFor(wallOwner.id);
		expect(rows, 'the message survives the unauthorized delete').toHaveLength(1);
		expect(rows[0].id).toBe(messageId);
	});

	test('the original body is stored VERBATIM (no server-side transformation)', async () => {
		const poster = await makeUser(uniqueHandle('po'));
		const wallOwner = await makeUser(uniqueHandle('wo'));
		// Internal whitespace, emoji, and newlines must survive untouched — M6 applies
		// a RENDER-time filter, never persists a transformed body.
		const original = 'Hot  dog 🌭\nwith  mustard 🟡 & relish';

		const { error } = await poster.client.from('wall_messages').insert({
			author_id: poster.id,
			profile_id: wallOwner.id,
			body: original
		});
		expect(error, 'the verbatim-body insert should succeed').toBeNull();

		const rows = await messagesFor(wallOwner.id);
		expect(rows, 'the message landed').toHaveLength(1);
		expect(rows[0].body, 'the body is stored byte-for-byte, untransformed').toBe(original);
	});

	test('UPDATE is blocked — no UPDATE grant means hard permission-denied (message is immutable)', async () => {
		const author = await makeUser(uniqueHandle('au'));
		const wallOwner = await makeUser(uniqueHandle('wo'));
		const messageId = await seedMessage(author.id, wallOwner.id, 'original immutable body');

		// Even the AUTHOR cannot edit: authenticated has NO base UPDATE grant on
		// wall_messages, so the attempt is rejected at the GRANT layer (Postgres
		// 42501 permission denied) BEFORE RLS is ever consulted. This is stronger
		// than an RLS-filtered zero-row no-op — the write never reaches a policy.
		const { error } = await author.client
			.from('wall_messages')
			.update({ body: 'edited!' })
			.eq('id', messageId);

		// Match on the SQLSTATE code, not the human-readable message (which can change).
		expect(error, 'a blocked update is rejected, not silently ignored').not.toBeNull();
		expect(error?.code, 'UPDATE is denied at the grant layer (42501 permission denied)').toBe(
			'42501'
		);

		const rows = await messagesFor(wallOwner.id);
		expect(rows, 'the message still exists').toHaveLength(1);
		expect(rows[0].body, 'the body was NOT mutated — UPDATE is permission-denied').toBe(
			'original immutable body'
		);
	});
});
