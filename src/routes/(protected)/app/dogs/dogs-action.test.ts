import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isActionFailure, isRedirect } from '@sveltejs/kit';

// Test-after coverage for the hot dog upload / delete form actions and the page
// load (project strategy: test-after for form actions / wiring). This is the M1
// vertical-slice core, so the security- and orphan-sensitive paths are the focus:
//
//   - upload: cap rejection (no upload/insert), storage-guard rejection (no
//     upload/insert), caption-length rejection (>280 fails BEFORE any
//     count/upload/insert; 280 is accepted; empty -> null), happy-path CALL
//     ORDER (count -> usage -> upload -> insert), and the ORPHAN-SAFETY
//     compensating delete (insert fails after a successful upload -> the
//     just-uploaded object is removed with the SAME path).
//   - auth: safeGetSession() used (never raw getSession()); owner_id is the
//     trusted user.id; a smuggled client owner_id/id is ignored; unauth fails closed.
//   - delete: removes the DB row AND the storage object; a storage-removal failure
//     is logged but the action still succeeds; ownership/not-found enforced.
//   - load: lists the owner's dogs + mints a signed URL per row; a failed signed
//     URL degrades to null (no crash); unauth redirects.
//
// The feature + storage modules are dependency-injected via their import surface,
// so we mock them with vi.mock and assert the action's orchestration (ordering,
// trusted ids, compensating cleanup) directly. The RLS / column-privilege /
// real-signed-URL guarantees remain a live-DB coverage gap (deferred to the
// TASK-014 Playwright @smoke), consistent with the tracked feature-test gaps.
//
// DEFERRED to the TASK-014 @smoke (not unit-testable without a live-DB harness;
// no harness is invented here): the DB-level column INSERT grant (a direct
// PostgREST insert cannot seed vote_count / peak_votes) and the
// hot_dogs_caption_length CHECK (a direct insert with a >280-char caption is
// rejected by the DB even when the friendly action layer is bypassed). The
// smoke should assert a forged-counter / oversized-caption direct insert fails.

vi.mock('$lib/features/hotdogs/hotdogs', () => ({
	createHotDog: vi.fn(),
	listHotDogsByOwner: vi.fn(),
	countByOwner: vi.fn(),
	getHotDogById: vi.fn(),
	deleteHotDog: vi.fn(),
	appStorageBytes: vi.fn(),
	isAtCap: (n: number) => n >= 100,
	PER_USER_CAP: 100,
	MAX_UPLOAD_BYTES: 2097152
}));

vi.mock('$lib/storage', () => ({
	upload: vi.fn(),
	remove: vi.fn(),
	getSignedUrl: vi.fn(),
	hotdogPath: (ownerId: string, dogId: string) => `${ownerId}/${dogId}.webp`,
	evaluateUpload: vi.fn(),
	HOTDOGS_BUCKET: 'hotdogs'
}));

// The load now reads LIVE crown state from the signed-in user's own profile to
// drive the Top Dog badge (TASK-023). Mock the profiles module so the load
// tests control whether this user holds the crown. `selectTopDog` (the winning-
// dog comparator) is the REAL pure module — we want the load's mapping into it
// and its real ranking/tie-break to be exercised end-to-end here.
vi.mock('$lib/features/profiles/profiles', () => ({
	getProfileById: vi.fn()
}));

// The gallery load now reads the anonymous burger-alarm aggregate for the owner's
// OWN dogs with the SERVICE client (getBurgerAlarmCounts: `.from('burger_alarms')
// .select('hot_dog_id, created_at').in('hot_dog_id', …)`) — the banner shows when
// YOUR dog has been flagged a hamburger. There is no report control here (you can't
// report your own dog). summarizeBurgerAlarm is the REAL pure module, so the
// render-time alarm summary is exercised through the load. getSignedUrl on this page
// stays on the RLS client (the owner-gallery signs its OWN dogs), so the service
// client backs only the alarm aggregate read.
let serviceAlarmRows: { hot_dog_id: string; created_at: string }[] = [];

function burgerAlarmsFrom(rows: Record<string, unknown>[]) {
	const inFn = vi.fn().mockResolvedValue({ data: rows, error: null });
	const select = vi.fn().mockReturnValue({ in: inFn });
	return { select };
}

vi.mock('$lib/server/supabase', () => ({
	getServiceClient: vi.fn(() => ({
		from: vi.fn((table: string) => {
			if (table === 'burger_alarms') return burgerAlarmsFrom(serviceAlarmRows);
			throw new Error(`unexpected service-client table: ${table}`);
		})
	}))
}));

