import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isHttpError, isRedirect } from '@sveltejs/kit';

// Test-after coverage for the profile-by-handle load (TASK-011 + TASK-041 mustard
// spray/render contract change). The load now:
//   - reads the session via safeGetSession() and redirects unauth -> /sign-in;
//   - returns { profile, avatarUrl, sprays, canSpray };
//   - 404s an unknown handle, 500s a profile read error (never swallowed);
//   - resolves a public avatar URL when avatar_path is set;
//   - computes canSpray from the VIEWER's OWN profile.is_current_top_dog
//     (server-maintained, non-client-writable — decision #25), true only when the
//     viewer holds the crown;
//   - passes the target's live sprays through, degrading to an empty mustard layer
//     (NOT a page failure) when the spray read fails;
//   - degrades canSpray to false (no spray affordance) when the viewer read fails.
//
// The profiles + sprays feature modules are dependency-injected via their import
// surface, so we mock the network-touching wrappers (getProfileByHandle /
// getProfileById / listSpraysForProfile) and the storage getPublicUrl, and assert
// the load's orchestration directly. The RLS Top-Dog INSERT gate is live-DB
// coverage (tests/mustard.e2e.ts), out of this unit test's reach.

vi.mock('$lib/features/profiles/profiles', () => ({
	getProfileByHandle: vi.fn(),
	getProfileById: vi.fn()
}));

vi.mock('$lib/features/mustard/sprays', () => ({
	listSpraysForProfile: vi.fn(),
	// Keep the real NOT_TOP_DOG sentinel so any action-layer mapping stays faithful.
	NOT_TOP_DOG: 'Only the current Top Dog can spray mustard.',
	addSpray: vi.fn()
}));

vi.mock('$lib/storage', () => ({
	getPublicUrl: vi.fn()
}));

import { load } from './+page.server';
import { getProfileByHandle, getProfileById } from '$lib/features/profiles/profiles';
import { listSpraysForProfile } from '$lib/features/mustard/sprays';
import { getPublicUrl } from '$lib/storage';

const VIEWER_ID = '11111111-1111-4111-8111-111111111111';
const VALID_USER = { id: VIEWER_ID, email: 'viewer@topdog.test' };
const VALID_SESSION = { access_token: 'valid', user: VALID_USER };

const TARGET_PROFILE = {
	id: 'target-uuid',
	handle: 'ChefDog',
	display_name: 'Chef Dog',
	avatar_path: null as string | null,
	joined_at: '2026-06-09T00:00:00Z',
	days_as_top_dog: 0,
	is_current_top_dog: false,
	top_dog_since: null as string | null
};

function aViewerProfile(overrides: Partial<typeof TARGET_PROFILE> = {}) {
	return {
		id: VIEWER_ID,
		handle: 'Viewer',
		display_name: 'The Viewer',
		avatar_path: null,
		joined_at: '2026-06-01T00:00:00Z',
		days_as_top_dog: 0,
		is_current_top_dog: false,
		top_dog_since: null,
		...overrides
	};
}

const A_SPRAY = { id: 'spray-1', x: 0.25, y: 0.5, sprayed_at: '2026-06-16T10:00:00Z' };

/**
 * Builds a fake load event. `rawGetSession` is exposed so we can prove the load
 * never reaches for the unvalidated session.
 */
function makeLoadEvent(opts: { session: unknown; user: unknown; handle?: string }) {
	const safeGetSession = vi.fn(async () => ({ session: opts.session, user: opts.user }));
	const rawGetSession = vi.fn(async () => ({ data: { session: null }, error: null }));
	return {
		params: { handle: opts.handle ?? 'ChefDog' },
		locals: {
			supabase: { __brand: 'rls-client', auth: { getSession: rawGetSession } },
			safeGetSession
		},
		safeGetSession,
		rawGetSession
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;
}

type LoadData = {
	profile: typeof TARGET_PROFILE;
	avatarUrl: string | null;
	sprays: { id: string; x: number; y: number; sprayed_at: string }[];
	canSpray: boolean;
};

async function callLoad(event: unknown): Promise<LoadData> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const result = await load(event as any);
	return result as LoadData;
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(console, 'error').mockImplementation(() => {});
	// Happy-path defaults; individual tests override as needed.
	vi.mocked(getProfileByHandle).mockResolvedValue({ ok: true, data: TARGET_PROFILE });
	vi.mocked(getProfileById).mockResolvedValue({ ok: true, data: aViewerProfile() });
	vi.mocked(listSpraysForProfile).mockResolvedValue({ ok: true, data: [] });
	vi.mocked(getPublicUrl).mockReturnValue('https://cdn/avatar.webp');
});

