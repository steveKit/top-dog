import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
	upload,
	getSignedUrl,
	getPublicUrl,
	remove,
	HOTDOGS_BUCKET,
	AVATARS_BUCKET
} from './index';

// These are unit tests with a fully mocked `SupabaseClient` — they never touch a
// live Supabase stack. The storage module is the sole place `supabase.storage`
// is called and the client is dependency-injected (first arg), so a structural
// fake is all we need. Each test asserts: (1) the correct bucket is targeted
// (signed -> hotdogs, public -> avatars), (2) args are forwarded faithfully, and
// (3) the SDK's `{ data, error }` shape is normalized into the discriminated
// `StorageResult` the rest of the app consumes.

/**
 * Builds a fake `SupabaseClient` whose `.storage.from(bucket)` records the bucket
 * it was called with and returns the supplied per-method stubs. The returned
 * `fromSpy` lets each test assert which bucket the function under test selected.
 */
function makeClient(methods: Record<string, ReturnType<typeof vi.fn>>) {
	const fileApi = methods;
	const fromSpy = vi.fn(() => fileApi);
	const client = { storage: { from: fromSpy } } as unknown as SupabaseClient;
	return { client, fromSpy };
}

const SDK_ERROR = { name: 'StorageApiError', message: 'boom', status: 500 };

describe('upload', () => {
	it('uploads to the given bucket and wraps success as { ok: true, data }', async () => {
		const uploadStub = vi.fn().mockResolvedValue({ data: { path: 'owner/dog.webp' }, error: null });
		const { client, fromSpy } = makeClient({ upload: uploadStub });
		const blob = new Blob(['x'], { type: 'image/webp' });

		const result = await upload(client, HOTDOGS_BUCKET, 'owner/dog.webp', blob);

		expect(fromSpy).toHaveBeenCalledWith(HOTDOGS_BUCKET);
		expect(result).toEqual({ ok: true, data: { path: 'owner/dog.webp' } });
	});

	it('forwards the path, blob, and a contentType derived from the blob', async () => {
		const uploadStub = vi.fn().mockResolvedValue({ data: { path: 'owner/dog.webp' }, error: null });
		const { client } = makeClient({ upload: uploadStub });
		const blob = new Blob(['x'], { type: 'image/webp' });

		await upload(client, HOTDOGS_BUCKET, 'owner/dog.webp', blob);

		expect(uploadStub).toHaveBeenCalledWith(
			'owner/dog.webp',
			blob,
			expect.objectContaining({ contentType: 'image/webp', upsert: true })
		);
	});

	it('defaults contentType to image/webp when the blob has no type', async () => {
		const uploadStub = vi.fn().mockResolvedValue({ data: { path: 'owner/dog.webp' }, error: null });
		const { client } = makeClient({ upload: uploadStub });
		const blob = new Blob(['x']); // no type

		await upload(client, HOTDOGS_BUCKET, 'owner/dog.webp', blob);

		expect(uploadStub).toHaveBeenCalledWith(
			'owner/dog.webp',
			blob,
			expect.objectContaining({ contentType: 'image/webp' })
		);
	});

	it('passes through an explicit upsert: false option', async () => {
		const uploadStub = vi.fn().mockResolvedValue({ data: { path: 'owner/dog.webp' }, error: null });
		const { client } = makeClient({ upload: uploadStub });
		const blob = new Blob(['x'], { type: 'image/webp' });

		await upload(client, HOTDOGS_BUCKET, 'owner/dog.webp', blob, { upsert: false });

		expect(uploadStub).toHaveBeenCalledWith(
			'owner/dog.webp',
			blob,
			expect.objectContaining({ upsert: false })
		);
	});

	it('targets the avatars bucket when asked to', async () => {
		const uploadStub = vi
			.fn()
			.mockResolvedValue({ data: { path: 'owner/avatar.webp' }, error: null });
		const { client, fromSpy } = makeClient({ upload: uploadStub });
		const blob = new Blob(['x'], { type: 'image/webp' });

		await upload(client, AVATARS_BUCKET, 'owner/avatar.webp', blob);

		expect(fromSpy).toHaveBeenCalledWith(AVATARS_BUCKET);
	});

	it('wraps an SDK error as { ok: false, error }', async () => {
		const uploadStub = vi.fn().mockResolvedValue({ data: null, error: SDK_ERROR });
		const { client } = makeClient({ upload: uploadStub });
		const blob = new Blob(['x'], { type: 'image/webp' });

		const result = await upload(client, HOTDOGS_BUCKET, 'owner/dog.webp', blob);

		expect(result).toEqual({ ok: false, error: SDK_ERROR });
	});
});

