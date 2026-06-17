import { expect, test } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getLocalStackCreds } from './helpers/local-stack';

// TASK-053 — Grant-invariant regression guard.
//
// TASK-052 (PR #66) restored the explicit Data API table grants after the
// Supabase CLI's `auto_expose_new_tables` default flipped to false, and pinned
// `auto_expose_new_tables = false` in config.toml. This spec is the CHECKED-IN
// regression guard so a future `supabase db reset` — or a new table migration
// that forgets its grants — can't silently re-drift the grant matrix.
//
// It encodes the empirically-confirmed, post-reset grant matrix as behavioural
// PostgREST assertions through the EXISTING harness (anon / authenticated /
// service-role supabase-js clients, local creds via helpers/local-stack.ts,
// non-localhost guardrail, workers:1 serialization). It deliberately covers the
// GAPS not already exercised by the per-feature @security specs:
//
//   * The `anon`-has-NOTHING matrix: anon (pre-auth role) has no base grant on
//     ANY of the 9 tables. SELECT returns zero rows (RLS is authenticated-only)
//     and INSERT is rejected at the GRANT layer (42501). No existing spec
//     exercises the anon role at all.
//   * The `authenticated`-cannot-write-votes/top_dog_days matrix: these two
//     tables are RPC-write-only (decision #12) — authenticated has SELECT but NO
//     base INSERT/UPDATE/DELETE grant, so a direct PostgREST write is a hard
//     grant-layer 42501. votes.e2e.ts exercises the RPCs; it does NOT assert the
//     direct-write lockdown.
//   * A consolidated POSITIVE base-grant smoke check: authenticated SELECT works
//     on all 9 tables, and service_role read/write works on all 9 — the base
//     grants TASK-052 restored. If any base SELECT grant were dropped, the
//     authenticated SELECT would flip from a 200-with-rows to a 42501.
//   * One representative locked-column forge denial (dms.read_at on INSERT) to
//     prove a column-lockdown still blocks a table-wide forge of a
//     server-maintained column. (The hot_dogs counter and profiles crown forge
//     denials are already covered by db-guards.e2e.ts — NOT duplicated here.)
//
// DELIBERATELY NOT DUPLICATED (covered elsewhere — see those specs):
//   * hot_dogs forge-counter INSERT denial          -> db-guards.e2e.ts
//   * profiles forge-crown INSERT/UPDATE denial      -> db-guards.e2e.ts / tally.e2e.ts
//   * dms read_at recipient-only UPDATE / body lockdown / privacy SELECT -> dms.e2e.ts
//   * wall / dm immutability (no UPDATE/DELETE)       -> walls.e2e.ts / dms.e2e.ts
//   * vote RPC behaviour                              -> votes.e2e.ts
//
// All denials are matched on the PostgreSQL SQLSTATE `code` (42501 =
// insufficient_privilege), never on human-readable message text.
//
// Tagged @security (NOT @smoke). Pure PostgREST, LOCAL stack, no app server.
// Keeps the project's workers:1 default — the shared local Postgres is the only
// datastore. The service key stays Node/server-side; never handed to a browser.

const creds = getLocalStackCreds();

// The 9 project tables, in the order TASK-052's restore migration lists them.
const ALL_TABLES = [
	'invites',
	'profiles',
	'hot_dogs',
	'votes',
	'top_dog_days',
	'hotdog_reactions',
	'mustard_sprays',
	'wall_messages',
	'dms'
] as const;

/** Service-role client: BYPASSRLS, backs setup + authoritative read/write. */
function serviceClient(): SupabaseClient {
	return createClient(creds.apiUrl, creds.secretKey, {
		auth: { autoRefreshToken: false, persistSession: false }
	});
}

/** anon-role client: the publishable key with NO user JWT (pre-auth browser). */
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
 * Creates an auth user + matching profile row, signs them in with the
 * publishable key, and returns an authenticated-role client holding their JWT
 * (exactly what a browser carries).
 */
