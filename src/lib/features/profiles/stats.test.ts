import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { loadShrineStats, EMPTY_SHRINE_STATS } from './stats';

// Unit coverage for the Shrine derived stat ledger (TASK-093). loadShrineStats
// runs READ-ONLY aggregates over existing tables and degrades each value to 0 on a
// read failure (the page is never blanked). There is NO write path / NO new schema
// — these are pure reads composed into a ledger.
//
// Two clients are passed in: the RLS-scoped request client runs every aggregate
// EXCEPT the redeemed-invites head-count, which runs on the SERVICE client because
// `invites_select_own` RLS would zero it out on a cross-member Shrine view. We mock
// both clients distinctly and assert `invites` is queried on the service client and
// NOT on the RLS client.
//
// We fake the SupabaseClient's query-builder chain per table. Each builder is
// thenable: head-count reads resolve `{ count }`; the hot_dogs read resolves
// `{ data }`. The reporter side is deliberately never queried (decision #27).

const PROFILE_ID = 'target-uuid';
const USER_ID = PROFILE_ID; // profiles.id === auth.users.id for a member

interface TableResults {
	top_dog_days?: { count?: number; error?: { message: string } };
	invites?: { count?: number; error?: { message: string } };
	mustard_sprays?: { count?: number; error?: { message: string } };
	hotdog_reactions?: { count?: number; error?: { message: string } };
	hot_dogs?: {
		data?: { vote_count: number; peak_votes: number }[];
		error?: { message: string };
	};
}

// Builds a query-builder stub that records `.eq`/`.not` filters and resolves to the
// configured per-table result. The builder is returned by `.select()` and is both
// chainable and awaitable (thenable), matching the PostgREST client surface used.
function makeBuilder(table: string, results: TableResults) {
	const filters: { method: string; args: unknown[] }[] = [];

	const settle = () => {
		switch (table) {
			case 'hot_dogs': {
				const r = results.hot_dogs ?? {};
				return { data: r.data ?? [], error: r.error ?? null };
			}
			case 'top_dog_days':
			case 'invites':
			case 'mustard_sprays':
			case 'hotdog_reactions': {
				const r = results[table] ?? {};
				return { count: r.count ?? 0, error: r.error ?? null };
			}
			default:
				return { count: 0, data: [], error: null };
		}
	};

	const builder: Record<string, unknown> = {
		eq(...args: unknown[]) {
			filters.push({ method: 'eq', args });
			return builder;
		},
		not(...args: unknown[]) {
			filters.push({ method: 'not', args });
			return builder;
		},
		// Thenable: awaiting the builder resolves the configured result.
		then(resolve: (value: unknown) => unknown) {
			return Promise.resolve(settle()).then(resolve);
		},
		__filters: filters
	};
	return builder;
}

function makeSupabase(results: TableResults) {
	const selects: { table: string; args: unknown[] }[] = [];
	const builders: Record<string, ReturnType<typeof makeBuilder>> = {};

	const client = {
		from(table: string) {
			return {
				select(...args: unknown[]) {
					selects.push({ table, args });
					const b = makeBuilder(table, results);
					builders[table] = b;
					return b;
				}
			};
		},
		__selects: selects,
		__builders: builders
	};
	return client as unknown as SupabaseClient & {
		__selects: typeof selects;
		__builders: typeof builders;
	};
}

