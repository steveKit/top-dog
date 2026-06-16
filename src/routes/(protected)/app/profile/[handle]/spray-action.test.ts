import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isActionFailure } from '@sveltejs/kit';

// Test-after coverage for the profile `spray` form action (TASK-041 — project
// strategy: test-after for form actions / route wiring). Mustard sprays are
// cosmetic flair gated to the current Top Dog (decision #15). The action MUST:
//   - read the session via safeGetSession() (never raw getSession()), failing
//     closed with 401 when unauthenticated;
//   - derive the sprayer id from the SESSION (auth.uid()), NEVER a client field —
//     a hostile sprayer_id in the form is ignored;
//   - resolve the target from the TRUSTED route param params.handle (never a
//     client-supplied id), 404ing an unknown handle and 500ing a target read error;
//   - validate x/y are finite at the boundary (400 otherwise) and forward them;
//   - map an addSpray NOT_TOP_DOG denial -> 403 and any other failure -> 400, with
//     the raw error never leaked and a server-side log.
//
// The profiles + sprays modules are dependency-injected via their import surface;
// we mock the network-touching wrappers and keep the REAL NOT_TOP_DOG sentinel so
// the action's status mapping is exercised faithfully. The RLS Top-Dog INSERT
// guarantee is live-DB coverage (tests/mustard.e2e.ts).

vi.mock('$lib/features/profiles/profiles', () => ({
	getProfileByHandle: vi.fn(),
	getProfileById: vi.fn()
}));

vi.mock('$lib/features/mustard/sprays', async () => {
	const actual = await vi.importActual<typeof import('$lib/features/mustard/sprays')>(
		'$lib/features/mustard/sprays'
	);
	return {
		...actual,
		addSpray: vi.fn(),
		listSpraysForProfile: vi.fn()
	};
});

vi.mock('$lib/storage', () => ({
	getPublicUrl: vi.fn()
}));

import { actions } from './+page.server';
import { getProfileByHandle } from '$lib/features/profiles/profiles';
import { addSpray, NOT_TOP_DOG } from '$lib/features/mustard/sprays';

const spray_ = actions.spray;

const USER_ID = '11111111-1111-4111-8111-111111111111';
const VALID_USER = { id: USER_ID, email: 'topdog@topdog.test' };
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
	vi.mocked(addSpray).mockResolvedValue({ ok: true, data: null });
});

