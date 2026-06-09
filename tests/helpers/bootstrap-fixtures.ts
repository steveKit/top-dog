// Shared constants + handoff for the smoke bootstrap.
//
// globalSetup mints a fresh invite token (and the inviter that owns it) using a
// LOCAL service-role client, then writes the token to a temp file so the spec
// (a separate process) can read it. We keep the inviter identity stable across
// runs (a known email) and make the whole bootstrap idempotent: a re-run upserts
// the inviter and mints a new unconsumed token, so repeated runs never collide.

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

/** Stable identity for the smoke inviter (re-used / upserted across runs). */
export const SMOKE_INVITER_EMAIL = 'smoke-inviter@topdog.test';
export const SMOKE_INVITER_PASSWORD = 'smoke-inviter-password-123';

/** Where globalSetup writes the freshly-minted invite token for the spec. */
export const BOOTSTRAP_FILE = join(tmpdir(), 'top-dog-smoke-bootstrap.json');

export interface BootstrapData {
	/** Unconsumed invite token the smoke redeems. */
	token: string;
	/** The local stack API URL (sanity-check the spec hit local, not hosted). */
	apiUrl: string;
}

export function writeBootstrap(data: BootstrapData): void {
	writeFileSync(BOOTSTRAP_FILE, JSON.stringify(data), 'utf8');
}

export function readBootstrap(): BootstrapData {
	try {
		return JSON.parse(readFileSync(BOOTSTRAP_FILE, 'utf8')) as BootstrapData;
	} catch (err) {
		throw new Error(
			`Could not read smoke bootstrap file at ${BOOTSTRAP_FILE}. Did globalSetup run?`,
			{ cause: err }
		);
	}
}
