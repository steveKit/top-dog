import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isRedirect } from '@sveltejs/kit';

// These tests exercise the two security-critical behaviors of the server hook:
//
//   1. `safeGetSession()` (installed by the `supabase` handle) must validate the
//      JWT via `getUser()` and refuse to trust an unvalidated `getSession()`.
//      If `getUser()` errors or returns no user, it must report an
//      unauthenticated state (null session).
//   2. The `authGuard` handle must redirect unauthenticated requests under
//      `/app` to `/sign-in`, and let authenticated requests (and non-protected
//      paths) through.
//
// We drive the two handles directly (rather than the composed `sequence`,
// which needs SvelteKit's per-request async store) in the same order `sequence`
// runs them: `supabase` first to populate `event.locals`, then `authGuard`.
// `@supabase/ssr` is stubbed so `createServerClient` returns a fake auth client
// we control, and the public env accessor is mocked so the hook can build a
// client without a real Supabase project.

const authStub = {
	getSession: vi.fn(),
	getUser: vi.fn()
};

const createServerClient = vi.fn(() => ({ auth: authStub }));

vi.mock('@supabase/ssr', () => ({
	createServerClient
}));

vi.mock('$env/dynamic/public', () => ({
	env: {
		PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
		PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test'
	}
}));

interface FakeEvent {
	cookies: { getAll: () => unknown[]; set: ReturnType<typeof vi.fn> };
	url: URL;
	locals: App.Locals;
}

function makeEvent(pathname: string): FakeEvent {
	return {
		cookies: {
			getAll: () => [],
			set: vi.fn()
		},
		url: new URL(`http://localhost${pathname}`),
		locals: {} as App.Locals
	};
}

// Runs the `supabase` handle to install `event.locals.supabase` +
// `safeGetSession`, mirroring the first step of the real `sequence`.
async function installLocals(event: FakeEvent) {
	const { supabase } = await import('./hooks.server');
	const resolve = vi.fn(async () => new Response('ok'));
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	await supabase({ event, resolve } as any);
	return resolve;
}

// Runs `supabase` then `authGuard` against a fake event, mirroring `sequence`.
async function runGuard(pathname: string) {
	const event = makeEvent(pathname);
	await installLocals(event);

	const { authGuard } = await import('./hooks.server');
	const resolve = vi.fn(async () => new Response('ok'));

	let thrown: unknown;
	let response: Response | undefined;
	try {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		response = await authGuard({ event, resolve } as any);
	} catch (e) {
		thrown = e;
	}
	return { event, resolve, response, thrown };
}

describe('hooks.server', () => {
	beforeEach(() => {
		authStub.getSession.mockReset();
		authStub.getUser.mockReset();
		createServerClient.mockClear();
	});

	describe('supabase handle — event.locals wiring', () => {
		it('attaches a request-scoped supabase client to event.locals', async () => {
			const event = makeEvent('/');
			await installLocals(event);

			expect(event.locals.supabase).toBeDefined();
			expect(createServerClient).toHaveBeenCalledOnce();
		});

		it('exposes safeGetSession on event.locals', async () => {
			const event = makeEvent('/');
			await installLocals(event);

			expect(typeof event.locals.safeGetSession).toBe('function');
		});

		it('resolves the request after installing locals', async () => {
			const event = makeEvent('/');
			const resolve = await installLocals(event);

			expect(resolve).toHaveBeenCalledOnce();
		});
	});

	describe('safeGetSession — JWT validation', () => {
		it('returns null session when there is no session cookie', async () => {
			authStub.getSession.mockResolvedValue({ data: { session: null } });

			const event = makeEvent('/');
			await installLocals(event);
			const result = await event.locals.safeGetSession();

			expect(result).toEqual({ session: null, user: null });
			expect(authStub.getUser).not.toHaveBeenCalled();
		});

		it('does NOT trust getSession alone — validates via getUser', async () => {
			const fakeSession = { access_token: 'forged', user: { id: 'spoofed' } };
			authStub.getSession.mockResolvedValue({ data: { session: fakeSession } });
			// getUser is the authority: it rejects the forged token.
			authStub.getUser.mockResolvedValue({
				data: { user: null },
				error: { message: 'invalid JWT' }
			});

			const event = makeEvent('/');
			await installLocals(event);
			const result = await event.locals.safeGetSession();

			expect(authStub.getUser).toHaveBeenCalledOnce();
			expect(result).toEqual({ session: null, user: null });
		});

		it('returns null session when getUser returns no user and no error', async () => {
			authStub.getSession.mockResolvedValue({
				data: { session: { access_token: 't', user: { id: 'x' } } }
			});
			authStub.getUser.mockResolvedValue({ data: { user: null }, error: null });

			const event = makeEvent('/');
			await installLocals(event);
			const result = await event.locals.safeGetSession();

			expect(result).toEqual({ session: null, user: null });
		});

		it('returns the validated session and user when getUser succeeds', async () => {
			const session = { access_token: 'valid', user: { id: 'u1' } };
			const user = { id: 'u1', email: 'chef@topdog.test' };
			authStub.getSession.mockResolvedValue({ data: { session } });
			authStub.getUser.mockResolvedValue({ data: { user }, error: null });

			const event = makeEvent('/');
			await installLocals(event);
			const result = await event.locals.safeGetSession();

			expect(result).toEqual({ session, user });
		});
	});

	describe('authGuard', () => {
		it('redirects unauthenticated requests under /app to /sign-in', async () => {
			authStub.getSession.mockResolvedValue({ data: { session: null } });

			const { thrown, resolve } = await runGuard('/app');

			expect(isRedirect(thrown)).toBe(true);
			expect((thrown as { status: number }).status).toBe(303);
			expect((thrown as { location: string }).location).toBe('/sign-in');
			// The request must not be resolved when redirected.
			expect(resolve).not.toHaveBeenCalled();
		});

		it('redirects unauthenticated requests to nested /app paths', async () => {
			authStub.getSession.mockResolvedValue({ data: { session: null } });

			const { thrown } = await runGuard('/app/profile/settings');

			expect(isRedirect(thrown)).toBe(true);
			expect((thrown as { location: string }).location).toBe('/sign-in');
		});

		it('allows authenticated requests under /app through', async () => {
			const session = { access_token: 'valid', user: { id: 'u1' } };
			authStub.getSession.mockResolvedValue({ data: { session } });
			authStub.getUser.mockResolvedValue({
				data: { user: { id: 'u1' } },
				error: null
			});

			const { thrown, resolve, response } = await runGuard('/app');

			expect(thrown).toBeUndefined();
			expect(resolve).toHaveBeenCalledOnce();
			expect(response).toBeInstanceOf(Response);
		});

		it('does not guard non-protected paths even when unauthenticated', async () => {
			authStub.getSession.mockResolvedValue({ data: { session: null } });

			const { thrown, resolve } = await runGuard('/sign-in');

			expect(thrown).toBeUndefined();
			expect(resolve).toHaveBeenCalledOnce();
		});

		it('populates event.locals.session/user from the validated session', async () => {
			const session = { access_token: 'valid', user: { id: 'u1' } };
			const user = { id: 'u1' };
			authStub.getSession.mockResolvedValue({ data: { session } });
			authStub.getUser.mockResolvedValue({ data: { user }, error: null });

			const { event } = await runGuard('/');

			expect(event.locals.session).toEqual(session);
			expect(event.locals.user).toEqual(user);
		});
	});
});
