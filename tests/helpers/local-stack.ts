// Resolves the LOCAL Supabase stack credentials at test time.
//
// The project has BOTH a local stack (Docker, `supabase start`) and a hosted
// project. The E2E smoke MUST target local — never hosted — so we read the
// credentials from `supabase status -o env` at runtime rather than from any
// committed `.env` (the real `.env` is gitignored and points at hosted).
//
// `supabase status -o env` prints `KEY="value"` lines to stdout (and may emit
// an unrelated "Stopped services:" notice on stderr, which we ignore). We parse
// the keys the app and the bootstrap need:
//   - API_URL          -> PUBLIC_SUPABASE_URL
//   - PUBLISHABLE_KEY  -> PUBLIC_SUPABASE_PUBLISHABLE_KEY (browser/app)
//   - SECRET_KEY       -> SUPABASE_SECRET_KEY (server-only; bootstrap service client)
//
// These values are stable, well-known local-dev keys (not secrets); reading
// them via the CLI is the documented way to discover the running stack.

import { execFileSync } from 'node:child_process';

export interface LocalStackCreds {
	apiUrl: string;
	publishableKey: string;
	secretKey: string;
}

function parseEnvOutput(output: string): Record<string, string> {
	const result: Record<string, string> = {};
	for (const line of output.split('\n')) {
		const match = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
		if (match) {
			result[match[1]] = match[2];
		}
	}
	return result;
}

/**
 * Reads the running local Supabase stack's credentials via the Supabase CLI.
 * Throws a clear error if the CLI fails or the stack is not running, so the
 * smoke fails loudly rather than silently falling back to hosted creds.
 */
export function getLocalStackCreds(): LocalStackCreds {
	let raw: string;
	try {
		raw = execFileSync('supabase', ['status', '-o', 'env'], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore']
		});
	} catch (err) {
		throw new Error(
			'Failed to read local Supabase stack credentials via `supabase status -o env`. ' +
				'Is the local stack running? Start it with `supabase start`.',
			{ cause: err }
		);
	}

	const env = parseEnvOutput(raw);
	const apiUrl = env.API_URL;
	const publishableKey = env.PUBLISHABLE_KEY;
	const secretKey = env.SECRET_KEY;

	if (!apiUrl || !publishableKey || !secretKey) {
		throw new Error(
			'Local Supabase stack credentials incomplete. Expected API_URL, PUBLISHABLE_KEY, ' +
				'and SECRET_KEY from `supabase status -o env`. Is the stack fully started?'
		);
	}

	// Guard against accidentally targeting a hosted project from this helper.
	if (!apiUrl.includes('127.0.0.1') && !apiUrl.includes('localhost')) {
		throw new Error(
			`Refusing to run the smoke against a non-local Supabase URL: ${apiUrl}. ` +
				'The smoke must target the local stack only.'
		);
	}

	return { apiUrl, publishableKey, secretKey };
}
