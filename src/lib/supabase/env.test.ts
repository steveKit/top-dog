import { describe, it, expect, vi, beforeEach } from 'vitest';

// `getPublicSupabaseConfig()` is the validation boundary for the public
// Supabase env vars. `$env/dynamic/public` types every value as
// `string | undefined`, so this accessor must fail loudly when a required
// var is missing rather than letting `undefined` flow into client creation.
//
// We mock `$env/dynamic/public` per-test so we can drive present/missing
// permutations deterministically (the real module reflects process env).

const envMock: { env: Record<string, string | undefined> } = { env: {} };

vi.mock('$env/dynamic/public', () => envMock);

async function loadConfig() {
	vi.resetModules();
	const mod = await import('./env');
	return mod.getPublicSupabaseConfig;
}

describe('getPublicSupabaseConfig', () => {
	beforeEach(() => {
		envMock.env = {};
	});

	it('returns url and publishableKey when both are present', async () => {
		envMock.env = {
			PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
			PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc'
		};

		const getPublicSupabaseConfig = await loadConfig();

		expect(getPublicSupabaseConfig()).toEqual({
			url: 'https://example.supabase.co',
			publishableKey: 'sb_publishable_abc'
		});
	});

	it('throws when PUBLIC_SUPABASE_URL is missing', async () => {
		envMock.env = { PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc' };

		const getPublicSupabaseConfig = await loadConfig();

		expect(() => getPublicSupabaseConfig()).toThrow(/PUBLIC_SUPABASE_URL/);
	});

	it('throws when PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing', async () => {
		envMock.env = { PUBLIC_SUPABASE_URL: 'https://example.supabase.co' };

		const getPublicSupabaseConfig = await loadConfig();

		expect(() => getPublicSupabaseConfig()).toThrow(/PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
	});

	it('throws when both vars are missing', async () => {
		envMock.env = {};

		const getPublicSupabaseConfig = await loadConfig();

		expect(() => getPublicSupabaseConfig()).toThrow(/Missing required public env var/);
	});

	it('treats an empty-string value as missing (not a usable key)', async () => {
		envMock.env = {
			PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
			PUBLIC_SUPABASE_PUBLISHABLE_KEY: ''
		};

		const getPublicSupabaseConfig = await loadConfig();

		expect(() => getPublicSupabaseConfig()).toThrow(/PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
	});
});
