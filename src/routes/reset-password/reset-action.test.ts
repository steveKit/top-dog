import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isActionFailure } from '@sveltejs/kit';
import { actions, load } from './+page.server';

// Test-after coverage for the public reset-password action. The action is
// exercised with a fake `event` exposing `locals.supabase.auth.verifyOtp` +
// `locals.supabase.auth.updateUser` and a `request.formData()`.
//
// OTP recovery handshake under test:
//   verifyOtp({ email, token, type: 'recovery' }) -> updateUser({ password })
//
// Invariants:
//   - the happy path validates the code, verifies the OTP, THEN updates the
//     password, and returns { success: true }
//   - a non-6-digit / blank code fails(400) BEFORE any auth call
//   - a short (< 8) new password fails(400) before any auth call
//   - a confirm-mismatch fails(400) before any auth call
//   - a wrong/expired code (verifyOtp error) returns a friendly fail and never
//     calls updateUser (the recovery session is the gate for updateUser)
//   - an updateUser error returns a friendly fail
//   - the password exactly at the 8-char minimum is accepted

const reset = actions.default;

const GOOD_FIELDS = {
	email: 'chef@topdog.test',
	code: '123456',
	password: 'hunter2hunter2',
	confirmPassword: 'hunter2hunter2'
};

/**
 * Builds a fake reset-password event. `request.formData()` resolves a FormData
 * from the supplied fields; `verifyOtp` resolves `verifyResult` (default:
 * success) and `updateUser` resolves `updateResult` (default: success). Spies
 * are exposed for call-order / payload assertions.
 */
