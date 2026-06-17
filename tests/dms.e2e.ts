import { expect, test } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getLocalStackCreds } from './helpers/local-stack';

// TASK-051 live-DB coverage for DIRECT MESSAGES. DMs are a PRIVACY surface (NOT a
// cosmetic one): the load-bearing control is the SELECT RLS — ONLY the sender or
// the recipient may read a row, so a THIRD party can never read others' DMs. We go
// DIRECTLY to PostgREST as authenticated members (publishable key + a signed-in
// user's JWT) against the LOCAL Postgres — the same live-DB pattern as
// walls.e2e.ts / mustard.e2e.ts.
//
// These tests prove the DB-authoritative RLS + column-grant guarantees the mocked
// unit tests cannot reach:
//   1. A member CAN send a DM (sender_id pinned to auth.uid()).
//   2. A FORGED sender_id (!= caller) is rejected by the INSERT WITH CHECK /
//      sender-pin (42501).
//   3. PRIVACY (critical): both the SENDER and the RECIPIENT can read the DM, but a
//      THIRD party CANNOT — their SELECT returns ZERO rows.
//   4. The RECIPIENT can set read_at (mark read).
//   5. The SENDER CANNOT update read_at (UPDATE RLS is recipient-only) — zero-row
//      no-op, the row is unchanged.
//   6. The RECIPIENT CANNOT rewrite body — the `grant update (read_at)` column
//      lockdown rejects an UPDATE touching body (column-privilege error, 42501).
//   7. The sender CANNOT pre-forge read_at on INSERT (it falls to NULL) and
//      created_at is not client-forgeable.
//   8. Body is stored VERBATIM.
//   9. No DELETE is allowed (default-deny — zero-row no-op, the row survives).
//
// The service-role client is used ONLY for setup (users + profiles) and
// authoritative read-backs — it bypasses RLS, which is the point of the read-back.
// The INSERT/UPDATE/DELETE under test run as the authenticated members. The service
// key stays Node/server-side; never handed to a browser context.
//
// Tagged @security (NOT @smoke). Pure PostgREST, LOCAL stack, no app server. DMs
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
	const email = `dm-${handle}-${Date.now().toString(36)}@topdog.test`;
	const password = 'dm-test-password-123';

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

interface DmRow {
	id: string;
	sender_id: string;
	recipient_id: string;
	body: string;
	created_at: string;
	read_at: string | null;
}

/** Authoritative read of one DM row by id, with the service client (bypasses RLS). */
async function dmById(id: string): Promise<DmRow | null> {
	const service = serviceClient();
	const { data, error } = await service
		.from('dms')
		.select('id, sender_id, recipient_id, body, created_at, read_at')
		.eq('id', id)
		.maybeSingle();
	if (error) {
		throw new Error(`Could not read dm ${id}: ${error.message}`);
	}
	return (data as DmRow | null) ?? null;
}

/**
 * Seeds a DM from `sender` to `recipient` with the SERVICE client (bypasses the
 * column grants), so a test can establish a known row to attack/read. Returns id.
 */
async function seedDm(
	senderId: string,
	recipientId: string,
	body: string,
	readAt: string | null = null
): Promise<string> {
	const service = serviceClient();
	const id = crypto.randomUUID();
	const { error } = await service
		.from('dms')
		.insert({ id, sender_id: senderId, recipient_id: recipientId, body, read_at: readAt });
	if (error) {
		throw new Error(`Could not seed dm: ${error.message}`);
	}
	return id;
}

