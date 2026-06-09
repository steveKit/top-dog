import { defineConfig } from '@playwright/test';
import { getLocalStackCreds } from './tests/helpers/local-stack';

// Resolve the LOCAL Supabase stack credentials at config-eval time so the built
// + previewed app's `$env/dynamic/public` points at LOCAL, never hosted. The
// real `.env` is gitignored and targets hosted, so we never read it — we read
// the running stack via the Supabase CLI. globalSetup additionally uses the
// secret key to bootstrap the invite fixture. The secret key is passed only to
// the server-side preview process, never to browser/page code.
const local = getLocalStackCreds();

export default defineConfig({
	globalSetup: './tests/global-setup.ts',
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		env: {
			PUBLIC_SUPABASE_URL: local.apiUrl,
			PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.publishableKey,
			SUPABASE_SECRET_KEY: local.secretKey
		}
	},
	testMatch: '**/*.e2e.{ts,js}'
});
