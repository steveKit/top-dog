import type { LayoutServerLoad } from './$types';

/**
 * Surfaces the validated session and the request cookies to the universal
 * layout load, so the browser client can hydrate with the same auth state
 * without an extra round-trip.
 */
export const load: LayoutServerLoad = async ({ locals: { session }, cookies }) => {
	return {
		session,
		cookies: cookies.getAll()
	};
};
