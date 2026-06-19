import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * The bare `/app` hub is retired (TASK-080). The persistent app shell now lives
 * in `(protected)/app/+layout.svelte` and provides navigation on every page, so
 * the standalone "kennel" hub has no remaining purpose. The App Chrome design
 * (design/pages/App Chrome.dc.html) defines only the shell chrome plus generic
 * page-content placeholders — no distinct designed hub surface — so `/app`
 * defaults to a redirect to The Procession (`/app/feed`), the app's home.
 *
 * The parent layout guard still runs first (unauthenticated → /sign-in,
 * profile-less → /app/onboarding), so this redirect only fires for a fully
 * onboarded member landing on the bare hub.
 *
 * 307 (temporary), GET-preserving, matching the `/` landing redirect.
 */
export const load: PageServerLoad = () => {
	throw redirect(307, '/app/feed');
};
