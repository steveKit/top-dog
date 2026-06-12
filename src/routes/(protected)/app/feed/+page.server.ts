import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listVotableDogs, getCurrentVote } from '$lib/features/voting/feed';
import {
	castVote,
	removeVote,
	VOTE_SELF,
	VOTE_NO_SUCH_DOG,
	VOTE_UNAUTHENTICATED
} from '$lib/features/voting/votes';
import { getSignedUrl } from '$lib/storage';
import {
	addReaction,
	removeReaction,
	listReactionsForDogs
} from '$lib/features/reactions/reactions';
import { summarizeReactions } from '$lib/features/reactions/summarize';
import { isAllowedReactionEmoji } from '$lib/features/reactions/emojiSet';

// Global vote feed (TASK-024) — the surface that closes DW-009. It lists every
// OTHER member's hot dog (sorted by vote_count desc, so it doubles as the live
// leaderboard), each rendered via a short-lived signed URL from the private
// `hotdogs` bucket, and wires the castVote / removeVote RPC wrappers into
// server-side form actions. A member casts a single active vote; casting on a
// different dog MOVES it (UNIQUE(voter_id) RPC contract); a remove control
// retracts it. All vote mutations run server-side with the RLS-scoped
// event.locals.supabase, gated by safeGetSession(); the voter is derived from
// auth.uid() inside the RPC (never a client-supplied id).

/** Friendly, user-facing copy for the known vote failure sentinels. */
function voteErrorMessage(error: string): string {
	switch (error) {
		case VOTE_UNAUTHENTICATED:
			return 'You must be signed in to vote.';
		case VOTE_SELF:
			return "You can't vote for your own hot dog.";
		case VOTE_NO_SUCH_DOG:
			return 'That hot dog no longer exists.';
		default:
			// An unrecognised (raw Supabase) error — already logged server-side; show
			// a generic friendly message rather than the raw SDK text.
			return 'Could not update your vote right now. Please try again.';
	}
}

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		throw redirect(303, '/sign-in');
	}

	const dogsResult = await listVotableDogs(supabase, user.id);
	if (!dogsResult.ok) {
		console.error('[feed] failed to list votable dogs', {
			userId: user.id,
			error: dogsResult.error
		});
		return { dogs: [], currentVoteDogId: null };
	}

	// The viewer's current active vote, used to mark the voted dog and label the
	// other affordances as "Move vote here". A read error here shouldn't blank the
	// feed; we degrade to "no current vote" and log it.
	const voteResult = await getCurrentVote(supabase, user.id);
	let currentVoteDogId: string | null = null;
	if (!voteResult.ok) {
		console.error('[feed] failed to load current vote', {
			userId: user.id,
			error: voteResult.error
		});
	} else {
		currentVoteDogId = voteResult.data;
	}

	// Cosmetic reactions for the listed dogs (decision #12 — flair only, never
	// touches vote_count/ranking). One query for all listed dogs, then aggregated
	// per dog at read time via the pure summarizeReactions(). A read error here
	// shouldn't blank the feed; we degrade to "no reactions" and log it.
	const dogIds = dogsResult.data.map((dog) => dog.id);
	const reactionsResult = await listReactionsForDogs(supabase, dogIds);
	const reactionRowsByDog = new Map<string, { emoji: string; user_id: string }[]>();
	if (!reactionsResult.ok) {
		console.error('[feed] failed to load reactions', {
			userId: user.id,
			error: reactionsResult.error
		});
	} else {
		for (const row of reactionsResult.data) {
			const bucket = reactionRowsByDog.get(row.hot_dog_id);
			if (bucket) {
				bucket.push({ emoji: row.emoji, user_id: row.user_id });
			} else {
				reactionRowsByDog.set(row.hot_dog_id, [{ emoji: row.emoji, user_id: row.user_id }]);
			}
		}
	}

	// Mint a signed URL per dog (private bucket). A single failed URL shouldn't
	// blank the whole grid, so we surface null for that one and log it. Attach the
	// per-dog reaction summary (viewer-relative) alongside.
	const dogs = await Promise.all(
		dogsResult.data.map(async (dog) => {
			const reactions = summarizeReactions(reactionRowsByDog.get(dog.id) ?? [], user.id);
			const signed = await getSignedUrl(supabase, dog.image_path);
			if (!signed.ok) {
				console.error('[feed] failed to sign url', {
					dogId: dog.id,
					path: dog.image_path,
					error: signed.error.message
				});
				return { ...dog, signedUrl: null, reactions };
			}
			return { ...dog, signedUrl: signed.data.signedUrl, reactions };
		})
	);

	return { dogs, currentVoteDogId };
};

