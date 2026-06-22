import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isRedirect, isHttpError } from '@sveltejs/kit';

// Test-after coverage for the DM inbox load (TASK-051; project strategy:
// test-after for load functions / route wiring). The inbox load is a read
// surface: safeGetSession()-gated, it lists the viewer's conversations via
// listConversations on the RLS-scoped event.locals.supabase (the SELECT RLS
// already limits visibility to the viewer's own DMs), with the viewer id taken
// from the validated session (never client input). It MUST:
//   - read the session via safeGetSession() (never raw getSession());
//   - redirect unauthenticated visitors -> /sign-in (never reaches the read);
//   - return { conversations } on success;
//   - 500 a listConversations failure (never swallowed, server-side log).
//
// listConversations is dependency-injected via its import surface, so we mock the
// network-touching wrapper and assert the load's orchestration directly. The
// privacy SELECT RLS guarantee is live-DB coverage (tests/dms.e2e.ts).

vi.mock('$lib/features/dms/dms', () => ({
	listConversations: vi.fn()
}));

import { load } from './+page.server';
import { listConversations } from '$lib/features/dms/dms';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const VALID_USER = { id: USER_ID, email: 'viewer@topdog.test' };
const VALID_SESSION = { access_token: 'valid', user: VALID_USER };

const SAMPLE_CONVERSATIONS = [
	{
		counterpartyId: '22222222-2222-4222-8222-222222222222',
		counterpartyHandle: 'alice',
		counterpartyDisplayName: 'Alice',
		lastBody: 'hey',
		lastAt: '2026-06-16T10:00:00Z',
		unreadCount: 2
	}
];

function makeEvent(opts: { session: unknown; user: unknown }) {
	const safeGetSession = vi.fn(async () => ({ session: opts.session, user: opts.user }));
	const rawGetSession = vi.fn(async () => ({ data: { session: null }, error: null }));
	const event = {
		locals: {
			supabase: { __brand: 'rls-client', auth: { getSession: rawGetSession } },
			safeGetSession
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;
	return { event, safeGetSession, rawGetSession };
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(console, 'error').mockImplementation(() => {});
	vi.mocked(listConversations).mockResolvedValue({ ok: true, data: SAMPLE_CONVERSATIONS });
});

describe('messages inbox load', () => {
	it('reads the session via safeGetSession(), never raw getSession()', async () => {
		const { event, safeGetSession, rawGetSession } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER
		});

		await load(event);

		expect(safeGetSession).toHaveBeenCalledOnce();
		expect(rawGetSession).not.toHaveBeenCalled();
	});

	it('lists conversations for the SESSION user on the RLS-scoped client and returns them', async () => {
		const { event } = makeEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await load(event);

		// viewer id comes from the validated session, on the RLS-scoped client.
		expect(listConversations).toHaveBeenCalledWith(event.locals.supabase, USER_ID);
		expect(result).toEqual({ conversations: SAMPLE_CONVERSATIONS });
	});

	it('redirects to /sign-in when unauthenticated; never reads the inbox', async () => {
		const { event } = makeEvent({ session: null, user: null });

		await expect(load(event)).rejects.toSatisfy((e: unknown) => {
			return isRedirect(e) && (e as { status: number; location: string }).location === '/sign-in';
		});
		expect(listConversations).not.toHaveBeenCalled();
	});

	it('redirects to /sign-in when a user is present but the session is null', async () => {
		const { event } = makeEvent({ session: null, user: VALID_USER });

		await expect(load(event)).rejects.toSatisfy((e: unknown) => isRedirect(e));
		expect(listConversations).not.toHaveBeenCalled();
	});

	it('500s a listConversations failure (does not swallow) and logs server-side', async () => {
		vi.mocked(listConversations).mockResolvedValue({
			ok: false,
			error: 'Could not load your messages right now.'
		});
		const { event } = makeEvent({ session: VALID_SESSION, user: VALID_USER });

		await expect(load(event)).rejects.toSatisfy((e: unknown) => {
			return isHttpError(e) && (e as { status: number }).status === 500;
		});
		expect(console.error).toHaveBeenCalled();
	});
});