// The redeemed-invites head-count runs on the SERVICE client; everything else on
// the RLS client. This calls loadShrineStats with both, routing the `invites`
// result to the service client and all other results to the RLS client, and
// returns both fakes so tests can assert which client saw which table.
async function loadWithSplitClients(results: TableResults, userId = USER_ID) {
	const { invites, ...rlsResults } = results;
	const rls = makeSupabase(rlsResults);
	const service = makeSupabase(invites ? { invites } : {});

	const stats = await loadShrineStats(rls, service, PROFILE_ID, userId);
	return { stats, rls, service };
}

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('loadShrineStats', () => {
	it('returns the all-zero ledger when a brand-new member has no rows anywhere', async () => {
		const { stats } = await loadWithSplitClients({});

		expect(stats).toEqual(EMPTY_SHRINE_STATS);
	});

	it('aggregates every ledger field from the configured rows', async () => {
		const { stats } = await loadWithSplitClients({
			top_dog_days: { count: 3 },
			invites: { count: 6 },
			mustard_sprays: { count: 12 },
			hotdog_reactions: { count: 488 },
			hot_dogs: {
				data: [
					{ vote_count: 1204, peak_votes: 1400 },
					{ vote_count: 612, peak_votes: 700 },
					{ vote_count: 340, peak_votes: 340 },
					{ vote_count: 198, peak_votes: 198 }
				]
			}
		});

		expect(stats).toEqual({
			timesCrowned: 3,
			disciplesSummoned: 6,
			anointingsReceived: 12,
			reactionsReceived: 488,
			franksOffered: 4,
			// sum(vote_count)
			totalDevotion: 1204 + 612 + 340 + 198,
			// max(peak_votes)
			highestBlessing: 1400
		});
	});

	it('counts only REDEEMED invites — filters on consumed_at IS NOT NULL', async () => {
		const { stats, service } = await loadWithSplitClients({ invites: { count: 2 } });

		expect(stats.disciplesSummoned).toBe(2);
		// The redeemed-only signal keys on consumed_at (never nulled by FK), not
		// consumed_by — asserted via the recorded filter chain on the SERVICE client.
		const filters = service.__builders.invites.__filters as {
			method: string;
			args: unknown[];
		}[];
		expect(filters).toEqual([
			{ method: 'eq', args: ['inviter_id', USER_ID] },
			{ method: 'not', args: ['consumed_at', 'is', null] }
		]);
	});

	it('keys the redeemed-invites count on the INVITER user id', async () => {
		const { service } = await loadWithSplitClients({ invites: { count: 1 } });

		const filters = service.__builders.invites.__filters as {
			method: string;
			args: unknown[];
		}[];
		expect(filters[0]).toEqual({ method: 'eq', args: ['inviter_id', USER_ID] });
	});

	it('issues the redeemed-invites head-count on the SERVICE client, never the RLS client', async () => {
		// `invites_select_own` RLS zeroes this count on a cross-member Shrine view, so
		// it MUST run on the service client (after the safeGetSession() gate). A
		// head-count ships no rows, so it stays decision-#27-safe.
		const { rls, service } = await loadWithSplitClients({ invites: { count: 4 } });

		const serviceTables = service.__selects.map((s) => s.table);
		expect(serviceTables).toContain('invites');

		const rlsTables = rls.__selects.map((s) => s.table);
		expect(rlsTables).not.toContain('invites');

		// The invites read is a HEAD-count — ships no rows.
		const invitesSelect = service.__selects.find((s) => s.table === 'invites');
		expect(invitesSelect?.args).toEqual(['*', { count: 'exact', head: true }]);
	});

	it('degrades a single failing aggregate to 0 without failing the others', async () => {
		const { stats } = await loadWithSplitClients({
			top_dog_days: { error: { message: 'crown boom' } },
			invites: { count: 5 },
			mustard_sprays: { count: 7 },
			hotdog_reactions: { count: 9 },
			hot_dogs: { data: [{ vote_count: 10, peak_votes: 10 }] }
		});

		// The failing crown count is 0; everything else still resolves.
		expect(stats.timesCrowned).toBe(0);
		expect(stats.disciplesSummoned).toBe(5);
		expect(stats.anointingsReceived).toBe(7);
		expect(stats.reactionsReceived).toBe(9);
		expect(stats.franksOffered).toBe(1);
		expect(console.error).toHaveBeenCalled();
	});

	it('degrades the redeemed-invites count to 0 on a service-client read error', async () => {
		const { stats } = await loadWithSplitClients({
			invites: { error: { message: 'invites boom' } }
		});

		expect(stats.disciplesSummoned).toBe(0);
		expect(console.error).toHaveBeenCalled();
	});

	it('degrades the hot_dogs aggregate trio to 0 on a read error', async () => {
		const { stats } = await loadWithSplitClients({
			hot_dogs: { error: { message: 'dogs boom' } }
		});

		expect(stats.franksOffered).toBe(0);
		expect(stats.totalDevotion).toBe(0);
		expect(stats.highestBlessing).toBe(0);
		expect(console.error).toHaveBeenCalled();
	});

	it('handles a member with dogs that have zero votes (max/sum default to 0)', async () => {
		const { stats } = await loadWithSplitClients({
			hot_dogs: { data: [{ vote_count: 0, peak_votes: 0 }] }
		});

		expect(stats.franksOffered).toBe(1);
		expect(stats.totalDevotion).toBe(0);
		expect(stats.highestBlessing).toBe(0);
	});

	it('keys the anointings count on target_profile_id and reactions on the owner-join', async () => {
		const { rls } = await loadWithSplitClients({
			mustard_sprays: { count: 4 },
			hotdog_reactions: { count: 9 }
		});

		// Anointings RECEIVED are sprays whose TARGET is this member (a consequence
		// borne), never sprays this member MADE.
		const sprayFilters = rls.__builders.mustard_sprays.__filters as {
			method: string;
			args: unknown[];
		}[];
		expect(sprayFilters).toEqual([{ method: 'eq', args: ['target_profile_id', PROFILE_ID] }]);

		// Reactions RECEIVED are counted through the owning dog (hot_dogs.owner_id),
		// never reactions this member GAVE (which would key on a reactor/user id).
		const reactionFilters = rls.__builders.hotdog_reactions.__filters as {
			method: string;
			args: unknown[];
		}[];
		expect(reactionFilters).toEqual([{ method: 'eq', args: ['hot_dogs.owner_id', PROFILE_ID] }]);
	});

	// ‼️ Decision #27 — reporter anonymity. The Shrine stat ledger surfaces only
	// consequences BORNE by the member (anointings/reactions RECEIVED, the borne
	// HERETIC / FALSE-WITNESS marks live on the load's separate brand path). It must
	// NEVER expose a reporter-side count — "heresies you've called", "reports made".
	// These tests pin that hard constraint structurally: the assembler never READS a
	// reporter-side table, and the returned ledger has no reporter-side field.
	describe('decision #27 — never surfaces a reporter-side count', () => {
		// The exact, closed set of tables the ledger is allowed to read. Anything
		// outside this set (notably the reporter-side burger_verdicts / hamburger_liars)
		// is a decision-#27 violation.
		const ALLOWED_TABLES = [
			'top_dog_days',
			'invites',
			'mustard_sprays',
			'hot_dogs',
			'hotdog_reactions'
		].sort();

		it('queries ONLY the allowed received-consequence tables — never a reporter-side table', async () => {
			const { rls, service } = await loadWithSplitClients({
				top_dog_days: { count: 1 },
				invites: { count: 1 },
				mustard_sprays: { count: 1 },
				hotdog_reactions: { count: 1 },
				hot_dogs: { data: [{ vote_count: 1, peak_votes: 1 }] }
			});

			// The full set of tables read across BOTH clients (the invites head-count is
			// on the service client; everything else on the RLS client).
			const queried = [
				...new Set([...rls.__selects.map((s) => s.table), ...service.__selects.map((s) => s.table)])
			].sort();
			expect(queried).toEqual(ALLOWED_TABLES);
			// The reporter-side stores are NEVER touched — no reports-made aggregate.
			expect(queried).not.toContain('burger_verdicts');
			expect(queried).not.toContain('hamburger_liars');
		});

		it('returns a ledger with no reporter-side field (only received consequences)', async () => {
			const { stats } = await loadWithSplitClients({});

			const keys = Object.keys(stats).sort();
			expect(keys).toEqual(
				[
					'anointingsReceived',
					'disciplesSummoned',
					'franksOffered',
					'highestBlessing',
					'reactionsReceived',
					'timesCrowned',
					'totalDevotion'
				].sort()
			);
			// No field counts reporter-side activity (heresies called / reports made).
			for (const key of keys) {
				const lowered = key.toLowerCase();
				expect(lowered).not.toContain('report');
				expect(lowered).not.toContain('heres');
				expect(lowered).not.toContain('accus');
				expect(lowered).not.toContain('called');
				expect(lowered).not.toMatch(/made$/);
			}
		});
	});
});
