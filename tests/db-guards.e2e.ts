import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { getLocalStackCreds } from './helpers/local-stack';
import { HOTDOGS_BUCKET } from '../src/lib/storage';

// DB-guard assertions deferred from the TASK-013 review (recorded in
// dogs-action.test.ts header). These verify the DB-AUTHORITATIVE backstops that
// the friendly action layer also enforces, by going DIRECTLY to PostgREST as an
// `authenticated`-role client (publishable key + a signed-in user's JWT) —
// bypassing the app's form actions entirely:
//
//   1. A direct hot_dogs insert that SUPPLIES vote_count / peak_votes is
//      REJECTED — the column-level INSERT grant only covers
//      (id, owner_id, image_path, caption, byte_size), so a client cannot seed
//      the server-maintained counters. (Column grant, not RLS, is the guard.)
//   2. A direct insert with a caption > 280 chars is REJECTED by the
//      hot_dogs_caption_length CHECK.
//
// Tagged @security (NOT @smoke) so `--grep @smoke` does not select it. Runs
// against the LOCAL stack; no app server required — pure PostgREST.

test.describe('@security DB-authoritative hot_dogs guards (direct PostgREST)', () => {
	const creds = getLocalStackCreds();

	// One signed-in user per file: an authenticated JWT is required so RLS lets
	// the owner_id match. We create the user with a service client, then sign in
	// with the publishable key to get a real `authenticated`-role session.
	const userEmail = `db-guard-${Date.now().toString(36)}@topdog.test`;
	const userPassword = 'db-guard-password-123';

	let userId: string;
	let authedToken: string;

	test.beforeAll(async () => {
		const service = createClient(creds.apiUrl, creds.secretKey, {
			auth: { autoRefreshToken: false, persistSession: false }
		});
		const { data: created, error: createError } = await service.auth.admin.createUser({
			email: userEmail,
			password: userPassword,
			email_confirm: true
		});
		if (createError || !created.user) {
			throw new Error(`Could not create the db-guard test user: ${createError?.message}`);
		}
		userId = created.user.id;

		const anon = createClient(creds.apiUrl, creds.publishableKey, {
			auth: { autoRefreshToken: false, persistSession: false }
		});
		const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
			email: userEmail,
			password: userPassword
		});
		if (signInError || !signIn.session) {
			throw new Error(`Could not sign in the db-guard test user: ${signInError?.message}`);
		}
		authedToken = signIn.session.access_token;
	});

	function authedClient() {
		// `authenticated`-role client: publishable key + the user's JWT, exactly
		// what a browser holds. No service key — these inserts run under RLS + the
		// column-level grants, which is the point.
		return createClient(creds.apiUrl, creds.publishableKey, {
			auth: { autoRefreshToken: false, persistSession: false },
			global: { headers: { Authorization: `Bearer ${authedToken}` } }
		});
	}

	test('rejects a direct insert that forges the server-maintained counters', async () => {
		const supabase = authedClient();
		const { error } = await supabase.from('hot_dogs').insert({
			id: crypto.randomUUID(),
			owner_id: userId,
			image_path: `${userId}/forged.webp`,
			byte_size: 10,
			caption: 'forged counters',
			// These columns are NOT in the INSERT grant — the DB must reject this.
			vote_count: 9999,
			peak_votes: 9999
		});

		expect(error, 'forging vote_count/peak_votes must be rejected').not.toBeNull();
	});

	test('rejects a direct insert with a caption over 280 characters', async () => {
		const supabase = authedClient();
		const tooLong = 'x'.repeat(281);
		const { error } = await supabase.from('hot_dogs').insert({
			id: crypto.randomUUID(),
			owner_id: userId,
			image_path: `${userId}/toolong.webp`,
			byte_size: 10,
			caption: tooLong
		});

		expect(error, 'a >280-char caption must be rejected by the CHECK').not.toBeNull();
	});
});

