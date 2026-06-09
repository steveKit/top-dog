import { describe, it, expect, vi, afterEach } from 'vitest';

import { fitWithinMaxEdge, compressToWebp } from './compress';

// PROJECT.md decisions #8/#9: client-side WebP compression. The pure dimension
// math (fitWithinMaxEdge) is the primary TDD target and is tested exhaustively.
// compressToWebp is exercised against a mocked canvas pipeline because the
// Vitest "server" project runs in a `node` environment with no real
// HTMLCanvasElement / image decoding (see vitest.config.ts).
//
// Pinned contracts (see report):
//  - fitWithinMaxEdge NEVER upscales and NEVER returns a 0 dimension; it returns
//    integers (rounded).
//  - Invalid input (zero/negative/non-finite width|height, non-positive maxEdge)
//    throws a TypeError, mirroring src/lib/storage/guard.ts.
//  - compressToWebp validates input type BEFORE touching the canvas, so the
//    rejection path is testable without a real canvas.

const DEFAULT_MAX_EDGE = 1280;
const DEFAULT_QUALITY = 0.8;

describe('fitWithinMaxEdge', () => {
	it('downscales a landscape image so the longest edge is capped (4000x3000 -> 1280x960)', () => {
		expect(fitWithinMaxEdge(4000, 3000, 1280)).toEqual({ width: 1280, height: 960 });
	});

	it('downscales a portrait image so the longest edge is capped (3000x4000 -> 960x1280)', () => {
		expect(fitWithinMaxEdge(3000, 4000, 1280)).toEqual({ width: 960, height: 1280 });
	});

	it('downscales a square image to maxEdge x maxEdge (2000x2000 -> 1280x1280)', () => {
		expect(fitWithinMaxEdge(2000, 2000, 1280)).toEqual({ width: 1280, height: 1280 });
	});

	it('never upscales: an image smaller than maxEdge is returned unchanged (800x600)', () => {
		expect(fitWithinMaxEdge(800, 600, 1280)).toEqual({ width: 800, height: 600 });
	});

	it('returns the image unchanged when it is exactly at the cap (1280x960)', () => {
		expect(fitWithinMaxEdge(1280, 960, 1280)).toEqual({ width: 1280, height: 960 });
	});

	it('never upscales when maxEdge exceeds BOTH dimensions (500x400 @ 1280)', () => {
		// Distinct from the at-cap case: the whole image is well within the cap, so
		// no axis may be scaled up.
		expect(fitWithinMaxEdge(500, 400, 1280)).toEqual({ width: 500, height: 400 });
	});

	it('downscales an extreme aspect ratio without zeroing the short edge (5000x10 @ 1280)', () => {
		// 10 * (1280/5000) = 2.56 -> rounds to 3; the long edge caps at 1280.
		const result = fitWithinMaxEdge(5000, 10, 1280);
		expect(result.width).toBe(1280);
		expect(result.height).toBe(3);
		expect(Math.max(result.width, result.height)).toBe(1280);
	});

	it('rounds fractional target dimensions to integers and never returns 0 (1281x1 -> 1280x>=1)', () => {
		const result = fitWithinMaxEdge(1281, 1, 1280);
		expect(result.width).toBe(1280);
		// 1 * (1280/1281) ≈ 0.999 — must round/clamp UP to a usable >=1, never 0.
		expect(result.height).toBeGreaterThanOrEqual(1);
		expect(Number.isInteger(result.height)).toBe(true);
		expect(Number.isInteger(result.width)).toBe(true);
	});

	it('returns integer dimensions for a non-clean aspect ratio (4032x3024 -> longest edge 1280)', () => {
		const result = fitWithinMaxEdge(4032, 3024, 1280);
		expect(result.width).toBe(1280);
		expect(Number.isInteger(result.height)).toBe(true);
		expect(Math.max(result.width, result.height)).toBe(1280);
	});

	// Invalid input — pinned to throw TypeError, mirroring storage/guard.ts.
	it('throws a TypeError for zero width', () => {
		expect(() => fitWithinMaxEdge(0, 100, 1280)).toThrow(TypeError);
	});

	it('throws a TypeError for zero height', () => {
		expect(() => fitWithinMaxEdge(100, 0, 1280)).toThrow(TypeError);
	});

	it('throws a TypeError for negative width', () => {
		expect(() => fitWithinMaxEdge(-1, 100, 1280)).toThrow(TypeError);
	});

	it('throws a TypeError for negative height', () => {
		expect(() => fitWithinMaxEdge(100, -1, 1280)).toThrow(TypeError);
	});

	it('throws a TypeError for a non-finite width (NaN)', () => {
		expect(() => fitWithinMaxEdge(NaN, 100, 1280)).toThrow(TypeError);
	});

	it('throws a TypeError for a non-finite height (Infinity)', () => {
		expect(() => fitWithinMaxEdge(100, Infinity, 1280)).toThrow(TypeError);
	});

	it('throws a TypeError for a zero maxEdge', () => {
		expect(() => fitWithinMaxEdge(100, 100, 0)).toThrow(TypeError);
	});

	it('throws a TypeError for a negative maxEdge', () => {
		expect(() => fitWithinMaxEdge(100, 100, -1280)).toThrow(TypeError);
	});

	it('throws a TypeError for a non-finite maxEdge (NaN)', () => {
		expect(() => fitWithinMaxEdge(100, 100, NaN)).toThrow(TypeError);
	});
});

