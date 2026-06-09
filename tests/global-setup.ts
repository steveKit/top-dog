// Playwright globalSetup for the M1 vertical-slice smoke.
//
// Two jobs, run once before any spec:
//   1. Resolve the LOCAL Supabase stack credentials (never hosted) and publish
//      them into process.env so the Playwright `webServer` (the built+previewed
//      app) starts with PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_PUBLISHABLE_KEY /
//      SUPABASE_SECRET_KEY all pointing at local. The app reads these via
//      `$env/dynamic/*` at request time, so injecting them here is sufficient.
//   2. Bootstrap the invite chicken-and-egg: invites need an inviter. Using a
//      LOCAL service-role client (bypasses RLS), upsert a stable inviter auth
//      user and mint a fresh UNCONSUMED invite token, then hand the token to the
//      spec via a temp file. Idempotent: safe to re-run; each run mints a new
//      token so reruns never collide on the single-use guard.
//
// The secret key stays in this Node-side setup (and the server-side app) — it is
// NEVER exposed to page/browser code in the spec.

import { createClient } from '@supabase/supabase-js';
import { generateInviteToken } from '../src/lib/features/invites/token';
import { getLocalStackCreds } from './helpers/local-stack';
import {
	SMOKE_INVITER_EMAIL,
	SMOKE_INVITER_PASSWORD,
	writeBootstrap
} from './helpers/bootstrap-fixtures';

async function globalSetup(): Promise<void> {
	const creds = getLocalStackCreds();

	// (1) Wire the local-stack creds into the env the previewed app inherits.
	process.env.PUBLIC_SUPABASE_URL = creds.apiUrl;
	process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY = creds.publishableKey;
	process.env.SUPABASE_SECRET_KEY = creds.secretKey;

	// (2) Bootstrap the inviter + a fresh invite using a service-role client.
	const service = createClient(creds.apiUrl, creds.secretKey, {
		auth: { autoRefreshToken: false, persistSession: false }
	});

	// Upsert the stable inviter. createUser fails if the email already exists
	// (a prior run), so look it up and reuse it in that case — keeping the
	// bootstrap idempotent.
	let inviterId: string | undefined;
	const { data: created, error: createError } = await service.auth.admin.createUser({
		email: SMOKE_INVITER_EMAIL,
		password: SMOKE_INVITER_PASSWORD,
		email_confirm: true
	});

	if (created?.user) {
		inviterId = created.user.id;
	} else {
		// Already exists (re-run) or some other error: find the existing inviter.
		const { data: list, error: listError } = await service.auth.admin.listUsers({
			page: 1,
			perPage: 1000
		});
		if (listError) {
			throw new Error(
				`Smoke bootstrap: could not create or list the inviter user. ` +
					`createUser error: ${createError?.message}; listUsers error: ${listError.message}`
			);
		}
		inviterId = list.users.find((u) => u.email === SMOKE_INVITER_EMAIL)?.id;
	}

	if (!inviterId) {
		throw new Error(
			`Smoke bootstrap: failed to resolve the inviter user id for ${SMOKE_INVITER_EMAIL}.`
		);
	}

	// Mint a fresh, unconsumed invite owned by the inviter. The service client
	// bypasses RLS, so we insert directly with a known token.
	const token = generateInviteToken();
	const { error: insertError } = await service
		.from('invites')
		.insert({ inviter_id: inviterId, token });

	if (insertError) {
		throw new Error(`Smoke bootstrap: failed to insert the invite row: ${insertError.message}`);
	}

	writeBootstrap({ token, apiUrl: creds.apiUrl });
}

export default globalSetup;