// ---------------------------------------------------------------------------
// TASK-021 — Crown-column write guards on public.profiles (same column-grant
// family as the forged-counter guards above, hence co-located here).
//
// The reviewer demonstrated that authenticated members could forge crown state
// (is_current_top_dog / top_dog_since / days_as_top_dog) via a plain PostgREST
// UPDATE/INSERT, because `profiles` had RLS row policies but no column-level
// write grants. The migration now revokes table-wide INSERT/UPDATE from
// `authenticated` and re-grants ONLY (id, handle, display_name, avatar_path) on
// INSERT and (handle, display_name, avatar_path) on UPDATE. These tests prove
// the crown columns are unreachable from a client write while the safe columns
// still work (no over-restriction that would break onboarding/profile editing).
//
// We assert column privileges (SQLSTATE 42501 insufficient_privilege), not RLS:
// RLS gates rows, the column grant gates columns. Authoritative read-backs use
// the service client (bypasses RLS + column grants) to confirm the stored crown
// state is untouched. Tagged @security (NOT @smoke). Runs against the LOCAL
// stack; pure PostgREST, no app server.
test.describe('@security DB-authoritative profiles crown-column guards (direct PostgREST)', () => {
	const creds = getLocalStackCreds();

	const userEmail = `crown-guard-${Date.now().toString(36)}@topdog.test`;
	const userPassword = 'crown-guard-password-123';
	const handle = `crown${Date.now().toString(36).slice(-6)}`.slice(0, 32);

	let userId: string;
	let authedToken: string;

	// Service client: bypasses RLS + column grants for setup and authoritative
	// read-backs. The service key stays Node-side; never handed to a browser.
	function serviceClient() {
		return createClient(creds.apiUrl, creds.secretKey, {
			auth: { autoRefreshToken: false, persistSession: false }
		});
	}

	function authedClient() {
		// `authenticated`-role client: publishable key + the user's JWT, exactly
		// what a browser holds. No service key — writes run under RLS + the
		// column-level grants, which is what we are testing.
		return createClient(creds.apiUrl, creds.publishableKey, {
			auth: { autoRefreshToken: false, persistSession: false },
			global: { headers: { Authorization: `Bearer ${authedToken}` } }
		});
	}

	/** Authoritative crown state, read with the service client (bypasses RLS). */
	async function readCrownState(id: string): Promise<{
		isTopDog: boolean;
		topDogSince: string | null;
		daysAsTopDog: number;
	}> {
		const service = serviceClient();
		const { data, error } = await service
			.from('profiles')
			.select('is_current_top_dog, top_dog_since, days_as_top_dog')
			.eq('id', id)
			.single();
		if (error || !data) {
			throw new Error(`Could not read crown state for ${id}: ${error?.message}`);
		}
		return {
			isTopDog: data.is_current_top_dog as boolean,
			topDogSince: data.top_dog_since as string | null,
			daysAsTopDog: data.days_as_top_dog as number
		};
	}

	test.beforeAll(async () => {
		const service = serviceClient();
		const { data: created, error: createError } = await service.auth.admin.createUser({
			email: userEmail,
			password: userPassword,
			email_confirm: true
		});
		if (createError || !created.user) {
			throw new Error(`Could not create the crown-guard test user: ${createError?.message}`);
		}
		userId = created.user.id;

		const anon = createClient(creds.apiUrl, creds.publishableKey, {
			auth: { autoRefreshToken: false, persistSession: false }
		});
		const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
			email: userEmail,
			password: userPassword
		});
		if (signInError || !signIn.session) {
			throw new Error(`Could not sign in the crown-guard test user: ${signInError?.message}`);
		}
		authedToken = signIn.session.access_token;
	});

	test('safe-column INSERT via the normal path succeeds (onboarding not broken)', async () => {
		// The legitimate createProfile path: a user inserts their own row supplying
		// exactly (id, handle, display_name, avatar_path). The id matches auth.uid()
		// so the insert RLS policy passes, and every supplied column is in the
		// INSERT grant — this MUST succeed. (Runs first so later UPDATE tests have a
		// row to target.)
		const supabase = authedClient();
		const { error } = await supabase.from('profiles').insert({
			id: userId,
			handle,
			display_name: 'Crown Guard',
			avatar_path: null
		});

		expect(error, 'a normal-path profile insert must succeed').toBeNull();

		// The omitted crown columns must have fallen to their safe DEFAULTs.
		const state = await readCrownState(userId);
		expect(state.isTopDog, 'a new profile is not Top Dog by default').toBe(false);
		expect(state.topDogSince, 'a new profile has no top_dog_since by default').toBeNull();
		expect(state.daysAsTopDog, 'a new profile has 0 days as Top Dog by default').toBe(0);
	});

	test('rejects a direct UPDATE that forges the crown columns (the reviewer exploit)', async () => {
		// The exact exploit: an authenticated user UPDATEs their OWN row (RLS allows
		// the row) trying to crown themselves. The column grant must reject it —
		// is_current_top_dog / top_dog_since / days_as_top_dog are not in the UPDATE
		// grant, so this is insufficient_privilege (42501).
		const supabase = authedClient();
		const { error } = await supabase
			.from('profiles')
			.update({
				is_current_top_dog: true,
				top_dog_since: '2000-01-01T00:00:00Z',
				days_as_top_dog: 9999
			})
			.eq('id', userId);

		expect(error, 'forging the crown via UPDATE must be rejected').not.toBeNull();
		expect(error?.code, 'crown UPDATE forgery raises insufficient_privilege 42501').toBe('42501');

		// Authoritative read-back: the stored crown state is unchanged.
		const state = await readCrownState(userId);
		expect(state.isTopDog, 'is_current_top_dog must remain false').toBe(false);
		expect(state.topDogSince, 'top_dog_since must remain null').toBeNull();
		expect(state.daysAsTopDog, 'days_as_top_dog must remain 0').toBe(0);
	});

	test('rejects a direct INSERT that seeds an opening crown', async () => {
		// A fresh authed user with NO profile row yet exercises the insert path. An
		// INSERT supplying is_current_top_dog / top_dog_since / days_as_top_dog must
		// be rejected by the column grant (42501) — a member cannot seed themselves
		// an opening crown. Uses a SEPARATE user so it is independent of the row the
		// safe-insert test created for `userId`.
		const service = serviceClient();
		const forgeEmail = `crown-forge-${Date.now().toString(36)}@topdog.test`;
		const { data: created, error: createError } = await service.auth.admin.createUser({
			email: forgeEmail,
			password: userPassword,
			email_confirm: true
		});
		if (createError || !created.user) {
			throw new Error(`Could not create the crown-forge test user: ${createError?.message}`);
		}
		const forgeId = created.user.id;

		const anon = createClient(creds.apiUrl, creds.publishableKey, {
			auth: { autoRefreshToken: false, persistSession: false }
		});
		const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
			email: forgeEmail,
			password: userPassword
		});
		if (signInError || !signIn.session) {
			throw new Error(`Could not sign in the crown-forge test user: ${signInError?.message}`);
		}
		const forger = createClient(creds.apiUrl, creds.publishableKey, {
			auth: { autoRefreshToken: false, persistSession: false },
			global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } }
		});

		const { error } = await forger.from('profiles').insert({
			id: forgeId,
			handle: `forge${Date.now().toString(36).slice(-6)}`.slice(0, 32),
			display_name: 'Forged Crown',
			// NOT in the INSERT grant — the DB must reject this.
			is_current_top_dog: true,
			top_dog_since: '2000-01-01T00:00:00Z',
			days_as_top_dog: 9999
		});

		expect(error, 'forging an opening crown via INSERT must be rejected').not.toBeNull();
		expect(error?.code, 'crown INSERT forgery raises insufficient_privilege 42501').toBe('42501');

		// And no row was created (the whole insert was rejected).
		const { data: rows } = await service.from('profiles').select('id').eq('id', forgeId);
		expect(rows ?? [], 'the rejected insert created no profile row').toHaveLength(0);
	});

	test('safe-column UPDATE (display_name) still works (profile editing not broken)', async () => {
		// Guards against over-restriction: display_name IS in the UPDATE grant, so a
		// legitimate profile edit must still succeed. (Relies on the safe-insert test
		// having created the row for `userId`.)
		const supabase = authedClient();
		const newName = 'Renamed Member';
		const { error } = await supabase
			.from('profiles')
			.update({ display_name: newName })
			.eq('id', userId);

		expect(error, 'a display_name edit must still succeed').toBeNull();

		const service = serviceClient();
		const { data } = await service
			.from('profiles')
			.select('display_name')
			.eq('id', userId)
			.single();
		expect(data?.display_name, 'the display_name edit persisted').toBe(newName);
	});
});

