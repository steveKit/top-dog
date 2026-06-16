-- TASK-042 — Mustard prune job: daily delete of fully-faded sprays (>24h)
--
-- Realizes the bound on mustard_sprays growth (adversarial finding C). A mustard
-- spray fully fades 24h after it lands (MUSTARD_LIFESPAN_MS in
-- src/lib/features/mustard/decay.ts; decision #15: opacity decays linearly over
-- 24h, computed at RENDER time). Once a spray is >24h old its render-time opacity
-- is clamped to 0 — it is invisible — so deleting it is purely a cleanup that
-- bounds table growth and changes nothing the UI shows.
--
-- This is the SOLE DELETE path for mustard_sprays. The TASK-041 table has NO
-- client UPDATE/DELETE policy (sprays are immutable + persistent — decision #15);
-- default-deny blocks every client write except the gated INSERT. This
-- SECURITY DEFINER function runs as the table owner and bypasses RLS to DELETE,
-- exactly as tally_top_dog_day() is the sole writer of top_dog_days.
--
-- Anon-callable + idempotent (decision #26 / the same shape as tally_top_dog_day):
-- the function takes NO caller input (pronargs = 0) and only ever deletes rows
-- that are provably >24h old. It is therefore:
--   - idempotent — a second call the same minute deletes 0 more rows;
--   - not forgeable — a caller cannot direct it to delete a specific or fresh
--     spray; it deletes exactly the expired set, the same set the cron targets;
--   - self-limiting — worst case (an early/extra call) deletes already-expired,
--     opacity-0, invisible rows, which is precisely what the daily cron does.
-- That is what makes it safe to EXECUTE-grant to anon: the keep-alive workflow
-- calls it via PostgREST with the existing publishable (anon) key — no new repo
-- secret (decision #26).
--
-- Returns the number of rows pruned (integer) rather than void — more testable
-- and gives the workflow a useful signal.
--
-- Gotcha (M0 lesson): schema-qualify all references (public.mustard_sprays) —
-- the hosted migration role lacks `extensions`/`public` in its search_path, so an
-- unqualified reference passes local `db reset` but fails hosted `db push`.

-- ---------------------------------------------------------------------------
-- sprayed_at index — support the prune range scan
-- ---------------------------------------------------------------------------
-- The prune predicate filters on sprayed_at (< now() - 24h). The table is
-- bounded by this very job, but sprays accumulate between daily runs (a Top Dog
-- can spray many profiles in a day), so a btree on sprayed_at lets the daily
-- DELETE range-scan only the expired tail instead of seq-scanning the whole
-- table. Cheap insurance; harmless on a small table.
create index mustard_sprays_sprayed_at_idx
  on public.mustard_sprays (sprayed_at);

-- ---------------------------------------------------------------------------
-- prune_mustard_sprays() RPC — delete fully-faded sprays (>24h), idempotent
-- ---------------------------------------------------------------------------
create function public.prune_mustard_sprays()
  returns integer
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  pruned integer;
begin
  with deleted as (
    delete from public.mustard_sprays
     where sprayed_at < now() - interval '24 hours'
    returning 1
  )
  select count(*) into pruned from deleted;

  return pruned;
end;
$$;

comment on function public.prune_mustard_sprays() is
  'Deletes fully-faded mustard sprays (sprayed_at older than 24h) and returns the '
  'number of rows pruned. SOLE DELETE path for mustard_sprays — the table has no '
  'client UPDATE/DELETE policy (sprays are immutable + persistent, decision #15); '
  'this SECURITY DEFINER function bypasses RLS to reap expired rows, exactly as '
  'tally_top_dog_day() is the sole writer of top_dog_days. Takes NO caller input '
  '(pronargs = 0): it only ever deletes rows provably >24h old (already opacity-0 / '
  'invisible per mustardOpacity), so it is idempotent (a re-run prunes 0), not '
  'forgeable, and self-limiting. That is why it is anon-callable (decision #26): '
  'the keep-alive workflow calls it with the existing publishable (anon) key — no '
  'new repo secret. Run daily by the keep-alive workflow.';

-- EXECUTE grant (decision #26 — anon-callable, no new secret): the keep-alive
-- workflow calls this RPC with the existing publishable (anon) key, so anon and
-- authenticated may execute it. Safe because the RPC takes NO caller input and
-- only ever deletes provably-expired rows — repeated/early calls are idempotent
-- and self-limiting; a caller cannot forge a deletion of an arbitrary or fresh
-- spray. Keep the grant explicit (anon + authenticated only): as with the tally
-- and vote RPCs, `revoke ... from public` alone is INEFFECTIVE on Supabase (new
-- public functions get an explicit anon/authenticated grant a PUBLIC-only revoke
-- does not strip), so revoke from public first, then grant the two roles.
revoke execute on function public.prune_mustard_sprays() from public;
grant execute on function public.prune_mustard_sprays() to anon, authenticated;
