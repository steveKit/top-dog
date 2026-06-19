import { slide } from 'svelte/transition';
import { cubicOut } from 'svelte/easing';
import type { TransitionConfig } from 'svelte/transition';

/**
 * Reduced-motion helper for Svelte transitions.
 *
 * Svelte transitions do NOT auto-respect `prefers-reduced-motion` — they run
 * their full duration regardless. This helper reads the OS-level
 * `prefers-reduced-motion: reduce` preference so callers can collapse a
 * transition's `duration` to 0 (an instant show/hide) for users who opt out.
 *
 * SSR-safe: `window`/`matchMedia` are guarded, so calling this on the server
 * (where neither exists) returns `false` rather than throwing. On the server
 * we can't know the preference anyway; the transition only runs client-side.
 */
export function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
		return false;
	}
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * A motion duration in ms that collapses to 0 when the user prefers reduced
 * motion. Pass the result straight into a Svelte transition's `duration`
 * option.
 */
export function motionDuration(ms: number): number {
	return prefersReducedMotion() ? 0 : ms;
}

/**
 * Default duration (ms) for the inline-error enter/leave, mirroring the
 * `--motion-fast` token (0.18s) in tokens.css. CSS tokens aren't readable from
 * JS at module load, so the literal is carried here as the single JS-side
 * source of truth — keep it in step with `--motion-fast` if that token moves.
 */
const ERROR_MOTION_MS = 180;

/**
 * Enter/leave transition for the inline `.field-error` messages on the gate
 * forms. Animates HEIGHT (via Svelte's `slide`) — which IS the layout shift,
 * so the fields below ease down on appear and ease back up on clear — and
 * layers a subtle opacity fade on top.
 *
 * Used with `transition:` so it runs on BOTH in and out. Honors
 * `prefers-reduced-motion`: when the user opts out, duration collapses to 0 for
 * an instant, un-animated show/hide. SSR-safe via `prefersReducedMotion()`.
 */
export function errorSlideFade(node: Element): TransitionConfig {
	const duration = motionDuration(ERROR_MOTION_MS);
	const slideConfig = slide(node, { duration, easing: cubicOut });
	const baseCss = slideConfig.css;
	return {
		duration,
		easing: cubicOut,
		// Compose the slide's height/padding interpolation with an opacity fade.
		css: (t, u) => `${baseCss ? baseCss(t, u) : ''}; opacity: ${t};`
	};
}