// ---------------------------------------------------------------------------
// TASK-070 — Upload limits enforcement (M7). The three DB/Storage-authoritative
// layers from the upload_limits migration, proven by going DIRECTLY to PostgREST
// / the Storage API as an `authenticated`-role client (the browser's publishable
// key + a signed-in JWT) — bypassing the SvelteKit upload action entirely:
//
//   1. A direct insert with byte_size > 2 MiB is rejected by the
//      hot_dogs_byte_size_max DB CHECK (the declared-size backstop, SQLSTATE
//      23514 check_violation).
//   2. After an owner has 100 rows, the 101st insert is rejected by the
//      hot_dogs_per_user_cap BEFORE INSERT trigger (rows 1-100 must succeed;
//      byte_size kept valid so we isolate the count cap, not the size CHECK).
//   3. A > 2 MiB object upload to the `hotdogs` bucket is rejected by the
//      Storage API file_size_limit; a <= 2 MiB object still succeeds.
//
// MAX_UPLOAD_BYTES = 2 MiB = 2097152 (mirrors src/lib/features/hotdogs/hotdogs.ts;
// SQL can't import the TS constant). Tagged @security (NOT @smoke). Runs against
// the LOCAL stack; pure PostgREST + Storage API, no app server. Fixture ids are
// fresh UUIDs (DW-014 — never pinned) to avoid hot_dogs_pkey collisions across
// runs/specs.
test.describe('@security DB-authoritative upload limits (direct PostgREST + Storage API)', () => {
	const creds = getLocalStackCreds();
	const MAX_UPLOAD_BYTES = 2097152;

	const userEmail = `upload-limits-${Date.now().toString(36)}@topdog.test`;
	const userPassword = 'upload-limits-password-123';

	let userId: string;
	let authedToken: string;

	function serviceClient() {
		return createClient(creds.apiUrl, creds.secretKey, {
			auth: { autoRefreshToken: false, persistSession: false }
		});
	}

	function authedClient() {
		// `authenticated`-role client: publishable key + the user's JWT, exactly
		// what a browser holds. No service key — these run under RLS + the
		// column-level grants + the new CHECK/trigger, which is the point.
		return createClient(creds.apiUrl, creds.publishableKey, {
			auth: { autoRefreshToken: false, persistSession: false },
			global: { headers: { Authorization: `Bearer ${authedToken}` } }
		});
	}

	test.beforeAll(async () => {
		const service = serviceClient();
		const { data: created, error: createError } = await service.auth.admin.createUser({
			email: userEmail,
			password: userPassword,
			email_confirm: true
		});
		if (createError || !created.user) {
			throw new Error(`Could not create the upload-limits test user: ${createError?.message}`);
		}
		userId = created.user.id;

		// hot_dogs.owner_id has an FK to profiles, so the owner needs a profile row
		// before any hot dog insert can land. Seed it with the service client.
		const handle = `ul${Date.now().toString(36).slice(-6)}`.slice(0, 32);
		const { error: profileError } = await service
			.from('profiles')
			.insert({ id: userId, handle, display_name: 'Upload Limits' });
		if (profileError) {
			throw new Error(`Could not seed the upload-limits profile: ${profileError.message}`);
		}

		const anon = createClient(creds.apiUrl, creds.publishableKey, {
			auth: { autoRefreshToken: false, persistSession: false }
		});
		const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
			email: userEmail,
			password: userPassword
		});
		if (signInError || !signIn.session) {
			throw new Error(`Could not sign in the upload-limits test user: ${signInError?.message}`);
		}
		authedToken = signIn.session.access_token;
	});

	test('rejects a direct insert with byte_size over 2 MiB (hot_dogs_byte_size_max CHECK)', async () => {
		const supabase = authedClient();
		const { error } = await supabase.from('hot_dogs').insert({
			id: crypto.randomUUID(),
			owner_id: userId,
			image_path: `${userId}/oversized.webp`,
			byte_size: MAX_UPLOAD_BYTES + 1,
			caption: 'too many bytes'
		});

		expect(error, 'byte_size > 2 MiB must be rejected by the DB CHECK').not.toBeNull();
		expect(error?.code, 'an oversized byte_size raises check_violation 23514').toBe('23514');
	});

	test('accepts a direct insert with byte_size at exactly 2 MiB (boundary, allowed)', async () => {
		const supabase = authedClient();
		const dogId = crypto.randomUUID();
		const { error } = await supabase.from('hot_dogs').insert({
			id: dogId,
			owner_id: userId,
			image_path: `${userId}/${dogId}.webp`,
			byte_size: MAX_UPLOAD_BYTES,
			caption: 'exactly at the cap'
		});

		expect(error, 'byte_size exactly at 2 MiB must be allowed by the CHECK').toBeNull();

		// Clean up so this row doesn't count toward the per-user cap test below.
		const service = serviceClient();
		await service.from('hot_dogs').delete().eq('id', dogId);
	});

	test('rejects the 101st insert for an owner (hot_dogs_per_user_cap BEFORE INSERT trigger)', async () => {
		// A SEPARATE owner so the 100-row seed is independent of `userId` (which the
		// byte_size tests above wrote/deleted against). Seed exactly 100 valid rows
		// with the service client, then the 101st insert (via either client) must
		// fail on the count-cap trigger, not the size CHECK (byte_size kept valid).
		const service = serviceClient();
		const capEmail = `cap-${Date.now().toString(36)}@topdog.test`;
		const { data: created, error: createError } = await service.auth.admin.createUser({
			email: capEmail,
			password: userPassword,
			email_confirm: true
		});
		if (createError || !created.user) {
			throw new Error(`Could not create the cap test user: ${createError?.message}`);
		}
		const capOwnerId = created.user.id;

		// The owner needs a profile row first (hot_dogs.owner_id FK -> profiles).
		const capHandle = `cap${Date.now().toString(36).slice(-6)}`.slice(0, 32);
		const { error: capProfileError } = await service
			.from('profiles')
			.insert({ id: capOwnerId, handle: capHandle, display_name: 'Cap Owner' });
		if (capProfileError) {
			throw new Error(`Could not seed the cap-test profile: ${capProfileError.message}`);
		}

		// Seed 100 valid rows; every one must succeed (we are AT the cap, not over).
		for (let i = 0; i < 100; i++) {
			const dogId = crypto.randomUUID();
			const { error } = await service.from('hot_dogs').insert({
				id: dogId,
				owner_id: capOwnerId,
				image_path: `${capOwnerId}/${dogId}.webp`,
				byte_size: 1000,
				caption: `dog ${i}`
			});
			expect(error, `seeding row ${i + 1}/100 must succeed (still under the cap)`).toBeNull();
		}

		// The 101st insert must be rejected by the BEFORE INSERT trigger. The trigger
		// raises with errcode 'check_violation' (23514), distinct from a size CHECK
		// because byte_size here is well within bounds.
		const overId = crypto.randomUUID();
		const { error: overError } = await service.from('hot_dogs').insert({
			id: overId,
			owner_id: capOwnerId,
			image_path: `${capOwnerId}/${overId}.webp`,
			byte_size: 1000,
			caption: 'one too many'
		});

		expect(
			overError,
			'the 101st insert must be rejected by the per-user cap trigger'
		).not.toBeNull();
		expect(overError?.code, 'the cap trigger raises check_violation 23514').toBe('23514');

		// Authoritative read-back: still exactly 100 rows (the 101st did not land).
		const { count } = await service
			.from('hot_dogs')
			.select('id', { count: 'exact', head: true })
			.eq('owner_id', capOwnerId);
		expect(count, 'the owner still has exactly 100 dogs').toBe(100);
	});

	test('rejects a > 2 MiB object upload to the hotdogs bucket (Storage API file_size_limit)', async () => {
		// The Storage API enforces the bucket file_size_limit on the ACTUAL object
		// bytes (what neither the DB CHECK nor the trigger can observe). Upload under
		// a valid `{uid}/...` prefix so storage RLS allows the write — the rejection
		// we assert is the size limit, not the prefix policy. Use the user's own
		// authed client so this is the real browser-equivalent write path.
		const supabase = authedClient();
		const oversized = new Uint8Array(MAX_UPLOAD_BYTES + 1);
		const { error } = await supabase.storage
			.from(HOTDOGS_BUCKET)
			.upload(`${userId}/${crypto.randomUUID()}.webp`, oversized, {
				contentType: 'image/webp',
				upsert: false
			});

		expect(error, 'a > 2 MiB object upload must be rejected by the Storage API').not.toBeNull();
	});

	test('accepts a <= 2 MiB object upload to the hotdogs bucket (boundary, allowed)', async () => {
		const supabase = authedClient();
		const atLimit = new Uint8Array(MAX_UPLOAD_BYTES);
		const objectPath = `${userId}/${crypto.randomUUID()}.webp`;
		const { error } = await supabase.storage
			.from(HOTDOGS_BUCKET)
			.upload(objectPath, atLimit, { contentType: 'image/webp', upsert: false });

		expect(error, 'an object exactly at the 2 MiB limit must be accepted').toBeNull();

		// Clean up the object we just uploaded (owner-scoped storage RLS allows it).
		const service = serviceClient();
		await service.storage.from(HOTDOGS_BUCKET).remove([objectPath]);
	});
});
