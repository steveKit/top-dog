-- TASK-051 — Direct messages
--
-- Member-to-member private messages. A FLAT table: there is no separate
-- conversations/threads table — a "thread" is DERIVED at read time by grouping on
-- the counterparty pair (sender_id, recipient_id) for the viewer. The inbox is
-- the viewer's distinct counterparties with the latest message + unread count,
-- aggregated by a PURE helper (summarizeConversations), not a denormalized DB
-- column.
--
-- Unlike walls/reactions/sprays (public/cosmetic surfaces), DMs are a PRIVACY
-- surface: the load-bearing control is the SELECT policy — ONLY the sender or the
-- recipient may read a row, so a third party can never read others' DMs. Still a
-- PLAIN owner-scoped RLS write (NOT a SECURITY DEFINER RPC): there is no
-- server-maintained denormalized counter to protect, so mark-read is a single
-- recipient-scoped UPDATE and send is a plain INSERT — the inverse of the
-- consuming-writes-via-RPC convention (see the CLAUDE.md cosmetic-table gotcha).
--
-- Column-level write lockdown (decision #24's MECHANISM, reused here to restrict
-- WHICH columns each actor may write — NOT a new architecture decision, and
-- read_at is recipient-maintained, not a server-maintained denormalized counter):
--   * UPDATE exposes ONLY read_at. Without this, the recipient's row-level UPDATE
--     policy would let them rewrite the SENDER's body — an integrity hole. We
--     revoke table-wide UPDATE then re-grant update (read_at) only.
--   * INSERT exposes only the safe columns (sender_id, recipient_id, body) so a
--     sender cannot pre-forge read_at/created_at; those fall to DEFAULTs.
--
-- Body storage: we store the ORIGINAL message body VERBATIM. The future M6 emoji
-- library applies a RENDER-time filter (like mustard decay and reactions) — never
-- persist filtered/transformed text. The DB keeps only a length sanity CHECK as an
-- abuse backstop; app-boundary validation (non-empty after trim, within bound) is
-- authoritative.
--
-- Gotcha (M0 lesson): schema-qualify all extension-provided functions/types
-- (extensions.gen_random_uuid()) — the hosted migration role lacks `extensions`
-- in its search_path, so an unqualified reference passes local `db reset` but
-- fails hosted `db push`.

-- ---------------------------------------------------------------------------
-- dms
-- ---------------------------------------------------------------------------
-- One row per message. Both FKs cascade from profiles (which cascades from
-- auth.users), so deleting a member removes the messages they SENT as well as the
-- messages they RECEIVED. A self-DM is disallowed by CHECK (sender <> recipient).

create table public.dms (
  id           uuid        primary key default extensions.gen_random_uuid(),
  sender_id    uuid        not null references public.profiles (id) on delete cascade,
  recipient_id uuid        not null references public.profiles (id) on delete cascade,
  -- The ORIGINAL message body, stored verbatim. M6 applies a render-time emoji
  -- filter; never persist the filtered/transformed text. The app boundary
  -- (sendDm) validates non-empty-after-trim authoritatively; this CHECK is the DB
  -- length backstop (1000 chars, consistent with wall_messages).
  body         text        not null,
  created_at   timestamptz not null default now(),
  -- NULL until the RECIPIENT reads the message; set by the recipient's UPDATE
  -- (mark-as-read). Never set by the sender (INSERT cannot write it).
  read_at      timestamptz,
  constraint dms_body_length check (char_length(body) <= 1000),
  constraint dms_no_self check (sender_id <> recipient_id)
);

comment on table public.dms is
  'One row per direct message between two members. Flat table — a "thread" is '
  'DERIVED by grouping on the counterparty pair, no conversations table. PRIVACY '
  'surface: the SELECT policy (sender OR recipient only) is the load-bearing '
  'control. Plain owner-scoped RLS write (NOT an RPC): INSERT pins sender_id to '
  'auth.uid(); the recipient marks read via a read_at-only UPDATE. Column-grant '
  'lockdown (decision #24 mechanism) confines INSERT to (sender_id, recipient_id, '
  'body) and UPDATE to (read_at). Stores the ORIGINAL body verbatim; M6 applies a '
  'RENDER-time emoji filter, never persisted. No DELETE — DMs persist.';
