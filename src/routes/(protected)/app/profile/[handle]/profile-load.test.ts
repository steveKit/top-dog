import { describe, it, expect, vi } from 'vitest';
import { isHttpError } from '@sveltejs/kit';
import { load } from './+page.server';

// Test-after coverage for the profile-by-handle load: a known handle returns the
// profile (+ resolved public avatar URL when set), an unknown handle 404s, and a
// read error 500s (never swallowed).

const A_PROFILE = {
	id: 'u1',
	handle: 'ChefDog',
	display_name: 'Chef Dog',
	avatar_path: null,
	joined_at: '2026-06-09T00:00:00Z',
	days_as_top_dog: 0,
	is_current_top_dog: false,
	top_dog_since: null
};

function makeSupabase(opts: { profile?: { data: unknown; error: unknown }; publicUrl?: string }) {
	const maybeSingle = vi.fn().mockResolvedValue(opts.profile ?? { data: A_PROFILE, error: null });
	const eq = vi.fn(() => ({ maybeSingle }));
	const select = vi.fn(() => ({ eq }));
	const from = vi.fn(() => ({ select }));
	const getPublicUrl = vi.fn(() => ({
		data: { publicUrl: opts.publicUrl ?? 'https://x/avatar.webp' }
	}));
	const storageFrom = vi.fn(() => ({ getPublicUrl }));
	return { from, storage: { from: storageFrom } };
}

function callLoad(supabase: unknown, handle: string) {
	return load({
		params: { handle },
		locals: { supabase }
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any);
}

describe('profile [handle] load', () => {
	it('returns the profile with a null avatarUrl when no avatar is set', async () => {
		const result = await callLoad(makeSupabase({}), 'ChefDog');

		expect(result).toEqual({ profile: A_PROFILE, avatarUrl: null });
	});

	it('resolves a public avatar URL when avatar_path is set', async () => {
		const withAvatar = { ...A_PROFILE, avatar_path: 'u1/avatar.webp' };
		const supabase = makeSupabase({
			profile: { data: withAvatar, error: null },
			publicUrl: 'https://cdn/u1/avatar.webp'
		});

		const result = await callLoad(supabase, 'ChefDog');

		expect(result).toEqual({ profile: withAvatar, avatarUrl: 'https://cdn/u1/avatar.webp' });
	});

	it('404s for an unknown handle', async () => {
		const supabase = makeSupabase({ profile: { data: null, error: null } });

		let thrown: unknown;
		try {
			await callLoad(supabase, 'nobody');
		} catch (e) {
			thrown = e;
		}

		expect(isHttpError(thrown)).toBe(true);
		expect((thrown as { status: number }).status).toBe(404);
	});

	it('500s on a read error (does not swallow)', async () => {
		const supabase = makeSupabase({ profile: { data: null, error: { message: 'boom' } } });

		let thrown: unknown;
		try {
			await callLoad(supabase, 'ChefDog');
		} catch (e) {
			thrown = e;
		}

		expect(isHttpError(thrown)).toBe(true);
		expect((thrown as { status: number }).status).toBe(500);
	});
});
