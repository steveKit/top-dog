import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isActionFailure } from '@sveltejs/kit';

// Test-after coverage for the profile `post` and `deleteMessage` form actions
// (TASK-050 — project strategy: test-after for form actions / route wiring). Wall
// messages are cosmetic/many-allowed (decision #12/#15): plain owner-scoped RLS
// write, no RPC. The actions MUST:
//   - read the session via safeGetSession() (never raw getSession()), failing
//     closed with 401 when unauthenticated;
//   - derive the AUTHOR id from the SESSION (auth.uid()), NEVER a client field — a
//     hostile author_id in the form is ignored (the load-bearing security test);
//   - resolve the wall owner (post) from the TRUSTED route param params.handle
//     (never a client-supplied id), 404ing an unknown handle and 500ing a target
//     read error (never swallowed);
//   - forward the body / messageId and map a wrapper failure -> fail() with the
//     raw error never leaked and a server-side log.
//
// The profiles + walls modules are dependency-injected via their import surface;
// we mock the network-touching wrappers and keep the REAL postWallMessage /
// deleteWallMessage validation unmocked where it is cheap to do so (the body
// boundary is unit-tested directly in walls.test.ts; here we assert the action's
// orchestration + trust boundary). The RLS author-pin / delete-authorization
// guarantees are live-DB coverage (tests/walls.e2e.ts).

vi.mock('$lib/features/profiles/profiles', () => ({
	getProfileByHandle: vi.fn(),
	getProfileById: vi.fn()
}));

vi.mock('$lib/features/mustard/sprays', () => ({
	addSpray: vi.fn(),
	listSpraysForProfile: vi.fn(),
	listAnointmentsForProfile: vi.fn(),
	NOT_TOP_DOG: 'Only The Anointed Wiener may anoint a disciple in mustard.'
}));

vi.mock('$lib/features/walls/walls', () => ({
	postWallMessage: vi.fn(),
	listWallMessages: vi.fn(),
	deleteWallMessage: vi.fn()
}));

vi.mock('$lib/storage', () => ({
	getPublicUrl: vi.fn()
}));

import { actions } from './+page.server';
import { getProfileByHandle } from '$lib/features/profiles/profiles';
import { postWallMessage, deleteWallMessage } from '$lib/features/walls/walls';

const post_ = actions.post;
const deleteMessage_ = actions.deleteMessage;

const USER_ID = '11111111-1111-4111-8111-111111111111';
const VALID_USER = { id: USER_ID, email: 'poster@topdog.test' };
const VALID_SESSION = { access_token: 'valid', user: VALID_USER };

const TARGET_ID = 'target-profile-uuid';
const TARGET_PROFILE = {
	id: TARGET_ID,
	handle: 'ChefDog',
	display_name: 'Chef Dog',
	avatar_path: null,
	joined_at: '2026-06-09T00:00:00Z',
	days_as_top_dog: 0,
	is_current_top_dog: false,
	top_dog_since: null
};

/**
 * Builds a fake action event. `formFields` is appended to FormData; `rawGetSession`
 * is exposed so we can prove the action never reaches for the unvalidated session.
 */
function makeEvent(opts: {
	session: unknown;
	user: unknown;
	formFields?: Record<string, string>;
	handle?: string;
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
	vi.mocked(getProfileByHandle).mockResolvedValue({ ok: true, data: TARGET_PROFILE });
	vi.mocked(postWallMessage).mockResolvedValue({ ok: true, data: null });
	vi.mocked(deleteWallMessage).mockResolvedValue({ ok: true, data: null });
});