// --- compressToWebp ---------------------------------------------------------
//
// The `node` test environment lacks a real canvas + image decoder. We install a
// faithful mock pipeline so we can assert the contract:
//  - input type is validated (non-image rejects)
//  - the canvas is sized per fitWithinMaxEdge
//  - the encode requests 'image/webp' at the given/defaulted quality
//  - the resolved Blob has type 'image/webp'
//
// COVERAGE GAP: real WebP pixel encoding cannot be simulated in node/jsdom; the
// fidelity of the actual bytes (size ~100–200 KB, real WebP magic) is deferred
// to the TASK-014 Playwright @smoke flow, which runs in a real browser.

interface CanvasMock {
	width: number;
	height: number;
	getContext: ReturnType<typeof vi.fn>;
	toBlob: ReturnType<typeof vi.fn>;
}

interface CanvasHarness {
	canvas: CanvasMock;
	drawImage: ReturnType<typeof vi.fn>;
	toBlob: ReturnType<typeof vi.fn>;
	createElement: ReturnType<typeof vi.fn>;
	createImageBitmap: ReturnType<typeof vi.fn>;
}

const SRC_WIDTH = 4000;
const SRC_HEIGHT = 3000;

/**
 * Installs a fake canvas + createImageBitmap pipeline as globals. The fake
 * decoded bitmap reports SRC_WIDTH x SRC_HEIGHT, and toBlob yields a fake
 * image/webp Blob. Returns the spies so tests can assert how they were called.
 */
function installCanvasHarness(): CanvasHarness {
	const drawImage = vi.fn();
	const context = { drawImage } as unknown;

	const toBlob = vi.fn((cb: (blob: Blob | null) => void) => {
		// Simulate async encode resolving with a WebP blob. The encode `type` and
		// `quality` args are inspected via toBlob.mock.calls in the tests below.
		cb(new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/webp' }));
	});

	const canvas: CanvasMock = {
		width: 0,
		height: 0,
		getContext: vi.fn(() => context),
		toBlob
	};

	const createElement = vi.fn((tag: string) => {
		if (tag === 'canvas') return canvas as unknown as HTMLCanvasElement;
		throw new Error(`unexpected createElement(${tag}) in test`);
	});

	const createImageBitmap = vi.fn(async () => ({
		width: SRC_WIDTH,
		height: SRC_HEIGHT,
		close: vi.fn()
	}));

	vi.stubGlobal('document', { createElement });
	vi.stubGlobal('createImageBitmap', createImageBitmap);

	return { canvas, drawImage, toBlob, createElement, createImageBitmap };
}

function imageBlob(): Blob {
	return new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
}

describe('compressToWebp', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('rejects non-image input (text/plain) with an error mentioning the bad type, before any canvas work', async () => {
		const harness = installCanvasHarness();
		const textBlob = new Blob(['hello'], { type: 'text/plain' });

		// Pin the rejection REASON to the input-type contract (mentions "image"
		// and/or the offending type) so a blanket "not implemented" throw does not
		// satisfy this test — it must be the validation path that rejects.
		await expect(compressToWebp(textBlob)).rejects.toThrow(/image|text\/plain/i);
		// Validation must happen up front — no canvas/bitmap work for bad input.
		expect(harness.createImageBitmap).not.toHaveBeenCalled();
		expect(harness.createElement).not.toHaveBeenCalled();
	});

	it('rejects a Blob with an empty type with an image-related error', async () => {
		const harness = installCanvasHarness();
		const typelessBlob = new Blob(['??'], { type: '' });

		await expect(compressToWebp(typelessBlob)).rejects.toThrow(/image|type/i);
		expect(harness.createImageBitmap).not.toHaveBeenCalled();
	});

	it('resolves a Blob whose type is image/webp for valid image input', async () => {
		installCanvasHarness();

		const result = await compressToWebp(imageBlob());
		expect(result).toBeInstanceOf(Blob);
		expect(result.type).toBe('image/webp');
	});

	it('sizes the canvas to the fitWithinMaxEdge result (4000x3000 @ 1280 -> 1280x960)', async () => {
		const harness = installCanvasHarness();

		await compressToWebp(imageBlob());

		const expected = fitWithinMaxEdge(SRC_WIDTH, SRC_HEIGHT, DEFAULT_MAX_EDGE);
		expect(harness.canvas.width).toBe(expected.width);
		expect(harness.canvas.height).toBe(expected.height);
	});

	it('requests a WebP encode at the default quality (0.8) when no options are given', async () => {
		const harness = installCanvasHarness();

		await compressToWebp(imageBlob());

		expect(harness.toBlob).toHaveBeenCalledTimes(1);
		const [, type, quality] = harness.toBlob.mock.calls[0];
		expect(type).toBe('image/webp');
		expect(quality).toBe(DEFAULT_QUALITY);
	});

	it('passes a custom quality through to the WebP encode', async () => {
		const harness = installCanvasHarness();

		await compressToWebp(imageBlob(), { quality: 0.5 });

		const [, type, quality] = harness.toBlob.mock.calls[0];
		expect(type).toBe('image/webp');
		expect(quality).toBe(0.5);
	});

	it('uses a custom maxEdge for the resize math', async () => {
		const harness = installCanvasHarness();

		await compressToWebp(imageBlob(), { maxEdge: 640 });

		const expected = fitWithinMaxEdge(SRC_WIDTH, SRC_HEIGHT, 640);
		expect(harness.canvas.width).toBe(expected.width);
		expect(harness.canvas.height).toBe(expected.height);
	});
});
