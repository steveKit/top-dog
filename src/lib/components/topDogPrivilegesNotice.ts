// Pure dismissal-state helpers for the 👑 Top Dog privileges notice.
//
// The notice is dismissible with NO schema (decision: keep this minimal/UI-only,
// no migration, no `profiles` column, no hosted-push gate). Dismissal is
// persisted per-browser in `localStorage`. These helpers isolate the storage
// key and the SSR-safe read/write so the Svelte component stays presentational
// and the logic is unit-testable without a DOM.
//
// `localStorage` is browser-only, so every accessor takes the Storage instance
// explicitly (or null when unavailable). The component passes
// `browser ? localStorage : null`, so on the server these are inert no-ops.

export const DISMISSED_KEY = 'topdog-privileges-notice-dismissed';

const DISMISSED_VALUE = '1';

/**
 * Has the crown-holder dismissed the notice in this browser?
 * Returns false when storage is unavailable (SSR) or unreadable, so the notice
 * shows by default and a thrown storage error never breaks render.
 */
export function isNoticeDismissed(storage: Storage | null | undefined): boolean {
	if (!storage) return false;
	try {
		return storage.getItem(DISMISSED_KEY) === DISMISSED_VALUE;
	} catch {
		return false;
	}
}

/**
 * Persist the dismissal for this browser. No-op when storage is unavailable;
 * swallows storage errors (e.g. quota / disabled storage) so a dismiss click
 * never throws — the in-memory state still hides the notice for the session.
 */
export function persistNoticeDismissed(storage: Storage | null | undefined): void {
	if (!storage) return;
	try {
		storage.setItem(DISMISSED_KEY, DISMISSED_VALUE);
	} catch {
		// Storage write failed (private mode, quota, disabled) — ignore.
	}
}