describe('profile post (wall message) action', () => {
	it('reads the session via safeGetSession(), never raw getSession()', async () => {
		const { event, safeGetSession, rawGetSession } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { body: 'Hi there' }
		});

		await post_(event);

		expect(safeGetSession).toHaveBeenCalledOnce();
		expect(rawGetSession).not.toHaveBeenCalled();
	});

	it('success: calls postWallMessage with the SESSION user id as author, the route-resolved target, and the form body', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { body: 'Nice dog!' }
		});

		const result = await post_(event);

		// Target wall owner is resolved from the trusted route param, not a client id.
		expect(getProfileByHandle).toHaveBeenCalledWith(event.locals.supabase, 'ChefDog');
		// postWallMessage(client, authorId=SESSION uid, profileId=target, body).
		expect(postWallMessage).toHaveBeenCalledWith(
			event.locals.supabase,
			USER_ID,
			TARGET_ID,
			'Nice dog!'
		);
		expect(result).toEqual({ posted: true });
	});

	it('IGNORES a hostile client-supplied author_id: the author comes from the session, not the form', async () => {
		// The load-bearing trust-boundary test: a forged author_id must never reach
		// the wrapper — the author is the trusted session uid.
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { body: 'forged?', author_id: 'attacker-uuid' }
		});

		await post_(event);

		const callArgs = vi.mocked(postWallMessage).mock.calls[0];
		// postWallMessage(client, authorId, profileId, body) — authorId is the
		// trusted session uid, NEVER the forged form value.
		expect(callArgs[1]).toBe(USER_ID);
		expect(callArgs[1]).not.toBe('attacker-uuid');
	});

	it('IGNORES a hostile client-supplied profile/target id: the wall owner comes from params.handle, not the form', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { body: 'forged target?', profile_id: 'attacker-target' }
		});

		await post_(event);

		const callArgs = vi.mocked(postWallMessage).mock.calls[0];
		// The wall owner is the route-resolved profile id, never a form-supplied one.
		expect(callArgs[2]).toBe(TARGET_ID);
		expect(callArgs[2]).not.toBe('attacker-target');
	});

	it('fails closed with 401 when unauthenticated; never resolves the target or posts', async () => {
		const { event } = makeEvent({
			session: null,
			user: null,
			formFields: { body: 'should not post' }
		});

		const result = await post_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(401);
		expect(getProfileByHandle).not.toHaveBeenCalled();
		expect(postWallMessage).not.toHaveBeenCalled();
	});

	it('fails closed with 401 when a user is present but the session is null', async () => {
		const { event } = makeEvent({
			session: null,
			user: VALID_USER,
			formFields: { body: 'should not post' }
		});

		const result = await post_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(401);
		expect(postWallMessage).not.toHaveBeenCalled();
	});

	it('404s an unknown target handle; never posts', async () => {
		vi.mocked(getProfileByHandle).mockResolvedValue({ ok: true, data: null });
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { body: 'hi' },
			handle: 'nobody'
		});

		const result = await post_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(404);
		expect(postWallMessage).not.toHaveBeenCalled();
	});

	it('500s a target read error (does not swallow); never posts; logs server-side', async () => {
		vi.mocked(getProfileByHandle).mockResolvedValue({ ok: false, error: 'target read boom' });
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { body: 'hi' }
		});

		const result = await post_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(500);
		expect(postWallMessage).not.toHaveBeenCalled();
		expect(console.error).toHaveBeenCalled();
	});

	it('maps a postWallMessage failure to a 400 with the friendly message (raw error not leaked); logs server-side', async () => {
		vi.mocked(postWallMessage).mockResolvedValue({
			ok: false,
			error: 'Your message can’t be empty.'
		});
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { body: '' }
		});

		const result = await post_(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { message: string } };
		expect(failure.status).toBe(400);
		expect(failure.data.message).toBe('Your message can’t be empty.');
		expect(console.error).toHaveBeenCalled();
	});

	it('forwards a MISSING body field as an empty string to the wrapper (boundary validates it)', async () => {
		// String(formData.get('body') ?? '') coerces an absent field to '' — the
		// wrapper's empty-body guard is the authoritative reject (asserted in
		// walls.test.ts). Here we only prove the action forwards '' rather than
		// throwing on a missing field.
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: {}
		});

		await post_(event);

		const callArgs = vi.mocked(postWallMessage).mock.calls[0];
		expect(callArgs[3]).toBe('');
	});
});

describe('profile deleteMessage action', () => {
	const MESSAGE_ID = 'message-uuid-to-delete';

	it('reads the session via safeGetSession(), never raw getSession()', async () => {
		const { event, safeGetSession, rawGetSession } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { messageId: MESSAGE_ID }
		});

		await deleteMessage_(event);

		expect(safeGetSession).toHaveBeenCalledOnce();
		expect(rawGetSession).not.toHaveBeenCalled();
	});

	it('success: calls deleteWallMessage with the form messageId and returns { deleted: true }', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { messageId: MESSAGE_ID }
		});

		const result = await deleteMessage_(event);

		expect(deleteWallMessage).toHaveBeenCalledWith(event.locals.supabase, MESSAGE_ID);
		expect(result).toEqual({ deleted: true });
	});

	it('fails closed with 401 when unauthenticated; never deletes', async () => {
		const { event } = makeEvent({
			session: null,
			user: null,
			formFields: { messageId: MESSAGE_ID }
		});

		const result = await deleteMessage_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(401);
		expect(deleteWallMessage).not.toHaveBeenCalled();
	});

	it('rejects a missing/blank messageId with a boundary 400; never deletes', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { messageId: '   ' }
		});

		const result = await deleteMessage_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect(deleteWallMessage).not.toHaveBeenCalled();
	});

	it('maps a deleteWallMessage failure to a 400 with the friendly message (raw error not leaked); logs server-side', async () => {
		vi.mocked(deleteWallMessage).mockResolvedValue({
			ok: false,
			error: 'Could not delete that message right now.'
		});
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { messageId: MESSAGE_ID }
		});

		const result = await deleteMessage_(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { message: string } };
		expect(failure.status).toBe(400);
		expect(failure.data.message).toBe('Could not delete that message right now.');
		expect(console.error).toHaveBeenCalled();
	});
});
