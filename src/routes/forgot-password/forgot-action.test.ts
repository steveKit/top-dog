import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isActionFailure } from '@sveltejs/kit';
import { actions } from './+page.server';

// Test-after coverage for the public forgot-password request action. The action
// is exercised with a fake `event` exposing `locals.supabase.auth
// .resetPasswordForEmail` and a `request.formData()`.
//
// Invariants under test:
//   - a valid email returns a NEUTRAL success message and calls
//     resetPasswordForEmail with that email
//   - a non-existent / errored email returns the SAME neutral success message
//     (no account enumeration) — the action must NOT surface the Supabase error
//   - a blank / malformed email fails(400) at the boundary BEFORE any call
//   - the success payload echoes the email so /reset-password can pre-fill it

const forgot = actions.default;

/**
 * Builds a fake forgot-password event. `request.formData()` resolves a FormData
 * from the supplied fields; `supabase.auth.resetPasswordForEmail` resolves
 * `resetResult` (default: success). The spy is exposed for call assertions.
 */
function makeEvent(opts: {
	fields: Record<string, string>;
	resetResult?: { data: unknown; error: unknown };
}) {
	const formData = new FormData();
	for (const [k, v] of Object.entries(opts.fields)) {
		formData.set(k, v);
	}

	const resetPasswordForEmail = vi
		.fn()
		.mockResolvedValue(opts.resetResult ?? { data: {}, error: null });

	const event = {
		request: { formData: vi.fn().mockResolvedValue(formData) },
		locals: { supabase: { auth: { resetPasswordForEmail } } }
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;

	return { event, resetPasswordForEmail };
}

describe('forgot-password action — neutral success', () => {
	beforeEach(() => vi.clearAllMocks());

	it('calls resetPasswordForEmail and returns a neutral success for a valid email', async () => {
		const { event, resetPasswordForEmail } = makeEvent({
			fields: { email: 'chef@topdog.test' }
		});

		const result = await forgot(event);

		expect(resetPasswordForEmail).toHaveBeenCalledWith('chef@topdog.test');
		expect(isActionFailure(result)).toBe(false);
		expect(result).toMatchObject({ success: true, email: 'chef@topdog.test' });
		expect((result as { message: string }).message).toMatch(/recovery code is on its way/i);
	});

	it('returns the SAME neutral success when resetPasswordForEmail errors (no enumeration)', async () => {
		const { event } = makeEvent({
			fields: { email: 'ghost@topdog.test' },
			resetResult: { data: null, error: { message: 'user not found' } }
		});

		const result = await forgot(event);

		// Identical neutral response — the error is swallowed (logged server-side only).
		expect(isActionFailure(result)).toBe(false);
		expect(result).toMatchObject({ success: true, email: 'ghost@topdog.test' });
		expect((result as { message: string }).message).toMatch(/recovery code is on its way/i);
	});

	it('trims surrounding whitespace from the email before sending', async () => {
		const { event, resetPasswordForEmail } = makeEvent({
			fields: { email: '  spaced@topdog.test  ' }
		});

		await forgot(event);

		expect(resetPasswordForEmail).toHaveBeenCalledWith('spaced@topdog.test');
	});
});

describe('forgot-password action — email validation', () => {
	beforeEach(() => vi.clearAllMocks());

	it('rejects a blank email before calling resetPasswordForEmail', async () => {
		const { event, resetPasswordForEmail } = makeEvent({ fields: { email: '' } });

		const result = await forgot(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect((result as { data: { error: string } }).data.error).toMatch(/valid email/i);
		expect(resetPasswordForEmail).not.toHaveBeenCalled();
	});

	it('rejects a malformed email before calling resetPasswordForEmail', async () => {
		const { event, resetPasswordForEmail } = makeEvent({ fields: { email: 'not-an-email' } });

		const result = await forgot(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect(resetPasswordForEmail).not.toHaveBeenCalled();
	});

	it('echoes the email on a validation failure so the field repopulates', async () => {
		const { event } = makeEvent({ fields: { email: 'bad@' } });

		const result = await forgot(event);

		expect((result as { data: { email: string } }).data.email).toBe('bad@');
	});
});
