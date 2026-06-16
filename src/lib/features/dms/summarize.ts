// PURE conversation aggregator. No SvelteKit / Supabase imports — plain data in,
// plain data out — so it is fully unit-testable in isolation (TDD-first per the
// project testing strategy). The inbox load reads the viewer's messages (sent and
// received) and calls this to derive the per-counterparty conversation list.
//
// DMs are a FLAT table (no conversations table): a "conversation" is DERIVED here
// by grouping on the counterparty pair. The unread count is computed at read time
// from raw read_at timestamps — there is no denormalized DB counter — mirroring
// the reactions/summarize aggregation shape.

/**
 * The minimal shape of a DM row this aggregator needs. The DB row has more
 * columns (id, body length CHECK, etc.); we depend only on the fields below so
 * the function stays decoupled from the table's full shape.
 */
export interface DmRow {
	sender_id: string;
	recipient_id: string;
	body: string;
	created_at: string;
	read_at: string | null;
	/** The counterparty's handle, joined for display. */
	counterparty_handle: string;
	/** The counterparty's display name, joined for display. */
	counterparty_display_name: string;
}

/**
 * One conversation summary for the inbox: the counterparty, the latest message's
 * body + timestamp, and how many of the viewer's RECEIVED messages from this
 * counterparty are still unread.
 */
export interface ConversationSummary {
	counterpartyId: string;
	counterpartyHandle: string;
	counterpartyDisplayName: string;
	lastBody: string;
	lastAt: string;
	unreadCount: number;
}

/**
 * Aggregates the viewer's DM rows into a deterministically-sorted inbox list.
 *
 * - The counterparty of a row is whichever of (sender_id, recipient_id) is NOT
 *   the viewer. Rows where the viewer is neither party are ignored (the SELECT
 *   RLS should never return such rows, but the helper stays defensive and pure).
 * - `lastBody`/`lastAt` come from the most recent message (max created_at) in the
 *   conversation, regardless of direction.
 * - `unreadCount` counts only messages the viewer RECEIVED (recipient_id ===
 *   viewerId) that are still unread (read_at === null). Messages the viewer SENT
 *   never count as unread for them.
 * - Sort is stable and deterministic: latest message DESC (newest conversation
 *   first), then counterparty handle ASC as a tiebreak.
 */
export function summarizeConversations(rows: DmRow[], viewerId: string): ConversationSummary[] {
	const byCounterparty = new Map<string, ConversationSummary>();

	for (const row of rows) {
		let counterpartyId: string;

		if (row.sender_id === viewerId) {
			counterpartyId = row.recipient_id;
		} else if (row.recipient_id === viewerId) {
			counterpartyId = row.sender_id;
		} else {
			// Viewer is neither party — not their conversation. Skip defensively.
			continue;
		}
		const counterpartyHandle = row.counterparty_handle;
		const counterpartyDisplayName = row.counterparty_display_name;

		const existing = byCounterparty.get(counterpartyId);
		const isUnreadForViewer = row.recipient_id === viewerId && row.read_at === null;

		if (!existing) {
			byCounterparty.set(counterpartyId, {
				counterpartyId,
				counterpartyHandle,
				counterpartyDisplayName,
				lastBody: row.body,
				lastAt: row.created_at,
				unreadCount: isUnreadForViewer ? 1 : 0
			});
			continue;
		}

		if (isUnreadForViewer) {
			existing.unreadCount += 1;
		}
		// Keep the most recent message as the conversation preview.
		if (row.created_at > existing.lastAt) {
			existing.lastBody = row.body;
			existing.lastAt = row.created_at;
		}
	}

	const summaries = [...byCounterparty.values()];
	summaries.sort((a, b) => {
		if (a.lastAt !== b.lastAt) {
			return a.lastAt < b.lastAt ? 1 : -1; // latest DESC
		}
		return a.counterpartyHandle < b.counterpartyHandle
			? -1
			: a.counterpartyHandle > b.counterpartyHandle
				? 1
				: 0; // handle ASC tiebreak
	});

	return summaries;
}