import { actions, load } from './+page.server';
import {
	createHotDog,
	listHotDogsByOwner,
	countByOwner,
	getHotDogById,
	deleteHotDog,
	appStorageBytes,
	MAX_UPLOAD_BYTES
} from '$lib/features/hotdogs/hotdogs';
import { upload, remove, getSignedUrl, evaluateUpload } from '$lib/storage';
import { getProfileById } from '$lib/features/profiles/profiles';
import { getServiceClient } from '$lib/server/supabase';

const upload_ = actions.upload;
const delete_ = actions.delete;

// A real uuid: hotdogPath asserts the owner id is uuid-shaped, and although the
// helper is mocked here, using a valid uuid keeps the fixtures faithful.
const USER_ID = '11111111-1111-4111-8111-111111111111';
const VALID_USER = { id: USER_ID, email: 'chef@topdog.test' };
const VALID_SESSION = { access_token: 'valid', user: VALID_USER };

const GUARD_BLOCK_MESSAGE =
	"The kennel's full! There's no room for new hot dogs right now. " +
	'Delete one of your older dogs to make space, then try again.';

/** A File the action accepts (instanceof File, non-zero size). */
function aPhoto(size = 4321): File {
	const blob = new Uint8Array(size);
	return new File([blob], 'frank.webp', { type: 'image/webp' });
}

/**
 * Builds a fake upload/delete event. `formFields` is appended to FormData so we
 * can smuggle owner_id/id fields and confirm they're ignored. `rawGetSession`
 * is exposed to prove the action never reaches for the unvalidated session.
 */
