import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isRedirect, isHttpError, isActionFailure } from '@sveltejs/kit';

// Test-after coverage for the DM thread load + `send` action (TASK-051; project
// strategy: test-after for load functions / form actions / route wiring). The
// thread is the conversation with ONE other member plus a compose box. Both the
// load and the action MUST:
//   - read the session via safeGetSession() (never raw getSession()), failing
//     closed (load -> redirect /sign-in; action -> 401) when unauthenticated;
//   - resolve the counterparty from the TRUSTED route param params.handle (never
//     a client id), 404ing an unknown handle and 500ing a target read error;
//   - SELF-handle (counterparty.id === session uid) redirects the load back to
//     the inbox;
//   - load lists the thread oldest-first AND marks the viewer's received unread
//     messages read on load (mark-read failure degrades, does NOT fail the page);
//   - the `send` action derives the SENDER from the SESSION (auth.uid()), NEVER a
//     client field — a hostile sender_id in the form is ignored (the load-bearing
//     security test) — and maps a sendDm failure -> fail(400) with the raw error
//     never leaked and a server-side log.
//
// The profiles + dms modules are dependency-injected via their import surface; we
// mock the network-touching wrappers and assert orchestration + the trust
// boundary. The privacy SELECT RLS, the sender-pin INSERT WITH CHECK, and the
// recipient-only read_at UPDATE are live-DB coverage (tests/dms.e2e.ts).

vi.mock('$lib/features/profiles/profiles', () => ({
	getProfileByHandle: vi.fn()
}));

vi.mock('$lib/features/dms/dms', () => ({
	sendDm: vi.fn(),
	listThread: vi.fn(),
	markThreadRead: vi.fn()
}));

import { load, actions } from './+page.server';
import { getProfileByHandle } from '$lib/features/profiles/profiles';
import { sendDm, listThread, markThreadRead } from '$lib/features/dms/dms';

const send_ = actions.send;

const USER_ID = '11111111-1111-4111-8111-111111111111';
const VALID_USER = { id: USER_ID, email: 'viewer@topdog.test' };
const VALID_SESSION = { access_token: 'valid', user: VALID_USER };

const COUNTERPARTY_ID = '22222222-2222-4222-8222-222222222222';
const COUNTERPARTY = {
	id: COUNTERPARTY_ID,
	handle: 'ChefDog',
	display_name: 'Chef Dog',
	avatar_path: null,
	joined_at: '2026-06-09T00:00:00Z',
	days_as_top_dog: 0,
	is_current_top_dog: false,
	top_dog_since: null
};

const THREAD_MESSAGES = [
	{
		id: 'm-1',
		sender_id: COUNTERPARTY_ID,
		recipient_id: USER_ID,
		body: 'first',
		created_at: '2026-06-16T09:00:00Z',
		read_at: null
	}
];

/**
 * Builds a fake event for both the load and the send action. `formFields` is
 * appended to FormData for the action; `rawGetSession` is exposed so we can prove
 * the code never reaches for the unvalidated session.
 */
function makeEvent(opts: {
	session: unknown;
	user: unknown;
	handle?: string;
	formFields?: Record<string, string>;
}) {
	const form = new FormData();
	for (const [k, v] of Object.entries(opts.formFields ?? {})) {
		form.append(k, v);
	}
	const request = { formData: vi.fn(async () => form) };
	const safeGetSession = vi.fn(async () => ({ session: opts.session, user: opts.user }));
	const rawGetSession = vi.fn(async () => ({ data: { session: null }, error: null }));

	const event = {
		request,
		params: { handle: opts.handle ?? 'ChefDog' },
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
	vi.mocked(getProfileByHandle).mockResolvedValue({ ok: true, data: COUNTERPARTY });
	vi.mocked(listThread).mockResolvedValue({ ok: true, data: THREAD_MESSAGES });
	vi.mocked(markThreadRead).mockResolvedValue({ ok: true, data: null });
	vi.mocked(sendDm).mockResolvedValue({ ok: true, data: null });
});

