-- Restore the base Data API table grants that auto_expose_new_tables used to
-- issue implicitly before its 2026-05-30 default flip. RLS policies and the
-- decision #24/#25 column-grant lockdowns are unchanged; this migration only
-- restores the BASE table privileges PostgREST needs in addition to a passing
-- RLS policy. anon is granted NOTHING (pre-auth role); its only access is via
-- RPC EXECUTE grants (already in place) and the keep-alive profiles ping, which
-- reads zero rows under the authenticated-only SELECT policy.
--
-- service_role bypasses RLS by design (BYPASSRLS) and backs both the app's
-- privileged server ops and the entire E2E harness; it gets table-wide DML,
-- matching what auto-expose used to grant it.

-- ---- authenticated: base SELECT on every table (RLS still gates rows) -------
grant select on public.invites           to authenticated;
grant select on public.profiles          to authenticated;
grant select on public.hot_dogs          to authenticated;
grant select on public.votes             to authenticated;
grant select on public.top_dog_days      to authenticated;
grant select on public.hotdog_reactions  to authenticated;
grant select on public.mustard_sprays    to authenticated;
grant select on public.wall_messages     to authenticated;
grant select on public.dms               to authenticated;

-- ---- authenticated: writes on tables WITHOUT a column lockdown --------------
-- invites: RLS invites_insert_own gates the row; no server-maintained column.
grant insert on public.invites to authenticated;
-- hotdog_reactions: owner-scoped insert/delete toggle (decision #12). No UPDATE.
grant insert, delete on public.hotdog_reactions to authenticated;
-- mustard_sprays: Top-Dog-gated insert (decision #15/#25). No UPDATE/DELETE
-- (prune is an RPC); do NOT grant them.
grant insert on public.mustard_sprays to authenticated;
-- wall_messages: owner-scoped insert + author/owner delete (decision #12). No UPDATE.
grant insert, delete on public.wall_messages to authenticated;

-- ---- authenticated: tables that are RPC-write-only get SELECT ONLY ----------
-- votes, top_dog_days: NO INSERT/UPDATE/DELETE grant — writes are exclusively
-- via SECURITY DEFINER RPCs (decision #12). SELECT was granted above.

-- ---- authenticated: row-level DELETE where the table has a column lockdown ---
-- hot_dogs INSERT(cols)/UPDATE(caption) survive from 20260609181013; the app
-- also deletes its own dogs (hot_dogs_delete_own RLS). DELETE is row-level, not
-- column-scoped, so it does not weaken the counter lockdown. profiles and dms
-- have NO client DELETE path — omit them.
grant delete on public.hot_dogs to authenticated;

-- ---- service_role: table-wide DML on every project table --------------------
grant select, insert, update, delete on public.invites          to service_role;
grant select, insert, update, delete on public.profiles         to service_role;
grant select, insert, update, delete on public.hot_dogs         to service_role;
grant select, insert, update, delete on public.votes            to service_role;
grant select, insert, update, delete on public.top_dog_days     to service_role;
grant select, insert, update, delete on public.hotdog_reactions to service_role;
grant select, insert, update, delete on public.mustard_sprays   to service_role;
grant select, insert, update, delete on public.wall_messages    to service_role;
grant select, insert, update, delete on public.dms              to service_role;