function makeEvent(opts: {
	session: unknown;
	user: unknown;
	formFields?: Record<string, string | File>;
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
		locals: {
			supabase: { auth: { getSession: rawGetSession } },
			safeGetSession
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;

	return { event, safeGetSession, rawGetSession };
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(console, 'error').mockImplementation(() => {});
	// Default: the owner's dogs carry no burger reports (inactive alarm).
	serviceAlarmRows = [];
	// Default happy-path stubs; individual tests override as needed.
	vi.mocked(countByOwner).mockResolvedValue({ ok: true, data: 0 });
	vi.mocked(appStorageBytes).mockResolvedValue({ ok: true, data: 1000 });
	vi.mocked(evaluateUpload).mockReturnValue({ allowed: true, status: 'ok' });
	vi.mocked(upload).mockResolvedValue({ ok: true, data: { path: 'x' } });
	vi.mocked(createHotDog).mockResolvedValue({
		ok: true,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		data: { id: 'dog' } as any
	});
	vi.mocked(remove).mockResolvedValue({ ok: true, data: { removed: 1 } });
	// Default: the signed-in user is NOT the current Top Dog, so the load returns
	// no badge data. Crown-specific load tests override this.
	vi.mocked(getProfileById).mockResolvedValue({
		ok: true,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		data: { id: USER_ID, is_current_top_dog: false, top_dog_since: null } as any
	});
});

describe('dogs upload action', () => {
	it('reads the session via safeGetSession(), never raw getSession()', async () => {
		const { event, safeGetSession, rawGetSession } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { photo: aPhoto() }
		});

		await upload_(event);

		expect(safeGetSession).toHaveBeenCalledOnce();
		expect(rawGetSession).not.toHaveBeenCalled();
	});

	it('fails closed with 401 when unauthenticated; attempts no count/upload/insert', async () => {
		const { event } = makeEvent({ session: null, user: null, formFields: { photo: aPhoto() } });

		const result = await upload_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(401);
		expect(countByOwner).not.toHaveBeenCalled();
		expect(upload).not.toHaveBeenCalled();
		expect(createHotDog).not.toHaveBeenCalled();
	});

	it('fails closed when a user is present but the session is null', async () => {
		const { event } = makeEvent({
			session: null,
			user: VALID_USER,
			formFields: { photo: aPhoto() }
		});

		const result = await upload_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(401);
	});

	it('rejects a missing/empty photo with 400 before any count/upload', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { caption: 'no file here' }
		});

		const result = await upload_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect(countByOwner).not.toHaveBeenCalled();
		expect(upload).not.toHaveBeenCalled();
	});

	it('rejects a caption longer than 280 chars with a friendly 400 BEFORE any upload/insert', async () => {
		const longCaption = 'd'.repeat(281);
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { photo: aPhoto(), caption: longCaption }
		});

		const result = await upload_(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { error: string; caption: string } };
		expect(failure.status).toBe(400);
		expect(failure.data.error).toMatch(/280 characters/i);
		// Other entered state is preserved so the user doesn't retype.
		expect(failure.data.caption).toBe(longCaption);
		// Hard guarantee: nothing was counted, measured, uploaded, or inserted.
		expect(countByOwner).not.toHaveBeenCalled();
		expect(appStorageBytes).not.toHaveBeenCalled();
		expect(upload).not.toHaveBeenCalled();
		expect(createHotDog).not.toHaveBeenCalled();
	});

	it('accepts a caption of exactly 280 chars (boundary) and inserts it verbatim', async () => {
		const maxCaption = 'd'.repeat(280);
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { photo: aPhoto(), caption: maxCaption }
		});

		const result = await upload_(event);

		expect(result).toEqual({ uploaded: true });
		const insertArg = vi.mocked(createHotDog).mock.calls[0][1];
		expect(insertArg.caption).toBe(maxCaption);
	});

	it('treats an empty/whitespace caption as null on insert', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { photo: aPhoto(), caption: '   ' }
		});

		const result = await upload_(event);

		expect(result).toEqual({ uploaded: true });
		const insertArg = vi.mocked(createHotDog).mock.calls[0][1];
		expect(insertArg.caption).toBeNull();
	});

	it('rejects a photo larger than MAX_UPLOAD_BYTES with a friendly "too big" 400 BEFORE any count/usage/upload/insert', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { photo: aPhoto(MAX_UPLOAD_BYTES + 1), caption: 'keep this' }
		});

		const result = await upload_(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { error: string; caption: string } };
		expect(failure.status).toBe(400);
		expect(failure.data.error).toMatch(/too big/i);
		// Entered state is preserved so the user doesn't retype.
		expect(failure.data.caption).toBe('keep this');
		// Hard guarantee: an oversized photo never reaches count/usage/upload/insert.
		expect(countByOwner).not.toHaveBeenCalled();
		expect(appStorageBytes).not.toHaveBeenCalled();
		expect(upload).not.toHaveBeenCalled();
		expect(createHotDog).not.toHaveBeenCalled();
	});

	it('accepts a photo of exactly MAX_UPLOAD_BYTES (boundary) and proceeds to upload/insert', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { photo: aPhoto(MAX_UPLOAD_BYTES) }
		});

		const result = await upload_(event);

		expect(result).toEqual({ uploaded: true });
		expect(upload).toHaveBeenCalledOnce();
		const insertArg = vi.mocked(createHotDog).mock.calls[0][1];
		expect(insertArg.byteSize).toBe(MAX_UPLOAD_BYTES);
	});

	it('rejects a photo one byte over MAX_UPLOAD_BYTES (boundary)', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { photo: aPhoto(MAX_UPLOAD_BYTES + 1) }
		});

		const result = await upload_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect(upload).not.toHaveBeenCalled();
		expect(createHotDog).not.toHaveBeenCalled();
	});

	it('at the per-user cap: friendly "delete one to add another" 400, NO upload/insert', async () => {
		vi.mocked(countByOwner).mockResolvedValue({ ok: true, data: 100 });
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { photo: aPhoto() }
		});

		const result = await upload_(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { error: string } };
		expect(failure.status).toBe(400);
		expect(failure.data.error).toMatch(/delete one to add another/i);
		// Hard guarantee: nothing was uploaded or inserted at the cap.
		expect(appStorageBytes).not.toHaveBeenCalled();
		expect(upload).not.toHaveBeenCalled();
		expect(createHotDog).not.toHaveBeenCalled();
	});

	it('surfaces a friendly 500 (no internals) when the cap count itself errors', async () => {
		vi.mocked(countByOwner).mockResolvedValue({ ok: false, error: 'pg down' });
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { photo: aPhoto() }
		});

		const result = await upload_(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { error: string } };
		expect(failure.status).toBe(500);
		expect(failure.data.error).not.toMatch(/pg down/i);
		expect(upload).not.toHaveBeenCalled();
	});

	it('when the storage guard blocks: rejects with the guard message, NO upload/insert', async () => {
		vi.mocked(appStorageBytes).mockResolvedValue({ ok: true, data: 999 * 1024 * 1024 });
		vi.mocked(evaluateUpload).mockReturnValue({
			allowed: false,
			status: 'block',
			message: GUARD_BLOCK_MESSAGE
		});
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { photo: aPhoto() }
		});

		const result = await upload_(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { error: string } };
		expect(failure.data.error).toBe(GUARD_BLOCK_MESSAGE);
		expect(upload).not.toHaveBeenCalled();
		expect(createHotDog).not.toHaveBeenCalled();
	});

	it('feeds the measured usage into evaluateUpload', async () => {
		vi.mocked(appStorageBytes).mockResolvedValue({ ok: true, data: 424242 });
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { photo: aPhoto() }
		});

		await upload_(event);

		expect(evaluateUpload).toHaveBeenCalledWith(424242);
	});

	it('surfaces a friendly 500 when the storage usage check errors', async () => {
		vi.mocked(appStorageBytes).mockResolvedValue({ ok: false, error: 'rpc fail' });
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { photo: aPhoto() }
		});

		const result = await upload_(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { error: string } };
		expect(failure.status).toBe(500);
		expect(failure.data.error).not.toMatch(/rpc fail/i);
		expect(upload).not.toHaveBeenCalled();
	});

	it('happy path: count -> usage -> upload(hotdogs/owner-prefixed) -> insert, in that order', async () => {
		const order: string[] = [];
		vi.mocked(countByOwner).mockImplementation(async () => {
			order.push('count');
			return { ok: true, data: 3 };
		});
		vi.mocked(appStorageBytes).mockImplementation(async () => {
			order.push('usage');
			return { ok: true, data: 1000 };
		});
		vi.mocked(upload).mockImplementation(async () => {
			order.push('upload');
			return { ok: true, data: { path: 'x' } };
		});
		vi.mocked(createHotDog).mockImplementation(async () => {
			order.push('insert');
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return { ok: true, data: { id: 'dog' } as any };
		});

		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { photo: aPhoto(777), caption: '  best frank  ' }
		});

		const result = await upload_(event);

		expect(result).toEqual({ uploaded: true });
		expect(order).toEqual(['count', 'usage', 'upload', 'insert']);

		// Upload target: hotdogs bucket, owner-prefixed path from hotdogPath.
		const uploadArgs = vi.mocked(upload).mock.calls[0];
		expect(uploadArgs[1]).toBe('hotdogs');
		const uploadedPath = uploadArgs[2];
		expect(uploadedPath).toMatch(new RegExp(`^${USER_ID}/[0-9a-f-]+\\.webp$`, 'i'));

		// Insert: trusted owner_id, the SAME path as the upload, real byte size,
		// trimmed caption, server-generated id matching the path's file segment.
		const insertArg = vi.mocked(createHotDog).mock.calls[0][1];
		expect(insertArg.ownerId).toBe(USER_ID);
		expect(insertArg.imagePath).toBe(uploadedPath);
		expect(insertArg.byteSize).toBe(777);
		expect(insertArg.caption).toBe('best frank');
		expect(uploadedPath).toBe(`${USER_ID}/${insertArg.id}.webp`);
	});

	it('ignores a smuggled client owner_id / id: writes the trusted auth uid', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: {
				photo: aPhoto(),
				owner_id: 'attacker-uuid',
				ownerId: 'attacker-uuid',
				id: 'attacker-controlled-id'
			}
		});

		await upload_(event);

		const insertArg = vi.mocked(createHotDog).mock.calls[0][1];
		expect(insertArg.ownerId).toBe(USER_ID);
		expect(insertArg.ownerId).not.toBe('attacker-uuid');
		expect(insertArg.id).not.toBe('attacker-controlled-id');
		// The path is built from the trusted uid, not the smuggled owner_id.
		expect(insertArg.imagePath.startsWith(`${USER_ID}/`)).toBe(true);
	});

	it('ORPHAN-SAFETY: when the row insert fails after upload, removes the uploaded object (same path)', async () => {
		vi.mocked(upload).mockResolvedValue({ ok: true, data: { path: 'x' } });
		vi.mocked(createHotDog).mockResolvedValue({ ok: false, error: 'insert exploded' });
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { photo: aPhoto() }
		});

		const result = await upload_(event);

		// The action reports a friendly failure...
		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { error: string } };
		expect(failure.status).toBe(500);
		expect(failure.data.error).not.toMatch(/insert exploded/i);

		// ...and crucially, the just-uploaded object is removed (no orphan).
		expect(remove).toHaveBeenCalledOnce();
		const uploadedPath = vi.mocked(upload).mock.calls[0][2];
		const removeArgs = vi.mocked(remove).mock.calls[0];
		expect(removeArgs[1]).toBe('hotdogs');
		expect(removeArgs[2]).toBe(uploadedPath);
	});

	it('orphan cleanup failure after insert error is logged, still fails the action (no throw)', async () => {
		vi.mocked(createHotDog).mockResolvedValue({ ok: false, error: 'insert exploded' });
		vi.mocked(remove).mockResolvedValue({
			ok: false,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			error: { message: 'remove failed' } as any
		});
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { photo: aPhoto() }
		});

		const result = await upload_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(500);
		expect(remove).toHaveBeenCalledOnce();
	});

	it('does NOT insert (and does not orphan-delete) when the upload itself fails', async () => {
		vi.mocked(upload).mockResolvedValue({
			ok: false,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			error: { message: 'upload failed' } as any
		});
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { photo: aPhoto() }
		});

		const result = await upload_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(500);
		expect(createHotDog).not.toHaveBeenCalled();
		// Nothing landed in storage, so there's nothing to compensate-delete.
		expect(remove).not.toHaveBeenCalled();
	});
});