describe('getSignedUrl', () => {
	it('always reads the hotdogs bucket (private/signed content)', async () => {
		const stub = vi
			.fn()
			.mockResolvedValue({ data: { signedUrl: 'https://signed/url' }, error: null });
		const { client, fromSpy } = makeClient({ createSignedUrl: stub });

		await getSignedUrl(client, 'owner/dog.webp');

		expect(fromSpy).toHaveBeenCalledWith(HOTDOGS_BUCKET);
	});

	it('wraps success as { ok: true, data: { signedUrl } }', async () => {
		const stub = vi
			.fn()
			.mockResolvedValue({ data: { signedUrl: 'https://signed/url' }, error: null });
		const { client } = makeClient({ createSignedUrl: stub });

		const result = await getSignedUrl(client, 'owner/dog.webp');

		expect(result).toEqual({ ok: true, data: { signedUrl: 'https://signed/url' } });
	});

	it('defaults the expiry to one hour (3600s)', async () => {
		const stub = vi
			.fn()
			.mockResolvedValue({ data: { signedUrl: 'https://signed/url' }, error: null });
		const { client } = makeClient({ createSignedUrl: stub });

		await getSignedUrl(client, 'owner/dog.webp');

		expect(stub).toHaveBeenCalledWith('owner/dog.webp', 3600);
	});

	it('forwards a custom expiry', async () => {
		const stub = vi
			.fn()
			.mockResolvedValue({ data: { signedUrl: 'https://signed/url' }, error: null });
		const { client } = makeClient({ createSignedUrl: stub });

		await getSignedUrl(client, 'owner/dog.webp', 120);

		expect(stub).toHaveBeenCalledWith('owner/dog.webp', 120);
	});

	it('wraps an SDK error as { ok: false, error }', async () => {
		const stub = vi.fn().mockResolvedValue({ data: null, error: SDK_ERROR });
		const { client } = makeClient({ createSignedUrl: stub });

		const result = await getSignedUrl(client, 'owner/dog.webp');

		expect(result).toEqual({ ok: false, error: SDK_ERROR });
	});
});

describe('getPublicUrl', () => {
	it('always reads the avatars bucket (public-read content)', () => {
		const stub = vi.fn().mockReturnValue({ data: { publicUrl: 'https://public/url' } });
		const { client, fromSpy } = makeClient({ getPublicUrl: stub });

		getPublicUrl(client, 'owner/avatar.webp');

		expect(fromSpy).toHaveBeenCalledWith(AVATARS_BUCKET);
	});

	it('forwards the path and returns the public URL string directly', () => {
		const stub = vi.fn().mockReturnValue({ data: { publicUrl: 'https://public/url' } });
		const { client } = makeClient({ getPublicUrl: stub });

		const url = getPublicUrl(client, 'owner/avatar.webp');

		expect(stub).toHaveBeenCalledWith('owner/avatar.webp');
		expect(url).toBe('https://public/url');
	});
});

describe('remove', () => {
	it('removes a single path by wrapping it in an array', async () => {
		const stub = vi.fn().mockResolvedValue({ data: [{ name: 'owner/dog.webp' }], error: null });
		const { client, fromSpy } = makeClient({ remove: stub });

		const result = await remove(client, HOTDOGS_BUCKET, 'owner/dog.webp');

		expect(fromSpy).toHaveBeenCalledWith(HOTDOGS_BUCKET);
		expect(stub).toHaveBeenCalledWith(['owner/dog.webp']);
		expect(result).toEqual({ ok: true, data: { removed: 1 } });
	});

	it('forwards an array of paths unchanged and reports the removed count', async () => {
		const stub = vi.fn().mockResolvedValue({ data: [{ name: 'a' }, { name: 'b' }], error: null });
		const { client } = makeClient({ remove: stub });

		const result = await remove(client, AVATARS_BUCKET, ['owner/a.webp', 'owner/b.webp']);

		expect(stub).toHaveBeenCalledWith(['owner/a.webp', 'owner/b.webp']);
		expect(result).toEqual({ ok: true, data: { removed: 2 } });
	});

	it('targets the avatars bucket when asked to', async () => {
		const stub = vi.fn().mockResolvedValue({ data: [{ name: 'owner/avatar.webp' }], error: null });
		const { client, fromSpy } = makeClient({ remove: stub });

		await remove(client, AVATARS_BUCKET, 'owner/avatar.webp');

		expect(fromSpy).toHaveBeenCalledWith(AVATARS_BUCKET);
	});

	it('wraps an SDK error as { ok: false, error }', async () => {
		const stub = vi.fn().mockResolvedValue({ data: null, error: SDK_ERROR });
		const { client } = makeClient({ remove: stub });

		const result = await remove(client, HOTDOGS_BUCKET, 'owner/dog.webp');

		expect(result).toEqual({ ok: false, error: SDK_ERROR });
	});
});

describe('bucket constants', () => {
	it('exposes the two bucket names from the TASK-003 migration', () => {
		expect(HOTDOGS_BUCKET).toBe('hotdogs');
		expect(AVATARS_BUCKET).toBe('avatars');
	});
});