describe('messages thread load', () => {
	it('reads the session via safeGetSession(), never raw getSession()', async () => {
		const { event, safeGetSession, rawGetSession } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER
		});

		await load(event);

		expect(safeGetSession).toHaveBeenCalledOnce();
		expect(rawGetSession).not.toHaveBeenCalled();
	});

	it('resolves the counterparty from params.handle, lists the thread, and returns it with viewerId', async () => {
		const { event } = makeEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await load(event);

		expect(getProfileByHandle).toHaveBeenCalledWith(event.locals.supabase, 'ChefDog');
		expect(listThread).toHaveBeenCalledWith(event.locals.supabase, USER_ID, COUNTERPARTY_ID);
		expect(result).toMatchObject({
			counterparty: { id: COUNTERPARTY_ID, handle: 'ChefDog', display_name: 'Chef Dog' },
			messages: THREAD_MESSAGES,
			viewerId: USER_ID
		});
	});

	it('marks the viewer’s received unread messages read on load (recipient=viewer, sender=counterparty)', async () => {
		const { event } = makeEvent({ session: VALID_SESSION, user: VALID_USER });

		await load(event);

		expect(markThreadRead).toHaveBeenCalledWith(event.locals.supabase, USER_ID, COUNTERPARTY_ID);
	});

	it('redirects to /sign-in when unauthenticated; never resolves the counterparty or reads the thread', async () => {
		const { event } = makeEvent({ session: null, user: null });

		await expect(load(event)).rejects.toSatisfy((e: unknown) => {
			return isRedirect(e) && (e as { location: string }).location === '/sign-in';
		});
		expect(getProfileByHandle).not.toHaveBeenCalled();
		expect(listThread).not.toHaveBeenCalled();
	});

	it('redirects a SELF-handle thread back to the inbox (/snacktum-snacktorum/epistles); never lists a self-thread', async () => {
		// The resolved counterparty is the viewer themselves.
		vi.mocked(getProfileByHandle).mockResolvedValue({
			ok: true,
			data: { ...COUNTERPARTY, id: USER_ID }
		});
		const { event } = makeEvent({ session: VALID_SESSION, user: VALID_USER });

		await expect(load(event)).rejects.toSatisfy((e: unknown) => {
			return (
				isRedirect(e) && (e as { location: string }).location === '/snacktum-snacktorum/epistles'
			);
		});
		expect(listThread).not.toHaveBeenCalled();
	});

	it('404s an unknown counterparty handle; never reads the thread', async () => {
		vi.mocked(getProfileByHandle).mockResolvedValue({ ok: true, data: null });
		const { event } = makeEvent({ session: VALID_SESSION, user: VALID_USER, handle: 'nobody' });

		await expect(load(event)).rejects.toSatisfy((e: unknown) => {
			return isHttpError(e) && (e as { status: number }).status === 404;
		});
		expect(listThread).not.toHaveBeenCalled();
	});

	it('500s a counterparty read error (does not swallow); never reads the thread', async () => {
		vi.mocked(getProfileByHandle).mockResolvedValue({ ok: false, error: 'target read boom' });
		const { event } = makeEvent({ session: VALID_SESSION, user: VALID_USER });

		await expect(load(event)).rejects.toSatisfy((e: unknown) => {
			return isHttpError(e) && (e as { status: number }).status === 500;
		});
		expect(listThread).not.toHaveBeenCalled();
		expect(console.error).toHaveBeenCalled();
	});

	it('500s a listThread error (does not swallow)', async () => {
		vi.mocked(listThread).mockResolvedValue({ ok: false, error: 'thread read boom' });
		const { event } = makeEvent({ session: VALID_SESSION, user: VALID_USER });

		await expect(load(event)).rejects.toSatisfy((e: unknown) => {
			return isHttpError(e) && (e as { status: number }).status === 500;
		});
		expect(console.error).toHaveBeenCalled();
	});

	it('DEGRADES (does NOT fail the page) when markThreadRead fails — thread still returns, logs server-side', async () => {
		vi.mocked(markThreadRead).mockResolvedValue({ ok: false, error: 'mark-read boom' });
		const { event } = makeEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await load(event);

		// The page renders the thread; only the unread badges linger.
		expect(result).toMatchObject({ messages: THREAD_MESSAGES });
		expect(console.error).toHaveBeenCalled();
	});
});

