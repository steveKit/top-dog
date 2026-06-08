// Global storage guard — PURE module. No Supabase or SvelteKit imports so the
// threshold logic can be unit-tested in isolation (CLAUDE.md Testing Strategy:
// the global storage guard thresholds are TDD-first).
//
// PROJECT.md decision #11 (adversarial finding D): degrade gracefully BEFORE
// Supabase's hard ~1 GiB free-tier cap. Warn around ~800 MiB, block around
// ~950 MiB, leaving headroom under 1024 MiB so an upload can never push the
// project over the hard cap and pause the project.
//
// Live wiring: this guard is consumed by the M1 upload path in TASK-013. No
// upload route exists yet, so this module only owns the pure threshold logic.

export type StorageGuardStatus = 'ok' | 'warn' | 'block';

const MiB = 1024 * 1024;

/** ok -> warn boundary (inclusive): usage at or above this warns. */
const WARN_AT_BYTES = 800 * MiB;
/** warn -> block boundary (inclusive): usage at or above this blocks uploads. */
const BLOCK_AT_BYTES = 950 * MiB;

/**
 * Classifies current storage usage into a guard status from the raw byte total.
 * Thresholds are binary megabytes (MiB = 1024 * 1024 bytes):
 *   <800 MiB -> 'ok', [800, 950) MiB -> 'warn', >=950 MiB -> 'block'.
 *
 * Validate-at-boundary: a negative or non-finite byte total is an upstream
 * programming error, not a quota state, so we throw rather than misclassify it.
 */
export function storageGuardStatus(usedBytes: number): StorageGuardStatus {
	if (!Number.isFinite(usedBytes) || usedBytes < 0) {
		throw new TypeError(
			`storageGuardStatus: usedBytes must be a non-negative finite number, got ${usedBytes}`
		);
	}

	if (usedBytes >= BLOCK_AT_BYTES) {
		return 'block';
	}
	if (usedBytes >= WARN_AT_BYTES) {
		return 'warn';
	}
	return 'ok';
}

/**
 * Boundary helper the upload path calls before accepting an upload. Blocks only
 * when the status is 'block'; surfaces a friendly user-facing message in that case.
 */
export function evaluateUpload(usedBytes: number): {
	allowed: boolean;
	status: StorageGuardStatus;
	message?: string;
} {
	const status = storageGuardStatus(usedBytes);
	const allowed = status !== 'block';

	if (!allowed) {
		return {
			allowed,
			status,
			message:
				"The kennel's full! There's no room for new hot dogs right now. " +
				'Delete one of your older dogs to make space, then try again.'
		};
	}

	return { allowed, status };
}