function makeEvent(opts: {
	fields: Record<string, string>;
	verifyResult?: { data: unknown; error: unknown };
	updateResult?: { data: unknown; error: unknown };
}) {
	const formData = new FormData();
	for (const [k, v] of Object.entries(opts.fields)) {
		formData.set(k, v);
	}

	const verifyOtp = vi
		.fn()
		.mockResolvedValue(opts.verifyResult ?? { data: { session: {} }, error: null });
	const updateUser = vi
		.fn()
		.mockResolvedValue(opts.updateResult ?? { data: { user: {} }, error: null });

	const event = {
		request: { formData: vi.fn().mockResolvedValue(formData) },
		locals: { supabase: { auth: { verifyOtp, updateUser } } }
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;

	return { event, verifyOtp, updateUser };
}

describe('reset-password load', () => {
	it('surfaces the email from the ?email= query param so the field pre-fills', async () => {
		const result = await load({
			url: new URL('https://x/reset-password?email=chef%40topdog.test')
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any);
		expect(result).toEqual({ email: 'chef@topdog.test' });
	});

	it('defaults to an empty email when none is supplied', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await load({ url: new URL('https://x/reset-password') } as any);
		expect(result).toEqual({ email: '' });
	});
});

describe('reset-password action — happy path', () => {
	beforeEach(() => vi.clearAllMocks());

	it('verifies the OTP code then updates the password, then returns success', async () => {
		const { event, verifyOtp, updateUser } = makeEvent({ fields: GOOD_FIELDS });

		const result = await reset(event);

		expect(verifyOtp).toHaveBeenCalledWith({
			email: 'chef@topdog.test',
			token: '123456',
			type: 'recovery'
		});
		expect(updateUser).toHaveBeenCalledWith({ password: 'hunter2hunter2' });
		// verify happens before update — the recovery session must exist first.
		expect(verifyOtp.mock.invocationCallOrder[0]).toBeLessThan(
			updateUser.mock.invocationCallOrder[0]
		);
		expect(isActionFailure(result)).toBe(false);
		expect(result).toEqual({ success: true });
	});

	it('accepts a new password exactly at the 8-char minimum boundary', async () => {
		const { event, updateUser } = makeEvent({
			fields: { ...GOOD_FIELDS, password: '12345678', confirmPassword: '12345678' }
		});

		const result = await reset(event);

		expect(updateUser).toHaveBeenCalledWith({ password: '12345678' });
		expect(isActionFailure(result)).toBe(false);
	});
});

describe('reset-password action — input validation', () => {
	beforeEach(() => vi.clearAllMocks());

	it('rejects a blank code before any auth call', async () => {
		const { event, verifyOtp, updateUser } = makeEvent({ fields: { ...GOOD_FIELDS, code: '' } });

		const result = await reset(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect((result as { data: { error: string } }).data.error).toMatch(/6-digit/i);
		expect(verifyOtp).not.toHaveBeenCalled();
		expect(updateUser).not.toHaveBeenCalled();
	});

	it('rejects a non-6-digit code before any auth call', async () => {
		const { event, verifyOtp } = makeEvent({ fields: { ...GOOD_FIELDS, code: '12ab' } });

		const result = await reset(event);

		expect(isActionFailure(result)).toBe(true);
		expect(verifyOtp).not.toHaveBeenCalled();
	});

	it('rejects a short (< 8) new password before any auth call', async () => {
		const { event, verifyOtp, updateUser } = makeEvent({
			fields: { ...GOOD_FIELDS, password: 'short', confirmPassword: 'short' }
		});

		const result = await reset(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect((result as { data: { error: string } }).data.error).toMatch(/at least 8 characters/i);
		expect(verifyOtp).not.toHaveBeenCalled();
		expect(updateUser).not.toHaveBeenCalled();
	});

	it('rejects a confirm-mismatch before any auth call', async () => {
		const { event, verifyOtp, updateUser } = makeEvent({
			fields: { ...GOOD_FIELDS, confirmPassword: 'different-but-long' }
		});

		const result = await reset(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect((result as { data: { error: string } }).data.error).toMatch(/do not match/i);
		expect(verifyOtp).not.toHaveBeenCalled();
		expect(updateUser).not.toHaveBeenCalled();
	});

	it('echoes email + code on a validation failure so the form repopulates', async () => {
		const { event } = makeEvent({
			fields: { ...GOOD_FIELDS, password: 'short', confirmPassword: 'short' }
		});

		const result = await reset(event);
		const data = (result as { data: { email: string; code: string } }).data;

		expect(data.email).toBe('chef@topdog.test');
		expect(data.code).toBe('123456');
	});
});

describe('reset-password action — wrong/expired code', () => {
	beforeEach(() => vi.clearAllMocks());

	it('returns a friendly fail and never updates the password when verifyOtp errors', async () => {
		const { event, updateUser } = makeEvent({
			fields: GOOD_FIELDS,
			verifyResult: { data: null, error: { message: 'Token has expired or is invalid' } }
		});

		const result = await reset(event);

		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect((result as { data: { error: string } }).data.error).toMatch(/invalid or has expired/i);
		// The recovery session never opened, so updateUser must NOT run.
		expect(updateUser).not.toHaveBeenCalled();
	});

	it('does not leak the raw Supabase error message to the client', async () => {
		const { event } = makeEvent({
			fields: GOOD_FIELDS,
			verifyResult: { data: null, error: { message: 'Token has expired or is invalid' } }
		});

		const result = await reset(event);
		const message = (result as { data: { error: string } }).data.error;

		expect(message).not.toMatch(/Token has expired or is invalid/);
	});
});

describe('reset-password action — updateUser failure', () => {
	beforeEach(() => vi.clearAllMocks());

	it('returns a friendly fail when updateUser errors after a valid code', async () => {
		const { event, verifyOtp } = makeEvent({
			fields: GOOD_FIELDS,
			updateResult: { data: null, error: { message: 'password too weak per policy' } }
		});

		const result = await reset(event);

		expect(verifyOtp).toHaveBeenCalledOnce();
		expect(isActionFailure(result)).toBe(true);
		expect((result as { status: number }).status).toBe(400);
		expect((result as { data: { error: string } }).data.error).toMatch(/could not update/i);
		expect((result as { data: { error: string } }).data.error).not.toMatch(/too weak/);
	});
});
