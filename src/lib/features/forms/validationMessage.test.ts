import { describe, it, expect } from 'vitest';

import { classifyFailure, validationMessage, type FieldFailure } from './validationMessage';

// TASK (M8 themed form validation): the PURE message layer maps a field's human
// label + which native constraint failed to a themed, FIELD-NAMING message in the
// cult voice. These tests pin the marquee special-cases (Mustard Address email,
// the eight-mark Seal) and the generic, label-naming fallbacks. The tester will
// expand coverage + add the submit-time E2E.

describe('classifyFailure', () => {
	it('reports valueMissing first when an empty required field is present', () => {
		// An empty required field can report other flags too; "you left it blank"
		// wins so the user sees the actionable message.
		expect(classifyFailure({ valueMissing: true, typeMismatch: true })).toBe('valueMissing');
	});

	it('maps each native validity flag to its failure', () => {
		expect(classifyFailure({ typeMismatch: true })).toBe('typeMismatch');
		expect(classifyFailure({ tooShort: true })).toBe('tooShort');
		expect(classifyFailure({ patternMismatch: true })).toBe('patternMismatch');
		expect(classifyFailure({ tooLong: true })).toBe('tooLong');
	});

	it('orders the remaining flags typeMismatch > tooShort > patternMismatch > tooLong', () => {
		// Precedence when several non-valueMissing flags are set at once: the
		// classifier returns the first in declared order so the message is stable.
		expect(classifyFailure({ typeMismatch: true, tooShort: true, patternMismatch: true })).toBe(
			'typeMismatch'
		);
		expect(classifyFailure({ tooShort: true, patternMismatch: true, tooLong: true })).toBe(
			'tooShort'
		);
		expect(classifyFailure({ patternMismatch: true, tooLong: true })).toBe('patternMismatch');
	});

	it('treats valueMissing as highest priority over every other flag', () => {
		expect(
			classifyFailure({
				valueMissing: true,
				typeMismatch: true,
				tooShort: true,
				patternMismatch: true,
				tooLong: true
			})
		).toBe('valueMissing');
	});

	it('falls back to "other" when no known flag is set', () => {
		expect(classifyFailure({})).toBe('other');
		// An all-false ValidityState (every constraint passes) is still "other" —
		// classifyFailure never returns a failure for a valid control.
		expect(
			classifyFailure({
				valueMissing: false,
				typeMismatch: false,
				tooShort: false,
				patternMismatch: false,
				tooLong: false
			})
		).toBe('other');
	});
});

describe('validationMessage', () => {
	it('names the email field in the cult voice when empty', () => {
		expect(validationMessage({ label: 'Mustard Address', failure: 'valueMissing' })).toBe(
			'Speak thy Mustard Address.'
		);
	});

	it('uses the Seal voice when a required Seal is empty', () => {
		expect(validationMessage({ label: 'Seal', failure: 'valueMissing' })).toBe(
			'A Seal is required to pass.'
		);
		expect(validationMessage({ label: 'New Seal', failure: 'valueMissing' })).toBe(
			'A Seal is required to pass.'
		);
	});

	it('rejects a malformed mustard-address', () => {
		expect(validationMessage({ label: 'Mustard Address', failure: 'typeMismatch' })).toBe(
			'That is no Mustard Address.'
		);
	});

	it('uses the Seal voice for the third Seal label variant when empty', () => {
		// SEAL_LABELS also covers the sign-up confirm field; pin it so a future
		// label rename doesn't silently drop the Seal special-case.
		expect(validationMessage({ label: 'Confirm the Seal', failure: 'valueMissing' })).toBe(
			'A Seal is required to pass.'
		);
	});

	it('matches the email/Seal special-cases case-insensitively and trimmed', () => {
		// fieldLabel passes the visible label verbatim; the module lowercases +
		// trims so casing/whitespace from the markup can't defeat the special-case.
		expect(validationMessage({ label: '  MUSTARD ADDRESS  ', failure: 'valueMissing' })).toBe(
			'Speak thy Mustard Address.'
		);
		expect(validationMessage({ label: ' seal ', failure: 'valueMissing' })).toBe(
			'A Seal is required to pass.'
		);
	});

	it('produces a generic typeMismatch message naming a non-email field', () => {
		expect(validationMessage({ label: 'Recovery Code', failure: 'typeMismatch' })).toBe(
			'That is no proper Recovery Code.'
		);
	});

	it('names the minimum marks when the Seal is too short', () => {
		expect(validationMessage({ label: 'New Seal', failure: 'tooShort', minLength: 8 })).toBe(
			'Thy Seal must be at least 8 marks.'
		);
	});

	it('defaults the Seal minimum to 8 marks when no minLength is given', () => {
		expect(validationMessage({ label: 'Seal', failure: 'tooShort' })).toBe(
			'Thy Seal must be at least 8 marks.'
		);
	});

	it('names a generic required field by its label', () => {
		expect(validationMessage({ label: 'Invite token', failure: 'valueMissing' })).toBe(
			'Speak thy Invite token.'
		);
	});

	it('names a generic too-short field with its minimum', () => {
		expect(validationMessage({ label: 'Recovery Code', failure: 'tooShort', minLength: 6 })).toBe(
			'Thy Recovery Code must be at least 6 marks.'
		);
	});

	it('falls back to a min-less too-short message for a generic field', () => {
		// Without a minLength on a non-Seal field there is no number to name, so the
		// message degrades to the bare "too short" form (no "at least N marks").
		expect(validationMessage({ label: 'Recovery Code', failure: 'tooShort' })).toBe(
			'Thy Recovery Code is too short.'
		);
	});

	it('names the Seal minimum from the supplied minLength rather than the default', () => {
		// The Seal default is 8, but an explicit minLength must win so the message
		// tracks the field's real constraint.
		expect(validationMessage({ label: 'Seal', failure: 'tooShort', minLength: 12 })).toBe(
			'Thy Seal must be at least 12 marks.'
		);
	});

	it('produces a themed too-long message naming the field', () => {
		expect(validationMessage({ label: 'Recovery Code', failure: 'tooLong' })).toBe(
			'Thy Recovery Code runs too long.'
		);
	});

	it('produces a themed pattern-mismatch message naming the field', () => {
		expect(validationMessage({ label: 'Recovery Code', failure: 'patternMismatch' })).toBe(
			'That is no proper Recovery Code.'
		);
	});

	it('has a themed fallback for unknown failures', () => {
		const failure: FieldFailure = 'other';
		expect(validationMessage({ label: 'Invite token', failure })).toBe(
			'The Order cannot accept thy Invite token.'
		);
	});
});