test.describe('@security dms: privacy SELECT RLS + sender-pin INSERT + read_at column lockdown (direct PostgREST)', () => {
	test('a member CAN send a DM to another member (sender pinned to themselves)', async () => {
		const sender = await makeUser(uniqueHandle('sn'));
		const recipient = await makeUser(uniqueHandle('rc'));

		const { data, error } = await sender.client
			.from('dms')
			.insert({ sender_id: sender.id, recipient_id: recipient.id, body: 'first dog of the day 🌭' })
			.select('id')
			.single();

		expect(error, 'sending a self-authored DM must succeed').toBeNull();
		expect(data?.id, 'the insert returned the new row id').toBeTruthy();

		const row = await dmById(data!.id);
		expect(row?.sender_id).toBe(sender.id);
		expect(row?.recipient_id).toBe(recipient.id);
	});

	test('a FORGED sender_id (!= auth.uid()) is rejected by the INSERT WITH CHECK / sender-pin (42501)', async () => {
		const attacker = await makeUser(uniqueHandle('at'));
		const victim = await makeUser(uniqueHandle('vi'));
		const recipient = await makeUser(uniqueHandle('rc'));

		// The attacker tries to stamp the DM as if the VICTIM sent it. The
		// `sender_id = (select auth.uid())` check rejects it — auth.uid() is the
		// attacker, not the victim.
		const { error } = await attacker.client.from('dms').insert({
			sender_id: victim.id,
			recipient_id: recipient.id,
			body: 'definitely the victim sent this'
		});

		expect(error, 'forging another sender_id must be rejected by RLS').not.toBeNull();
		expect(error?.code, 'the INSERT WITH-CHECK denial surfaces as 42501').toBe('42501');
	});

	test('PRIVACY: both the SENDER and the RECIPIENT can read the DM, but a THIRD party CANNOT (zero rows)', async () => {
		const sender = await makeUser(uniqueHandle('sn'));
		const recipient = await makeUser(uniqueHandle('rc'));
		const thirdParty = await makeUser(uniqueHandle('tp'));
		const id = await seedDm(sender.id, recipient.id, 'private between us');

		// The SENDER can read their own sent DM.
		const senderRead = await sender.client.from('dms').select('id, body').eq('id', id);
		expect(senderRead.error, 'sender read must not error').toBeNull();
		expect(senderRead.data, 'the sender sees the DM').toHaveLength(1);
		expect(senderRead.data?.[0].body).toBe('private between us');

		// The RECIPIENT can read the DM addressed to them.
		const recipientRead = await recipient.client.from('dms').select('id, body').eq('id', id);
		expect(recipientRead.error, 'recipient read must not error').toBeNull();
		expect(recipientRead.data, 'the recipient sees the DM').toHaveLength(1);
		expect(recipientRead.data?.[0].body).toBe('private between us');

		// The THIRD PARTY must see NOTHING — RLS filters the row out entirely. This is
		// the critical privacy guarantee: a non-party cannot read others' DMs.
		const thirdRead = await thirdParty.client.from('dms').select('id, body').eq('id', id);
		expect(
			thirdRead.error,
			'an unauthorized read is filtered to zero rows, not an error'
		).toBeNull();
		expect(thirdRead.data, 'a THIRD party reads ZERO rows — they cannot see the DM').toHaveLength(
			0
		);
	});

	test('the RECIPIENT can mark the message read (set read_at)', async () => {
		const sender = await makeUser(uniqueHandle('sn'));
		const recipient = await makeUser(uniqueHandle('rc'));
		const id = await seedDm(sender.id, recipient.id, 'mark me read');

		const now = new Date().toISOString();
		const { error } = await recipient.client
			.from('dms')
			.update({ read_at: now })
			.eq('id', id)
			.is('read_at', null);

		expect(error, 'the recipient setting read_at must succeed').toBeNull();

		const row = await dmById(id);
		expect(row?.read_at, 'read_at is now set').not.toBeNull();
	});

	test('the SENDER CANNOT update read_at — the UPDATE RLS is recipient-only (zero-row no-op)', async () => {
		const sender = await makeUser(uniqueHandle('sn'));
		const recipient = await makeUser(uniqueHandle('rc'));
		const id = await seedDm(sender.id, recipient.id, 'sender cannot mark this read');

		// The UPDATE policy pins recipient_id = auth.uid(); the sender is not the
		// recipient, so RLS makes the update affect ZERO rows (no error in PostgREST),
		// leaving read_at NULL.
		const { error } = await sender.client
			.from('dms')
			.update({ read_at: new Date().toISOString() })
			.eq('id', id);

		expect(error, 'a sender mark-read is a zero-row no-op, not an error').toBeNull();

		const row = await dmById(id);
		expect(row?.read_at, 'read_at stays NULL — the sender could not mark it read').toBeNull();
	});

	test('the RECIPIENT CANNOT rewrite body — the grant update (read_at) column lockdown rejects it (42501)', async () => {
		const sender = await makeUser(uniqueHandle('sn'));
		const recipient = await makeUser(uniqueHandle('rc'));
		const id = await seedDm(sender.id, recipient.id, 'original sender body');

		// Even though the recipient's ROW-level UPDATE policy permits them to touch the
		// row, the COLUMN grant confines UPDATE to read_at only. An UPDATE that writes
		// `body` requires UPDATE privilege on the body column, which was revoked — so
		// PostgREST returns a column-privilege error (42501).
		const { error } = await recipient.client
			.from('dms')
			.update({ body: 'tampered body' })
			.eq('id', id);

		expect(error, 'rewriting body must be rejected by the column lockdown').not.toBeNull();
		expect(error?.code, 'the column-privilege denial surfaces as 42501').toBe('42501');

		const row = await dmById(id);
		expect(row?.body, 'the body was NOT mutated').toBe('original sender body');
	});

	test('the sender CANNOT pre-forge read_at on INSERT — it falls to the NULL default', async () => {
		const sender = await makeUser(uniqueHandle('sn'));
		const recipient = await makeUser(uniqueHandle('rc'));

		// The INSERT column grant omits read_at, so a direct PostgREST insert that
		// tries to set read_at is rejected by the column lockdown (42501) — a sender
		// cannot forge an already-read message.
		const forgedReadAt = new Date().toISOString();
		const { error } = await sender.client.from('dms').insert({
			sender_id: sender.id,
			recipient_id: recipient.id,
			body: 'pretend this is already read',
			read_at: forgedReadAt
		});

		expect(
			error,
			'pre-forging read_at on INSERT must be rejected by the column lockdown'
		).not.toBeNull();
		expect(error?.code, 'the column-privilege denial surfaces as 42501').toBe('42501');
	});

	test('a normal INSERT lands read_at NULL and a server-set created_at (not client-forgeable)', async () => {
		const sender = await makeUser(uniqueHandle('sn'));
		const recipient = await makeUser(uniqueHandle('rc'));

		const before = Date.now();
		const { data, error } = await sender.client
			.from('dms')
			.insert({ sender_id: sender.id, recipient_id: recipient.id, body: 'fresh message' })
			.select('id')
			.single();
		expect(error, 'the insert should succeed').toBeNull();

		const row = await dmById(data!.id);
		expect(row?.read_at, 'read_at falls to its NULL default — message is unread').toBeNull();
		// created_at is server-defaulted (now()): it must be a real, recent timestamp,
		// not anything the client could have supplied (the column grant omits it).
		expect(row?.created_at, 'created_at is server-set').toBeTruthy();
		const createdMs = new Date(row!.created_at).getTime();
		expect(createdMs, 'created_at is a recent server timestamp').toBeGreaterThanOrEqual(
			before - 5000
		);
	});

	test('the body is stored VERBATIM (no server-side transformation)', async () => {
		const sender = await makeUser(uniqueHandle('sn'));
		const recipient = await makeUser(uniqueHandle('rc'));
		// Internal whitespace, emoji, and newlines must survive untouched — M6 applies
		// a RENDER-time filter, never persists a transformed body.
		const original = 'Hot  dog 🌭\nwith  mustard 🟡 & relish';

		const { data, error } = await sender.client
			.from('dms')
			.insert({ sender_id: sender.id, recipient_id: recipient.id, body: original })
			.select('id')
			.single();
		expect(error, 'the verbatim-body insert should succeed').toBeNull();

		const row = await dmById(data!.id);
		expect(row?.body, 'the body is stored byte-for-byte, untransformed').toBe(original);
	});

	test('DELETE is blocked — no DELETE policy means default-deny (DM persists)', async () => {
		const sender = await makeUser(uniqueHandle('sn'));
		const recipient = await makeUser(uniqueHandle('rc'));
		const id = await seedDm(sender.id, recipient.id, 'DMs persist, never deleted');

		// Neither the sender nor the recipient may delete — there is NO DELETE policy,
		// so RLS default-denies. The delete affects zero rows (not an error in
		// PostgREST), so the row must remain for BOTH parties.
		const senderDel = await sender.client.from('dms').delete().eq('id', id);
		expect(senderDel.error, 'a blocked delete is a zero-row no-op, not an error').toBeNull();

		const recipientDel = await recipient.client.from('dms').delete().eq('id', id);
		expect(recipientDel.error, 'a blocked delete is a zero-row no-op, not an error').toBeNull();

		const row = await dmById(id);
		expect(row, 'the DM survives — DELETE is default-denied').not.toBeNull();
		expect(row?.body).toBe('DMs persist, never deleted');
	});
});