export const actions: Actions = {
	vote: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { error: 'You must be signed in to vote.' });
		}

		const formData = await request.formData();
		const dogId = String(formData.get('id') ?? '');
		if (!dogId) {
			return fail(400, { error: 'Which hot dog?' });
		}

		// Cast — or MOVE — the viewer's single vote. The RPC derives the voter from
		// auth.uid(); we pass only the target dog id (never a voter id).
		const result = await castVote(supabase, dogId);
		if (!result.ok) {
			console.error('[feed] castVote failed', {
				userId: user.id,
				dogId,
				error: result.error
			});
			const status = result.error === VOTE_UNAUTHENTICATED ? 401 : 400;
			return fail(status, { error: voteErrorMessage(result.error) });
		}

		return { voted: true };
	},

	remove: async ({ locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { error: 'You must be signed in to vote.' });
		}

		// Retract the viewer's active vote (idempotent: a no-op when there is none).
		// The voter is derived from auth.uid() inside the RPC.
		const result = await removeVote(supabase);
		if (!result.ok) {
			console.error('[feed] removeVote failed', {
				userId: user.id,
				error: result.error
			});
			const status = result.error === VOTE_UNAUTHENTICATED ? 401 : 400;
			return fail(status, { error: voteErrorMessage(result.error) });
		}

		return { removed: true };
	},

	// Add a cosmetic reaction (decision #12 — flair only, never touches the vote
	// count or crown). The reacting user is derived from safeGetSession() and
	// passed to the wrapper; the client supplies only the dog id + emoji. The emoji
	// is validated against the allowed set BEFORE touching the DB. Idempotent: a
	// repeat react is a benign no-op.
	react: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { error: 'You must be signed in to react.' });
		}

		const formData = await request.formData();
		const dogId = String(formData.get('id') ?? '');
		const emoji = String(formData.get('emoji') ?? '');
		if (!dogId) {
			return fail(400, { error: 'Which hot dog?' });
		}
		if (!isAllowedReactionEmoji(emoji)) {
			return fail(400, { error: 'That reaction is not allowed.' });
		}

		const result = await addReaction(supabase, user.id, dogId, emoji);
		if (!result.ok) {
			console.error('[feed] addReaction failed', { userId: user.id, dogId, emoji });
			return fail(400, { error: result.error });
		}

		return { reacted: true };
	},

	// Remove a cosmetic reaction (the un-react half of the toggle). Same trust
	// model as `react`: user from safeGetSession(), dog id + emoji from the form,
	// emoji validated before the DB. Idempotent: removing a missing reaction is a
	// no-op.
	unreact: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { error: 'You must be signed in to react.' });
		}

		const formData = await request.formData();
		const dogId = String(formData.get('id') ?? '');
		const emoji = String(formData.get('emoji') ?? '');
		if (!dogId) {
			return fail(400, { error: 'Which hot dog?' });
		}
		if (!isAllowedReactionEmoji(emoji)) {
			return fail(400, { error: 'That reaction is not allowed.' });
		}

		const result = await removeReaction(supabase, user.id, dogId, emoji);
		if (!result.ok) {
			console.error('[feed] removeReaction failed', { userId: user.id, dogId, emoji });
			return fail(400, { error: result.error });
		}

		return { unreacted: true };
	}
};