describe('profile [handle] load', () => {
	it('reads the session via safeGetSession(), never raw getSession()', async () => {
		const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		await callLoad(event);

		expect(event.safeGetSession).toHaveBeenCalledOnce();
		expect(event.rawGetSession).not.toHaveBeenCalled();
	});

	it('redirects to /sign-in when unauthenticated; never queries the profile', async () => {
		const event = makeLoadEvent({ session: null, user: null });

		let thrown: unknown;
		try {
			await load(event);
		} catch (e) {
			thrown = e;
		}

		expect(isRedirect(thrown)).toBe(true);
		expect((thrown as { location: string }).location).toBe('/sign-in');
		expect(getProfileByHandle).not.toHaveBeenCalled();
	});

	it('returns { profile, null avatarUrl, sprays, canSpray } when no avatar is set', async () => {
		const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await callLoad(event);

		expect(getProfileByHandle).toHaveBeenCalledWith(event.locals.supabase, 'ChefDog');
		expect(result).toEqual({
			profile: TARGET_PROFILE,
			avatarUrl: null,
			sprays: [],
			canSpray: false
		});
		// No avatar_path => no public-URL resolution.
		expect(getPublicUrl).not.toHaveBeenCalled();
	});

	it('resolves a public avatar URL when avatar_path is set', async () => {
		const withAvatar = { ...TARGET_PROFILE, avatar_path: 'target-uuid/avatar.webp' };
		vi.mocked(getProfileByHandle).mockResolvedValue({ ok: true, data: withAvatar });
		vi.mocked(getPublicUrl).mockReturnValue('https://cdn/target-uuid/avatar.webp');
		const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		const result = await callLoad(event);

		expect(getPublicUrl).toHaveBeenCalledWith(event.locals.supabase, 'target-uuid/avatar.webp');
		expect(result.profile).toEqual(withAvatar);
		expect(result.avatarUrl).toBe('https://cdn/target-uuid/avatar.webp');
	});

	it('404s for an unknown handle', async () => {
		vi.mocked(getProfileByHandle).mockResolvedValue({ ok: true, data: null });
		const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER, handle: 'nobody' });

		let thrown: unknown;
		try {
			await load(event);
		} catch (e) {
			thrown = e;
		}

		expect(isHttpError(thrown)).toBe(true);
		expect((thrown as { status: number }).status).toBe(404);
	});

	it('500s on a profile read error (does not swallow)', async () => {
		vi.mocked(getProfileByHandle).mockResolvedValue({ ok: false, error: 'boom' });
		const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

		let thrown: unknown;
		try {
			await load(event);
		} catch (e) {
			thrown = e;
		}

		expect(isHttpError(thrown)).toBe(true);
		expect((thrown as { status: number }).status).toBe(500);
		expect(console.error).toHaveBeenCalled();
	});

	describe('canSpray (viewer crown gate)', () => {
		it('is true ONLY when the viewer’s OWN profile holds the crown', async () => {
			vi.mocked(getProfileById).mockResolvedValue({
				ok: true,
				data: aViewerProfile({ is_current_top_dog: true })
			});
			const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

			const result = await callLoad(event);

			// The crown flag is read off the VIEWER's profile (user.id), not the target's.
			expect(getProfileById).toHaveBeenCalledWith(event.locals.supabase, VIEWER_ID);
			expect(result.canSpray).toBe(true);
		});

		it('is false when the viewer does NOT hold the crown, even if the TARGET does', async () => {
			// A non-Top-Dog viewing the current Top Dog's profile still cannot spray.
			vi.mocked(getProfileByHandle).mockResolvedValue({
				ok: true,
				data: { ...TARGET_PROFILE, is_current_top_dog: true }
			});
			vi.mocked(getProfileById).mockResolvedValue({
				ok: true,
				data: aViewerProfile({ is_current_top_dog: false })
			});
			const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

			const result = await callLoad(event);

			expect(result.canSpray).toBe(false);
		});

		it('degrades canSpray to false (no affordance) when the viewer profile read fails', async () => {
			vi.mocked(getProfileById).mockResolvedValue({ ok: false, error: 'viewer read boom' });
			const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

			const result = await callLoad(event);

			// A viewer-read failure must not block the page — it just hides the spray UI.
			expect(result.canSpray).toBe(false);
			expect(result.profile).toEqual(TARGET_PROFILE);
			expect(console.error).toHaveBeenCalled();
		});
	});

	describe('sprays passthrough + graceful degradation', () => {
		it('passes the target profile’s live sprays through (read on the target id)', async () => {
			const sprays = [
				A_SPRAY,
				{ id: 'spray-2', x: 0.9, y: 0.1, sprayed_at: '2026-06-16T11:00:00Z' }
			];
			vi.mocked(listSpraysForProfile).mockResolvedValue({ ok: true, data: sprays });
			const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

			const result = await callLoad(event);

			// Sprays are fetched for the TARGET profile id, not the viewer's.
			expect(listSpraysForProfile).toHaveBeenCalledWith(event.locals.supabase, TARGET_PROFILE.id);
			expect(result.sprays).toEqual(sprays);
		});

		it('degrades to an empty mustard layer (page not failed) when the spray read fails', async () => {
			vi.mocked(listSpraysForProfile).mockResolvedValue({ ok: false, error: 'spray read boom' });
			const event = makeLoadEvent({ session: VALID_SESSION, user: VALID_USER });

			const result = await callLoad(event);

			expect(result.sprays).toEqual([]);
			// The rest of the page is intact — only the mustard layer degraded.
			expect(result.profile).toEqual(TARGET_PROFILE);
			expect(console.error).toHaveBeenCalled();
		});
	});
});
