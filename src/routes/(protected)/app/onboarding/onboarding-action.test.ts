import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isActionFailure, isRedirect } from '@sveltejs/kit';
import { actions, load } from './+page.server';
import { HANDLE_TAKEN } from '$lib/features/profiles/profiles';

// Test-after coverage for the onboarding load + default action. The action is
// exercised with a fake `event` exposing `locals.supabase` (a `from()` query
// builder + a `storage` surface) and `locals.safeGetSession`. Invariants:
//   - load redirects an already-onboarded user to their profile
//   - a bad-charset/length handle fails BEFORE any insert
//   - a blank display_name defaults to the handle
//   - a taken handle (pre-check OR unique-violation) fails friendly, preserving inputs
//   - a happy path inserts with the trusted session uid and redirects to the profile
//   - an optional avatar is uploaded to {uid}/avatar.webp and its path stored
//   - the avatar path is owner-prefixed (RLS), built via avatarPath()

const A_USER = { id: '11111111-1111-1111-1111-111111111111', email: 'chef@topdog.test' };
const A_SESSION = { access_token: 'tok', user: A_USER };

const NEW_PROFILE = {
	id: A_USER.id,
	handle: 'ChefDog',
	display_name: 'Chef Dog',
	avatar_path: null,
	joined_at: '2026-06-09T00:00:00Z',
	days_as_top_dog: 0,
	is_current_top_dog: false,
	top_dog_since: null
};

const onboard = actions.default;

/**
 * Builds a fake onboarding event. `from('profiles')` supports two shapes used by
 * the action: the `isHandleAvailable` pre-check (select -> eq -> maybeSingle)
 * and `createProfile` (insert -> select -> single). `existingProfile` controls
 * the pre-check result; `insertResult` controls the insert result. Storage
 * `upload` resolves `uploadResult`. Spies are exposed for assertions.
 */