describe('messages thread send action', () => {
	it('reads the session via safeGetSession(), never raw getSession()', async () => {
		const { event, safeGetSession, rawGetSession } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { body: 'hello' }
		});

		await send_(event);

		expect(safeGetSession).toHaveBeenCalledOnce();
		expect(rawGetSession).not.toHaveBeenCalled();
	});

	it('success: calls sendDm with the SESSION sender id, the params.handle counterparty, and the form body', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { body: 'hello there' }
		});

		const result = await send_(event);

		expect(getProfileByHandle).toHaveBeenCalledWith(event.locals.supabase, 'ChefDog');
		// sendDm(client, senderId=SESSION uid, recipientId=resolved counterparty, body).
		expect(sendDm).toHaveBeenCalledWith(
			event.locals.supabase,
			USER_ID,
			COUNTERPARTY_ID,
			'hello there'
		);
		expect(result).toEqual({ sent: true });
	});

	it('IGNORES a hostile client-supplied sender_id: the sender comes from the session, not the form', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { body: 'forge attempt', sender_id: 'attacker-uuid' }
		});

		await send_(event);

		// sendDm(client, senderId, recipientId, body) — senderId is the trusted
		// session uid, NEVER the forged form value.
		const callArgs = vi.mocked(sendDm).mock.calls[0];
		expect(callArgs[1]).toBe(USER_ID);
		expect(callArgs[1]).not.toBe('attacker-uuid');
	});

	it('IGNORES a hostile client-supplied recipient id: the recipient comes from params.handle, not the form', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { body: 'forge attempt', recipient_id: 'attacker-target' }
		});

		await send_(event);

		const callArgs = vi.mocked(sendDm).mock.calls[0];
		expect(callArgs[2]).toBe(COUNTERPARTY_ID);
		expect(callArgs[2]).not.toBe('attacker-target');
	});

	it('fails closed with 401 when unauthenticated; never resolves the counterparty or sends', async () => {
		const { event } = makeEvent({
			session: null,
			user: null,
			formFields: { body: 'hi' }
		});

		const result = await send_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(401);
		expect(getProfileByHandle).not.toHaveBeenCalled();
		expect(sendDm).not.toHaveBeenCalled();
	});

	it('fails closed with 401 when a user is present but the session is null', async () => {
		const { event } = makeEvent({
			session: null,
			user: VALID_USER,
			formFields: { body: 'hi' }
		});

		const result = await send_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(401);
		expect(sendDm).not.toHaveBeenCalled();
	});

	it('404s an unknown recipient handle; never sends', async () => {
		vi.mocked(getProfileByHandle).mockResolvedValue({ ok: true, data: null });
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { body: 'hi' },
			handle: 'nobody'
		});

		const result = await send_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(404);
		expect(sendDm).not.toHaveBeenCalled();
	});

	it('500s a recipient read error (does not swallow); never sends', async () => {
		vi.mocked(getProfileByHandle).mockResolvedValue({ ok: false, error: 'target read boom' });
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { body: 'hi' }
		});

		const result = await send_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(500);
		expect(sendDm).not.toHaveBeenCalled();
		expect(console.error).toHaveBeenCalled();
	});

	it('maps a sendDm failure to a fail(400) with the friendly error surfaced (raw not leaked) and logs server-side', async () => {
		vi.mocked(sendDm).mockResolvedValue({ ok: false, error: 'Your message can’t be empty.' });
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { body: '   ' }
		});

		const result = await send_(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { message: string } };
		expect(failure.status).toBe(400);
		expect(failure.data.message).toBe('Your message can’t be empty.');
		expect(console.error).toHaveBeenCalled();
	});
});
