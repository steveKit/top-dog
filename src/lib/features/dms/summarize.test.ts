import { describe, it, expect } from 'vitest';

import { summarizeConversations, type DmRow } from './summarize';

// PURE-logic (TDD-grade) coverage for the DM conversation aggregator.
// summarizeConversations is the ENTIRE "inbox" mechanism — there is no
// conversations table and no denormalized unread counter (decision: derive at
// read time, mirroring the reactions aggregator). Its correctness IS the inbox:
//   - counterparty derivation works whether the viewer is the SENDER or the
//     RECIPIENT of a row;
//   - lastBody/lastAt track the most recent message in each conversation,
//     regardless of direction;
//   - unreadCount counts ONLY messages the viewer RECEIVED that are still unread
//     (read_at === null) — never the viewer's SENT messages, never already-read;
//   - the output is deterministically sorted: latest message DESC, then
//     counterparty handle ASC as a stable tiebreak;
//   - empty input yields an empty list.
// No SvelteKit / Supabase imports — plain data in, plain data out.

const VIEWER = 'viewer-uuid';
const ALICE = 'alice-uuid';
const BOB = 'bob-uuid';

/**
 * Builds a DM row. `from`/`to` are the sender/recipient ids; the counterparty
 * display fields are filled relative to whichever party is NOT the viewer (the
 * inbox query embeds the counterparty), so we accept them explicitly.
 */
function row(opts: {
	from: string;
	to: string;
	body: string;
	at: string;
	readAt?: string | null;
	cpHandle?: string;
	cpName?: string;
}): DmRow {
	return {
		sender_id: opts.from,
		recipient_id: opts.to,
		body: opts.body,
		created_at: opts.at,
		read_at: opts.readAt ?? null,
		counterparty_handle: opts.cpHandle ?? 'cp',
		counterparty_display_name: opts.cpName ?? 'Counter Party'
	};
}