function makeEvent(opts: {
	fields: Record<string, string | Blob>;
	session?: unknown;
	existingProfile?: { data: unknown; error: unknown };
	insertResult?: { data: unknown; error: unknown };
	uploadResult?: { data: unknown; error: unknown };
}) {
	const formData = new FormData();
	for (const [k, v] of Object.entries(opts.fields)) {
		formData.set(k, v);
	}

	const existingProfile = opts.existingProfile ?? { data: null, error: null };
	const insertResult = opts.insertResult ?? { data: NEW_PROFILE, error: null };

	// select -> eq -> maybeSingle (pre-check / available)
	const maybeSingle = vi.fn().mockResolvedValue(existingProfile);
	const eq = vi.fn(() => ({ maybeSingle }));
	// insert -> select -> single (create)
	const single = vi.fn().mockResolvedValue(insertResult);
	const insertSelect = vi.fn(() => ({ single }));
	const insert = vi.fn(() => ({ select: insertSelect }));
	// select() returns a builder supporting both .eq() (pre-check) chains
	const select = vi.fn(() => ({ eq }));
	const from = vi.fn(() => ({ select, insert }));

	const storageUpload = vi
		.fn()
		.mockResolvedValue(
			opts.uploadResult ?? { data: { path: `${A_USER.id}/avatar.webp` }, error: null }
		);
	const getPublicUrl = vi.fn(() => ({ data: { publicUrl: 'https://x/avatar.webp' } }));
	const storageFrom = vi.fn(() => ({ upload: storageUpload, getPublicUrl }));

	const safeGetSession = vi.fn(async () => {
		const session = 'session' in opts ? opts.session : A_SESSION;
		return { session, user: session ? A_USER : null };
	});

	// A raw getSession spy: the action MUST NOT use this (auth-trust boundary —
	// only the JWT-revalidating safeGetSession is trusted). We assert it's untouched.
	const rawGetSession = vi.fn(async () => ({ data: { session: A_SESSION }, error: null }));
	const getUser = vi.fn(async () => ({ data: { user: A_USER }, error: null }));

	const event = {
		request: { formData: vi.fn().mockResolvedValue(formData) },
		locals: {
			supabase: {
				from,
				storage: { from: storageFrom },
				auth: { getSession: rawGetSession, getUser }
			},
			safeGetSession
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;

	return { event, from, insert, storageUpload, storageFrom, safeGetSession, rawGetSession };
}

describe('onboarding load', () => {
	beforeEach(() => vi.clearAllMocks());

	it('redirects an already-onboarded user to their profile page', async () => {
		const maybeSingle = vi.fn().mockResolvedValue({ data: NEW_PROFILE, error: null });
		const eq = vi.fn(() => ({ maybeSingle }));
		const select = vi.fn(() => ({ eq }));
		const from = vi.fn(() => ({ select }));
		const safeGetSession = vi.fn(async () => ({ session: A_SESSION, user: A_USER }));

		let thrown: unknown;
		try {
			await load({
				locals: { supabase: { from }, safeGetSession }
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} as any);
		} catch (e) {
			thrown = e;
		}

		expect(isRedirect(thrown)).toBe(true);
		expect((thrown as { location: string }).location).toBe('/app/profile/ChefDog');
	});

	it('renders (returns {}) for a profile-less user', async () => {
		const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
		const eq = vi.fn(() => ({ maybeSingle }));
		const select = vi.fn(() => ({ eq }));
		const from = vi.fn(() => ({ select }));
		const safeGetSession = vi.fn(async () => ({ session: A_SESSION, user: A_USER }));

		const result = await load({
			locals: { supabase: { from }, safeGetSession }
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any);

		expect(result).toEqual({});
	});
});

describe('onboarding default action', () => {
	beforeEach(() => vi.clearAllMocks());

	it('rejects a bad-charset handle before any insert', async () => {
		const { event, insert } = makeEvent({ fields: { handle: 'chef dog!', display_name: 'Chef' } });

		const result = await onboard(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { data: { error: string } }).data.error).toMatch(
			/letters, numbers, and underscores/i
		);
		expect(insert).not.toHaveBeenCalled();
	});

	it('rejects a too-short handle before any insert', async () => {
		const { event, insert } = makeEvent({ fields: { handle: 'a', display_name: 'Chef' } });

		const result = await onboard(event);

		expect(isActionFailure(result)).toBe(true);
		expect(insert).not.toHaveBeenCalled();
	});

	it('fails when the pre-check reports the handle is taken', async () => {
		const { event, insert } = makeEvent({
			fields: { handle: 'ChefDog', display_name: 'Chef' },
			existingProfile: { data: { id: 'someone-else' }, error: null }
		});

		const result = await onboard(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { data: { error: string } }).data.error).toMatch(/taken/i);
		expect((result as { data: { handle: string } }).data.handle).toBe('ChefDog');
		expect(insert).not.toHaveBeenCalled();
	});

	it('inserts with the trusted session uid and redirects to the profile on success', async () => {
		const { event, insert } = makeEvent({
			fields: { handle: 'ChefDog', display_name: 'Chef Dog' }
		});

		let thrown: unknown;
		try {
			await onboard(event);
		} catch (e) {
			thrown = e;
		}

		expect(insert).toHaveBeenCalledWith(
			expect.objectContaining({ id: A_USER.id, handle: 'ChefDog', display_name: 'Chef Dog' })
		);
		expect(isRedirect(thrown)).toBe(true);
		expect((thrown as { location: string }).location).toBe('/app/profile/ChefDog');
	});

	it('defaults a blank display_name to the handle', async () => {
		const { event, insert } = makeEvent({ fields: { handle: 'ChefDog', display_name: '' } });

		try {
			await onboard(event);
		} catch {
			// redirect on success
		}

		expect(insert).toHaveBeenCalledWith(expect.objectContaining({ display_name: 'ChefDog' }));
	});

	it('maps a unique-violation on insert to a friendly taken message, preserving inputs', async () => {
		const { event } = makeEvent({
			fields: { handle: 'ChefDog', display_name: 'Chef Dog' },
			insertResult: { data: null, error: { code: '23505', message: 'duplicate key' } }
		});

		const result = await onboard(event);

		expect(isActionFailure(result)).toBe(true);
		// The action never sees raw HANDLE_TAKEN in its message; it shows a friendly one.
		expect((result as { data: { error: string } }).data.error).toMatch(/taken/i);
		expect((result as { data: { error: string } }).data.error).not.toContain(HANDLE_TAKEN);
		expect((result as { data: { handle: string } }).data.handle).toBe('ChefDog');
	});

	it('uploads an optional avatar to {uid}/avatar.webp and stores the returned path', async () => {
		const avatar = new File([new Uint8Array([1, 2, 3])], 'pic.webp', { type: 'image/webp' });
		const { event, insert, storageUpload, storageFrom } = makeEvent({
			fields: { handle: 'ChefDog', display_name: 'Chef Dog', avatar }
		});

		try {
			await onboard(event);
		} catch {
			// redirect on success
		}

		expect(storageFrom).toHaveBeenCalledWith('avatars');
		const uploadArgs = (storageUpload.mock.calls as unknown[][])[0];
		expect(uploadArgs[0]).toBe(`${A_USER.id}/avatar.webp`);
		expect(insert).toHaveBeenCalledWith(
			expect.objectContaining({ avatar_path: `${A_USER.id}/avatar.webp` })
		);
	});

	it('fails closed (no insert) when the avatar upload errors', async () => {
		const avatar = new File([new Uint8Array([1, 2, 3])], 'pic.webp', { type: 'image/webp' });
		const { event, insert } = makeEvent({
			fields: { handle: 'ChefDog', display_name: 'Chef Dog', avatar },
			uploadResult: { data: null, error: { message: 'storage boom' } }
		});

		const result = await onboard(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { data: { error: string } }).data.error).toMatch(/avatar/i);
		expect(insert).not.toHaveBeenCalled();
	});

	it('returns 401 when there is no validated session', async () => {
		const { event, insert } = makeEvent({
			fields: { handle: 'ChefDog', display_name: 'Chef' },
			session: null
		});

		const result = await onboard(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(401);
		expect(insert).not.toHaveBeenCalled();
	});

	it('reads the session via safeGetSession, never the raw unvalidated getSession', async () => {
		const { event, safeGetSession, rawGetSession } = makeEvent({
			fields: { handle: 'ChefDog', display_name: 'Chef Dog' }
		});

		try {
			await onboard(event);
		} catch {
			// redirect on success
		}

		expect(safeGetSession).toHaveBeenCalled();
		expect(rawGetSession).not.toHaveBeenCalled();
	});

	it('creates the profile with no avatar upload when no avatar is supplied', async () => {
		const { event, insert, storageUpload } = makeEvent({
			fields: { handle: 'ChefDog', display_name: 'Chef Dog' }
		});

		try {
			await onboard(event);
		} catch {
			// redirect on success
		}

		expect(storageUpload).not.toHaveBeenCalled();
		expect(insert).toHaveBeenCalledWith(expect.objectContaining({ avatar_path: null }));
	});

	it('skips the upload and creates the profile when the avatar field is an empty file', async () => {
		// An empty <input type=file> submits a zero-size File; the action must not
		// attempt to upload it (guard: avatarFile.size > 0) and must still onboard.
		const emptyAvatar = new File([], '', { type: 'application/octet-stream' });
		const { event, insert, storageUpload } = makeEvent({
			fields: { handle: 'ChefDog', display_name: 'Chef Dog', avatar: emptyAvatar }
		});

		try {
			await onboard(event);
		} catch {
			// redirect on success
		}

		expect(storageUpload).not.toHaveBeenCalled();
		expect(insert).toHaveBeenCalledWith(expect.objectContaining({ avatar_path: null }));
	});

	it('does not forge another user id — the insert id is the trusted session uid', async () => {
		// Even if a client smuggles an `id` field in the form, the action ignores
		// it and uses user.id from the validated session.
		const { event, insert } = makeEvent({
			fields: { handle: 'ChefDog', display_name: 'Chef Dog', id: 'attacker-supplied-id' }
		});

		try {
			await onboard(event);
		} catch {
			// redirect on success
		}

		expect(insert).toHaveBeenCalledWith(expect.objectContaining({ id: A_USER.id }));
		const insertArg = (insert.mock.calls as Record<string, unknown>[][])[0][0];
		expect(insertArg.id).not.toBe('attacker-supplied-id');
	});
});