async function makeUser(handle: string): Promise<TestUser> {
	const service = serviceClient();
	const email = `grant-${handle}-${Date.now().toString(36)}@topdog.test`;
	const password = 'grant-test-password-123';

	const { data: created, error: createError } = await service.auth.admin.createUser({
		email,
		password,
		email_confirm: true
	});
	if (createError || !created.user) {
		throw new Error(`Could not create test user ${handle}: ${createError?.message}`);
	}
	const id = created.user.id;

	const { error: profileError } = await service
		.from('profiles')
		.insert({ id, handle, display_name: handle });
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

// ---------------------------------------------------------------------------
// (1) POSITIVES — the base grants TASK-052 restored must be present.
// ---------------------------------------------------------------------------
test.describe('@security grant invariants: REQUIRED positives (base grants present)', () => {
	test('authenticated holds SELECT on ALL 9 tables (no 42501)', async () => {
		const member = await makeUser(uniqueHandle('sel'));

		for (const table of ALL_TABLES) {
			// A SELECT a member is *granted* returns at most some rows under RLS — it
			// must NOT be a grant-layer permission denial. Zero rows is fine (RLS
			// gates rows); a 42501 would mean the base SELECT grant was dropped.
			const { error } = await member.client.from(table).select('*').limit(1);
			expect(error?.code, `authenticated must hold SELECT on ${table} (no 42501)`).not.toBe(
				'42501'
			);
			expect(error, `authenticated SELECT on ${table} must not error`).toBeNull();
		}
	});

	test('authenticated INSERT works on the un-locked write tables (invites, reactions, sprays, walls)', async () => {
		// invites: RLS invites_insert_own gates the row; inviter_id must be the caller.
		const inviter = await makeUser(uniqueHandle('inv'));
		const service = serviceClient();
		const inviteToken = `grant-inv-${Date.now().toString(36)}-${seq}-padded-token`;
		const { error: inviteErr } = await inviter.client
			.from('invites')
			.insert({ inviter_id: inviter.id, token: inviteToken });
		expect(inviteErr, 'authenticated INSERT on invites must succeed').toBeNull();

		// hotdog_reactions: owner-scoped insert toggle. Needs a target dog.
		const dogOwner = await makeUser(uniqueHandle('do'));
		const reactor = await makeUser(uniqueHandle('re'));
		const dogId = crypto.randomUUID();
		const { error: dogErr } = await service.from('hot_dogs').insert({
			id: dogId,
			owner_id: dogOwner.id,
			image_path: `${dogOwner.id}/g.webp`,
			byte_size: 10,
			caption: 'grant probe dog'
		});
		if (dogErr) throw new Error(`Could not seed probe dog: ${dogErr.message}`);
		const { error: reactErr } = await reactor.client
			.from('hotdog_reactions')
			.insert({ hot_dog_id: dogId, user_id: reactor.id, emoji: '🔥' });
		expect(reactErr, 'authenticated INSERT on hotdog_reactions must succeed').toBeNull();

		// mustard_sprays: Top-Dog-gated. Crown the sprayer (service client) so the
		// EXISTS privilege conjunct passes, then spray.
		const sprayer = await makeUser(uniqueHandle('sp'));
		const target = await makeUser(uniqueHandle('tg'));
		const { error: crownErr } = await service
			.from('profiles')
			.update({ is_current_top_dog: true })
			.eq('id', sprayer.id);
		if (crownErr) throw new Error(`Could not crown the sprayer: ${crownErr.message}`);
		const { error: sprayErr } = await sprayer.client
			.from('mustard_sprays')
			.insert({ sprayer_id: sprayer.id, target_profile_id: target.id, x: 0.5, y: 0.5 });
		expect(sprayErr, 'authenticated INSERT on mustard_sprays (as Top Dog) must succeed').toBeNull();
		// Reset the crown so this test leaves no global-singleton residue for the
		// serialized suite.
		await service.from('profiles').update({ is_current_top_dog: false }).eq('id', sprayer.id);

		// wall_messages: owner-scoped insert, author pinned to the caller.
		const poster = await makeUser(uniqueHandle('po'));
		const wallOwner = await makeUser(uniqueHandle('wo'));
		const { error: wallErr } = await poster.client
			.from('wall_messages')
			.insert({ author_id: poster.id, profile_id: wallOwner.id, body: 'grant probe note' });
		expect(wallErr, 'authenticated INSERT on wall_messages must succeed').toBeNull();
	});

	test('service_role holds SELECT + INSERT + DELETE on every table (round-trip)', async () => {
		// service_role is BYPASSRLS and must hold table-wide DML. We round-trip an
		// insert+delete on the two tables that have no FK prerequisites and no
		// single-use guard to trip — invites (needs an inviter) and top_dog_days
		// (needs a profile). A clean insert→delete proves INSERT+DELETE+SELECT.
		const service = serviceClient();
		const owner = await makeUser(uniqueHandle('svc'));

		// SELECT on all 9 must succeed for service_role.
		for (const table of ALL_TABLES) {
			const { error } = await service.from(table).select('*').limit(1);
			expect(error, `service_role SELECT on ${table} must succeed`).toBeNull();
		}

		// INSERT + DELETE round-trip on top_dog_days (FK -> profiles only).
		const dayId = crypto.randomUUID();
		const { error: insErr } = await service
			.from('top_dog_days')
			.insert({ id: dayId, profile_id: owner.id, day: '1999-01-01' });
		expect(insErr, 'service_role INSERT on top_dog_days must succeed').toBeNull();
		const { error: delErr } = await service.from('top_dog_days').delete().eq('id', dayId);
		expect(delErr, 'service_role DELETE on top_dog_days must succeed').toBeNull();

		// INSERT + UPDATE round-trip on profiles (proves service_role UPDATE).
		const { error: updErr } = await service
			.from('profiles')
			.update({ display_name: 'svc renamed' })
			.eq('id', owner.id);
		expect(updErr, 'service_role UPDATE on profiles must succeed').toBeNull();
	});
});

// ---------------------------------------------------------------------------
// (2) NEGATIVES — anon has NOTHING (pre-auth role). Gap not covered elsewhere.
// ---------------------------------------------------------------------------
test.describe('@security grant invariants: anon (pre-auth) has NOTHING', () => {
	test('anon SELECT returns zero rows on every table (RLS is authenticated-only)', async () => {
		// anon holds no base grant and every SELECT RLS policy is authenticated-only,
		// so PostgREST returns an empty set (not a 42501 — Supabase grants anon a
		// nominal base for the API to respond, but RLS yields nothing). The
		// load-bearing assertion: anon NEVER sees a row. We seed one real row per
		// readable table with the service client first, then confirm anon sees none.
		const service = serviceClient();
		const member = await makeUser(uniqueHandle('seed'));

		// Seed at least one row the service client can see, per table, so "anon sees
		// zero" is meaningful (not vacuously true on an empty table).
		const dogId = crypto.randomUUID();
		await service
			.from('invites')
			.insert({ inviter_id: member.id, token: `anon-seed-${seq}-padded-token-value` });
		await service.from('hot_dogs').insert({
			id: dogId,
			owner_id: member.id,
			image_path: `${member.id}/a.webp`,
			byte_size: 10,
			caption: 'anon seed dog'
		});
		await service.from('top_dog_days').insert({ profile_id: member.id, day: '1998-02-02' });
		await service
			.from('hotdog_reactions')
			.insert({ hot_dog_id: dogId, user_id: member.id, emoji: '👀' });

		const anon = anonClient();
		for (const table of ALL_TABLES) {
			const { data, error } = await anon.from(table).select('*');
			// Either a hard 42501 (no grant) or an empty set — both satisfy "anon sees
			// nothing". What anon must NEVER do is return a populated row set.
			if (error) {
				expect(error.code, `anon SELECT on ${table} may only fail with 42501`).toBe('42501');
			} else {
				expect(data ?? [], `anon must see ZERO rows on ${table}`).toHaveLength(0);
			}
		}
	});

	test('anon INSERT is rejected at the grant layer (42501) on every table', async () => {
		// anon has no base INSERT grant on any table, so a direct write is a hard
		// grant-layer permission denial (42501) — before RLS is ever consulted. We
		// supply a plausible-shaped payload per table; the grant denial precedes any
		// column/CHECK/RLS evaluation, so the exact payload doesn't matter.
		const anon = anonClient();
		const fakeId = crypto.randomUUID();
		const payloads: Record<(typeof ALL_TABLES)[number], Record<string, unknown>> = {
			invites: { inviter_id: fakeId, token: `anon-write-${seq}-padded-token-value` },
			profiles: { id: fakeId, handle: uniqueHandle('an'), display_name: 'anon' },
			hot_dogs: { id: fakeId, owner_id: fakeId, image_path: `${fakeId}/x.webp`, byte_size: 1 },
			votes: { voter_id: fakeId, hot_dog_id: fakeId },
			top_dog_days: { profile_id: fakeId, day: '1997-03-03' },
			hotdog_reactions: { hot_dog_id: fakeId, user_id: fakeId, emoji: '🌭' },
			mustard_sprays: { sprayer_id: fakeId, target_profile_id: fakeId, x: 0.5, y: 0.5 },
			wall_messages: { author_id: fakeId, profile_id: fakeId, body: 'anon' },
			dms: { sender_id: fakeId, recipient_id: fakeId, body: 'anon' }
		};

		for (const table of ALL_TABLES) {
			const { error } = await anon.from(table).insert(payloads[table]);
			expect(error, `anon INSERT on ${table} must be rejected`).not.toBeNull();
			expect(error?.code, `anon INSERT on ${table} is grant-layer denied (42501)`).toBe('42501');
		}
	});
});

// ---------------------------------------------------------------------------
// (3) NEGATIVES — authenticated cannot directly write the RPC-only tables.
//     Gap not covered elsewhere (votes.e2e.ts exercises the RPCs, not this).
// ---------------------------------------------------------------------------
test.describe('@security grant invariants: votes / top_dog_days are RPC-write-only for authenticated', () => {
	test('authenticated direct INSERT on votes is grant-denied (42501)', async () => {
		const member = await makeUser(uniqueHandle('vi'));
		// No base INSERT grant on votes for authenticated — writes go only through
		// cast_vote/remove_vote RPCs (decision #12). A direct PostgREST insert hits
		// the grant layer (42501) before RLS.
		const { error } = await member.client
			.from('votes')
			.insert({ voter_id: member.id, hot_dog_id: crypto.randomUUID() });
		expect(error, 'direct vote INSERT must be rejected').not.toBeNull();
		expect(error?.code, 'votes INSERT is grant-layer denied (42501)').toBe('42501');
	});

	test('authenticated direct UPDATE on votes is grant-denied (42501)', async () => {
		const member = await makeUser(uniqueHandle('vu'));
		const { error } = await member.client
			.from('votes')
			.update({ hot_dog_id: crypto.randomUUID() })
			.eq('voter_id', member.id);
		expect(error, 'direct vote UPDATE must be rejected').not.toBeNull();
		expect(error?.code, 'votes UPDATE is grant-layer denied (42501)').toBe('42501');
	});

	test('authenticated direct DELETE on votes is grant-denied (42501)', async () => {
		const member = await makeUser(uniqueHandle('vd'));
		const { error } = await member.client.from('votes').delete().eq('voter_id', member.id);
		expect(error, 'direct vote DELETE must be rejected').not.toBeNull();
		expect(error?.code, 'votes DELETE is grant-layer denied (42501)').toBe('42501');
	});

	test('authenticated direct INSERT on top_dog_days is grant-denied (42501)', async () => {
		const member = await makeUser(uniqueHandle('ti'));
		// top_dog_days is written only by tally_top_dog_day() (SECURITY DEFINER). A
		// member crowning themselves a tally day directly is grant-denied (42501).
		const { error } = await member.client
			.from('top_dog_days')
			.insert({ profile_id: member.id, day: '2000-01-01' });
		expect(error, 'direct top_dog_days INSERT must be rejected').not.toBeNull();
		expect(error?.code, 'top_dog_days INSERT is grant-layer denied (42501)').toBe('42501');
	});

	test('authenticated direct UPDATE on top_dog_days is grant-denied (42501)', async () => {
		const member = await makeUser(uniqueHandle('tu'));
		const { error } = await member.client
			.from('top_dog_days')
			.update({ day: '2000-01-01' })
			.eq('profile_id', member.id);
		expect(error, 'direct top_dog_days UPDATE must be rejected').not.toBeNull();
		expect(error?.code, 'top_dog_days UPDATE is grant-layer denied (42501)').toBe('42501');
	});

	test('authenticated direct DELETE on top_dog_days is grant-denied (42501)', async () => {
		const member = await makeUser(uniqueHandle('td'));
		const { error } = await member.client.from('top_dog_days').delete().eq('profile_id', member.id);
		expect(error, 'direct top_dog_days DELETE must be rejected').not.toBeNull();
		expect(error?.code, 'top_dog_days DELETE is grant-layer denied (42501)').toBe('42501');
	});
});

// ---------------------------------------------------------------------------
// (4) NEGATIVE — representative locked-column forge denial on a column that no
//     other @security spec covers (dms.read_at on INSERT). Proves the
//     decision #24/#25 insert-column lockdown still rejects a table-wide forge
//     of a server/recipient-maintained column. (hot_dogs counter + profiles
//     crown forge denials live in db-guards.e2e.ts and are NOT duplicated.)
// ---------------------------------------------------------------------------
test.describe('@security grant invariants: locked-column forge denial (dms.read_at on INSERT)', () => {
	test('a sender forging read_at on a dms INSERT is column-grant denied (42501)', async () => {
		const sender = await makeUser(uniqueHandle('ds'));
		const recipient = await makeUser(uniqueHandle('dr'));

		// The INSERT column grant is (sender_id, recipient_id, body) — read_at is NOT
		// in it (it falls to its DEFAULT/NULL and is recipient-only on UPDATE). A
		// sender supplying read_at to pre-mark the DM read is denied at the column
		// grant layer (42501), independent of RLS.
		const { error } = await sender.client.from('dms').insert({
			sender_id: sender.id,
			recipient_id: recipient.id,
			body: 'forging read state',
			read_at: '2000-01-01T00:00:00Z'
		});

		expect(error, 'forging read_at on a dms INSERT must be rejected').not.toBeNull();
		expect(error?.code, 'dms.read_at INSERT forgery is column-grant denied (42501)').toBe('42501');
	});
});