comment on column public.dms.sender_id is
  'The member who sent the message. Pinned to auth.uid() by the INSERT policy so a '
  'sender cannot forge another sender. Cascades from auth.users.';
comment on column public.dms.recipient_id is
  'The member the message is addressed to. Unrestricted at INSERT (you DM other '
  'members); a self-DM is blocked by the dms_no_self CHECK. Cascades from auth.users.';
comment on column public.dms.body is
  'The ORIGINAL message body, stored verbatim. M6 applies a render-time emoji '
  'filter; never persist the filtered output. DB keeps only a length sanity CHECK.';
comment on column public.dms.created_at is
  'When the message was sent. Threads render oldest-first (created_at asc).';
comment on column public.dms.read_at is
  'When the RECIPIENT read the message; NULL while unread. Set only by the '
  'recipient via a read_at-only UPDATE; the sender cannot write it (INSERT grant '
  'omits it, so it falls to the NULL default).';

-- The inbox query reads the viewer's received messages newest-first to find
-- counterparties + unread counts; this index supports the recipient-side read.
create index dms_recipient_created_idx on public.dms (recipient_id, created_at desc);

-- The thread query reads all messages between two members (both directions, via
-- an .or filter). A composite index on the conversation pair supports the
-- sender-side lookups; combined with the recipient index above it covers the
-- thread and inbox reads.
create index dms_sender_recipient_idx on public.dms (sender_id, recipient_id);

-- ---------------------------------------------------------------------------
-- dms RLS
-- ---------------------------------------------------------------------------
-- Default-deny: enabling RLS with no policy blocks all access; we add explicit
-- SELECT / INSERT / UPDATE policies only (NO DELETE — DMs persist). Uses the
-- (select auth.uid()) subselect idiom so the planner caches it as an initplan
-- (Supabase RLS perf pattern). Plain owner-scoped client writes (no RPC) because
-- there is no server-maintained counter to protect.

alter table public.dms enable row level security;

-- Read: ONLY the sender or the recipient may read a message. This is the critical
-- PRIVACY guarantee — a third party must never read others' DMs.
create policy "dms_select_sender_or_recipient"
  on public.dms
  for select
  to authenticated
  using (
    sender_id = (select auth.uid())
    or recipient_id = (select auth.uid())
  );

-- Insert: a member may send to ANY member, but sender_id is pinned to auth.uid()
-- so a sender cannot impersonate another member. recipient_id is unrestricted —
-- that is the point: you DM other members (self-DM blocked by the CHECK).
create policy "dms_insert_own_sender"
  on public.dms
  for insert
  to authenticated
  with check (sender_id = (select auth.uid()));

-- Update: only the RECIPIENT may update (to mark read). Both USING and WITH CHECK
-- pin recipient_id = auth.uid() so a non-recipient cannot touch the row and the
-- recipient cannot reassign it. The column grant below additionally confines the
-- writable columns to read_at, so this UPDATE can ONLY mark-read — it cannot
-- rewrite the sender's body.
create policy "dms_update_recipient_read"
  on public.dms
  for update
  to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

-- No DELETE policy: DMs persist (default-deny covers DELETE).

-- ---------------------------------------------------------------------------
-- Column-level write lockdown (decision #24 mechanism)
-- ---------------------------------------------------------------------------
-- RLS gates ROWS, not COLUMNS. The row-level policies above are necessary but not
-- sufficient: without column grants, the recipient's UPDATE policy would let them
-- rewrite the SENDER's body, and a sender could pre-forge read_at/created_at on
-- INSERT. We revoke the table-wide write privileges and re-grant only the safe
-- columns for each path.

-- INSERT: only sender_id, recipient_id, body. read_at and created_at fall to
-- their DEFAULTs (NULL and now()), so a direct PostgREST insert cannot forge an
-- already-read or back-dated message. (id defaults via gen_random_uuid().)
revoke insert on public.dms from authenticated;
grant insert (sender_id, recipient_id, body) on public.dms to authenticated;

-- UPDATE: only read_at. This is the load-bearing column lock — it confines the
-- recipient's mark-read UPDATE to read_at so it can never rewrite the sender's
-- body (or any other column).
revoke update on public.dms from authenticated;
grant update (read_at) on public.dms to authenticated;
