import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { getLocalStackCreds } from './helpers/local-stack';

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