describe('profile spray action', () => {
	it('reads the session via safeGetSession(), never raw getSession()', async () => {
		const { event, safeGetSession, rawGetSession } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { x: '0.5', y: '0.5' }
		});

		await spray_(event);

		expect(safeGetSession).toHaveBeenCalledOnce();
		expect(rawGetSession).not.toHaveBeenCalled();
	});

	it('success: calls addSpray with the SESSION user id, the target resolved from params.handle, and the form x/y', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { x: '0.25', y: '0.75' }
		});

		const result = await spray_(event);

		// Target is resolved from the trusted route param, not a client id.
		expect(getProfileByHandle).toHaveBeenCalledWith(event.locals.supabase, 'ChefDog');
		// addSpray(client, sprayerId=SESSION uid, targetId, x, y).
		expect(addSpray).toHaveBeenCalledWith(event.locals.supabase, USER_ID, TARGET_ID, 0.25, 0.75);
		expect(result).toEqual({ sprayed: true });
	});

	it('IGNORES a hostile client-supplied sprayer_id: the sprayer comes from the session, not the form', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { x: '0.5', y: '0.5', sprayer_id: 'attacker-uuid' }
		});

		await spray_(event);

		// addSpray(client, sprayerId, targetId, x, y) — sprayerId is the trusted
		// session uid, NEVER the forged form value.
		const callArgs = vi.mocked(addSpray).mock.calls[0];
		expect(callArgs[1]).toBe(USER_ID);
		expect(callArgs[1]).not.toBe('attacker-uuid');
	});

	it('IGNORES a hostile client-supplied target id: the target comes from params.handle, not the form', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { x: '0.5', y: '0.5', target_profile_id: 'attacker-target' }
		});

		await spray_(event);

		const callArgs = vi.mocked(addSpray).mock.calls[0];
		// The target is the route-resolved profile id, never a form-supplied one.
		expect(callArgs[2]).toBe(TARGET_ID);
		expect(callArgs[2]).not.toBe('attacker-target');
	});

	it('fails closed with 401 when unauthenticated; never resolves the target or sprays', async () => {
		const { event } = makeEvent({
			session: null,
			user: null,
			formFields: { x: '0.5', y: '0.5' }
		});

		const result = await spray_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(401);
		expect(getProfileByHandle).not.toHaveBeenCalled();
		expect(addSpray).not.toHaveBeenCalled();
	});

	it('fails closed with 401 when a user is present but the session is null', async () => {
		const { event } = makeEvent({
			session: null,
			user: VALID_USER,
			formFields: { x: '0.5', y: '0.5' }
		});

		const result = await spray_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(401);
		expect(addSpray).not.toHaveBeenCalled();
	});

	it('404s an unknown target handle; never sprays', async () => {
		vi.mocked(getProfileByHandle).mockResolvedValue({ ok: true, data: null });
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { x: '0.5', y: '0.5' },
			handle: 'nobody'
		});

		const result = await spray_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(404);
		expect(addSpray).not.toHaveBeenCalled();
	});

	it('500s a target read error (does not swallow); never sprays', async () => {
		vi.mocked(getProfileByHandle).mockResolvedValue({ ok: false, error: 'target read boom' });
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { x: '0.5', y: '0.5' }
		});

		const result = await spray_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(500);
		expect(addSpray).not.toHaveBeenCalled();
		expect(console.error).toHaveBeenCalled();
	});

	it.each([
		['non-numeric x', { x: 'left', y: '0.5' }],
		['non-numeric y', { x: '0.5', y: 'down' }],
		['non-numeric both', { x: 'abc', y: 'xyz' }]
	])('rejects %s with a boundary 400; never sprays', async (_label, formFields) => {
		// The action parses x/y with Number(...) and rejects non-finite results. A
		// value that does not coerce to a finite number (e.g. 'left', 'down') is a
		// NaN -> boundary 400. (A MISSING field coerces via Number(null) === 0, a
		// valid in-range position, so it is NOT rejected here — see the dedicated
		// "missing field" test below for that contract.)
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: formFields as Record<string, string>
		});

		const result = await spray_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect(addSpray).not.toHaveBeenCalled();
	});

	it('treats a MISSING x/y as 0 (Number(null) === 0, a valid in-range position) — not a 400', async () => {
		// Documents the action's actual coercion contract: an absent field becomes 0,
		// which is a finite, in-range position. The action forwards (0,0) to addSpray
		// rather than failing the boundary check. (The DB CHECK + addSpray range guard
		// still backstop genuinely out-of-range values.)
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: {}
		});

		const result = await spray_(event);

		expect(isActionFailure(result)).toBe(false);
		expect(addSpray).toHaveBeenCalledWith(event.locals.supabase, USER_ID, TARGET_ID, 0, 0);
		expect(result).toEqual({ sprayed: true });
	});

	it('maps an addSpray NOT_TOP_DOG denial to a 403 (raw sentinel surfaced as the friendly message)', async () => {
		vi.mocked(addSpray).mockResolvedValue({ ok: false, error: NOT_TOP_DOG });
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { x: '0.5', y: '0.5' }
		});

		const result = await spray_(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { message: string } };
		expect(failure.status).toBe(403);
		expect(failure.data.message).toBe(NOT_TOP_DOG);
		expect(console.error).toHaveBeenCalled();
	});

	it('maps any other addSpray failure to a 400 (not 403)', async () => {
		vi.mocked(addSpray).mockResolvedValue({
			ok: false,
			error: 'Could not spray mustard right now.'
		});
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { x: '0.5', y: '0.5' }
		});

		const result = await spray_(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { message: string } };
		expect(failure.status).toBe(400);
		expect(failure.status).not.toBe(403);
		expect(console.error).toHaveBeenCalled();
	});
});
