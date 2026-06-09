// Server-side invite wrappers. These run on the server (form actions / load
// functions) and take an RLS-scoped SupabaseClient *passed in* — never a
// client-side secret key. They return typed discriminated results rather than
// throwing, mirroring the storage module's StorageResult convention; callers
// branch on `ok`. Supabase errors are surfaced to the caller (which logs
// context server-side and shows a friendly message via fail()).

import type { SupabaseClient } from '@supabase/supabase-js';
import { generateInviteToken } from './token';

/** Discriminated result for invite operations. */
export type InviteResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface CreatedInvite {
	id: string;
	token: string;
}

/**
 * Mints a single-use invite for the given inviter. The caller must pass an
 * authenticated, RLS-scoped client and the validated inviter id (auth.uid()):
 * the `invites_insert_own` policy enforces `auth.uid() = inviter_id`, so this
 * cannot forge an invite for another user.
 *
 * Returns the new invite id and token on success.
 */
export async function createInvite(
	supabase: SupabaseClient,
	inviterId: string
): Promise<InviteResult<CreatedInvite>> {
	const token = generateInviteToken();

	const { data, error } = await supabase
		.from('invites')
		.insert({ inviter_id: inviterId, token })
		.select('id, token')
		.single();

	if (error || !data) {
		return { ok: false, error: error?.message ?? 'Failed to create invite.' };
	}

	return { ok: true, data: { id: data.id as string, token: data.token as string } };
}

/**
 * Best-effort pre-check that an invite token exists and is unspent, via the
 * read-only `invite_is_redeemable` SECURITY DEFINER RPC. Used BEFORE signUp to
 * reject an invalid/used token without creating an orphaned auth user — it is
 * NOT the single-use guard (a concurrent redemption can still win the race after
 * this returns true; `redeemInvite` remains authoritative).
 *
 * Returns the boolean redeemability on success; `ok: false` when the RPC errors.
 */
export async function isInviteRedeemable(
	supabase: SupabaseClient,
	token: string
): Promise<InviteResult<boolean>> {
	const { data, error } = await supabase.rpc('invite_is_redeemable', {
		invite_token: token
	});

	if (error) {
		return { ok: false, error: error.message };
	}

	return { ok: true, data: data === true };
}

/**
 * Consumes a single-use invite token for the freshly signed-up redeemer via the
 * `redeem_invite` SECURITY DEFINER RPC. Single-use is enforced atomically in the
 * function (the `consumed_at IS NULL` guard): a NULL return means the token was
 * invalid or already spent.
 *
 * Returns the consumed invite id on success; `ok: false` when the token is
 * invalid/used or the RPC errors.
 */
export async function redeemInvite(
	supabase: SupabaseClient,
	token: string,
	redeemerId: string
): Promise<InviteResult<string>> {
	const { data, error } = await supabase.rpc('redeem_invite', {
		invite_token: token,
		redeemer_id: redeemerId
	});

	if (error) {
		return { ok: false, error: error.message };
	}

	// The RPC returns the invite id (uuid) on success, or NULL for an invalid or
	// already-used token.
	if (!data) {
		return { ok: false, error: 'This invite link is invalid or has already been used.' };
	}

	return { ok: true, data: data as string };
}