describe('dogs delete action', () => {
	beforeEach(() => {
		vi.mocked(getHotDogById).mockResolvedValue({
			ok: true,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			data: { id: 'dog-1', owner_id: USER_ID, image_path: `${USER_ID}/dog-1.webp` } as any
		});
		vi.mocked(deleteHotDog).mockResolvedValue({ ok: true, data: { deleted: 1 } });
	});

	it('reads the session via safeGetSession(), never raw getSession()', async () => {
		const { event, safeGetSession, rawGetSession } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'dog-1' }
		});

		await delete_(event);

		expect(safeGetSession).toHaveBeenCalledOnce();
		expect(rawGetSession).not.toHaveBeenCalled();
	});

	it('fails closed with 401 when unauthenticated; deletes nothing', async () => {
		const { event } = makeEvent({ session: null, user: null, formFields: { id: 'dog-1' } });

		const result = await delete_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(401);
		expect(deleteHotDog).not.toHaveBeenCalled();
		expect(remove).not.toHaveBeenCalled();
	});

	it('rejects a missing id with 400', async () => {
		const { event } = makeEvent({ session: VALID_SESSION, user: VALID_USER, formFields: {} });

		const result = await delete_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect(deleteHotDog).not.toHaveBeenCalled();
	});

	it('removes BOTH the DB row AND the storage object on success', async () => {
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'dog-1' }
		});

		const result = await delete_(event);

		expect(result).toEqual({ deleted: true });
		expect(deleteHotDog).toHaveBeenCalledWith(expect.anything(), 'dog-1');
		expect(remove).toHaveBeenCalledWith(expect.anything(), 'hotdogs', `${USER_ID}/dog-1.webp`);
	});

	it('still succeeds when storage removal fails (row already gone) — leak is logged', async () => {
		vi.mocked(remove).mockResolvedValue({
			ok: false,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			error: { message: 'object missing' } as any
		});
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'dog-1' }
		});

		const result = await delete_(event);

		expect(result).toEqual({ deleted: true });
		expect(deleteHotDog).toHaveBeenCalledOnce();
	});

	it('404s when the row no longer exists (lookup returns null) — no row delete attempted', async () => {
		vi.mocked(getHotDogById).mockResolvedValue({ ok: true, data: null });
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'ghost' }
		});

		const result = await delete_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(404);
		expect(deleteHotDog).not.toHaveBeenCalled();
	});

	it('404s when the owner-pinned delete matches no row (not owned) — no storage removal', async () => {
		vi.mocked(deleteHotDog).mockResolvedValue({ ok: true, data: { deleted: 0 } });
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'dog-1' }
		});

		const result = await delete_(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(404);
		// RLS matched nothing: don't remove the object (it isn't ours).
		expect(remove).not.toHaveBeenCalled();
	});

	it('surfaces a friendly 500 (no internals) when the row delete errors', async () => {
		vi.mocked(deleteHotDog).mockResolvedValue({ ok: false, error: 'pg constraint xyz' });
		const { event } = makeEvent({
			session: VALID_SESSION,
			user: VALID_USER,
			formFields: { id: 'dog-1' }
		});

		const result = await delete_(event);

		expect(isActionFailure(result)).toBe(true);
		const failure = result as { status: number; data: { error: string } };
		expect(failure.status).toBe(500);
		expect(failure.data.error).not.toMatch(/constraint xyz/i);
		expect(remove).not.toHaveBeenCalled();
	});
});