describe('summarizeConversations', () => {
	it('returns an empty list for no rows', () => {
		expect(summarizeConversations([], VIEWER)).toEqual([]);
	});

	it('derives the counterparty when the viewer is the SENDER of the row', () => {
		const result = summarizeConversations(
			[
				row({
					from: VIEWER,
					to: ALICE,
					body: 'hey alice',
					at: '2026-06-16T10:00:00Z',
					cpHandle: 'alice',
					cpName: 'Alice'
				})
			],
			VIEWER
		);

		expect(result).toHaveLength(1);
		expect(result[0].counterpartyId).toBe(ALICE);
		expect(result[0].counterpartyHandle).toBe('alice');
		expect(result[0].counterpartyDisplayName).toBe('Alice');
		expect(result[0].lastBody).toBe('hey alice');
	});

	it('derives the counterparty when the viewer is the RECIPIENT of the row', () => {
		const result = summarizeConversations(
			[
				row({
					from: BOB,
					to: VIEWER,
					body: 'yo viewer',
					at: '2026-06-16T10:00:00Z',
					cpHandle: 'bob',
					cpName: 'Bob'
				})
			],
			VIEWER
		);

		expect(result).toHaveLength(1);
		expect(result[0].counterpartyId).toBe(BOB);
		expect(result[0].counterpartyHandle).toBe('bob');
	});

	it('groups both directions of a conversation under one counterparty', () => {
		const result = summarizeConversations(
			[
				row({ from: VIEWER, to: ALICE, body: 'first (sent)', at: '2026-06-16T10:00:00Z' }),
				row({ from: ALICE, to: VIEWER, body: 'reply (received)', at: '2026-06-16T11:00:00Z' })
			],
			VIEWER
		);

		// One conversation, not two — both rows share the ALICE counterparty.
		expect(result).toHaveLength(1);
		expect(result[0].counterpartyId).toBe(ALICE);
	});

	it('picks the LATEST message (max created_at) as the conversation preview, regardless of direction', () => {
		const result = summarizeConversations(
			[
				row({ from: ALICE, to: VIEWER, body: 'oldest', at: '2026-06-16T08:00:00Z' }),
				row({ from: VIEWER, to: ALICE, body: 'NEWEST', at: '2026-06-16T12:00:00Z' }),
				row({ from: ALICE, to: VIEWER, body: 'middle', at: '2026-06-16T10:00:00Z' })
			],
			VIEWER
		);

		expect(result).toHaveLength(1);
		expect(result[0].lastBody).toBe('NEWEST');
		expect(result[0].lastAt).toBe('2026-06-16T12:00:00Z');
	});

	it('is independent of input row order when picking the latest preview', () => {
		const rows = [
			row({ from: VIEWER, to: ALICE, body: 'NEWEST', at: '2026-06-16T12:00:00Z' }),
			row({ from: ALICE, to: VIEWER, body: 'oldest', at: '2026-06-16T08:00:00Z' })
		];
		const reversed = [...rows].reverse();

		expect(summarizeConversations(reversed, VIEWER)).toEqual(summarizeConversations(rows, VIEWER));
		expect(summarizeConversations(rows, VIEWER)[0].lastBody).toBe('NEWEST');
	});

	it('counts ONLY the viewer-RECEIVED unread messages toward unreadCount', () => {
		const result = summarizeConversations(
			[
				// received + unread -> counts
				row({
					from: ALICE,
					to: VIEWER,
					body: 'unread 1',
					at: '2026-06-16T09:00:00Z',
					readAt: null
				}),
				// received + unread -> counts
				row({ from: ALICE, to: VIEWER, body: 'unread 2', at: '2026-06-16T10:00:00Z', readAt: null })
			],
			VIEWER
		);

		expect(result).toHaveLength(1);
		expect(result[0].unreadCount).toBe(2);
	});

	it('does NOT count the viewer-SENT messages as unread (even when their read_at is null)', () => {
		const result = summarizeConversations(
			[
				// SENT by viewer, recipient hasn't read it (read_at null) — must NOT count
				// as unread FOR THE VIEWER.
				row({
					from: VIEWER,
					to: ALICE,
					body: 'i sent this',
					at: '2026-06-16T09:00:00Z',
					readAt: null
				})
			],
			VIEWER
		);

		expect(result).toHaveLength(1);
		expect(result[0].unreadCount).toBe(0);
	});

	it('does NOT count already-read received messages toward unreadCount', () => {
		const result = summarizeConversations(
			[
				row({
					from: ALICE,
					to: VIEWER,
					body: 'already read',
					at: '2026-06-16T09:00:00Z',
					readAt: '2026-06-16T09:30:00Z'
				})
			],
			VIEWER
		);

		expect(result).toHaveLength(1);
		expect(result[0].unreadCount).toBe(0);
	});

	it('counts only the unread-received subset in a mixed conversation', () => {
		const result = summarizeConversations(
			[
				row({
					from: ALICE,
					to: VIEWER,
					body: 'unread A',
					at: '2026-06-16T08:00:00Z',
					readAt: null
				}),
				row({
					from: ALICE,
					to: VIEWER,
					body: 'read B',
					at: '2026-06-16T09:00:00Z',
					readAt: '2026-06-16T09:01:00Z'
				}),
				row({ from: VIEWER, to: ALICE, body: 'sent C', at: '2026-06-16T10:00:00Z', readAt: null }),
				row({ from: ALICE, to: VIEWER, body: 'unread D', at: '2026-06-16T11:00:00Z', readAt: null })
			],
			VIEWER
		);

		expect(result).toHaveLength(1);
		// Only the two received+unread rows (A, D) count.
		expect(result[0].unreadCount).toBe(2);
		// The latest message overall is the SENT one (C is 10:00, D is 11:00 -> D).
		expect(result[0].lastBody).toBe('unread D');
	});

	it('sorts conversations by latest message DESC (newest conversation first)', () => {
		const result = summarizeConversations(
			[
				row({
					from: ALICE,
					to: VIEWER,
					body: 'alice older',
					at: '2026-06-16T08:00:00Z',
					cpHandle: 'alice'
				}),
				row({
					from: BOB,
					to: VIEWER,
					body: 'bob newer',
					at: '2026-06-16T12:00:00Z',
					cpHandle: 'bob'
				})
			],
			VIEWER
		);

		expect(result.map((c) => c.counterpartyId)).toEqual([BOB, ALICE]);
	});

	it('breaks an equal-latest-timestamp tie by counterparty handle ASC (deterministic)', () => {
		// Both conversations' latest message shares the same timestamp; the handle
		// ASC tiebreak puts 'alice' before 'bob'.
		const result = summarizeConversations(
			[
				row({
					from: BOB,
					to: VIEWER,
					body: 'bob',
					at: '2026-06-16T12:00:00Z',
					cpHandle: 'bob'
				}),
				row({
					from: ALICE,
					to: VIEWER,
					body: 'alice',
					at: '2026-06-16T12:00:00Z',
					cpHandle: 'alice'
				})
			],
			VIEWER
		);

		expect(result.map((c) => c.counterpartyHandle)).toEqual(['alice', 'bob']);
	});

	it('produces the same ordering regardless of input row order', () => {
		const rows = [
			row({ from: ALICE, to: VIEWER, body: 'a', at: '2026-06-16T09:00:00Z', cpHandle: 'alice' }),
			row({ from: BOB, to: VIEWER, body: 'b', at: '2026-06-16T11:00:00Z', cpHandle: 'bob' })
		];
		const reversed = [...rows].reverse();

		expect(summarizeConversations(reversed, VIEWER)).toEqual(summarizeConversations(rows, VIEWER));
	});

	it('ignores rows where the viewer is neither sender nor recipient (defensive)', () => {
		const result = summarizeConversations(
			[row({ from: ALICE, to: BOB, body: 'not my convo', at: '2026-06-16T10:00:00Z' })],
			VIEWER
		);

		expect(result).toEqual([]);
	});
});
