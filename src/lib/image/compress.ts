// Client-side WebP compression (TASK-012).
//
// PROJECT.md decisions #8/#9: photos are compressed CLIENT-SIDE to WebP before
// upload — resize the longest edge to ~1280px, encode WebP at quality ~0.8,
// targeting ~100–200 KB/photo, with ZERO new dependencies (browser canvas only).
//
// This is a shared lib seam (parallel to src/lib/storage/), consumed later by
// TASK-011 (avatar upload) and TASK-013 (hot dog upload). It is feature-agnostic:
// callers pass a Blob/File of any image type and get back an image/webp Blob.

export interface CompressOptions {
	maxEdge?: number; // default 1280 — cap on the LONGEST edge
	quality?: number; // default 0.8 — WebP encode quality (0..1)
}

const DEFAULT_MAX_EDGE = 1280;
const DEFAULT_QUALITY = 0.8;

/**
 * PURE dimension math (primary TDD target). Given source width/height and a max
 * edge, return target dimensions that preserve aspect ratio and cap the LONGEST
 * edge at maxEdge. NEVER upscales (images already within maxEdge are returned
 * unchanged). Returns integer dimensions (rounded, never 0).
 *
 * Validate-at-boundary (mirrors src/lib/storage/guard.ts): zero/negative/
 * non-finite width or height, and non-positive/non-finite maxEdge are upstream
 * programming errors, so we throw a TypeError rather than produce garbage dims.
 */
export function fitWithinMaxEdge(
	width: number,
	height: number,
	maxEdge: number
): { width: number; height: number } {
	if (!Number.isFinite(width) || width <= 0) {
		throw new TypeError(`fitWithinMaxEdge: width must be a positive finite number, got ${width}`);
	}
	if (!Number.isFinite(height) || height <= 0) {
		throw new TypeError(`fitWithinMaxEdge: height must be a positive finite number, got ${height}`);
	}
	if (!Number.isFinite(maxEdge) || maxEdge <= 0) {
		throw new TypeError(
			`fitWithinMaxEdge: maxEdge must be a positive finite number, got ${maxEdge}`
		);
	}

	const longest = Math.max(width, height);

	// NEVER upscale: if the image already fits within maxEdge, return it as-is
	// (rounded to integers in case the source dims were fractional).
	if (longest <= maxEdge) {
		return { width: Math.round(width), height: Math.round(height) };
	}

	const scale = maxEdge / longest;

	// Clamp each dimension UP to >=1: a very thin image (e.g. 1281x1) scales the
	// short edge below 1px, and a 0-width/height canvas can't be drawn to — so we
	// never let rounding produce a zero dimension.
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale))
	};
}

/**
 * Compress an image Blob/File to WebP via canvas. Resizes per fitWithinMaxEdge,
 * encodes WebP at `quality`. REJECTS non-image input. Returns a Blob
 * (image/webp) ready for storage upload.
 *
 * Pipeline (browser-only globals; the node test env stubs these): decode with
 * createImageBitmap -> draw onto a sized <canvas> -> encode via toBlob.
 */
export async function compressToWebp(input: Blob, options?: CompressOptions): Promise<Blob> {
	const maxEdge = options?.maxEdge ?? DEFAULT_MAX_EDGE;
	const quality = options?.quality ?? DEFAULT_QUALITY;

	// Validate the input type FIRST, before any decode/canvas work: an empty type
	// or a non-image type can never be encoded, and rejecting up front keeps the
	// failure path cheap and testable without a real canvas.
	if (!input.type.startsWith('image/')) {
		throw new TypeError(
			`compressToWebp: expected an image Blob, got type "${input.type || '(empty)'}"`
		);
	}

	// Decode the source pixels. createImageBitmap reads the natural dimensions we
	// need for the resize math.
	const bitmap = await createImageBitmap(input);

	const { width, height } = fitWithinMaxEdge(bitmap.width, bitmap.height, maxEdge);

	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;

	const context = canvas.getContext('2d');
	if (!context) {
		throw new Error('compressToWebp: could not acquire a 2d canvas context');
	}

	// Draw the decoded bitmap scaled into the target-sized canvas.
	context.drawImage(bitmap, 0, 0, width, height);

	// Release the decoded bitmap's resources once drawn (no-op if unsupported).
	bitmap.close?.();

	// Encode the canvas to WebP. toBlob is callback-based, so wrap it in a Promise.
	return new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (!blob) {
					// A null result means the browser failed/declined the WebP encode.
					reject(new Error('compressToWebp: canvas.toBlob returned null (encode failed)'));
					return;
				}
				resolve(blob);
			},
			'image/webp',
			quality
		);
	});
}