describe('dogs load', () => {
	function makeLoadEvent(opts: { session: unknown; user: unknown }) {
		const safeGetSession = vi.fn(async () => ({ session: opts.session, user: opts.user }));
		return {
			locals: { supabase: {}, safeGetSession }
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any;
	}

	// The load signature is `void | {...}` because the unauth branch throws a
	// redirect (typed as a return path). On the authenticated paths the redirect
	// is never reached, so narrow away `void` for ergonomic, type-safe assertions.
	type LoadData = {
		dogs: {
			signedUrl: string | null;
			alarm: { active: boolean; reporterCount: number; intensity: string };
		}[];
		cap: number;
		isCurrentTopDog: boolean;
		topDogId: string | null;
	};
	const INACTIVE_ALARM = { active: false, reporterCount: 0, intensity: 'none' };
	async function loadData(event: unknown): Promise<LoadData> {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await load(event as any);
		expect(result).toBeDefined();
		return result as LoadData;
	}

	const DOG_A = {
		id: 'dog-a',
		owner_id: USER_ID,
		image_path: `${USER_ID}/dog-a.webp`,
		caption: 'a',
		created_at: '2026-06-09T00:00:00Z',
		vote_count: 0,
		peak_votes: 0,
		byte_size: 1
	};
	const DOG_B = { ...DOG_A, id: 'dog-b', image_path: `${USER_ID}/dog-b.webp`, caption: 'b' };

	it('redirects to sign-in when unauthenticated', async () => {
		const event = makeLoadEvent({ session: null, user: null });

		let thrown: unknown;
		try {
			await load(event);
		} catch (e) {
			thrown = e;
		}

		expect(isRedirect(thrown)).toBe(true);
		expect((thrown as { location: string }).location).toBe('/sign-in');
	});

	it('lists the owner dogs and mints a signed URL per row', async () => {
		vi.mocked(listHotDogsByOwner).mockResolvedValue({ ok: true, data: [DOG_A, DOG_B] });
		vi.mocked(getSignedUrl).mockImplementation(async (_c, path) => ({
			ok: true,
			data: { signedUrl: `https://signed/${path}` }
		}));

		const result = await loadData(makeLoadEvent({ session: VALID_SESSION, user: VALID_USER }));

		expect(listHotDogsByOwner).toHaveBeenCalledWith(expect.anything(), USER_ID);
		expect(getSignedUrl).toHaveBeenCalledTimes(2);
		expect(result.cap).toBe(100);
		expect(result.dogs).toEqual([
			{ ...DOG_A, signedUrl: `https://signed/${DOG_A.image_path}`, alarm: INACTIVE_ALARM },
			{ ...DOG_B, signedUrl: `https://signed/${DOG_B.image_path}`, alarm: INACTIVE_ALARM }
		]);
		// Default profile is non-crown, so no badge data accompanies the grid.
		expect(result.isCurrentTopDog).toBe(false);
		expect(result.topDogId).toBeNull();
	});

	it('degrades a failed signed URL to null without crashing the whole grid', async () => {
		vi.mocked(listHotDogsByOwner).mockResolvedValue({ ok: true, data: [DOG_A, DOG_B] });
		vi.mocked(getSignedUrl).mockImplementation(async (_c, path) => {
			if (path === DOG_A.image_path) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				return { ok: false, error: { message: 'sign failed' } as any };
			}
			return { ok: true, data: { signedUrl: `https://signed/${path}` } };
		});

		const result = await loadData(makeLoadEvent({ session: VALID_SESSION, user: VALID_USER }));

		expect(result.dogs[0].signedUrl).toBeNull();
		expect(result.dogs[1].signedUrl).toBe(`https://signed/${DOG_B.image_path}`);
	});

	it('returns an empty grid (no crash) when the list query fails', async () => {
		vi.mocked(listHotDogsByOwner).mockResolvedValue({ ok: false, error: 'list boom' });

		const result = await loadData(makeLoadEvent({ session: VALID_SESSION, user: VALID_USER }));

		expect(result.dogs).toEqual([]);
		expect(result.cap).toBe(100);
		expect(getSignedUrl).not.toHaveBeenCalled();
	});

	// Burger-alarm wiring on the owner gallery (TASK-071, decision #12/#15). The
	// banner shows when YOUR own dog has been flagged a hamburger; the anonymous
	// per-dog aggregate is read with the SERVICE client and the render-time alarm is
	// derived by the REAL summarizeBurgerAlarm. There is no report control here.
	it('attaches an active render-time burger alarm to a flagged own dog', async () => {
		vi.mocked(listHotDogsByOwner).mockResolvedValue({ ok: true, data: [DOG_A, DOG_B] });
		vi.mocked(getSignedUrl).mockImplementation(async (_c, path) => ({
			ok: true,
			data: { signedUrl: `https://signed/${path}` }
		}));
		const fresh = new Date().toISOString();
		// DOG_A flagged by two fresh anonymous reporters (medium); DOG_B not flagged.
		serviceAlarmRows = [
			{ hot_dog_id: DOG_A.id, created_at: fresh },
			{ hot_dog_id: DOG_A.id, created_at: fresh }
		];

		const result = await loadData(makeLoadEvent({ session: VALID_SESSION, user: VALID_USER }));

		expect(getServiceClient).toHaveBeenCalled();
		expect(result.dogs[0].alarm).toEqual({ active: true, reporterCount: 2, intensity: 'medium' });
		expect(result.dogs[1].alarm).toEqual(INACTIVE_ALARM);
	});

	it('degrades to no alarm (grid not blanked) when the alarm aggregate read fails', async () => {
		vi.mocked(listHotDogsByOwner).mockResolvedValue({ ok: true, data: [DOG_A] });
		vi.mocked(getSignedUrl).mockImplementation(async (_c, path) => ({
			ok: true,
			data: { signedUrl: `https://signed/${path}` }
		}));
		vi.mocked(getServiceClient).mockReturnValueOnce({
			from: vi.fn(() => ({
				select: vi.fn().mockReturnValue({
					in: vi.fn().mockResolvedValue({ data: null, error: { message: 'alarm boom' } })
				})
			}))
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any);

		const result = await loadData(makeLoadEvent({ session: VALID_SESSION, user: VALID_USER }));

		expect(result.dogs).toHaveLength(1);
		expect(result.dogs[0].alarm).toEqual(INACTIVE_ALARM);
		expect(result.dogs[0].signedUrl).toBe(`https://signed/${DOG_A.image_path}`);
		expect(console.error).toHaveBeenCalled();
	});

	// TASK-023 — Top Dog badge wiring on the kennel load. The badge derives from
	// LIVE server crown state (the user's own `profiles.is_current_top_dog`), and
	// the winning dog is resolved through the SAME shared `selectTopDog` comparator
	// the vote-RPC crown recompute uses — never a parallel ordering — so it stays
	// in lockstep across a crown handoff (a handoff just changes what the next load
	// reads back). These cases exercise the real comparator end-to-end via the load.
	describe('Top Dog badge wiring', () => {
		// A crowned-owner profile. The single shared `top_dog_since` means the
		// stickiness tie-break degenerates to vote_count + id across the owner's dogs.
		const CROWN_PROFILE = {
			id: USER_ID,
			is_current_top_dog: true,
			top_dog_since: '2026-06-01T00:00:00Z'
		};

		function crowned() {
			vi.mocked(getProfileById).mockResolvedValue({
				ok: true,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				data: CROWN_PROFILE as any
			});
		}

		/** All signed URLs succeed — keep these cases focused on badge wiring. */
		function signAll() {
			vi.mocked(getSignedUrl).mockImplementation(async (_c, path) => ({
				ok: true,
				data: { signedUrl: `https://signed/${path}` }
			}));
		}

		it('reads the live crown from the signed-in user OWN profile (user.id), not a handle', async () => {
			crowned();
			signAll();
			vi.mocked(listHotDogsByOwner).mockResolvedValue({ ok: true, data: [DOG_A] });

			await loadData(makeLoadEvent({ session: VALID_SESSION, user: VALID_USER }));

			expect(getProfileById).toHaveBeenCalledWith(expect.anything(), USER_ID);
		});

		it('when the user IS Top Dog: topDogId is their HIGHEST vote_count dog', async () => {
			crowned();
			signAll();
			const lowVotes = { ...DOG_A, id: 'dog-low', vote_count: 2 };
			const winner = {
				...DOG_A,
				id: 'dog-win',
				image_path: `${USER_ID}/dog-win.webp`,
				vote_count: 9
			};
			const midVotes = { ...DOG_A, id: 'dog-mid', vote_count: 5 };
			vi.mocked(listHotDogsByOwner).mockResolvedValue({
				ok: true,
				data: [lowVotes, winner, midVotes]
			});

			const result = await loadData(makeLoadEvent({ session: VALID_SESSION, user: VALID_USER }));

			expect(result.isCurrentTopDog).toBe(true);
			expect(result.topDogId).toBe('dog-win');
		});

		it('on a vote_count tie, topDogId breaks to the LOWEST id (matches selectTopDog)', async () => {
			crowned();
			signAll();
			// Same top vote_count; the comparator (single shared top_dog_since) falls
			// through stickiness to ascending lexicographic id, so 'dog-aaa' wins.
			const tieHigh = { ...DOG_A, id: 'dog-zzz', vote_count: 7 };
			const tieLow = {
				...DOG_A,
				id: 'dog-aaa',
				image_path: `${USER_ID}/dog-aaa.webp`,
				vote_count: 7
			};
			const loser = { ...DOG_A, id: 'dog-mmm', vote_count: 3 };
			vi.mocked(listHotDogsByOwner).mockResolvedValue({
				ok: true,
				data: [tieHigh, tieLow, loser]
			});

			const result = await loadData(makeLoadEvent({ session: VALID_SESSION, user: VALID_USER }));

			expect(result.isCurrentTopDog).toBe(true);
			expect(result.topDogId).toBe('dog-aaa');
		});

		it('when the user is NOT Top Dog: isCurrentTopDog false and topDogId null regardless of votes', async () => {
			// Default beforeEach profile is non-crown. Even with heavily-voted dogs,
			// a non-crowned user gets NO badge data (selectTopDog isn't consulted).
			signAll();
			const heavilyVoted = { ...DOG_A, id: 'dog-hot', vote_count: 999 };
			vi.mocked(listHotDogsByOwner).mockResolvedValue({ ok: true, data: [heavilyVoted] });

			const result = await loadData(makeLoadEvent({ session: VALID_SESSION, user: VALID_USER }));

			expect(result.isCurrentTopDog).toBe(false);
			expect(result.topDogId).toBeNull();
		});

		it('crowned user with an EMPTY dog list: topDogId null (no dog to badge)', async () => {
			crowned();
			vi.mocked(listHotDogsByOwner).mockResolvedValue({ ok: true, data: [] });

			const result = await loadData(makeLoadEvent({ session: VALID_SESSION, user: VALID_USER }));

			expect(result.isCurrentTopDog).toBe(true);
			expect(result.topDogId).toBeNull();
		});

		it('crowned user but NO dog has vote_count >= 1: topDogId null (no eligible winner)', async () => {
			crowned();
			signAll();
			// DOG_A / DOG_B both have vote_count 0 — selectTopDog returns null.
			vi.mocked(listHotDogsByOwner).mockResolvedValue({ ok: true, data: [DOG_A, DOG_B] });

			const result = await loadData(makeLoadEvent({ session: VALID_SESSION, user: VALID_USER }));

			expect(result.isCurrentTopDog).toBe(true);
			expect(result.topDogId).toBeNull();
		});

		it('profile-load FAILURE degrades gracefully: no badge, grid still returns, no throw', async () => {
			vi.mocked(getProfileById).mockResolvedValue({ ok: false, error: 'profile boom' });
			signAll();
			vi.mocked(listHotDogsByOwner).mockResolvedValue({ ok: true, data: [DOG_A, DOG_B] });

			const result = await loadData(makeLoadEvent({ session: VALID_SESSION, user: VALID_USER }));

			// Crown state degrades to "not Top Dog"; the dog grid is unaffected.
			expect(result.isCurrentTopDog).toBe(false);
			expect(result.topDogId).toBeNull();
			expect(result.dogs).toEqual([
				{ ...DOG_A, signedUrl: `https://signed/${DOG_A.image_path}`, alarm: INACTIVE_ALARM },
				{ ...DOG_B, signedUrl: `https://signed/${DOG_B.image_path}`, alarm: INACTIVE_ALARM }
			]);
		});

		it('crowned user with a null profile row degrades to no badge (no throw)', async () => {
			// getProfileById can resolve { ok: true, data: null } for a profile-less
			// user; that must be treated as "not Top Dog", not a crash.
			vi.mocked(getProfileById).mockResolvedValue({ ok: true, data: null });
			signAll();
			vi.mocked(listHotDogsByOwner).mockResolvedValue({ ok: true, data: [DOG_A] });

			const result = await loadData(makeLoadEvent({ session: VALID_SESSION, user: VALID_USER }));

			expect(result.isCurrentTopDog).toBe(false);
			expect(result.topDogId).toBeNull();
		});
	});
});
